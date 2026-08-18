import { Router } from 'express';
import { SubscriptionEnforcementService } from '../services/subscription-enforcement.service';
import logger from '../utils/logger';

const router = Router();

// 1. PUBLIC: Register Free Trial with Digital Agreement Log
router.post('/trial-register', async (req: any, res: any) => {
    try {
        const result = await SubscriptionEnforcementService.registerTrialWithAgreement({
            ...req.body,
            requestIp: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || ''
        });
        res.status(201).json(result);
    } catch (error: any) {
        logger.error('Failed to register free trial', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

// 2. PROTECTED: Get Real-time Subscription Status & Feature Matrix
router.get('/status', async (req: any, res: any) => {
    try {
        const tenantId = req.tenantId || req.user?.tenantId || req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID is required' });
        }

        // Return a lifetime premium free pass for Super Admin / Platform Owner
        if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'PLATFORM_OWNER') {
            return res.json({
                status: 'ACTIVE',
                isAccessAllowed: true,
                isDashboardAllowed: true,
                isReadOnly: false,
                daysRemaining: 9999,
                statusMessage: 'Super Admin Access - Premium Free Pass Granted',
                subscription: {
                    status: 'ACTIVE',
                    billingCycle: 'LIFETIME',
                    autoRenew: true,
                    trialEndDate: null,
                    gracePeriodEndDate: null,
                },
                plan: {
                    name: 'Super Admin Unlimited Plan',
                    slug: 'unlimited',
                    maxActiveUsers: -1,
                    maxRouters: -1,
                    maxStaff: -1,
                    maxCampaigns: -1,
                    apiAccess: true,
                    analyticsFeatures: true,
                    marketingFeatures: true,
                    whiteLabelFeatures: true,
                    multiBranchFeatures: true,
                    customIntegrations: true,
                    maxSMS: -1,
                    maxWhatsapp: -1,
                    maxAdvertisements: -1,
                },
                usage: {
                    subscribers: { current: 0, max: -1 },
                    routers: { current: 0, max: -1 },
                    staff: { current: 0, max: -1 },
                    campaigns: { current: 0, max: -1 }
                },
                features: {
                    hasAnalytics: true,
                    hasApiAccess: true,
                    hasMarketing: true,
                    hasWhiteLabel: true,
                    hasMultiBranch: true,
                    hasCustomIntegrations: true,
                    hasSms: true,
                    hasWhatsapp: true,
                    hasAdvertising: true
                }
            });
        }

        const evalResult = await SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);
        res.json(evalResult);
    } catch (error: any) {
        logger.error('Failed to fetch subscription status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 3. SUPER ADMIN: License Overview & Violation Logs
router.get('/superadmin/licenses', async (_req: any, res: any) => {
    try {
        const tenants = await SubscriptionEnforcementService.evaluateSubscriptionStatus('all');
        res.json(tenants);
    } catch (error: any) {
        logger.error('Failed to fetch super admin licenses overview', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 4. SUPER ADMIN: Super Admin License Override (Extend Trial, Force Activate, Force Suspend)
router.post('/superadmin/override', async (req: any, res: any) => {
    try {
        const { tenantId, action, extendDays, notes } = req.body;
        if (!tenantId || !action) {
            return res.status(400).json({ error: 'tenantId and action are required' });
        }

        const result = await SubscriptionEnforcementService.superAdminOverride(tenantId, {
            action,
            extendDays: Number(extendDays) || 14,
            notes,
            actorId: req.user?.id || 'SUPERADMIN'
        });

        res.json(result);
    } catch (error: any) {
        logger.error('Failed to apply super admin license override', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
