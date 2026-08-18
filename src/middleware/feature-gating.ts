import { Request, Response, NextFunction } from 'express';
import { TenantSubscription, TenantAddonModule, SubscriptionPlan } from '../models';
import logger from '../utils/logger';

export interface GatedRequest extends Request {
    tenantId?: string;
    subscription?: TenantSubscription;
}

export const requireFeature = (featureName: 'ADVERTISING' | 'SMS' | 'WHATSAPP' | 'EMAIL' | 'API_ACCESS' | 'ADVANCED_ANALYTICS') => {
    return async (req: any, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId || req.user?.tenantId;
            if (!tenantId) {
                return next(); // Super admin bypass or unauthenticated fallback
            }

            // Bypass for Super Admin and Platform Owner (free pass)
            if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'PLATFORM_OWNER') {
                return next();
            }

            // 1. Check Tenant Subscription Status
            const sub = await TenantSubscription.findOne({
                where: { tenantId },
                include: [SubscriptionPlan]
            });

            if (sub && sub.status === 'SUSPENDED') {
                logger.warn(`Feature ${featureName} blocked: Tenant ${tenantId} is SUSPENDED`);
                return res.status(403).json({
                    error: 'Account Suspended',
                    message: 'Your account is currently suspended due to overdue unpaid invoices. Please settle your invoice in the Billing Hub to restore access.',
                    feature: featureName,
                    actionRequired: 'PAY_INVOICE'
                });
            }

            // 2. Check Plan Features
            const plan = (sub as any)?.SubscriptionPlan;
            if (plan) {
                if (featureName === 'API_ACCESS' && !plan.apiAccess) {
                    // Check if tenant purchased API_ACCESS add-on module
                    const addon = await TenantAddonModule.findOne({
                        where: { tenantId, moduleName: 'API_ACCESS', status: 'ACTIVE' }
                    });
                    if (!addon) {
                        return res.status(403).json({
                            error: 'Feature Gated',
                            message: 'API Access is not included in your current plan. Upgrade your subscription or activate the API Access module.',
                            feature: featureName,
                            actionRequired: 'UPGRADE_PLAN'
                        });
                    }
                }
            }

            next();
        } catch (error: any) {
            logger.error(`Feature gating middleware error for ${featureName}`, { error: error.message });
            next(); // Non-blocking safety fallback
        }
    };
};
