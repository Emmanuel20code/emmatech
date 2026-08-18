import { Tenant, Wallet } from '../models';
import { WalletService } from './wallet.service';
import logger from '../utils/logger';
import { Op } from 'sequelize';

export class SettlementEngine {
    /**
     * Process automated settlements for all tenants
     * This would typically be called by a cron job (daily/weekly)
     */
    static async runAutomatedSettlements() {
        const today = new Date();
        const tenants = await Tenant.findAll({
            where: {
                settlementSchedule: { [Op.ne]: 'MANUAL' },
                status: 'ACTIVE'
            }
        });

        for (const tenant of tenants) {
            try {
                if (this.shouldSettleToday(tenant.settlementSchedule, today)) {
                    await this.processSettlementForTenant(tenant);
                }
            } catch (error: any) {
                logger.error('Automated settlement failed for tenant', { tenantId: tenant.id, error: error.message });
            }
        }
    }

    private static shouldSettleToday(schedule: string, date: Date): boolean {
        // Simple logic for DAILY, WEEKLY (on Monday), MONTHLY (on 1st)
        if (schedule === 'DAILY') return true;
        if (schedule === 'WEEKLY' && date.getDay() === 1) return true;
        if (schedule === 'MONTHLY' && date.getDate() === 1) return true;
        return false;
    }

    private static async processSettlementForTenant(tenant: Tenant) {
        const wallet = await Wallet.findOne({ where: { ownerId: tenant.id, ownerType: 'TENANT' } });
        if (!wallet) return;

        const amount = Number(wallet.settledBalance);
        if (amount < tenant.minimumWithdrawalAmount) {
            logger.info('Tenant balance below minimum withdrawal amount', { tenantId: tenant.id, balance: amount });
            return;
        }

        logger.info('Initiating automated settlement', { tenantId: tenant.id, amount });

        // Use WalletService to create settlement request
        // This will freeze the funds
        await WalletService.createSettlement(tenant.id, amount, tenant.settlementMethod, 'SYSTEM');

        // In a real system, here we would trigger the payout via API
        // For now, it stays in PENDING status in the Settlement table
    }
}
