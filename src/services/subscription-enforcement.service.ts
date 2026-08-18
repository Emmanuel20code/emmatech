import {
    TenantSubscription,
    SubscriptionPlan,
    TrialAgreement,
    FeatureViolationLog,
    Tenant,
    Router,
    Subscriber,
    Campaign,
    AdminUser,
    AuditLog,
    SaaSInvoice
} from '../models';
import logger from '../utils/logger';
import crypto from 'crypto';
import { Op } from 'sequelize';

export interface TrialRegistrationInput {
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    businessLocation: string;
    expectedSubscriberCount: number;
    expectedRouterCount: number;
    termsAccepted: boolean;
    trialAgreementAccepted: boolean;
    requestIp: string;
    userAgent: string;
    trialDays?: number;
}

export interface SuperAdminOverrideParams {
    action: 'EXTEND_TRIAL' | 'FORCE_ACTIVATE' | 'FORCE_SUSPEND' | 'GRANT_CREDITS' | 'OVERRIDE_RESTRICTIONS';
    extendDays?: number;
    notes?: string;
    overrideFeatures?: string[];
    actorId?: string;
}

export class SubscriptionEnforcementService {
    public static DEFAULT_TRIAL_DAYS = 14;
    public static DEFAULT_GRACE_DAYS = 7;

    /**
     * 1. Register Free Trial with Legally Binding Digital Agreement
     */
    public static async registerTrialWithAgreement(input: TrialRegistrationInput): Promise<{
        tenant: Tenant;
        subscription: TenantSubscription;
        agreement: TrialAgreement;
    }> {
        const {
            businessName, ownerName, phone, email, businessLocation,
            expectedSubscriberCount, expectedRouterCount, termsAccepted,
            trialAgreementAccepted, requestIp, userAgent, trialDays
        } = input;

        if (!termsAccepted || !trialAgreementAccepted) {
            throw new Error('Terms and Trial Agreement acceptance are required to activate a trial.');
        }

        // Generate tenant slug
        const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `isp-${Date.now()}`;
        const subdomain = slug;

        let tenant = await Tenant.findOne({ where: { subdomain } });
        if (!tenant) {
            tenant = await Tenant.create({
                name: businessName,
                slug,
                subdomain,
                businessEmail: email,
                contactPhone: phone,
                businessAddress: businessLocation,
                status: 'ACTIVE'
            });
        }

        // Find Unlimited Plan for Trial
        let starterPlan = await SubscriptionPlan.findOne({ where: { slug: 'unlimited' } });
        if (!starterPlan) {
            starterPlan = await SubscriptionPlan.findOne({ where: { slug: 'starter' } });
            if (!starterPlan) {
                starterPlan = await SubscriptionPlan.findOne();
                if (!starterPlan) throw new Error('Default subscription plan not found');
            }
        }

        const effectiveTrialDays = trialDays || this.DEFAULT_TRIAL_DAYS;
        const now = new Date();
        const trialEndDate = new Date(now.getTime() + effectiveTrialDays * 24 * 60 * 60 * 1000);

        // Create or update Tenant Subscription in FREE_TRIAL status
        let subscription = await TenantSubscription.findOne({ where: { tenantId: tenant.id } });
        if (subscription) {
            await subscription.update({
                planId: starterPlan.id,
                status: 'FREE_TRIAL',
                startDate: now,
                currentPeriodStart: now,
                currentPeriodEnd: trialEndDate,
                trialEndDate,
                gracePeriodEndDate: null
            });
        } else {
            subscription = await TenantSubscription.create({
                tenantId: tenant.id,
                planId: starterPlan.id,
                status: 'FREE_TRIAL',
                billingCycle: 'MONTHLY',
                startDate: now,
                currentPeriodStart: now,
                currentPeriodEnd: trialEndDate,
                trialEndDate,
                gracePeriodEndDate: null,
                autoRenew: false
            });
        }

        // Record Legally Binding Digital Trial Agreement
        const textToHash = `TRIAL_AGREEMENT:${tenant.id}:${email}:${now.toISOString()}:${requestIp}`;
        const agreedTextHash = crypto.createHash('sha256').update(textToHash).digest('hex');

        const agreement = await TrialAgreement.create({
            tenantId: tenant.id,
            businessName,
            ownerName,
            phone,
            email,
            businessLocation,
            expectedSubscriberCount: expectedSubscriberCount || 50,
            expectedRouterCount: expectedRouterCount || 2,
            termsAccepted: true,
            trialAgreementAccepted: true,
            agreedAt: now,
            agreedIp: requestIp || '127.0.0.1',
            agreedUserAgent: userAgent || 'Jevish Platform',
            agreedTextHash
        });

        await AuditLog.create({
            tenantId: tenant.id,
            actorType: 'SYSTEM',
            actorId: 'TRIAL_ENGINE',
            action: 'FREE_TRIAL_REGISTERED',
            details: `Free Trial activated for ${businessName}. Duration: ${effectiveTrialDays} days. Agreement Hash: ${agreedTextHash}`,
            ipAddress: requestIp
        });

        logger.info(`[SubscriptionEnforcementService] Registered Free Trial for ${businessName} (Tenant ID: ${tenant.id}). Expires at ${trialEndDate.toISOString()}`);

        return { tenant, subscription, agreement };
    }

    /**
     * 2. Real-time Subscription Status & Feature Matrix Health Evaluation
     */
    public static async evaluateSubscriptionStatus(tenantId: string): Promise<{
        status: string;
        isAccessAllowed: boolean;
        isDashboardAllowed: boolean;
        isReadOnly: boolean;
        daysRemaining: number;
        statusMessage: string;
        subscription: TenantSubscription | null;
        plan: SubscriptionPlan | null;
        usage: {
            subscribers: { current: number; max: number };
            routers: { current: number; max: number };
            staff: { current: number; max: number };
            campaigns: { current: number; max: number };
        };
        features: Record<string, boolean>;
    }> {
        const subscription = await TenantSubscription.findOne({
            where: { tenantId },
            include: [{ model: SubscriptionPlan }]
        });

        if (!subscription) {
            return {
                status: 'NO_SUBSCRIPTION',
                isAccessAllowed: false,
                isDashboardAllowed: false,
                isReadOnly: true,
                daysRemaining: 0,
                statusMessage: 'No subscription record found. Please select a plan to activate.',
                subscription: null,
                plan: null,
                usage: {
                    subscribers: { current: 0, max: 0 },
                    routers: { current: 0, max: 0 },
                    staff: { current: 0, max: 0 },
                    campaigns: { current: 0, max: 0 }
                },
                features: {}
            };
        }

        const plan = (subscription as any).SubscriptionPlan as SubscriptionPlan;
        const now = new Date();
        let status = subscription.status;

        // Auto transition logic on evaluation:
        if (status === 'FREE_TRIAL' || status === 'TRIAL') {
            if (subscription.trialEndDate && new Date(subscription.trialEndDate) < now) {
                status = 'EXPIRED';
                await subscription.update({ status: 'EXPIRED' });
            }
        } else if (status === 'ACTIVE') {
            if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now) {
                const graceEnd = new Date(now.getTime() + this.DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000);
                status = 'GRACE_PERIOD';
                await subscription.update({ status: 'GRACE_PERIOD', gracePeriodEndDate: graceEnd });
            }
        } else if (status === 'GRACE_PERIOD' || status === 'OVERDUE') {
            if (subscription.gracePeriodEndDate && new Date(subscription.gracePeriodEndDate) < now) {
                status = 'SUSPENDED';
                await subscription.update({ status: 'SUSPENDED' });
            }
        }

        // Calculate Days Remaining
        let targetDate = subscription.currentPeriodEnd;
        if (status === 'FREE_TRIAL' || status === 'TRIAL') targetDate = subscription.trialEndDate || subscription.currentPeriodEnd;
        if (status === 'GRACE_PERIOD') targetDate = subscription.gracePeriodEndDate || subscription.currentPeriodEnd;

        const msDiff = targetDate ? new Date(targetDate).getTime() - now.getTime() : 0;
        const daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

        // Permissions Matrix
        const isAccessAllowed = ['ACTIVE', 'FREE_TRIAL', 'TRIAL', 'GRACE_PERIOD'].includes(status);
        const isDashboardAllowed = ['ACTIVE', 'FREE_TRIAL', 'TRIAL', 'GRACE_PERIOD'].includes(status);
        const isReadOnly = status === 'GRACE_PERIOD';

        let statusMessage = 'Subscription is active and healthy.';
        if (status === 'FREE_TRIAL' || status === 'TRIAL') statusMessage = `Free Trial Active (${daysRemaining} days remaining).`;
        if (status === 'GRACE_PERIOD') statusMessage = `Payment Overdue. Grace Period Active (${daysRemaining} days remaining). Please renew now to avoid suspension.`;
        if (status === 'EXPIRED') statusMessage = 'Your subscription or trial has expired. Payment is required to continue.';
        if (status === 'SUSPENDED') statusMessage = 'Account suspended due to unpaid invoices. Please clear outstanding balance.';
        if (status === 'CANCELLED') statusMessage = 'Subscription cancelled. Please reactivate to restore access.';
        if (status === 'PENDING_PAYMENT') statusMessage = 'Invoice generated. Pending payment confirmation.';

        // Real Usage Metrics
        const subscriberCount = await Subscriber.count({ where: { tenantId } });
        const routerCount = await Router.count({ where: { tenantId } });
        const staffCount = await AdminUser.count({ where: { tenantId } });
        const campaignCount = await Campaign.count({ where: { tenantId } });

        const maxSub = plan ? plan.maxActiveUsers : 300;
        const maxRtr = plan ? plan.maxRouters : 2;
        const maxStf = plan ? plan.maxStaff : 2;
        const maxCmp = plan ? plan.maxCampaigns : 1;

        const features: Record<string, boolean> = plan ? {
            hasAnalytics: Boolean(plan.analyticsFeatures),
            hasApiAccess: Boolean(plan.apiAccess),
            hasMarketing: Boolean(plan.marketingFeatures),
            hasWhiteLabel: Boolean(plan.whiteLabelFeatures),
            hasMultiBranch: Boolean(plan.multiBranchFeatures),
            hasCustomIntegrations: Boolean(plan.customIntegrations),
            hasSms: plan.maxSMS !== 0,
            hasWhatsapp: plan.maxWhatsapp !== 0,
            hasAdvertising: plan.maxAdvertisements !== 0
        } : {};

        return {
            status,
            isAccessAllowed,
            isDashboardAllowed,
            isReadOnly,
            daysRemaining,
            statusMessage,
            subscription,
            plan,
            usage: {
                subscribers: { current: subscriberCount, max: maxSub },
                routers: { current: routerCount, max: maxRtr },
                staff: { current: staffCount, max: maxStf },
                campaigns: { current: campaignCount, max: maxCmp }
            },
            features
        };
    }

    /**
     * 3. Feature Gating & Restriction Enforcement
     */
    public static async enforceFeatureAccess(tenantId: string, featureKey: string, requestIp = '127.0.0.1', userAgent = ''): Promise<{ allowed: boolean; reason?: string }> {
        const evalResult = await this.evaluateSubscriptionStatus(tenantId);
        if (!evalResult.isAccessAllowed) {
            await FeatureViolationLog.create({
                tenantId,
                featureOrLimitKey: featureKey,
                attemptedAction: `FEATURE_ACCESS:${featureKey}`,
                currentUsage: 0,
                allowedLimit: 0,
                subscriptionStatus: evalResult.status,
                requestIp,
                userAgent
            });
            return { allowed: false, reason: evalResult.statusMessage };
        }

        if (evalResult.features[featureKey] !== true) {
            await FeatureViolationLog.create({
                tenantId,
                featureOrLimitKey: featureKey,
                attemptedAction: `UNINCLUDED_FEATURE_ATTEMPT:${featureKey}`,
                currentUsage: 0,
                allowedLimit: 0,
                subscriptionStatus: evalResult.status,
                requestIp,
                userAgent
            });
            return { allowed: false, reason: `Feature '${featureKey}' is not included in your current plan (${evalResult.plan?.name || 'Current Plan'}). Please upgrade.` };
        }

        return { allowed: true };
    }

    /**
     * 4. Usage Limit Enforcement (Subscribers, Routers, SMS, Storage)
     */
    public static async enforceUsageLimit(tenantId: string, resourceType: 'subscribers' | 'routers' | 'staff' | 'campaigns', requestIp = '127.0.0.1', userAgent = ''): Promise<{ allowed: boolean; reason?: string }> {
        const evalResult = await this.evaluateSubscriptionStatus(tenantId);
        if (!evalResult.isAccessAllowed) {
            return { allowed: false, reason: evalResult.statusMessage };
        }

        const usageItem = evalResult.usage[resourceType];
        if (!usageItem) return { allowed: true };

        // -1 means unlimited
        if (usageItem.max !== -1 && usageItem.current >= usageItem.max) {
            await FeatureViolationLog.create({
                tenantId,
                featureOrLimitKey: `LIMIT:${resourceType}`,
                attemptedAction: `ADD_${resourceType.toUpperCase()}_EXCEEDED`,
                currentUsage: usageItem.current,
                allowedLimit: usageItem.max,
                subscriptionStatus: evalResult.status,
                requestIp,
                userAgent
            });
            return {
                allowed: false,
                reason: `Limit reached for ${resourceType}. Current: ${usageItem.current}, Maximum Allowed: ${usageItem.max}. Please upgrade your plan.`
            };
        }

        return { allowed: true };
    }

    public static async runAutomatedEnforcement(): Promise<void> {
        const now = new Date();
        const overdueSubscriptions = await TenantSubscription.findAll({
            where: {
                status: {
                    [Op.in]: ['GRACE_PERIOD', 'EXPIRED']
                },
                gracePeriodEndDate: {
                    [Op.lt]: now
                }
            }
        });

        for (const sub of overdueSubscriptions) {
            await sub.update({ status: 'SUSPENDED' });
            logger.warn(`[SubscriptionEnforcementService] Tenant ${sub.tenantId} suspended due to expired grace period.`);
            
            // Trigger Captive Portal block if needed
            // This would likely call a method on RadiusService or similar
        }
    }

    /**
     * 5. Super Admin License Control & Override Engine
     */
    public static async superAdminOverride(tenantId: string, params: SuperAdminOverrideParams): Promise<{ success: boolean; subscription: TenantSubscription | null; message: string }> {
        const subscription = await TenantSubscription.findOne({ where: { tenantId } });
        if (!subscription) {
            return { success: false, subscription: null, message: 'No subscription found for this tenant.' };
        }

        const { action, extendDays, notes, actorId } = params;
        const now = new Date();
        let message = '';

        if (action === 'EXTEND_TRIAL') {
            const daysToAdd = extendDays || 14;
            const currentEnd = subscription.trialEndDate ? new Date(subscription.trialEndDate) : now;
            const newTrialEnd = new Date(Math.max(now.getTime(), currentEnd.getTime()) + daysToAdd * 24 * 60 * 60 * 1000);

            await subscription.update({
                status: 'FREE_TRIAL',
                trialEndDate: newTrialEnd,
                currentPeriodEnd: newTrialEnd
            });
            message = `Trial extended by ${daysToAdd} days until ${newTrialEnd.toISOString()}`;
        } else if (action === 'FORCE_ACTIVATE') {
            const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            await subscription.update({
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: newPeriodEnd,
                gracePeriodEndDate: null
            });
            message = `Subscription force-activated until ${newPeriodEnd.toISOString()}`;
        } else if (action === 'FORCE_SUSPEND') {
            await subscription.update({ status: 'SUSPENDED' });
            message = `Subscription force-suspended.`;
        }

        await AuditLog.create({
            tenantId,
            actorType: 'SUPERADMIN',
            actorId: actorId || 'SUPERADMIN_OVERRIDE_ENGINE',
            action: `LICENSE_OVERRIDE_${action}`,
            details: `${message}. Notes: ${notes || 'N/A'}`,
            ipAddress: '127.0.0.1'
        });

        logger.info(`[SubscriptionEnforcementService] Super Admin Override '${action}' applied to Tenant ID: ${tenantId}`);

        return { success: true, subscription, message };
    }
}
