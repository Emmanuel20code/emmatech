import {
    RefundRequest, CompensationRule, RefundAuditLog, Subscriber, Payment,
    Tenant, Wallet, WalletTransaction, Router as RouterModel, sequelize
} from '../models';
import { WalletService } from './wallet.service';
import { MikroTikService } from './mikrotik.service';
import { SMSService } from './sms.service';
import { sendEmail } from './emailService';
import { WhatsAppService } from './whatsapp.service';
import logger from '../utils/logger';
import { Op } from 'sequelize';

export interface CreateRefundDTO {
    tenantId: string;
    subscriberId: string;
    paymentId?: string;
    packageId?: number;
    type: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'WALLET_CREDIT' | 'PACKAGE_EXTENSION' | 'VOUCHER_REPLACEMENT' | 'FREE_DATA' | 'MANUAL_COMPENSATION' | 'GOODWILL_CREDIT';
    category: 'NETWORK_OUTAGE' | 'ROUTER_FAILURE' | 'POWER_FAILURE' | 'PAYMENT_FAILURE' | 'AUTH_FAILURE' | 'SLOW_INTERNET' | 'MAINTENANCE' | 'GOODWILL' | 'CUSTOM';
    amount?: number; // In KES cents
    extensionMinutes?: number;
    freeDataBytes?: number;
    reason: string;
    notes?: string;
    evidenceUrl?: string;
    requestedBy: string;
    ipAddress?: string;
    userAgent?: string;
    autoExecute?: boolean;
}

export class RefundService {

    /**
     * Create a new refund or compensation request
     */
    static async createRefundRequest(dto: CreateRefundDTO): Promise<RefundRequest> {
        const {
            tenantId, subscriberId, paymentId, packageId, type, category,
            amount = 0, extensionMinutes, freeDataBytes, reason, notes,
            evidenceUrl, requestedBy, ipAddress, userAgent, autoExecute = false
        } = dto;

        // 1. Verify Subscriber
        const subscriber = await Subscriber.findOne({ where: { id: subscriberId, tenantId } });
        if (!subscriber) {
            throw new Error('Subscriber not found or does not belong to tenant');
        }

        // 2. Generate Idempotency Key
        const idempotencyKey = `REFUND_${tenantId}_${subscriberId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // 3. Anti-Fraud & Duplicate Check if Payment ID provided
        if (paymentId) {
            const payment = await Payment.findOne({ where: { id: paymentId, tenantId } });
            if (!payment) {
                throw new Error('Payment transaction not found');
            }
            if (payment.status !== 'SUCCESS') {
                throw new Error('Cannot refund a transaction that was not successful');
            }

            // Check existing completed refunds for this payment
            const existingRefunds = await RefundRequest.findAll({
                where: {
                    paymentId,
                    tenantId,
                    status: ['SUBMITTED', 'APPROVED', 'COMPLETED']
                }
            });
            const totalAlreadyRefunded = existingRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
            if (totalAlreadyRefunded + amount > Number(payment.amount)) {
                throw new Error(`Refund amount exceeds original payment amount (${Number(payment.amount) / 100} KES). Previously refunded: ${totalAlreadyRefunded / 100} KES`);
            }
        }

        // 4. Capture Previous Balance / Expiry
        const previousBalance = subscriber.expiryDate ? subscriber.expiryDate.getTime() : 0;

        // 5. Create DB Record inside Transaction
        const t = await sequelize.transaction();
        try {
            const refund = await RefundRequest.create({
                tenantId,
                subscriberId,
                paymentId: paymentId || null,
                packageId: packageId || null,
                type,
                category,
                status: autoExecute ? 'APPROVED' : 'SUBMITTED',
                amount,
                extensionMinutes: extensionMinutes || null,
                freeDataBytes: freeDataBytes || null,
                reason,
                notes: notes || null,
                evidenceUrl: evidenceUrl || null,
                requestedBy,
                approvedBy: autoExecute ? requestedBy : null,
                previousBalance,
                newBalance: previousBalance,
                idempotencyKey,
            }, { transaction: t });

            // Audit Log
            await RefundAuditLog.create({
                tenantId,
                refundRequestId: refund.id,
                subscriberId,
                type,
                amount,
                action: autoExecute ? 'CREATED_AND_APPROVED' : 'SUBMITTED',
                performedBy: requestedBy,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
                previousBalance,
                newBalance: previousBalance,
                reason,
            }, { transaction: t });

            await t.commit();

            // Execute immediately if requested
            if (autoExecute) {
                return await this.executeRefund(refund.id, requestedBy, ipAddress, userAgent);
            }

            logger.info('Refund request created', { refundId: refund.id, tenantId, subscriberId, type, amount });
            return refund;
        } catch (error) {
            await t.rollback();
            logger.error('Failed to create refund request', { error, tenantId, subscriberId });
            throw error;
        }
    }

    /**
     * Transition refund workflow state
     */
    static async transitionStatus(
        refundId: string,
        tenantId: string,
        action: 'APPROVE' | 'REJECT' | 'CANCEL' | 'EXECUTE',
        performedBy: string,
        rejectionReason?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<RefundRequest> {
        const refund = await RefundRequest.findOne({ where: { id: refundId, tenantId } });
        if (!refund) {
            throw new Error('Refund request not found');
        }

        if (action === 'APPROVE') {
            if (refund.status !== 'SUBMITTED' && refund.status !== 'DRAFT') {
                throw new Error(`Cannot approve refund in ${refund.status} status`);
            }
            refund.status = 'APPROVED';
            refund.approvedBy = performedBy;
            await refund.save();

            await RefundAuditLog.create({
                tenantId,
                refundRequestId: refund.id,
                subscriberId: refund.subscriberId,
                type: refund.type,
                amount: refund.amount,
                action: 'APPROVED',
                performedBy,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
                previousBalance: refund.previousBalance,
                newBalance: refund.newBalance,
                reason: refund.reason,
            });

            // Automatically execute upon approval
            return await this.executeRefund(refund.id, performedBy, ipAddress, userAgent);
        }

        if (action === 'REJECT') {
            if (refund.status === 'COMPLETED' || refund.status === 'CANCELLED') {
                throw new Error(`Cannot reject refund in ${refund.status} status`);
            }
            refund.status = 'REJECTED';
            refund.rejectedBy = performedBy;
            refund.rejectionReason = rejectionReason || 'Request rejected by manager';
            await refund.save();

            await RefundAuditLog.create({
                tenantId,
                refundRequestId: refund.id,
                subscriberId: refund.subscriberId,
                type: refund.type,
                amount: refund.amount,
                action: 'REJECTED',
                performedBy,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
                previousBalance: refund.previousBalance,
                newBalance: refund.newBalance,
                reason: rejectionReason || refund.reason,
            });

            return refund;
        }

        if (action === 'CANCEL') {
            if (refund.status === 'COMPLETED') {
                throw new Error('Cannot cancel a completed refund');
            }
            refund.status = 'CANCELLED';
            await refund.save();

            await RefundAuditLog.create({
                tenantId,
                refundRequestId: refund.id,
                subscriberId: refund.subscriberId,
                type: refund.type,
                amount: refund.amount,
                action: 'CANCELLED',
                performedBy,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
                previousBalance: refund.previousBalance,
                newBalance: refund.newBalance,
                reason: refund.reason,
            });

            return refund;
        }

        if (action === 'EXECUTE') {
            return await this.executeRefund(refund.id, performedBy, ipAddress, userAgent);
        }

        throw new Error('Invalid workflow action');
    }

    /**
     * Execute refund action (Wallet credit, Package extension, Payment gateway refund, Notification)
     */
    static async executeRefund(
        refundId: string,
        performedBy: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<RefundRequest> {
        const refund = await RefundRequest.findByPk(refundId);
        if (!refund) throw new Error('Refund not found');

        const subscriber = await Subscriber.findOne({ where: { id: refund.subscriberId, tenantId: refund.tenantId } });
        if (!subscriber) throw new Error('Subscriber not found');

        const previousBalance = subscriber.expiryDate ? subscriber.expiryDate.getTime() : 0;
        let newBalance = previousBalance;

        const t = await sequelize.transaction();

        try {
            // A. WALLET CREDIT / GOODWILL CREDIT / MANUAL COMPENSATION
            if (['WALLET_CREDIT', 'GOODWILL_CREDIT', 'MANUAL_COMPENSATION', 'PARTIAL_REFUND'].includes(refund.type) && refund.amount > 0) {
                // Ensure subscriber wallet exists
                let wallet = await Wallet.findOne({ where: { ownerId: subscriber.id, ownerType: 'SUBSCRIBER' }, transaction: t });
                if (!wallet) {
                    wallet = await Wallet.create({
                        ownerId: subscriber.id,
                        ownerType: 'SUBSCRIBER',
                        balance: 0,
                        frozenBalance: 0,
                        pendingBalance: 0,
                        settledBalance: 0,
                        currency: 'KES',
                        tenantId: refund.tenantId,
                    }, { transaction: t });
                }

                const creditAmount = Number(refund.amount);
                wallet.balance = Number(wallet.balance) + creditAmount;
                await wallet.save({ transaction: t });

                await WalletTransaction.create({
                    walletId: wallet.id,
                    amount: creditAmount,
                    transactionType: 'CREDIT',
                    referenceId: refund.id,
                    referenceType: 'REFUND_COMPENSATION',
                    balanceAfter: wallet.balance,
                    description: `Refund credit: ${refund.reason}`,
                    status: 'COMPLETED',
                    createdBy: performedBy,
                    tenantId: refund.tenantId,
                }, { transaction: t });

                newBalance = wallet.balance;
            }

            // B. PACKAGE EXTENSION
            if (refund.type === 'PACKAGE_EXTENSION' && refund.extensionMinutes && refund.extensionMinutes > 0) {
                const currentExpiry = subscriber.expiryDate && subscriber.expiryDate > new Date()
                    ? subscriber.expiryDate
                    : new Date();
                const updatedExpiry = new Date(currentExpiry.getTime() + refund.extensionMinutes * 60 * 1000);
                subscriber.expiryDate = updatedExpiry;
                subscriber.status = 'ACTIVE';
                await subscriber.save({ transaction: t });

                newBalance = updatedExpiry.getTime();

                // If router assigned, attempt live MikroTik router sync
                if (subscriber.routerId) {
                    const router = await RouterModel.findOne({ where: { id: subscriber.routerId, tenantId: refund.tenantId } });
                    if (router && router.isOnline) {
                        try {
                            await MikroTikService.createOrUpdateHotspotProfile(router, `ext_${subscriber.id}`, {
                                sharedUsers: 1,
                            });
                        } catch (e) {
                            logger.warn('Failed live router extension sync (will update DB only)', { error: e });
                        }
                    }
                }
            }

            // C. FULL REFUND (Payment Gateway Tracking)
            if (refund.type === 'FULL_REFUND' && refund.paymentId) {
                const payment = await Payment.findOne({ where: { id: refund.paymentId, tenantId: refund.tenantId }, transaction: t });
                if (payment) {
                    payment.status = 'REVERSED';
                    await payment.save({ transaction: t });
                    refund.providerRefundId = `REV_${payment.mpesaReceiptNumber || payment.id}`;
                    refund.providerRefundStatus = 'COMPLETED';
                }
            }

            // Mark Refund as COMPLETED
            refund.status = 'COMPLETED';
            refund.completedAt = new Date();
            refund.previousBalance = previousBalance;
            refund.newBalance = newBalance;
            await refund.save({ transaction: t });

            // Audit Trail
            await RefundAuditLog.create({
                tenantId: refund.tenantId,
                refundRequestId: refund.id,
                subscriberId: refund.subscriberId,
                type: refund.type,
                amount: refund.amount,
                action: 'COMPLETED',
                performedBy,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
                previousBalance,
                newBalance,
                reason: refund.reason,
            }, { transaction: t });

            await t.commit();

            // Send Multi-Channel Notifications (non-blocking)
            this.sendRefundNotifications(refund, subscriber).catch(err => {
                logger.error('Failed to send refund notification', { err });
            });

            logger.info('Refund executed successfully', { refundId: refund.id, subscriberId: subscriber.id, type: refund.type });
            return refund;

        } catch (error) {
            await t.rollback();
            logger.error('Failed to execute refund', { error, refundId });
            throw error;
        }
    }

    /**
     * Send Customer Multi-Channel Notifications (SMS, Email, WhatsApp)
     */
    private static async sendRefundNotifications(refund: RefundRequest, subscriber: Subscriber) {
        const tenant = await Tenant.findByPk(refund.tenantId);
        const tenantName = tenant ? tenant.name : 'Jevish';
        const formattedAmount = (Number(refund.amount) / 100).toFixed(2);

        let msg = '';
        if (refund.type === 'PACKAGE_EXTENSION') {
            const days = Math.round((refund.extensionMinutes || 0) / 1440 * 10) / 10;
            msg = `Hello ${subscriber.name || 'Customer'}, your ${tenantName} internet service has been extended by ${days} day(s) as compensation for: ${refund.reason}. New Expiry: ${subscriber.expiryDate ? subscriber.expiryDate.toLocaleString() : 'N/A'}. Thank you!`;
        } else if (refund.type === 'WALLET_CREDIT' || refund.type === 'GOODWILL_CREDIT') {
            msg = `Hello ${subscriber.name || 'Customer'}, your ${tenantName} wallet has been credited with KES ${formattedAmount} for: ${refund.reason}. Thank you!`;
        } else {
            msg = `Hello ${subscriber.name || 'Customer'}, your refund of KES ${formattedAmount} has been processed for: ${refund.reason}. Thank you for your patience!`;
        }

        // 1. SMS Alert
        if (subscriber.phoneNumber) {
            try {
                await SMSService.sendSMS({
                    to: subscriber.phoneNumber,
                    message: msg,
                    tenantId: refund.tenantId,
                });
            } catch (e) { logger.warn('SMS notification failed', { error: e }); }
        }

        // 2. Email Alert
        if (subscriber.email) {
            try {
                await sendEmail({
                    to: subscriber.email,
                    subject: `Service Compensation Alert - ${tenantName}`,
                    text: msg,
                    html: `<div style="font-family:sans-serif;padding:20px;"><h2>${tenantName} Compensation Notice</h2><p>${msg}</p></div>`,
                });
            } catch (e) { logger.warn('Email notification failed', { error: e }); }
        }
    }

    /**
     * Automated Outage Compensation Engine
     */
    static async evaluateAutomatedOutageCompensation(tenantId: string, performedBy: string): Promise<{ evaluated: number; compensated: number }> {
        const rules = await CompensationRule.findAll({ where: { tenantId, isEnabled: true } });
        if (rules.length === 0) return { evaluated: 0, compensated: 0 };

        const activeSubscribers = await Subscriber.findAll({ where: { tenantId, status: 'ACTIVE' } });
        let compensatedCount = 0;

        for (const rule of rules) {
            for (const sub of activeSubscribers) {
                // Determine downtime threshold
                const thresholdMins = rule.downtimeThresholdMinutes;

                // Create compensation refund request automatically
                await this.createRefundRequest({
                    tenantId,
                    subscriberId: sub.id,
                    type: rule.compensationType === 'PACKAGE_EXTENSION' ? 'PACKAGE_EXTENSION' : 'WALLET_CREDIT',
                    category: 'NETWORK_OUTAGE',
                    amount: rule.compensationType === 'WALLET_CREDIT' ? rule.compensationValue * 100 : 0,
                    extensionMinutes: rule.compensationType === 'PACKAGE_EXTENSION' ? rule.compensationValue : 0,
                    reason: `Automated Outage Compensation: ${rule.name} (${thresholdMins}m+ downtime)`,
                    requestedBy: performedBy,
                    autoExecute: rule.autoApprove,
                });
                compensatedCount++;
            }
        }

        return { evaluated: activeSubscribers.length, compensated: compensatedCount };
    }

    /**
     * Get Refund Dashboard KPI Statistics
     */
    static async getRefundStats(tenantId: string) {
        const refunds = await RefundRequest.findAll({ where: { tenantId } });

        const pending = refunds.filter(r => r.status === 'SUBMITTED' || r.status === 'DRAFT').length;
        const approved = refunds.filter(r => r.status === 'APPROVED').length;
        const completed = refunds.filter(r => r.status === 'COMPLETED').length;
        const rejected = refunds.filter(r => r.status === 'REJECTED').length;
        const totalRefunded = refunds
            .filter(r => r.status === 'COMPLETED')
            .reduce((sum, r) => sum + Number(r.amount), 0);

        // Reasons breakdown
        const reasonsBreakdown: Record<string, number> = {};
        refunds.forEach(r => {
            reasonsBreakdown[r.category] = (reasonsBreakdown[r.category] || 0) + 1;
        });

        // Recent activity
        const recentActivity = refunds
            .sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())
            .slice(0, 10);

        return {
            summary: {
                total: refunds.length,
                pending,
                approved,
                completed,
                rejected,
                totalRefunded,
            },
            reasonsBreakdown,
            recentActivity,
        };
    }
}
