"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceTenantSubscription = enforceTenantSubscription;
exports.enforcePaymentEligibility = enforcePaymentEligibility;
exports.addSubscriptionWarningHeaders = addSubscriptionWarningHeaders;
const logger_1 = __importDefault(require("../utils/logger"));
const subscription_enforcement_service_1 = require("../services/subscription-enforcement.service");
/**
 * Middleware to enforce tenant subscription status
 * Blocks requests from tenants with expired/suspended subscriptions
 * Allows Super Admin and Platform Owner unrestricted access
 */
async function enforceTenantSubscription(req, res, next) {
    try {
        const user = req.user;
        // Allow Super Admin and Platform Owner unrestricted access
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_OWNER') {
            return next();
        }
        const tenantId = req.tenantId || user?.tenantId || req.headers['x-tenant-id'];
        if (!tenantId) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Tenant ID required for subscription verification'
            });
        }
        // Evaluate subscription status
        const evalResult = await subscription_enforcement_service_1.SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);
        // Attach subscription info to request for downstream use
        req.subscriptionStatus = evalResult.status;
        req.subscriptionDaysRemaining = evalResult.daysRemaining;
        req.isSubscriptionActive = evalResult.isAccessAllowed;
        // Block access for suspended/expired tenants
        if (!evalResult.isAccessAllowed) {
            logger_1.default.warn('[SubscriptionEnforcement] Blocked request from tenant with inactive subscription', {
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
        req.isReadOnlyMode = evalResult.isReadOnly;
        next();
    }
    catch (error) {
        logger_1.default.error('[SubscriptionEnforcement] Error checking subscription status', {
            error: error.message,
            tenantId: req.tenantId
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
async function enforcePaymentEligibility(req, res, next) {
    try {
        const user = req.user;
        // Allow Super Admin and Platform Owner unrestricted access
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_OWNER') {
            return next();
        }
        const tenantId = req.tenantId || user?.tenantId || req.headers['x-tenant-id'];
        if (!tenantId) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Tenant ID required for payment eligibility check'
            });
        }
        const evalResult = await subscription_enforcement_service_1.SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);
        // Only ACTIVE, FREE_TRIAL, TRIAL, and GRACE_PERIOD statuses allow payments
        const paymentAllowedStatuses = ['ACTIVE', 'FREE_TRIAL', 'TRIAL', 'GRACE_PERIOD'];
        if (!paymentAllowedStatuses.includes(evalResult.status)) {
            logger_1.default.warn('[PaymentEligibility] Blocked customer payment attempt from tenant with inactive subscription', {
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
    }
    catch (error) {
        logger_1.default.error('[PaymentEligibility] Error checking payment eligibility', {
            error: error.message,
            tenantId: req.tenantId
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
async function addSubscriptionWarningHeaders(req, res, next) {
    try {
        const user = req.user;
        const tenantId = req.tenantId || user?.tenantId || req.headers['x-tenant-id'];
        if (tenantId && user?.role !== 'SUPER_ADMIN' && user?.role !== 'PLATFORM_OWNER') {
            const evalResult = await subscription_enforcement_service_1.SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);
            // Add warning header if subscription expires within 5 days
            if (evalResult.daysRemaining <= 5 && evalResult.daysRemaining > 0) {
                res.setHeader('X-Subscription-Warning', 'true');
                res.setHeader('X-Subscription-Days-Remaining', String(evalResult.daysRemaining));
                res.setHeader('X-Subscription-Status', evalResult.status);
            }
        }
        next();
    }
    catch (error) {
        // Non-blocking: don't fail the request if warning header can't be added
        next();
    }
}
