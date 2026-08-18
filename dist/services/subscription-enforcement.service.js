"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionEnforcementService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
class SubscriptionEnforcementService {
    static { this.DEFAULT_TRIAL_DAYS = 14; }
    static { this.DEFAULT_GRACE_DAYS = 7; }
    /**
     * 1. Register Free Trial with Legally Binding Digital Agreement
     */
    static async registerTrialWithAgreement(input) {
        const { businessName, ownerName, phone, email, businessLocation, expectedSubscriberCount, expectedRouterCount, termsAccepted, trialAgreementAccepted, requestIp, userAgent, trialDays } = input;
        if (!termsAccepted || !trialAgreementAccepted) {
            throw new Error('Terms and Trial Agreement acceptance are required to activate a trial.');
        }
        // Generate tenant slug
        const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `isp-${Date.now()}`;
        const subdomain = slug;
        let tenant = await models_1.Tenant.findOne({ where: { subdomain } });
        if (!tenant) {
            tenant = await models_1.Tenant.create({
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
        let starterPlan = await models_1.SubscriptionPlan.findOne({ where: { slug: 'unlimited' } });
        if (!starterPlan) {
            starterPlan = await models_1.SubscriptionPlan.findOne({ where: { slug: 'starter' } });
            if (!starterPlan) {
                starterPlan = await models_1.SubscriptionPlan.findOne();
                if (!starterPlan)
                    throw new Error('Default subscription plan not found');
            }
        }
        const effectiveTrialDays = trialDays || this.DEFAULT_TRIAL_DAYS;
        const now = new Date();
        const trialEndDate = new Date(now.getTime() + effectiveTrialDays * 24 * 60 * 60 * 1000);
        // Create or update Tenant Subscription in FREE_TRIAL status
        let subscription = await models_1.TenantSubscription.findOne({ where: { tenantId: tenant.id } });
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
        }
        else {
            subscription = await models_1.TenantSubscription.create({
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
        const agreedTextHash = crypto_1.default.createHash('sha256').update(textToHash).digest('hex');
        const agreement = await models_1.TrialAgreement.create({
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
        await models_1.AuditLog.create({
            tenantId: tenant.id,
            actorType: 'SYSTEM',
            actorId: 'TRIAL_ENGINE',
            action: 'FREE_TRIAL_REGISTERED',
            details: `Free Trial activated for ${businessName}. Duration: ${effectiveTrialDays} days. Agreement Hash: ${agreedTextHash}`,
            ipAddress: requestIp
        });
        logger_1.default.info(`[SubscriptionEnforcementService] Registered Free Trial for ${businessName} (Tenant ID: ${tenant.id}). Expires at ${trialEndDate.toISOString()}`);
        return { tenant, subscription, agreement };
    }
    /**
     * 2. Real-time Subscription Status & Feature Matrix Health Evaluation
     */
    static async evaluateSubscriptionStatus(tenantId) {
        const subscription = await models_1.TenantSubscription.findOne({
            where: { tenantId },
            include: [{ model: models_1.SubscriptionPlan }]
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
        const plan = subscription.SubscriptionPlan;
        const now = new Date();
        let status = subscription.status;
        // Auto transition logic on evaluation:
        if (status === 'FREE_TRIAL' || status === 'TRIAL') {
            if (subscription.trialEndDate && new Date(subscription.trialEndDate) < now) {
                status = 'EXPIRED';
                await subscription.update({ status: 'EXPIRED' });
            }
        }
        else if (status === 'ACTIVE') {
            if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now) {
                const graceEnd = new Date(now.getTime() + this.DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000);
                status = 'GRACE_PERIOD';
                await subscription.update({ status: 'GRACE_PERIOD', gracePeriodEndDate: graceEnd });
            }
        }
        else if (status === 'GRACE_PERIOD' || status === 'OVERDUE') {
            if (subscription.gracePeriodEndDate && new Date(subscription.gracePeriodEndDate) < now) {
                status = 'SUSPENDED';
                await subscription.update({ status: 'SUSPENDED' });
            }
        }
        // Calculate Days Remaining
        let targetDate = subscription.currentPeriodEnd;
        if (status === 'FREE_TRIAL' || status === 'TRIAL')
            targetDate = subscription.trialEndDate || subscription.currentPeriodEnd;
        if (status === 'GRACE_PERIOD')
            targetDate = subscription.gracePeriodEndDate || subscription.currentPeriodEnd;
        const msDiff = targetDate ? new Date(targetDate).getTime() - now.getTime() : 0;
        const daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
        // Permissions Matrix
        const isAccessAllowed = ['ACTIVE', 'FREE_TRIAL', 'TRIAL', 'GRACE_PERIOD'].includes(status);
        const isDashboardAllowed = ['ACTIVE', 'FREE_TRIAL', 'TRIAL', 'GRACE_PERIOD'].includes(status);
        const isReadOnly = status === 'GRACE_PERIOD';
        let statusMessage = 'Subscription is active and healthy.';
        if (status === 'FREE_TRIAL' || status === 'TRIAL')
            statusMessage = `Free Trial Active (${daysRemaining} days remaining).`;
        if (status === 'GRACE_PERIOD')
            statusMessage = `Payment Overdue. Grace Period Active (${daysRemaining} days remaining). Please renew now to avoid suspension.`;
        if (status === 'EXPIRED')
            statusMessage = 'Your subscription or trial has expired. Payment is required to continue.';
        if (status === 'SUSPENDED')
            statusMessage = 'Account suspended due to unpaid invoices. Please clear outstanding balance.';
        if (status === 'CANCELLED')
            statusMessage = 'Subscription cancelled. Please reactivate to restore access.';
        if (status === 'PENDING_PAYMENT')
            statusMessage = 'Invoice generated. Pending payment confirmation.';
        // Real Usage Metrics
        const subscriberCount = await models_1.Subscriber.count({ where: { tenantId } });
        const routerCount = await models_1.Router.count({ where: { tenantId } });
        const staffCount = await models_1.AdminUser.count({ where: { tenantId } });
        const campaignCount = await models_1.Campaign.count({ where: { tenantId } });
        const maxSub = plan ? plan.maxActiveUsers : 300;
        const maxRtr = plan ? plan.maxRouters : 2;
        const maxStf = plan ? plan.maxStaff : 2;
        const maxCmp = plan ? plan.maxCampaigns : 1;
        const features = plan ? {
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
    static async enforceFeatureAccess(tenantId, featureKey, requestIp = '127.0.0.1', userAgent = '') {
        const evalResult = await this.evaluateSubscriptionStatus(tenantId);
        if (!evalResult.isAccessAllowed) {
            await models_1.FeatureViolationLog.create({
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
            await models_1.FeatureViolationLog.create({
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
    static async enforceUsageLimit(tenantId, resourceType, requestIp = '127.0.0.1', userAgent = '') {
        const evalResult = await this.evaluateSubscriptionStatus(tenantId);
        if (!evalResult.isAccessAllowed) {
            return { allowed: false, reason: evalResult.statusMessage };
        }
        const usageItem = evalResult.usage[resourceType];
        if (!usageItem)
            return { allowed: true };
        // -1 means unlimited
        if (usageItem.max !== -1 && usageItem.current >= usageItem.max) {
            await models_1.FeatureViolationLog.create({
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
    static async runAutomatedEnforcement() {
        const now = new Date();
        const overdueSubscriptions = await models_1.TenantSubscription.findAll({
            where: {
                status: {
                    [sequelize_1.Op.in]: ['GRACE_PERIOD', 'EXPIRED']
                },
                gracePeriodEndDate: {
                    [sequelize_1.Op.lt]: now
                }
            }
        });
        for (const sub of overdueSubscriptions) {
            await sub.update({ status: 'SUSPENDED' });
            logger_1.default.warn(`[SubscriptionEnforcementService] Tenant ${sub.tenantId} suspended due to expired grace period.`);
            // Trigger Captive Portal block if needed
            // This would likely call a method on RadiusService or similar
        }
    }
    /**
     * 5. Super Admin License Control & Override Engine
     */
    static async superAdminOverride(tenantId, params) {
        const subscription = await models_1.TenantSubscription.findOne({ where: { tenantId } });
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
        }
        else if (action === 'FORCE_ACTIVATE') {
            const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            await subscription.update({
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: newPeriodEnd,
                gracePeriodEndDate: null
            });
            message = `Subscription force-activated until ${newPeriodEnd.toISOString()}`;
        }
        else if (action === 'FORCE_SUSPEND') {
            await subscription.update({ status: 'SUSPENDED' });
            message = `Subscription force-suspended.`;
        }
        await models_1.AuditLog.create({
            tenantId,
            actorType: 'SUPERADMIN',
            actorId: actorId || 'SUPERADMIN_OVERRIDE_ENGINE',
            action: `LICENSE_OVERRIDE_${action}`,
            details: `${message}. Notes: ${notes || 'N/A'}`,
            ipAddress: '127.0.0.1'
        });
        logger_1.default.info(`[SubscriptionEnforcementService] Super Admin Override '${action}' applied to Tenant ID: ${tenantId}`);
        return { success: true, subscription, message };
    }
}
exports.SubscriptionEnforcementService = SubscriptionEnforcementService;
