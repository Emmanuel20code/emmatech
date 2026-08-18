"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFeature = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const requireFeature = (featureName) => {
    return async (req, res, next) => {
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
            const sub = await models_1.TenantSubscription.findOne({
                where: { tenantId },
                include: [models_1.SubscriptionPlan]
            });
            if (sub && sub.status === 'SUSPENDED') {
                logger_1.default.warn(`Feature ${featureName} blocked: Tenant ${tenantId} is SUSPENDED`);
                return res.status(403).json({
                    error: 'Account Suspended',
                    message: 'Your account is currently suspended due to overdue unpaid invoices. Please settle your invoice in the Billing Hub to restore access.',
                    feature: featureName,
                    actionRequired: 'PAY_INVOICE'
                });
            }
            // 2. Check Plan Features
            const plan = sub?.SubscriptionPlan;
            if (plan) {
                if (featureName === 'API_ACCESS' && !plan.apiAccess) {
                    // Check if tenant purchased API_ACCESS add-on module
                    const addon = await models_1.TenantAddonModule.findOne({
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
        }
        catch (error) {
            logger_1.default.error(`Feature gating middleware error for ${featureName}`, { error: error.message });
            next(); // Non-blocking safety fallback
        }
    };
};
exports.requireFeature = requireFeature;
