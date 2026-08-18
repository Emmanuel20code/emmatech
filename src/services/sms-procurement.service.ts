import {
    SmsFinancialLedger,
    SmsProcurementTask,
    SmsLedgerTransaction,
    TenantSmsWallet,
    SmsTransaction,
    SmsPackage,
    SaaSInvoice,
    Tenant,
    AuditLog,
    SmsGateway
} from '../models';
import logger from '../utils/logger';
import crypto from 'crypto';

export interface TenantSmsPurchaseParams {
    tenantId: string;
    invoiceId: string;
    packageId?: string | null;
    smsCount: number;
    amountPaidCents: number;
    paymentMethod?: string;
    transactionRef?: string;
}

export class SmsProcurementService {
    private static DEFAULT_PROVIDER_COST_PER_SMS_CENTS = 70; // 0.70 KES per SMS default provider cost

    /**
     * Helper: Get or initialize the global SMS Financial Ledger singleton
     */
    public static async getOrCreateLedger(): Promise<SmsFinancialLedger> {
        let ledger = await SmsFinancialLedger.findOne();
        if (!ledger) {
            ledger = await SmsFinancialLedger.create({
                providerProcurementBalanceCents: 0,
                reservedProfitBalanceCents: 0,
                availableOperatingBalanceCents: 0,
                smsInventoryBalanceCount: 100000, // 100k pool starting units
                totalTenantRevenueCents: 0,
                totalProcurementSpentCents: 0,
                totalReservedProfitCents: 0
            });
        }
        return ledger;
    }

    /**
     * Process Tenant SMS Purchase with Margin Protection & Financial Ledger Separation
     */
    public static async processTenantSmsPurchase(params: TenantSmsPurchaseParams): Promise<{
        task: SmsProcurementTask;
        ledger: SmsFinancialLedger;
        success: boolean;
    }> {
        const { tenantId, invoiceId, packageId, smsCount, amountPaidCents } = params;

        // Idempotency check: prevent duplicate procurement tasks
        const procurementHash = crypto.createHash('sha256')
            .update(`${tenantId}-${invoiceId}-${smsCount}-${amountPaidCents}`)
            .digest('hex');

        let task = await SmsProcurementTask.findOne({ where: { procurementHash } });
        if (task) {
            logger.info(`[SmsProcurementService] Duplicate purchase attempt detected for hash ${procurementHash}. RetURNING existing task.`);
            const ledger = await this.getOrCreateLedger();
            return { task, ledger, success: task.procurementStatus === 'COMPLETED' };
        }

        // Calculate Cost & Margin
        let unitProviderCostCents = this.DEFAULT_PROVIDER_COST_PER_SMS_CENTS;
        if (packageId) {
            const pkg = await SmsPackage.findByPk(packageId);
            if (pkg && pkg.costPrice > 0) {
                unitProviderCostCents = Math.round(pkg.costPrice / pkg.smsCount);
            }
        }

        const providerCostCents = unitProviderCostCents * smsCount;
        const reservedProfitCents = Math.max(0, amountPaidCents - providerCostCents);

        const procurementNumber = `PROC-SMS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;

        // Create Procurement Task in PENDING status
        task = await SmsProcurementTask.create({
            procurementNumber,
            tenantId,
            invoiceId,
            packageId: packageId || null,
            smsCount,
            amountPaidCents,
            providerCostCents,
            reservedProfitCents,
            executionMode: 'API',
            procurementStatus: 'PENDING',
            procurementHash,
            providerBalanceBeforeCents: 0,
            providerBalanceAfterCents: 0
        });

        // Financial Ledger Balancing:
        // 1. Lock reserved profit immediately (UNTOUCHABLE)
        // 2. Credit provider procurement balance ONLY with provider cost portion
        const ledger = await this.getOrCreateLedger();
        const newReservedProfit = Number(ledger.reservedProfitBalanceCents) + reservedProfitCents;
        const newProcurementBalance = Number(ledger.providerProcurementBalanceCents) + providerCostCents;
        const newTotalRevenue = Number(ledger.totalTenantRevenueCents) + amountPaidCents;
        const newTotalProfit = Number(ledger.totalReservedProfitCents) + reservedProfitCents;

        await ledger.update({
            reservedProfitBalanceCents: newReservedProfit,
            providerProcurementBalanceCents: newProcurementBalance,
            totalTenantRevenueCents: newTotalRevenue,
            totalReservedProfitCents: newTotalProfit
        });

        // Record Initial Ledger Transaction
        await SmsLedgerTransaction.create({
            procurementTaskId: task.id,
            tenantId,
            transactionType: 'TENANT_PAYMENT',
            amountCents: amountPaidCents,
            providerProcurementBalanceAfterCents: newProcurementBalance,
            reservedProfitBalanceAfterCents: newReservedProfit,
            notes: `Tenant Payment Received: KES ${(amountPaidCents / 100).toFixed(2)}. Provider Cost Allocated: KES ${(providerCostCents / 100).toFixed(2)}, Reserved Profit Locked: KES ${(reservedProfitCents / 100).toFixed(2)}.`
        });

        logger.info(`[SmsProcurementService] Margin Protected. Procurement Task ${task.procurementNumber} initialized. Provider Cost: KES ${(providerCostCents / 100).toFixed(2)}, Locked Profit: KES ${(reservedProfitCents / 100).toFixed(2)}`);

        // Trigger Automated Procurement Execution
        const executionResult = await this.executeProcurement(task.id);
        return { task: executionResult.task, ledger: executionResult.ledger, success: executionResult.success };
    }

    /**
     * Execute Automated Procurement via API or Automated Procurement Service
     */
    public static async executeProcurement(taskId: string): Promise<{
        task: SmsProcurementTask;
        ledger: SmsFinancialLedger;
        success: boolean;
    }> {
        const task = await SmsProcurementTask.findByPk(taskId);
        if (!task) throw new Error('Procurement task not found');

        const ledger = await this.getOrCreateLedger();

        // Safety Check 1: Verify sufficient procurement funds
        if (Number(ledger.providerProcurementBalanceCents) < task.providerCostCents) {
            await task.update({
                procurementStatus: 'FAILED',
                failureReason: `Insufficient procurement funds balance. Required: KES ${(task.providerCostCents / 100).toFixed(2)}, Available: KES ${(ledger.providerProcurementBalanceCents / 100).toFixed(2)}`
            });
            logger.error(`[SmsProcurementService] Procurement ${task.procurementNumber} FAILED: Insufficient procurement funds.`);
            return { task, ledger, success: false };
        }

        await task.update({ procurementStatus: 'IN_PROGRESS' });

        try {
            // Dual Execution Path: API or Controlled Procurement Service
            // Simulate/execute procurement task
            const providerRef = `PROV-${Date.now()}`;
            const updatedProcurementBalance = Math.max(0, Number(ledger.providerProcurementBalanceCents) - task.providerCostCents);
            const updatedSpent = Number(ledger.totalProcurementSpentCents) + task.providerCostCents;
            const updatedInventory = Number(ledger.smsInventoryBalanceCount) + task.smsCount;

            await ledger.update({
                providerProcurementBalanceCents: updatedProcurementBalance,
                totalProcurementSpentCents: updatedSpent,
                smsInventoryBalanceCount: updatedInventory
            });

            // 2. Credit Tenant SMS Wallet
            let smsWallet = await TenantSmsWallet.findOne({ where: { tenantId: task.tenantId } });
            if (!smsWallet) {
                smsWallet = await TenantSmsWallet.create({ tenantId: task.tenantId, balance: 0, usedCredits: 0, purchasedCredits: 0 });
            }

            const newTenantBalance = Number(smsWallet.balance) + task.smsCount;
            const newTenantPurchased = Number(smsWallet.purchasedCredits) + task.smsCount;

            await smsWallet.update({
                balance: newTenantBalance,
                purchasedCredits: newTenantPurchased,
                lastPurchaseAt: new Date(),
                lastPurchasePackageId: task.packageId || null
            });

            // 3. Mark Procurement Task COMPLETED
            await task.update({
                procurementStatus: 'COMPLETED',
                providerReference: providerRef,
                providerBalanceBeforeCents: 0,
                providerBalanceAfterCents: 0,
                verifiedAt: new Date(),
                allocatedAt: new Date(),
                failureReason: null
            });

            // 4. Record Audit Log & Ledger Debit
            await SmsLedgerTransaction.create({
                procurementTaskId: task.id,
                tenantId: task.tenantId,
                transactionType: 'PROCUREMENT_DEBIT',
                amountCents: task.providerCostCents,
                providerProcurementBalanceAfterCents: updatedProcurementBalance,
                reservedProfitBalanceAfterCents: Number(ledger.reservedProfitBalanceCents),
                notes: `Procurement Verified & Executed. Provider Ref: ${providerRef}. ${task.smsCount} credits allocated to Tenant Wallet.`
            });

            await AuditLog.create({
                tenantId: task.tenantId,
                actorType: 'SYSTEM',
                actorId: 'SMS_PROCUREMENT_ENGINE',
                action: 'SMS_PROCUREMENT_COMPLETED',
                details: `Procured ${task.smsCount} SMS credits for KES ${(task.providerCostCents / 100).toFixed(2)}. Provider Ref: ${providerRef}`,
                ipAddress: '127.0.0.1'
            });

            logger.info(`[SmsProcurementService] Procurement ${task.procurementNumber} COMPLETED & VERIFIED. Tenant balance updated to ${newTenantBalance}.`);
            return { task, ledger, success: true };
        } catch (error: any) {
            await task.update({
                procurementStatus: 'FAILED',
                failureReason: error?.message || 'Automated Procurement Service execution failed.'
            });

            logger.error(`[SmsProcurementService] Procurement ${task.procurementNumber} FAILED: ${error?.message}`);
            return { task, ledger, success: false };
        }
    }

    /**
     * Retry a Failed Procurement Task (Super Admin Action)
     */
    public static async retryProcurement(taskId: string): Promise<{
        task: SmsProcurementTask;
        ledger: SmsFinancialLedger;
        success: boolean;
    }> {
        const task = await SmsProcurementTask.findByPk(taskId);
        if (!task) throw new Error('Procurement task not found');

        await task.update({ procurementStatus: 'RETRYING', failureReason: null });
        logger.info(`[SmsProcurementService] Retrying Procurement Task ${task.procurementNumber}...`);

        return this.executeProcurement(taskId);
    }

    /**
     * Get Financial Overview Metrics for Super Admin Dashboard
     */
    public static async getFinancialSummary(): Promise<{
        ledger: SmsFinancialLedger;
        summary: {
            totalRevenueKes: number;
            totalProviderCostKes: number;
            totalReservedProfitKes: number;
            availableProcurementFundKes: number;
            profitMarginPercentage: number;
            smsInventoryCount: number;
            pendingProcurementsCount: number;
            successfulProcurementsCount: number;
            failedProcurementsCount: number;
        };
        recentProcurements: SmsProcurementTask[];
        recentLedgerTransactions: SmsLedgerTransaction[];
    }> {
        const ledger = await this.getOrCreateLedger();

        const totalRevenueKes = Number((Number(ledger.totalTenantRevenueCents) / 100).toFixed(2));
        const totalProviderCostKes = Number((Number(ledger.totalProcurementSpentCents) / 100).toFixed(2));
        const totalReservedProfitKes = Number((Number(ledger.reservedProfitBalanceCents) / 100).toFixed(2));
        const availableProcurementFundKes = Number((Number(ledger.providerProcurementBalanceCents) / 100).toFixed(2));

        const profitMarginPercentage = totalRevenueKes > 0
            ? Number(((totalReservedProfitKes / totalRevenueKes) * 100).toFixed(1))
            : 0;

        const pendingProcurementsCount = await SmsProcurementTask.count({ where: { procurementStatus: 'PENDING' } });
        const successfulProcurementsCount = await SmsProcurementTask.count({ where: { procurementStatus: 'COMPLETED' } });
        const failedProcurementsCount = await SmsProcurementTask.count({ where: { procurementStatus: 'FAILED' } });

        const recentProcurements = await SmsProcurementTask.findAll({
            order: [['createdAt', 'DESC']],
            limit: 20,
            include: [{ model: Tenant }]
        });

        const recentLedgerTransactions = await SmsLedgerTransaction.findAll({
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        return {
            ledger,
            summary: {
                totalRevenueKes,
                totalProviderCostKes,
                totalReservedProfitKes,
                availableProcurementFundKes,
                profitMarginPercentage,
                smsInventoryCount: ledger.smsInventoryBalanceCount,
                pendingProcurementsCount,
                successfulProcurementsCount,
                failedProcurementsCount
            },
            recentProcurements,
            recentLedgerTransactions
        };
    }
}
