"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementEngine = void 0;
const models_1 = require("../models");
const wallet_service_1 = require("./wallet.service");
const logger_1 = __importDefault(require("../utils/logger"));
const sequelize_1 = require("sequelize");
class SettlementEngine {
    /**
     * Process automated settlements for all tenants
     * This would typically be called by a cron job (daily/weekly)
     */
    static async runAutomatedSettlements() {
        const today = new Date();
        const tenants = await models_1.Tenant.findAll({
            where: {
                settlementSchedule: { [sequelize_1.Op.ne]: 'MANUAL' },
                status: 'ACTIVE'
            }
        });
        for (const tenant of tenants) {
            try {
                if (this.shouldSettleToday(tenant.settlementSchedule, today)) {
                    await this.processSettlementForTenant(tenant);
                }
            }
            catch (error) {
                logger_1.default.error('Automated settlement failed for tenant', { tenantId: tenant.id, error: error.message });
            }
        }
    }
    static shouldSettleToday(schedule, date) {
        // Simple logic for DAILY, WEEKLY (on Monday), MONTHLY (on 1st)
        if (schedule === 'DAILY')
            return true;
        if (schedule === 'WEEKLY' && date.getDay() === 1)
            return true;
        if (schedule === 'MONTHLY' && date.getDate() === 1)
            return true;
        return false;
    }
    static async processSettlementForTenant(tenant) {
        const wallet = await models_1.Wallet.findOne({ where: { ownerId: tenant.id, ownerType: 'TENANT' } });
        if (!wallet)
            return;
        const amount = Number(wallet.settledBalance);
        if (amount < tenant.minimumWithdrawalAmount) {
            logger_1.default.info('Tenant balance below minimum withdrawal amount', { tenantId: tenant.id, balance: amount });
            return;
        }
        logger_1.default.info('Initiating automated settlement', { tenantId: tenant.id, amount });
        // Use WalletService to create settlement request
        // This will freeze the funds
        await wallet_service_1.WalletService.createSettlement(tenant.id, amount, tenant.settlementMethod, 'SYSTEM');
        // In a real system, here we would trigger the payout via API
        // For now, it stays in PENDING status in the Settlement table
    }
}
exports.SettlementEngine = SettlementEngine;
