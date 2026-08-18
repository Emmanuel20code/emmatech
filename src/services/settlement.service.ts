import { Settlement, Wallet, sequelize } from '../models';

export class SettlementService {
    static async requestSettlement(tenantId: string, amount: number, method: string) {
        return await sequelize.transaction(async (t) => {
            const wallet = await Wallet.findOne({ where: { ownerId: tenantId, ownerType: 'TENANT' }, transaction: t });
            if (!wallet || wallet.balance < amount) {
                throw new Error('Insufficient balance in tenant wallet');
            }

            // Move balance to frozen
            wallet.balance = Number(wallet.balance) - amount;
            wallet.frozenBalance = Number(wallet.frozenBalance) + amount;
            await wallet.save({ transaction: t });

            return await Settlement.create({
                tenantId,
                amount,
                method,
                status: 'PENDING'
            }, { transaction: t });
        });
    }

    static async approveSettlement(settlementId: string) {
        return await sequelize.transaction(async (t) => {
            const settlement = await Settlement.findByPk(settlementId, { transaction: t });
            if (!settlement || settlement.status !== 'PENDING') {
                throw new Error('Invalid or non-pending settlement');
            }

            const wallet = await Wallet.findOne({ where: { ownerId: settlement.tenantId, ownerType: 'TENANT' }, transaction: t });
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

    static async getTenantSettlements(tenantId: string) {
        return await Settlement.findAll({ where: { tenantId }, order: [['createdAt', 'DESC']] });
    }
}
