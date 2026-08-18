"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
const models_1 = require("../models");
class SettlementService {
    static async requestSettlement(tenantId, amount, method) {
        return await models_1.sequelize.transaction(async (t) => {
            const wallet = await models_1.Wallet.findOne({ where: { ownerId: tenantId, ownerType: 'TENANT' }, transaction: t });
            if (!wallet || wallet.balance < amount) {
                throw new Error('Insufficient balance in tenant wallet');
            }
            // Move balance to frozen
            wallet.balance = Number(wallet.balance) - amount;
            wallet.frozenBalance = Number(wallet.frozenBalance) + amount;
            await wallet.save({ transaction: t });
            return await models_1.Settlement.create({
                tenantId,
                amount,
                method,
                status: 'PENDING'
            }, { transaction: t });
        });
    }
    static async approveSettlement(settlementId) {
        return await models_1.sequelize.transaction(async (t) => {
            const settlement = await models_1.Settlement.findByPk(settlementId, { transaction: t });
            if (!settlement || settlement.status !== 'PENDING') {
                throw new Error('Invalid or non-pending settlement');
            }
            const wallet = await models_1.Wallet.findOne({ where: { ownerId: settlement.tenantId, ownerType: 'TENANT' }, transaction: t });
            if (wallet) {
                wallet.frozenBalance = Number(wallet.frozenBalance) - Number(settlement.amount);
                await wallet.save({ transaction: t });
            }
            settlement.status = 'PAID';
            settlement.paidAt = new Date();
            await settlement.save({ transaction: t });
            return settlement;
        });
    }
    static async getTenantSettlements(tenantId) {
        return await models_1.Settlement.findAll({ where: { tenantId }, order: [['createdAt', 'DESC']] });
    }
}
exports.SettlementService = SettlementService;
