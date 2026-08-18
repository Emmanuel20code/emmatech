"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const DEFAULT_FLAGS = [
    { key: 'DarkMode', description: 'Dark Mode UI theme toggle', isEnabledGlobal: false, isEnabledStaging: true },
    { key: 'SmsMarketplace', description: 'SMS Credit Purchase & Gateway Marketplace', isEnabledGlobal: true, isEnabledStaging: true },
    { key: 'WhatsappCampaign', description: 'WhatsApp Business Campaign Integration', isEnabledGlobal: false, isEnabledStaging: true },
    { key: 'MikrotikAutoInstaller', description: 'Automated RouterOS One-Click Auto Installer', isEnabledGlobal: false, isEnabledStaging: true },
    { key: 'AnalyticsV2', description: 'Advanced Real-time Analytics & Revenue Forecasting', isEnabledGlobal: false, isEnabledStaging: true },
    { key: 'WalletUpgrade', description: 'Multi-Currency Wallet & Settlement Engine', isEnabledGlobal: false, isEnabledStaging: true },
];
class FeatureFlagService {
    /**
     * Seed initial feature flags if missing.
     */
    static async seedDefaultFlags() {
        try {
            for (const flag of DEFAULT_FLAGS) {
                await models_1.FeatureFlag.findOrCreate({
                    where: { key: flag.key },
                    defaults: flag,
                });
            }
        }
        catch (err) {
            logger_1.default.error('[FeatureFlag] Failed to seed default flags', { error: err.message });
        }
    }
    /**
     * Check if a feature flag is enabled for a given context (staging, tenant, admin).
     */
    static async isEnabled(key, context) {
        try {
            const flag = await models_1.FeatureFlag.findOne({ where: { key } });
            if (!flag)
                return false;
            // 1. Globally enabled
            if (flag.isEnabledGlobal)
                return true;
            // 2. Staging environment check
            const isStagingEnv = context?.isStaging ?? (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'development');
            if (isStagingEnv && flag.isEnabledStaging)
                return true;
            // 3. Tenant override check
            if (context?.tenantId && flag.enabledTenants) {
                const tenants = JSON.parse(flag.enabledTenants);
                if (tenants.includes(context.tenantId))
                    return true;
            }
            // 4. Admin override check
            if (context?.userId && flag.enabledAdmins) {
                const admins = JSON.parse(flag.enabledAdmins);
                if (admins.includes(context.userId))
                    return true;
            }
            return false;
        }
        catch (err) {
            logger_1.default.error(`[FeatureFlag] Error checking flag ${key}`, { error: err.message });
            return false;
        }
    }
    /**
     * Get all feature flags with status for a specific context.
     */
    static async getAllFlags(context) {
        await this.seedDefaultFlags();
        const flags = await models_1.FeatureFlag.findAll();
        const results = [];
        for (const flag of flags) {
            const enabledTenants = flag.enabledTenants ? JSON.parse(flag.enabledTenants) : [];
            const enabledAdmins = flag.enabledAdmins ? JSON.parse(flag.enabledAdmins) : [];
            const enabled = await this.isEnabled(flag.key, context);
            results.push({
                key: flag.key,
                description: flag.description,
                isEnabled: enabled,
                isEnabledGlobal: flag.isEnabledGlobal,
                isEnabledStaging: flag.isEnabledStaging,
                enabledTenantsCount: enabledTenants.length,
                enabledAdminsCount: enabledAdmins.length,
            });
        }
        return results;
    }
    /**
     * Toggle or update a feature flag.
     */
    static async updateFlag(key, updates) {
        const flag = await models_1.FeatureFlag.findOne({ where: { key } });
        if (!flag)
            throw new Error(`Feature flag '${key}' not found.`);
        const payload = {};
        if (updates.isEnabledGlobal !== undefined)
            payload.isEnabledGlobal = updates.isEnabledGlobal;
        if (updates.isEnabledStaging !== undefined)
            payload.isEnabledStaging = updates.isEnabledStaging;
        if (updates.enabledTenants !== undefined)
            payload.enabledTenants = JSON.stringify(updates.enabledTenants);
        if (updates.enabledAdmins !== undefined)
            payload.enabledAdmins = JSON.stringify(updates.enabledAdmins);
        await flag.update(payload);
        return flag;
    }
}
exports.FeatureFlagService = FeatureFlagService;
