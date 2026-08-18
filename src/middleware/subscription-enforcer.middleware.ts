import { Request, Response, NextFunction } from 'express';
import { SubscriptionEnforcementService } from '../services/subscription-enforcement.service';
import logger from '../utils/logger';

export const subscriptionEnforcerMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Extract tenant ID from request (set by TenantResolver or auth header)
        const tenantId = (req as any).tenantId || (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;

        // Skip enforcement if no tenantId present (e.g. public routes or super admin global routes)
        if (!tenantId) {
            return next();
        }

        // Bypass enforcement for Super Admin / Platform Owner (free pass)
        if ((req as any).user?.role === 'SUPER_ADMIN' || (req as any).user?.role === 'PLATFORM_OWNER') {
            return next();
        }

        // Bypass enforcement for subscription renewal endpoints & public auth endpoints
        const path = req.originalUrl || req.url;
        if (
            path.includes('/api/v1/subscription/renew') ||
            path.includes('/api/v1/subscription/status') ||
            path.includes('/api/v1/checkout') ||
            path.includes('/api/v1/auth/login') ||
            path.includes('/api/v1/enterprise/quote')
        ) {
            return next();
        }

        const evalResult = await SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);

        // 1. HARD BLOCK for Expired, Suspended, Cancelled, Archived or Pending Payment Subscriptions
        if (!evalResult.isAccessAllowed) {
            logger.warn(`[SubscriptionEnforcer] Access BLOCKED for tenant ${tenantId}. Status: ${evalResult.status}. Target URL: ${path}`);
            return res.status(402).json({
                error: 'PAYMENT_REQUIRED',
                message: evalResult.statusMessage,
                subscriptionStatus: evalResult.status,
                renewUrl: '/renew',
                daysRemaining: evalResult.daysRemaining
            });
        }

        // 2. WARNING HEADER for Grace Period Subscriptions
        if (evalResult.status === 'GRACE_PERIOD') {
            res.setHeader('X-Subscription-Warning', 'GRACE_PERIOD_ACTIVE');
            res.setHeader('X-Subscription-Days-Remaining', String(evalResult.daysRemaining));
        }

        // Attach subscription status to request context
        (req as any).subscriptionEval = evalResult;
        return next();
    } catch (error: any) {
        logger.error(`[SubscriptionEnforcer] Error evaluating subscription: ${error.message}`);
        // In case of error, fall through to avoid locking out healthy tenants unexpectedly
        return next();
    }
};

/**
 * Route-Level Feature Guard Helper
 */
export const requireFeature = (featureKey: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = (req as any).tenantId || (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;
        if (!tenantId) return next();

        // Bypass for Super Admin and Platform Owner (free pass)
        if ((req as any).user?.role === 'SUPER_ADMIN' || (req as any).user?.role === 'PLATFORM_OWNER') {
            return next();
        }

        const ip = req.ip || '127.0.0.1';
        const ua = req.headers['user-agent'] || '';

        const check = await SubscriptionEnforcementService.enforceFeatureAccess(tenantId, featureKey, ip, ua);
        if (!check.allowed) {
            return res.status(403).json({
                error: 'FEATURE_NOT_INCLUDED',
                message: check.reason,
                featureKey,
                upgradeUrl: '/renew'
            });
        }
        return next();
    };
};

/**
 * Route-Level Usage Limit Guard Helper
 */
export const requireLimit = (resourceType: 'subscribers' | 'routers' | 'staff' | 'campaigns') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = (req as any).tenantId || (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;
        if (!tenantId) return next();

        // Bypass for Super Admin and Platform Owner (free pass)
        if ((req as any).user?.role === 'SUPER_ADMIN' || (req as any).user?.role === 'PLATFORM_OWNER') {
            return next();
        }

        const ip = req.ip || '127.0.0.1';
        const ua = req.headers['user-agent'] || '';

        const check = await SubscriptionEnforcementService.enforceUsageLimit(tenantId, resourceType, ip, ua);
        if (!check.allowed) {
            return res.status(403).json({
                error: 'USAGE_LIMIT_EXCEEDED',
                message: check.reason,
                resourceType,
                upgradeUrl: '/renew'
            });
        }
        return next();
    };
};
