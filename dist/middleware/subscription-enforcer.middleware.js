"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireLimit = exports.requireFeature = exports.subscriptionEnforcerMiddleware = void 0;
const subscription_enforcement_service_1 = require("../services/subscription-enforcement.service");
const logger_1 = __importDefault(require("../utils/logger"));
const subscriptionEnforcerMiddleware = async (req, res, next) => {
    try {
        // Extract tenant ID from request (set by TenantResolver or auth header)
        const tenantId = req.tenantId || req.user?.tenantId || req.headers['x-tenant-id'];
        // Skip enforcement if no tenantId present (e.g. public routes or super admin global routes)
        if (!tenantId) {
            return next();
        }
        // Bypass enforcement for Super Admin / Platform Owner (free pass)
        if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'PLATFORM_OWNER') {
            return next();
        }
        // Bypass enforcement for subscription renewal endpoints & public auth endpoints
        const path = req.originalUrl || req.url;
        if (path.includes('/api/v1/subscription/renew') ||
            path.includes('/api/v1/subscription/status') ||
            path.includes('/api/v1/checkout') ||
            path.includes('/api/v1/auth/login') ||
            path.includes('/api/v1/enterprise/quote')) {
            return next();
        }
        const evalResult = await subscription_enforcement_service_1.SubscriptionEnforcementService.evaluateSubscriptionStatus(tenantId);
        // 1. HARD BLOCK for Expired, Suspended, Cancelled, Archived or Pending Payment Subscriptions
        if (!evalResult.isAccessAllowed) {
            logger_1.default.warn(`[SubscriptionEnforcer] Access BLOCKED for tenant ${tenantId}. Status: ${evalResult.status}. Target URL: ${path}`);
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
        req.subscriptionEval = evalResult;
        return next();
    }
    catch (error) {
        logger_1.default.error(`[SubscriptionEnforcer] Error evaluating subscription: ${error.message}`);
        // In case of error, fall through to avoid locking out healthy tenants unexpectedly
        return next();
    }
};
exports.subscriptionEnforcerMiddleware = subscriptionEnforcerMiddleware;
/**
 * Route-Level Feature Guard Helper
 */
const requireFeature = (featureKey) => {
    return async (req, res, next) => {
        const tenantId = req.tenantId || req.user?.tenantId || req.headers['x-tenant-id'];
        if (!tenantId)
            return next();
        // Bypass for Super Admin and Platform Owner (free pass)
        if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'PLATFORM_OWNER') {
            return next();
        }
        const ip = req.ip || '127.0.0.1';
        const ua = req.headers['user-agent'] || '';
        const check = await subscription_enforcement_service_1.SubscriptionEnforcementService.enforceFeatureAccess(tenantId, featureKey, ip, ua);
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
exports.requireFeature = requireFeature;
/**
 * Route-Level Usage Limit Guard Helper
 */
const requireLimit = (resourceType) => {
    return async (req, res, next) => {
        const tenantId = req.tenantId || req.user?.tenantId || req.headers['x-tenant-id'];
        if (!tenantId)
            return next();
        // Bypass for Super Admin and Platform Owner (free pass)
        if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'PLATFORM_OWNER') {
            return next();
        }
        const ip = req.ip || '127.0.0.1';
        const ua = req.headers['user-agent'] || '';
        const check = await subscription_enforcement_service_1.SubscriptionEnforcementService.enforceUsageLimit(tenantId, resourceType, ip, ua);
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
exports.requireLimit = requireLimit;
