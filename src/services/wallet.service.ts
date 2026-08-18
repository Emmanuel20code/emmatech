import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { AuditService } from './audit.service';
import { Op, Transaction } from 'sequelize';
import {
    Wallet, WalletTransaction, Payment, Tenant, PlatformTransaction,
    PlatformWallet, Settlement, AuditLog, sequelize
} from '../models';

export class WalletService {
    /**
     * Initialize tenant wallet on creation
     */
    static async initializeTenantWallet(tenantId: string, transaction?: any): Promise<any> {
        try {
            // Create tenant wallet
            const wallet = await Wallet.create({
                ownerId: tenantId,
                ownerType: 'TENANT',
                balance: 0,
                frozenBalance: 0,
                pendingBalance: 0,
                settledBalance: 0,
                currency: 'KES',
                tenantId: tenantId
            }, { transaction });

            // Create initial wallet transaction
            await WalletTransaction.create({
                walletId: wallet.id,
                amount: 0,
                transactionType: 'CREDIT',
                status: 'COMPLETED',
                description: 'Wallet initialized',
                referenceId: null,
                balanceAfter: 0,
                tenantId: tenantId
            }, { transaction });

            await AuditService.log('WALLET_INITIALIZED', `Tenant wallet initialized: ${tenantId}`, tenantId, undefined);
            return wallet;
        } catch (error) {
            logger.error('Failed to initialize tenant wallet', { error: error instanceof Error ? error.message : String(error), tenantId });
            throw new Error('Failed to initialize wallet');
        }
    }

    /**
     * Get wallet balance and analytics by owner
     */
    static async getWalletBalanceByOwner(ownerId: string, ownerType: 'TENANT' | 'SUBSCRIBER' | 'AGENT' = 'TENANT'): Promise<{
        balance: number;
        pending: number;
        settled: number;
        frozen: number;
        id: string;
        totalEarnings: number;
        totalFees: number;
    }> {
        const wallet = await Wallet.findOne({ where: { ownerId, ownerType } });

        // If wallet doesn't exist, return default values (for new tenants)
        if (!wallet) {
            return {
                balance: 0,
                pending: 0,
                settled: 0,
                frozen: 0,
                id: 'uninitialized',
                totalEarnings: 0,
                totalFees: 0
            };
        }

        // Calculate analytics (Total Earnings and Fees)
        let totalEarnings = 0;
        let totalFees = 0;
        try {
            const { Payment } = require('../models');
            totalEarnings = await WalletTransaction.sum('amount', {
                where: { walletId: wallet.id, transactionType: 'CREDIT' }
            }) || 0;
            
            totalFees = await Payment.sum('platformFee', {
                where: { tenantId: ownerId, status: 'SUCCESS' }
            }) || 0;
        } catch (err) {
            logger.error('Error calculating wallet analytics', { error: err instanceof Error ? err.message : String(err) });
        }

        return {
            balance: Number(wallet.balance),
            pending: Number(wallet.pendingBalance),
            settled: Number(wallet.settledBalance),
            frozen: Number(wallet.frozenBalance),
            id: wallet.id,
            totalEarnings: Number(totalEarnings),
            totalFees: Number(totalFees)
        };
    }

    /**
     * Get wallet balance by wallet ID
     */
    static async getWalletBalance(walletId: string): Promise<{ balance: number; pending: number; settled: number; frozen: number }> {
        const wallet = await Wallet.findByPk(walletId);
        if (!wallet) throw new Error('Wallet not found');

        return {
            balance: Number(wallet.balance),
            pending: Number(wallet.pendingBalance),
            settled: Number(wallet.settledBalance),
            frozen: Number(wallet.frozenBalance)
        };
    }

    /**
     * Process payment with automated split logic (90/10 or tenant-specific)
     */
    static async processPayment(payment: Payment, externalTransaction?: Transaction): Promise<WalletTransaction> {
        const transaction = externalTransaction || await sequelize.transaction();

        try {
            const tenant = await Tenant.findByPk(payment.tenantId);
            if (!tenant) throw new Error('Tenant not found');

            const transactionAmount = BigInt(payment.amount);
            const commissionPercentage = tenant.commissionPercentage || 10;
            // Calculate commission in cents: (amount * percentage) / 100
            const commissionAmount = (transactionAmount * BigInt(Math.floor(commissionPercentage * 100))) / 10000n;
            const transactionFee = BigInt(tenant.transactionFee || 0);
            const platformFeeAmount = commissionAmount + transactionFee;
            const netAmount = transactionAmount - platformFeeAmount;

            // Get tenant wallet with LOCK
            const wallet = await Wallet.findOne({
                where: { ownerId: payment.tenantId, ownerType: 'TENANT' },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!wallet) throw new Error('Tenant wallet not found');

            // Credit Tenant Wallet
            // Note: With Aggregator Model, funds are often settled instantly or follow a maturation period
            const newBalance = BigInt(wallet.balance) + netAmount;
            const newSettledBalance = BigInt(wallet.settledBalance) + netAmount; // Instant settlement for aggregator confirm

            await wallet.update({
                balance: newBalance,
                settledBalance: newSettledBalance
            }, { transaction });

            // Create wallet transaction
            const walletTransaction = await WalletTransaction.create({
                walletId: wallet.id,
                sourceWalletId: undefined,
                destinationWalletId: wallet.id,
                amount: netAmount,
                transactionType: 'CREDIT',
                referenceId: payment.id,
                referenceType: 'PAYMENT',
                balanceAfter: newBalance,
                description: `Payment received (Aggregator Split: ${100 - commissionPercentage}%)`,
                status: 'COMPLETED',
                settlementStatus: 'SETTLED',
                maturesAt: new Date(),
                createdBy: payment.subscriberId || undefined,
                metadata: JSON.stringify({
                    paymentId: payment.id,
                    totalAmount: transactionAmount.toString(),
                    commissionPercent: commissionPercentage,
                    platformCommission: platformFeeAmount.toString(),
                    tenantProceeds: netAmount.toString()
                }),
                tenantId: payment.tenantId
            }, { transaction });

            // Update payment with split details
            await payment.update({
                platformFee: platformFeeAmount,
                netAmount: netAmount,
                walletTransactionId: walletTransaction.id,
                status: 'SUCCESS',
                completedAt: new Date()
            }, { transaction });

            // Update platform wallet
            await this.updatePlatformWallet(platformFeeAmount, 'CREDIT', payment.id, transaction);

            // Record Platform Transactions for transparency
            if (commissionAmount > 0) {
                await PlatformTransaction.create({
                    type: 'COMMISSION',
                    amount: commissionAmount,
                    tenantId: payment.tenantId,
                    referenceId: payment.id,
                    metadata: JSON.stringify({ rate: commissionPercentage })
                }, { transaction });
            }

            if (transactionFee > 0n) {
                await PlatformTransaction.create({
                    type: 'FEE_TRANSACTION',
                    amount: transactionFee,
                    tenantId: payment.tenantId,
                    referenceId: payment.id
                }, { transaction });
            }

            if (!externalTransaction) await transaction.commit();

            await AuditService.log('PAYMENT_AGGREGATOR_SPLIT', `Split processed for ${payment.id}: Tenant(${netAmount}) Platform(${platformFeeAmount})`, payment.tenantId, payment.subscriberId || undefined);

            return walletTransaction;
        } catch (error) {
            if (!externalTransaction) await transaction.rollback();
            logger.error('Aggregator split processing failed', { error: error instanceof Error ? error.message : String(error), paymentId: payment.id });
            throw new Error('Split processing failed');
        }
    }

    /**
     * Clear all matured pending balances for all wallets
     */
    static async clearAllMaturedPendingBalances(): Promise<number> {
        const { Op } = require('sequelize');
        const maturedTransactions = await WalletTransaction.findAll({
            where: {
                settlementStatus: 'PENDING',
                maturesAt: { [Op.lte]: new Date() }
            }
        });

        let clearedCount = 0;
        for (const tx of maturedTransactions) {
            try {
                await this.clearPendingBalance(tx.walletId, Number(tx.amount));
                await tx.update({ settlementStatus: 'SETTLED' });
                clearedCount++;
            } catch (error) {
                logger.error('Failed to clear matured pending balance', { transactionId: tx.id, error: error instanceof Error ? error.message : String(error) });
            }
        }

        if (clearedCount > 0) {
            logger.info(`Cleared ${clearedCount} matured pending transactions`);
        }

        return clearedCount;
    }

    /**
     * Clear pending balance to settled
     */
    static async clearPendingBalance(walletId: string, amount: number): Promise<Wallet> {
        const transaction = await sequelize.transaction();
        try {
            const wallet = await Wallet.findByPk(walletId);
            if (!wallet) throw new Error('Wallet not found');

            if (BigInt(wallet.pendingBalance) < BigInt(amount)) throw new Error('Insufficient pending balance');

            await wallet.update({
                pendingBalance: BigInt(wallet.pendingBalance) - BigInt(amount),
                settledBalance: BigInt(wallet.settledBalance) + BigInt(amount)
            }, { transaction });

            await transaction.commit();
            return wallet;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Update platform wallet
     */
    static async updatePlatformWallet(amount: number | bigint, transactionType: 'CREDIT' | 'DEBIT', _referenceId: string | null, transaction?: Transaction): Promise<PlatformWallet> {
        let platformWallet = await PlatformWallet.findOne();
        if (!platformWallet) {
            platformWallet = await PlatformWallet.create({ balance: 0, pendingBalance: 0, currency: 'KES' }, { transaction });
        }

        if (transactionType === 'CREDIT') {
            await platformWallet.update({
                balance: BigInt(platformWallet.balance) + BigInt(amount),
                pendingBalance: BigInt(platformWallet.pendingBalance) + BigInt(amount)
            }, { transaction });
        } else {
            await platformWallet.update({
                balance: BigInt(platformWallet.balance) - BigInt(amount),
                pendingBalance: BigInt(platformWallet.pendingBalance) - BigInt(amount)
            }, { transaction });
        }

        return platformWallet;
    }

    /**
     * Create settlement request
     */
    static async createSettlement(tenantId: string, amount: number, method: string, userId: string): Promise<Settlement> {
        const transaction = await sequelize.transaction();

        try {
            // Get tenant wallet with LOCK
            const wallet = await Wallet.findOne({
                where: { ownerId: tenantId, ownerType: 'TENANT' },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!wallet) throw new Error('Tenant wallet not found');

            // Check available balance
            if (BigInt(wallet.balance) < BigInt(amount)) throw new Error('Insufficient balance');

            // Get tenant details
            const tenant = await Tenant.findByPk(tenantId);
            if (!tenant) throw new Error('Tenant not found');

            // Check minimum withdrawal
            if (BigInt(amount) < BigInt(tenant.minimumWithdrawalAmount)) {
                throw new Error(`Minimum withdrawal amount is KES ${Number(tenant.minimumWithdrawalAmount)}`);
            }

            // Freeze the amount
            // Withdrawal happens from settledBalance
            if (BigInt(wallet.settledBalance) < BigInt(amount)) throw new Error('Insufficient settled balance for withdrawal');

            await wallet.update({
                settledBalance: BigInt(wallet.settledBalance) - BigInt(amount),
                frozenBalance: BigInt(wallet.frozenBalance) + BigInt(amount),
                balance: BigInt(wallet.balance) - BigInt(amount)
            }, { transaction });

            // Create settlement record
            const settlement = await Settlement.create({
                tenantId: tenantId,
                amount: amount,
                status: 'PENDING',
                method: method,
                paidAt: undefined,
                referenceNumber: undefined,
                transactionFee: 0,
                walletTransactionId: undefined,
                processedBy: userId
            }, { transaction });

            // Create wallet transaction
            const walletTransaction = await WalletTransaction.create({
                walletId: wallet.id,
                sourceWalletId: wallet.id,
                destinationWalletId: undefined, // External destination (e.g. M-Pesa B2C)
                amount: amount,
                transactionType: 'SETTLEMENT',
                referenceId: settlement.id,
                referenceType: 'SETTLEMENT',
                balanceAfter: Number(wallet.balance) - amount,
                description: `Settlement request via ${method}`,
                status: 'PENDING',
                createdBy: userId,
                metadata: JSON.stringify({
                    settlementId: settlement.id,
                    method: method,
                    status: 'PENDING'
                }),
                tenantId: tenantId
            }, { transaction });

            // Update settlement with wallet transaction
            await settlement.update({ walletTransactionId: walletTransaction.id }, { transaction });

            await transaction.commit();

            await AuditService.log('SETTLEMENT_REQUESTED', `Settlement requested: ${amount} via ${method}`, tenantId, userId || undefined);

            return settlement;
        } catch (error) {
            await transaction.rollback();
            logger.error('Failed to create settlement', { error: error instanceof Error ? error.message : String(error), tenantId, amount });
            throw new Error(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Process settlement (approve and pay out)
     */
    static async processSettlement(settlementId: string, userId: string): Promise<Settlement> {
        const transaction = await sequelize.transaction();

        try {
            const settlement = await Settlement.findByPk(settlementId, { transaction });
            if (!settlement) throw new Error('Settlement not found');

            if (settlement.status !== 'PENDING') throw new Error('Settlement already processed');

            const tenant = await Tenant.findByPk(settlement.tenantId);
            if (!tenant) throw new Error('Tenant not found');

            const wallet = await Wallet.findOne({
                where: { ownerId: settlement.tenantId, ownerType: 'TENANT' },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!wallet) throw new Error('Tenant wallet not found');

            // Simulate payment processing (in real system, this would call payment gateway)
            const referenceNumber = `SETTLE-${Date.now()}`;

            // Update wallet - move from frozen to settled
            await wallet.update({
                frozenBalance: BigInt(wallet.frozenBalance) - BigInt(settlement.amount),
                settledBalance: BigInt(wallet.settledBalance) + BigInt(settlement.amount)
            }, { transaction });

            // Update settlement
            await settlement.update({
                status: 'PAID',
                paidAt: new Date(),
                referenceNumber: referenceNumber,
                processedBy: userId
            }, { transaction });

            // Update wallet transaction
            const walletTransaction = await WalletTransaction.findByPk(settlement.walletTransactionId || undefined);
            if (walletTransaction) {
                await walletTransaction.update({
                    status: 'COMPLETED',
                    metadata: JSON.stringify({
                        ...JSON.parse(walletTransaction.metadata || '{}'),
                        status: 'PAID',
                        referenceNumber: referenceNumber,
                        paidAt: new Date().toISOString()
                    })
                }, { transaction });
            }

            await transaction.commit();

            await AuditService.log('SETTLEMENT_PROCESSED', `Settlement ${settlementId} processed: ${settlement.amount} paid via ${settlement.method}`, settlement.tenantId, userId || undefined);

            return settlement;
        } catch (error) {
            await transaction.rollback();
            logger.error('Failed to process settlement', { error: error instanceof Error ? error.message : String(error), settlementId });
            throw new Error(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Reverse a transaction
     */
    static async reverseTransaction(transactionId: string, reason: string, userId: string): Promise<WalletTransaction> {
        const transaction = await sequelize.transaction();

        try {
            const walletTransaction = await WalletTransaction.findByPk(transactionId, { transaction });
            if (!walletTransaction) throw new Error('Transaction not found');

            if (walletTransaction.status === 'REVERSED') throw new Error('Transaction already reversed');

            const wallet = await Wallet.findByPk(walletTransaction.walletId, { transaction });
            if (!wallet) throw new Error('Wallet not found');

            // Reverse the transaction
            let newBalance = BigInt(wallet.balance);
            let newPendingBalance = BigInt(wallet.pendingBalance);
            let newSettledBalance = BigInt(wallet.settledBalance);
            let newFrozenBalance = BigInt(wallet.frozenBalance);

            if (walletTransaction.transactionType === 'CREDIT') {
                // Reverse credit (debit the wallet)
                newBalance -= BigInt(walletTransaction.amount);
                if (walletTransaction.referenceType === 'PAYMENT') {
                    newPendingBalance -= BigInt(walletTransaction.amount);
                } else if (walletTransaction.referenceType === 'SETTLEMENT') {
                    newFrozenBalance -= BigInt(walletTransaction.amount);
                }
            } else if (walletTransaction.transactionType === 'DEBIT' || walletTransaction.transactionType === 'FEE') {
                // Reverse debit (credit the wallet)
                newBalance += BigInt(walletTransaction.amount);
                if (walletTransaction.referenceType === 'SETTLEMENT') {
                    newSettledBalance -= BigInt(walletTransaction.amount);
                    newPendingBalance += BigInt(walletTransaction.amount);
                }
            }

            await wallet.update({
                balance: newBalance,
                pendingBalance: newPendingBalance,
                settledBalance: newSettledBalance,
                frozenBalance: newFrozenBalance
            }, { transaction });

            // Mark original transaction as reversed
            await walletTransaction.update({
                status: 'REVERSED'
            }, { transaction });

            // Create reversal transaction
            const reversalTransaction = await WalletTransaction.create({
                walletId: wallet.id,
                amount: walletTransaction.amount,
                transactionType: 'REVERSAL',
                referenceId: walletTransaction.id,
                referenceType: 'REVERSAL',
                balanceAfter: newBalance,
                description: `Reversal of transaction ${walletTransaction.id}: ${reason}`,
                status: 'COMPLETED',
                createdBy: userId,
                metadata: JSON.stringify({
                    originalTransactionId: walletTransaction.id,
                    originalAmount: walletTransaction.amount,
                    originalType: walletTransaction.transactionType,
                    reason: reason
                }),
                tenantId: walletTransaction.tenantId
            }, { transaction });

            // If this was a payment, update the payment status
            if (walletTransaction.referenceType === 'PAYMENT') {
                const payment = await Payment.findByPk(walletTransaction.referenceId || undefined);
                if (payment) {
                    await payment.update({
                        status: 'REVERSED'
                    }, { transaction });
                }
            }

            // If this was a settlement, update the settlement status
            if (walletTransaction.referenceType === 'SETTLEMENT') {
                const settlement = await Settlement.findByPk(walletTransaction.referenceId || undefined);
                if (settlement) {
                    await settlement.update({
                        status: 'REVERSED'
                    }, { transaction });
                }
            }

            await transaction.commit();

            await AuditService.log('TRANSACTION_REVERSED', `Transaction ${transactionId} reversed: ${reason}`, walletTransaction.tenantId, userId || undefined);

            return reversalTransaction;
        } catch (error) {
            await transaction.rollback();
            logger.error('Failed to reverse transaction', { error: error instanceof Error ? error.message : String(error), transactionId });
            throw new Error(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Get wallet transactions by owner
     */
    static async getWalletTransactionsByOwner(ownerId: string, ownerType: 'TENANT' | 'SUBSCRIBER' | 'AGENT' = 'TENANT', limit: number = 50, offset: number = 0): Promise<WalletTransaction[]> {
        const wallet = await Wallet.findOne({ where: { ownerId, ownerType } });
        if (!wallet) return [];

        return WalletTransaction.findAll({
            where: { walletId: wallet.id },
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });
    }

    /**
     * Get wallet transactions
     */
    static async getWalletTransactions(walletId: string, limit: number = 50, offset: number = 0): Promise<WalletTransaction[]> {
        return WalletTransaction.findAll({
            where: { walletId },
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });
    }

    /**
     * Get wallet statement
     */
    static async getWalletStatement(walletId: string, startDate: Date, endDate: Date): Promise<WalletTransaction[]> {
        return WalletTransaction.findAll({
            where: {
                walletId,
                createdAt: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                }
            },
            order: [['createdAt', 'DESC']]
        });
    }

    /**
     * Manual wallet adjustment (for corrections)
     */
    static async manualAdjustment(walletId: string, amount: number, reason: string, userId: string): Promise<WalletTransaction> {
        const transaction = await sequelize.transaction();

        try {
            const wallet = await Wallet.findByPk(walletId, { transaction });
            if (!wallet) throw new Error('Wallet not found');

            const newBalance = BigInt(wallet.balance) + BigInt(amount);

            await wallet.update({
                balance: newBalance
            }, { transaction });

            const walletTransaction = await WalletTransaction.create({
                walletId: wallet.id,
                amount: amount,
                transactionType: amount > 0 ? 'CREDIT' : 'DEBIT',
                referenceId: undefined,
                referenceType: 'ADJUSTMENT',
                balanceAfter: newBalance,
                description: `Manual adjustment: ${reason}`,
                status: 'COMPLETED',
                createdBy: userId,
                metadata: JSON.stringify({
                    adjustmentType: amount > 0 ? 'credit' : 'debit',
                    reason: reason,
                    adjustedBy: userId
                }),
                tenantId: wallet.tenantId
            }, { transaction });

            await transaction.commit();

            await AuditService.log('WALLET_ADJUSTMENT', `Manual adjustment: ${amount} - ${reason}`, wallet.tenantId, userId || undefined);

            return walletTransaction;
        } catch (error) {
            await transaction.rollback();
            logger.error('Failed to make manual adjustment', { error: error instanceof Error ? error.message : String(error), walletId });
            throw new Error(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Bill for SMS usage
     */
    static async billSms(tenantId: string, smsLogId: string): Promise<void> {
        const transaction = await sequelize.transaction();
        try {
            const tenant = await Tenant.findByPk(tenantId);
            if (!tenant || !tenant.smsFee) {
                await transaction.commit();
                return;
            }

            const fee = BigInt(tenant.smsFee);
            const wallet = await Wallet.findOne({ where: { ownerId: tenantId, ownerType: 'TENANT' } });
            if (!wallet) throw new Error('Tenant wallet not found');

            const currentBalance = BigInt(wallet.balance);
            const currentSettledBalance = BigInt(wallet.settledBalance);

            // Deduct from wallet
            await wallet.update({
                balance: currentBalance - fee,
                settledBalance: currentSettledBalance - fee
            }, { transaction });

            // Create wallet transaction
            await WalletTransaction.create({
                walletId: wallet.id,
                amount: fee,
                transactionType: 'FEE',
                referenceId: smsLogId,
                referenceType: 'SMS',
                balanceAfter: currentBalance - fee,
                description: `SMS notification fee`,
                status: 'COMPLETED',
                tenantId: tenantId
            }, { transaction });

            // Update platform wallet
            await this.updatePlatformWallet(fee, 'CREDIT', smsLogId, transaction);

            // Record Platform Transaction
            await PlatformTransaction.create({
                type: 'FEE_SMS',
                amount: fee,
                tenantId: tenantId,
                referenceId: smsLogId
            }, { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            logger.error('Failed to bill SMS usage', { error: error instanceof Error ? error.message : String(error), tenantId });
        }
    }

    /**
     * Bill for base subscription
     */
    static async billSubscription(tenantId: string): Promise<void> {
        const transaction = await sequelize.transaction();
        try {
            const tenant = await Tenant.findByPk(tenantId);
            if (!tenant || !tenant.baseMonthlyFee) {
                await transaction.commit();
                return;
            }

            const fee = BigInt(tenant.baseMonthlyFee);
            const wallet = await Wallet.findOne({ where: { ownerId: tenantId, ownerType: 'TENANT' } });
            if (!wallet) throw new Error('Tenant wallet not found');

            const currentBalance = BigInt(wallet.balance);
            const currentSettledBalance = BigInt(wallet.settledBalance);

            // Deduct from wallet
            await wallet.update({
                balance: currentBalance - fee,
                settledBalance: currentSettledBalance - fee
            }, { transaction });

            // Create wallet transaction
            await WalletTransaction.create({
                walletId: wallet.id,
                amount: fee,
                transactionType: 'FEE',
                referenceType: 'SUBSCRIPTION',
                balanceAfter: currentBalance - fee,
                description: `Monthly platform subscription fee`,
                status: 'COMPLETED',
                tenantId: tenantId
            }, { transaction });

            // Update platform wallet
            await this.updatePlatformWallet(fee, 'CREDIT', null, transaction);

            // Record Platform Transaction
            await PlatformTransaction.create({
                type: 'FEE_SUBSCRIPTION',
                amount: fee,
                tenantId: tenantId
            }, { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            logger.error('Failed to bill subscription', { error: error instanceof Error ? error.message : String(error), tenantId });
        }
    }

    /**
     * Get platform wallet balance
     */
    static async getPlatformWalletBalance(): Promise<{ balance: number; pending: number; currency: string }> {
        const platformWallet = await PlatformWallet.findOne() || { balance: BigInt(0), pendingBalance: BigInt(0), currency: 'KES' };
        return {
            balance: Number(platformWallet.balance),
            pending: Number(platformWallet.pendingBalance),
            currency: (platformWallet as any).currency
        };
    }

    /**
     * Reconcile wallet balance against transaction ledger
     */
    static async reconcileWallet(tenantId: string): Promise<{
        actualBalance: number;
        ledgerBalance: number;
        discrepancy: number;
        status: 'MATCH' | 'MISMATCH';
    }> {
        const wallet = await Wallet.findOne({ where: { ownerId: tenantId, ownerType: 'TENANT' } });
        if (!wallet) throw new Error('Wallet not found');

        // Include both COMPLETED and PENDING settlements since they affect balance immediately
        const transactions = await WalletTransaction.findAll({
            where: {
                walletId: wallet.id,
                [Op.or]: [
                    { status: 'COMPLETED' },
                    { transactionType: 'SETTLEMENT', status: 'PENDING' }
                ]
            }
        });

        let ledgerBalance = 0n;
        for (const tx of transactions) {
            const amount = BigInt(tx.amount);
            if (['CREDIT', 'REVERSAL'].includes(tx.transactionType)) {
                ledgerBalance += amount;
            } else {
                ledgerBalance -= amount;
            }
        }

        const actualBalance = BigInt(wallet.balance || 0);
        const discrepancy = actualBalance - ledgerBalance;

        return {
            actualBalance: Number(actualBalance),
            ledgerBalance: Number(ledgerBalance),
            discrepancy: Number(discrepancy),
            status: discrepancy === 0n ? 'MATCH' : 'MISMATCH'
        };
    }

    /**
     * Fetch full auditable trace for a transaction
     */
    static async getTransactionTrace(transactionId: string, tenantId: string): Promise<any> {
        const tx = await WalletTransaction.findOne({
            where: { id: transactionId, tenantId }
        });

        if (!tx) throw new Error('Transaction not found or unauthorized');

        let sourceData: any = null;

        if (tx.referenceType === 'PAYMENT' && tx.referenceId) {
            const payment = await Payment.findByPk(tx.referenceId);
            if (payment) {
                sourceData = {
                    type: 'GATEWAY_PAYMENT',
                    gateway: payment.paymentChannel,
                    reference: payment.mpesaReceiptNumber || payment.intasendTrackingId,
                    rawPayload: payment.rawCallback ? JSON.parse(payment.rawCallback) : null,
                    completedAt: payment.completedAt
                };
            }
        } else if (tx.referenceType === 'SETTLEMENT' && tx.referenceId) {
            const settlement = await Settlement.findByPk(tx.referenceId);
            if (settlement) {
                sourceData = {
                    type: 'SETTLEMENT',
                    method: settlement.method,
                    reference: settlement.referenceNumber,
                    status: settlement.status,
                    paidAt: settlement.paidAt
                };
            }
        }

        const auditLogs = await AuditLog.findAll({
            where: {
                tenantId,
                details: { [Op.like]: `%${transactionId}%` }
            },
            order: [['createdAt', 'DESC']]
        });

        return {
            transaction: tx,
            source: sourceData,
            auditTrail: auditLogs
        };
    }
}