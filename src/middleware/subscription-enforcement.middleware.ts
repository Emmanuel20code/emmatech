import { Request, Response, NextFunction } from 'express';
import { Tenant, TenantSubscription } from '../models';
import logger from '../utils/logger';
import { SubscriptionEnforcementService } from '../services/subscription-enforcement.service';

/**
 * Middleware to enforce tenant subscription status
 * Blocks requests from tenants with expired/suspended subscriptions
 * Allows Super Admin and Platform Owner unrestricted access
 */
export async function enforceTenantSubscription(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const user = (req as any).user;
        
        // Allow Super Admin and Platform Owner unrestricted access
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_OWNER') {
            return next();
        }

        const tenantId = (req as any).tenantId || user?.tenantId || req.headers['x-tenant-id'] as string;
        
        if (!tenantId) {
            return res.status(401).json({ 
                error: 'UNAUTHORIZED', 
                message: 'Tenant ID required for subscription verification' 
            });
        }

        // Evaluate subscription status
        const evalResult = await SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);
        
        // Attach subscription info to request for downstream use
        (req as any).subscriptionStatus = evalResult.status;
        (req as any).subscriptionDaysRemaining = evalResult.daysRemaining;
        (req as any).isSubscriptionActive = evalResult.isAccessAllowed;

        // Block access for suspended/expired tenants
        if (!evalResult.isAccessAllowed) {
            logger.warn('[SubscriptionEnforcement] Blocked request from tenant with inactive subscription', {
                tenantId,
                status: evalResult.status,
                path: req.path,
                method: req.method
            });

            return res.status(403).json({
                error: 'SUBSCRIPTION_REQUIRED',
                message: evalResult.statusMessage,
                status: evalResult.status,
                daysRemaining: evalResult.daysRemaining,
                requiresPayment: true
            });
        }

        // Attach read-only flag for grace period tenants
        (req as any).isReadOnlyMode = evalResult.isReadOnly;

        next();
    } catch (error: any) {
        logger.error('[SubscriptionEnforcement] Error checking subscription status', {
            error: error.message,
            tenantId: (req as any).tenantId
        });
        
        // Fail open in case of database errors to avoid blocking all traffic
        // But log the error for investigation
        next();
    }
}

/**
 * Middleware specifically for payment endpoints
 * Ensures tenant subscription is active before allowing customer payments
 */
export async function enforcePaymentEligibility(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const user = (req as any).user;
        
        // Allow Super Admin and Platform Owner unrestricted access
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_OWNER') {
            return next();
        }

        const tenantId = (req as any).tenantId || user?.tenantId || req.headers['x-tenant-id'] as string;
        
        if (!tenantId) {
            return res.status(401).json({ 
                error: 'UNAUTHORIZED', 
                message: 'Tenant ID required for payment eligibility check' 
            });
        }

        const evalResult = await SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);

        // Only ACTIVE, FREE_TRIAL, TRIAL, and GRACE_PERIOD statuses allow payments
        const paymentAllowedStatuses = ['ACTIVE', 'FREE_TRIAL', 'TRIAL', 'GRACE_PERIOD'];
        
        if (!paymentAllowedStatuses.includes(evalResult.status)) {
            logger.warn('[PaymentEligibility] Blocked customer payment attempt from tenant with inactive subscription', {
                tenantId,
                status: evalResult.status,
                path: req.path
            });

            return res.status(403).json({
                error: 'PAYMENT_BLOCKED_SUBSCRIPTION_EXPIRED',
                message: 'Customer payments are disabled because your subscription has expired. Please renew your subscription to continue accepting customer payments.',
                status: evalResult.status,
                daysRemaining: evalResult.daysRemaining
            });
        }

        next();
    } catch (error: any) {
        logger.error('[PaymentEligibility] Error checking payment eligibility', {
            error: error.message,
            tenantId: (req as any).tenantId
        });
        
        // Fail closed for payment operations
        return res.status(503).json({
            error: 'SERVICE_UNAVAILABLE',
            message: 'Unable to verify subscription status. Please try again.'
        });
    }
}

/**
 * Middleware to add subscription warning headers
 * Adds headers about subscription status for frontend to display warnings
 */
export async function addSubscriptionWarningHeaders(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const user = (req as any).user;
        const tenantId = (req as any).tenantId || user?.tenantId || req.headers['x-tenant-id'] as string;
        
        if (tenantId && user?.role !== 'SUPER_ADMIN' && user?.role !== 'PLATFORM_OWNER') {
            const evalResult = await SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);
            
            // Add warning header if subscription expires within 5 days
            if (evalResult.daysRemaining <= 5 && evalResult.daysRemaining > 0) {
                res.setHeader('X-Subscription-Warning', 'true');
                res.setHeader('X-Subscription-Days-Remaining', String(evalResult.daysRemaining));
                res.setHeader('X-Subscription-Status', evalResult.status);
            }
        }
        
        next();
    } catch (error: any) {
        // Non-blocking: don't fail the request if warning header can't be added
        next();
    }
}
