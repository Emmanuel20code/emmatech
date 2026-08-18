"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceLiveMpesaMode = enforceLiveMpesaMode;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
async function enforceLiveMpesaMode() {
    logger_1.default.info('Enforcing LIVE mode across all M-Pesa API client instances...');
    // 1. Update PlatformSettings to enforce production environment
    await models_1.PlatformSetting.upsert({
        key: 'SUPERADMIN_MPESA_ENV',
        value: 'production',
        description: 'Enforced Live Production Environment for M-Pesa'
    });
    // 2. Update all tenants with mpesaEnvironment set to sandbox to production
    await models_1.Tenant.update({ mpesaEnvironment: 'production' }, { where: { mpesaEnvironment: 'sandbox' } });
    logger_1.default.info('M-Pesa Live Mode enforcement completed successfully. Sandbox settings ignored, using production environment https://api.safaricom.co.ke.');
}
if (require.main === module) {
    enforceLiveMpesaMode()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error('Failed to enforce M-Pesa live mode:', err);
        process.exit(1);
    });
}
