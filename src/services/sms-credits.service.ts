import { Op, Transaction } from 'sequelize';
import { sequelize } from '../models';
import {
    TenantSmsWallet, SmsTransaction, SmsPackage, Tenant,
    WalletTransaction, Wallet, AuditLog, SMSLog, Campaign,
    SmsCampaignMessage, Subscriber, AdminUser
} from '../models';
import { WalletService } from './wallet.service';
import { SmsGatewayService } from './sms-gateway.service';
import { sendEmail } from './emailService';
import { IntaSendService } from './intasend.service';
import logger from '../utils/logger';
import axios from 'axios';
import crypto from 'crypto';


const INVOICE_PREFIX = 'SMS-INV';

function generateInvoiceNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${INVOICE_PREFIX}-${ts}-${rand}`;
}

export class SmsCreditsService {

    // ================================================================
    // WALLET INITIALIZATION
    // ================================================================

    /**
     * Ensure a TenantSmsWallet exists for this tenant.
     * Called lazily — on first balance check or purchase.
     */
    static async ensureWallet(tenantId: string): Promise<TenantSmsWallet> {
        const [wallet] = await TenantSmsWallet.findOrCreate({
            where: { tenantId },
            defaults: { tenantId, balance: 0, usedCredits: 0, purchasedCredits: 0 }
        });
        return wallet;
    }

    // ================================================================
    // BALANCE & STATS
    // ================================================================

    static async getBalance(tenantId: string): Promise<{
        balance: number;
        usedCredits: number;
        purchasedCredits: number;
        lastPurchaseAt: Date | null;
        lowBalanceThreshold: number;
    }> {
        const wallet = await this.ensureWallet(tenantId);
        return {
            balance: wallet.balance,
            usedCredits: wallet.usedCredits,
            purchasedCredits: wallet.purchasedCredits,
            lastPurchaseAt: wallet.lastPurchaseAt,
            lowBalanceThreshold: wallet.lowBalanceThreshold,
        };
    }

    static async getDashboardStats(tenantId: string): Promise<{
        balance: number;
        usedToday: number;
        usedThisMonth: number;
        totalPurchased: number;
        totalTransactions: number;
        lastPurchase: Date | null;
        campaignSuccessRate: number;
    }> {
        const wallet = await this.ensureWallet(tenantId);
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Messages sent today
        const todayMessages = await SmsCampaignMessage.count({
            where: {
                tenantId,
                status: { [Op.in]: ['SENT', 'DELIVERED'] },
                sentAt: { [Op.gte]: startOfDay }
            }
        });

        // Messages sent this month
        const monthMessages = await SmsCampaignMessage.count({
            where: {
                tenantId,
                status: { [Op.in]: ['SENT', 'DELIVERED'] },
                sentAt: { [Op.gte]: startOfMonth }
            }
        });

        // Campaign success rate
        const totalSent = await SmsCampaignMessage.count({ where: { tenantId, status: { [Op.in]: ['SENT', 'DELIVERED'] } } });
        const totalFailed = await SmsCampaignMessage.count({ where: { tenantId, status: 'FAILED' } });
        const totalAttempted = totalSent + totalFailed;
        const successRate = totalAttempted > 0 ? Math.round((totalSent / totalAttempted) * 100) : 0;

        const totalTransactions = await SmsTransaction.count({ where: { tenantId, status: 'COMPLETED' } });

        return {
            balance: wallet.balance,
            usedToday: todayMessages,
            usedThisMonth: monthMessages,
            totalPurchased: wallet.purchasedCredits,
            totalTransactions,
            lastPurchase: wallet.lastPurchaseAt,
            campaignSuccessRate: successRate,
        };
    }

    // ================================================================
    // PACKAGES (Tenant-facing, sanitized — no costPrice)
    // ================================================================

    static async getActivePackages(): Promise<object[]> {
        const packages = await SmsPackage.findAll({
            where: { status: 'ACTIVE' },
            order: [['sortOrder', 'ASC'], ['smsCount', 'ASC']],
            attributes: ['id', 'name', 'smsCount', 'sellingPrice', 'description', 'isCustom']
        });
        return packages.map(p => ({
            id: p.id,
            name: p.name,
            smsCount: p.smsCount,
            sellingPrice: Number(p.sellingPrice),
            description: p.description,
            isCustom: p.isCustom,
            costPerSms: p.smsCount > 0 ? Number(p.sellingPrice) / p.smsCount : 0,
        }));
    }

    // ================================================================
    // PURCHASE — WALLET
    // ================================================================

    static async purchaseWithWallet(tenantId: string, packageId: string, userId: string, idempotencyKey: string): Promise<{
        success: boolean;
        smsTransaction: SmsTransaction;
        creditsAdded: number;
        newBalance: number;
    }> {
        // Idempotency check
        const existing = await SmsTransaction.findOne({ where: { idempotencyKey } });
        if (existing) {
            throw new Error('DUPLICATE_PURCHASE: This purchase has already been processed.');
        }

        const pkg = await SmsPackage.findByPk(packageId);
        if (!pkg || pkg.status !== 'ACTIVE') throw new Error('Package not found or inactive');

        const tenantWallet = await WalletService.getWalletBalanceByOwner(tenantId, 'TENANT');
        if (tenantWallet.balance < Number(pkg.sellingPrice)) {
            throw new Error('INSUFFICIENT_BALANCE: Wallet balance is too low to purchase this package.');
        }

        const t = await sequelize.transaction();
        try {
            // Deduct from tenant wallet
            const tenantWalletRecord = await Wallet.findOne({ where: { ownerId: tenantId, ownerType: 'TENANT' } });
            if (!tenantWalletRecord) throw new Error('Tenant wallet not found');

            const newWalletBalance = Number(tenantWalletRecord.balance) - Number(pkg.sellingPrice);
            await tenantWalletRecord.update({ balance: newWalletBalance }, { transaction: t });

            await WalletTransaction.create({
                walletId: tenantWalletRecord.id,
                amount: Number(pkg.sellingPrice),
                transactionType: 'DEBIT',
                referenceType: 'SMS_PURCHASE',
                balanceAfter: newWalletBalance,
                description: `SMS Credits purchase: ${pkg.name} (${pkg.smsCount} SMS)`,
                status: 'COMPLETED',
                createdBy: userId,
                tenantId,
                metadata: JSON.stringify({ packageId, creditsAdded: pkg.smsCount }),
            }, { transaction: t });

            // Add SMS credits
            const smsWallet = await this.ensureWallet(tenantId);
            const newSmsBalance = smsWallet.balance + pkg.smsCount;
            await smsWallet.update({
                balance: newSmsBalance,
                purchasedCredits: smsWallet.purchasedCredits + pkg.smsCount,
                lastPurchaseAt: new Date(),
                lastPurchasePackageId: packageId,
                lowBalanceNotified: false,
            }, { transaction: t });

            const invoiceNumber = generateInvoiceNumber();
            const smsTx = await SmsTransaction.create({
                tenantId,
                packageId,
                creditsAdded: pkg.smsCount,
                amount: Number(pkg.sellingPrice),
                paymentMethod: 'WALLET',
                paymentReference: `WALLET-${Date.now()}`,
                idempotencyKey,
                status: 'COMPLETED',
                invoiceNumber,
                completedAt: new Date(),
                metadata: JSON.stringify({ packageName: pkg.name, userId }),
            }, { transaction: t });

            await AuditLog.create({
                action: 'SMS_CREDITS_PURCHASED',
                details: `Tenant ${tenantId} purchased ${pkg.smsCount} SMS credits via wallet. Invoice: ${invoiceNumber}`,
                tenantId,
                userId,
            }, { transaction: t });

            await t.commit();

            // Post-commit: send confirmation email (fire & forget)
            this.sendPurchaseConfirmationEmail(tenantId, smsTx, pkg).catch(err =>
                logger.error('Failed to send SMS purchase confirmation email', { error: err.message })
            );

            return { success: true, smsTransaction: smsTx, creditsAdded: pkg.smsCount, newBalance: newSmsBalance };
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    // ================================================================
    // PURCHASE — INTASEND
    // ================================================================

    static async initiateIntasendPurchase(tenantId: string, packageId: string, phoneNumber: string, userId: string, idempotencyKey: string): Promise<{
        checkoutId: string;
        trackingId: string;
        smsTransactionId: string;
    }> {
        // Idempotency check
        const existing = await SmsTransaction.findOne({ where: { idempotencyKey } });
        if (existing && existing.status !== 'FAILED') {
            throw new Error('DUPLICATE_PURCHASE: This purchase request already exists.');
        }

        const pkg = await SmsPackage.findByPk(packageId);
        if (!pkg || pkg.status !== 'ACTIVE') throw new Error('Package not found or inactive');

        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) throw new Error('Tenant not found');

        // Create pending transaction
        const invoiceNumber = generateInvoiceNumber();
        const smsTx = await SmsTransaction.create({
            tenantId,
            packageId,
            creditsAdded: pkg.smsCount,
            amount: Number(pkg.sellingPrice),
            paymentMethod: 'INTASEND',
            status: 'PENDING',
            invoiceNumber,
            idempotencyKey,
            metadata: JSON.stringify({ packageName: pkg.name, userId, phoneNumber }),
        });

        try {
            const result = await IntaSendService.initiateStkPush({
                paymentId: smsTx.id,
                amount: BigInt(pkg.sellingPrice),
                phoneNumber,
            });

            await smsTx.update({
                intasendCheckoutId: result.id,
                intasendTrackingId: result.tracking_id,
            });

            await AuditLog.create({
                action: 'SMS_PURCHASE_INTASEND_INITIATED',
                details: `IntaSend STK push initiated for SMS purchase. Package: ${pkg.name}. Tracking: ${result.tracking_id}`,
                tenantId,
                userId,
            });

            return {
                checkoutId: result.id,
                trackingId: result.tracking_id,
                smsTransactionId: smsTx.id,
            };
        } catch (error: any) {
            await smsTx.update({ status: 'FAILED', failureReason: error.message });
            throw error;
        }
    }

    /**
     * Called by webhook / polling after IntaSend payment completes.
     */
    static async fulfillIntasendPurchase(trackingId: string): Promise<{ success: boolean; creditsAdded: number }> {
        const smsTx = await SmsTransaction.findOne({ where: { intasendTrackingId: trackingId } });
        if (!smsTx) {
            logger.warn('SMS fulfillment: no transaction found for tracking', { trackingId });
            return { success: false, creditsAdded: 0 };
        }
        if (smsTx.status === 'COMPLETED') {
            return { success: true, creditsAdded: smsTx.creditsAdded }; // Idempotent
        }

        const pkg = smsTx.packageId ? await SmsPackage.findByPk(smsTx.packageId) : null;

        const t = await sequelize.transaction();
        try {
            const smsWallet = await this.ensureWallet(smsTx.tenantId);
            const newBalance = smsWallet.balance + smsTx.creditsAdded;
            await smsWallet.update({
                balance: newBalance,
                purchasedCredits: smsWallet.purchasedCredits + smsTx.creditsAdded,
                lastPurchaseAt: new Date(),
                lastPurchasePackageId: smsTx.packageId,
                lowBalanceNotified: false,
            }, { transaction: t });

            await smsTx.update({
                status: 'COMPLETED',
                completedAt: new Date(),
                paymentReference: trackingId,
            }, { transaction: t });

            await AuditLog.create({
                action: 'SMS_CREDITS_FULFILLED',
                details: `${smsTx.creditsAdded} SMS credits added via IntaSend. Invoice: ${smsTx.invoiceNumber}`,
                tenantId: smsTx.tenantId,
            }, { transaction: t });

            await t.commit();

            if (pkg) {
                this.sendPurchaseConfirmationEmail(smsTx.tenantId, smsTx, pkg).catch(() => { });
            }

            return { success: true, creditsAdded: smsTx.creditsAdded };
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    // ================================================================
    // DEDUCT CREDITS (used by SMS sending)
    // ================================================================

    /**
     * Atomically deduct credits from a tenant's SMS wallet.
     * Returns false if insufficient balance.
     */
    static async deductCredits(tenantId: string, count: number, t?: Transaction): Promise<boolean> {
        const wallet = await TenantSmsWallet.findOne({
            where: { tenantId },
            transaction: t,
            lock: t ? true : undefined,
        });
        if (!wallet) return false;
        if (wallet.balance < count) return false;

        await wallet.update({
            balance: wallet.balance - count,
            usedCredits: wallet.usedCredits + count,
        }, { transaction: t });

        // Check low balance after deduction
        if (wallet.balance - count <= wallet.lowBalanceThreshold && !wallet.lowBalanceNotified) {
            await wallet.update({ lowBalanceNotified: true }, { transaction: t });
            // Fire-and-forget notification
            this.notifyLowBalance(tenantId, wallet.balance - count).catch(() => { });
        }

        return true;
    }

    // ================================================================
    // HISTORY
    // ================================================================

    static async getHistory(tenantId: string, page = 1, limit = 20, status?: string): Promise<{
        data: SmsTransaction[];
        total: number;
        page: number;
        pages: number;
    }> {
        const offset = (page - 1) * limit;
        const where: Record<string, unknown> = { tenantId };
        if (status) where.status = status;

        const { count, rows } = await SmsTransaction.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            include: [{ model: SmsPackage, attributes: ['name', 'smsCount'], required: false }],
        });

        return {
            data: rows,
            total: count,
            page,
            pages: Math.ceil(count / limit),
        };
    }

    // ================================================================
    // CAMPAIGNS — SMS specific
    // ================================================================

    /**
     * Create and send an SMS campaign. Checks and deducts credits before sending.
     */
    static async createAndSendSmsCampaign(tenantId: string, input: {
        name: string;
        content: string;
        recipientType: 'ALL' | 'ACTIVE' | 'CUSTOM';
        phoneNumbers?: string[];
        scheduledAt?: Date;
        templateId?: string;
    }, userId: string): Promise<{ campaignId: string; recipientCount: number; creditsRequired: number }> {

        // 1. Resolve recipients
        let phoneNumbers: string[] = [];
        if (input.recipientType === 'CUSTOM' && input.phoneNumbers) {
            phoneNumbers = [...new Set(input.phoneNumbers.filter(p => p && p.trim()))];
        } else {
            const where: Record<string, unknown> = { tenantId };
            if (input.recipientType === 'ACTIVE') where.status = 'ACTIVE';
            const subscribers = await Subscriber.findAll({
                where,
                attributes: ['phoneNumber'],
                raw: true
            });
            phoneNumbers = [...new Set(subscribers.map((s: any) => s.phoneNumber).filter(Boolean))];
        }

        if (phoneNumbers.length === 0) throw new Error('No recipients found for this campaign');

        const creditsRequired = phoneNumbers.length; // 1 credit = 1 SMS

        // 2. Check balance
        const wallet = await this.ensureWallet(tenantId);
        if (wallet.balance < creditsRequired) {
            throw new Error(`INSUFFICIENT_CREDITS: Need ${creditsRequired} credits but only have ${wallet.balance}.`);
        }

        const t = await sequelize.transaction();
        try {
            // 3. Create Campaign record
            const campaign = await Campaign.create({
                tenantId,
                name: input.name,
                type: 'SMS',
                content: input.content,
                status: input.scheduledAt ? 'DRAFT' : 'SENDING',
                scheduledAt: input.scheduledAt || null,
                templateId: input.templateId || null,
                totalRecipients: phoneNumbers.length,
                sentCount: 0,
                failedCount: 0,
            }, { transaction: t });

            // 4. Deduct credits atomically
            const deducted = await this.deductCredits(tenantId, creditsRequired, t);
            if (!deducted) throw new Error('INSUFFICIENT_CREDITS: Failed to deduct credits.');

            // 5. Create per-recipient message records
            const messageRecords = phoneNumbers.map(phone => ({
                campaignId: campaign.id,
                tenantId,
                phoneNumber: phone,
                message: input.content,
                status: 'PENDING' as const,
                scheduledAt: input.scheduledAt || null,
                creditsCost: 1,
            }));
            await SmsCampaignMessage.bulkCreate(messageRecords, { transaction: t });

            await AuditLog.create({
                action: 'SMS_CAMPAIGN_CREATED',
                details: `Campaign "${input.name}" created. Recipients: ${phoneNumbers.length}. Credits deducted: ${creditsRequired}`,
                tenantId,
                userId,
            }, { transaction: t });

            await t.commit();

            // 6. Send (async, outside transaction)
            if (!input.scheduledAt) {
                this.dispatchCampaignMessages(campaign.id, tenantId).catch(err =>
                    logger.error('Campaign dispatch error', { campaignId: campaign.id, error: err.message })
                );
            }

            return { campaignId: campaign.id, recipientCount: phoneNumbers.length, creditsRequired };
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    /**
     * Async message dispatch — sends messages via the configured gateway.
     */
    private static async dispatchCampaignMessages(campaignId: string, tenantId: string): Promise<void> {
        const gateway = await SmsGatewayService.getActiveGatewayDecrypted();
        const messages = await SmsCampaignMessage.findAll({
            where: { campaignId, status: 'PENDING' }
        });

        let sentCount = 0;
        let failedCount = 0;

        for (const msg of messages) {
            try {
                let providerRef = `PENDING-${Date.now()}`; // TODO: Replace with real provider reference after API integration

                if (gateway && gateway.provider === 'AFRICASTALKING' && gateway.apiKey) {
                    const response = await axios.post(
                        (gateway.apiBaseUrl || 'https://api.africastalking.com') + '/version1/messaging',
                        new URLSearchParams({
                            username: gateway.apiSecret || 'sandbox',
                            to: msg.phoneNumber,
                            message: msg.message,
                            from: gateway.senderId || '',
                        }),
                        {
                            headers: { 'apiKey': gateway.apiKey, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
                            timeout: 15000,
                        }
                    );
                    const recipient = response.data?.SMSMessageData?.Recipients?.[0];
                    if (recipient?.status === 'Success') {
                        providerRef = recipient.messageId;
                    } else {
                        throw new Error(`Provider error: ${recipient?.status}`);
                    }
                } else if (process.env.NODE_ENV === 'production' && !gateway) {
                    throw new Error('No active SMS gateway configured');
                }

                await msg.update({ status: 'SENT', providerReference: providerRef, sentAt: new Date() });

                // Log to existing SMSLog
                await SMSLog.create({
                    tenantId,
                    phoneNumber: msg.phoneNumber,
                    message: msg.message,
                    status: 'SENT',
                    cost: 100, // 1 credit = 1 KES (example)
                    providerReference: providerRef,
                });

                sentCount++;
            } catch (error: any) {
                logger.error('Campaign message send failed', { msgId: msg.id, error: error.message });
                const retries = msg.retries + 1;
                await msg.update({
                    status: retries >= 3 ? 'FAILED' : 'PENDING',
                    retries,
                    errorMessage: error.message,
                });
                if (retries >= 3) failedCount++;
            }
        }

        await Campaign.update(
            { status: 'COMPLETED', sentCount, failedCount },
            { where: { id: campaignId } }
        );
    }

    // ================================================================
    // REPORTS
    // ================================================================

    static async getMonthlyReport(tenantId: string, year: number, month: number): Promise<object> {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);

        const transactions = await SmsTransaction.findAll({
            where: { tenantId, status: 'COMPLETED', completedAt: { [Op.gte]: start, [Op.lt]: end } },
            include: [{ model: SmsPackage, attributes: ['name', 'smsCount'], required: false }]
        });

        const sent = await SmsCampaignMessage.count({
            where: { tenantId, status: { [Op.in]: ['SENT', 'DELIVERED'] }, sentAt: { [Op.gte]: start, [Op.lt]: end } }
        });
        const failed = await SmsCampaignMessage.count({
            where: { tenantId, status: 'FAILED', sentAt: { [Op.gte]: start, [Op.lt]: end } }
        });

        const totalSpend = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
        const totalCredits = transactions.reduce((sum, tx) => sum + tx.creditsAdded, 0);

        return {
            period: { year, month },
            totalSpend,
            totalCredits,
            totalTransactions: transactions.length,
            messagesSent: sent,
            messagesFailed: failed,
            successRate: (sent + failed) > 0 ? Math.round((sent / (sent + failed)) * 100) : 0,
            transactions,
        };
    }

    // ================================================================
    // PRIVATE HELPERS
    // ================================================================

    private static async sendPurchaseConfirmationEmail(tenantId: string, smsTx: SmsTransaction, pkg: SmsPackage): Promise<void> {
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return;

        const user = await AdminUser.findOne({ where: { tenantId, role: 'TENANT' } });
        if (!user) return;

        await sendEmail({
            to: user.email,
            subject: `SMS Credits Purchase Confirmed — ${pkg.name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0ea5e9;">SMS Credits Purchased Successfully</h2>
                    <p>Hello <strong>${tenant.name}</strong>,</p>
                    <p>Your purchase of <strong>${pkg.smsCount} SMS credits</strong> has been confirmed.</p>
                    <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;"><strong>Package</strong></td><td style="padding:8px; border:1px solid #e2e8f0;">${pkg.name}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;"><strong>Credits Added</strong></td><td style="padding:8px; border:1px solid #e2e8f0;">${smsTx.creditsAdded} SMS</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;"><strong>Amount Paid</strong></td><td style="padding:8px; border:1px solid #e2e8f0;">KES ${(Number(smsTx.amount) / 100).toFixed(2)}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;"><strong>Payment Method</strong></td><td style="padding:8px; border:1px solid #e2e8f0;">${smsTx.paymentMethod}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;"><strong>Invoice Number</strong></td><td style="padding:8px; border:1px solid #e2e8f0;">${smsTx.invoiceNumber}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;"><strong>Date</strong></td><td style="padding:8px; border:1px solid #e2e8f0;">${new Date().toLocaleDateString()}</td></tr>
                    </table>
                    <p style="color:#64748b; font-size:12px;">This is an automated confirmation from Jevish SMS System.</p>
                </div>
            `,
            action: 'SMS_PURCHASE_CONFIRMATION',
            userId: undefined,
        });
    }

    private static async notifyLowBalance(tenantId: string, currentBalance: number): Promise<void> {
        try {
            const tenant = await Tenant.findByPk(tenantId);
            const user = await AdminUser.findOne({ where: { tenantId, role: 'TENANT' } });
            if (!user || !tenant) return;

            await sendEmail({
                to: user.email,
                subject: '⚠️ Low SMS Balance Alert — Jevish',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #f59e0b;">⚠️ Low SMS Credit Balance</h2>
                        <p>Hello <strong>${tenant.name}</strong>,</p>
                        <p>Your SMS credit balance is running low.</p>
                        <p><strong>Current Balance: ${currentBalance} SMS credits</strong></p>
                        <p>Please purchase more credits to ensure uninterrupted messaging.</p>
                    </div>
                `,
                action: 'SMS_LOW_BALANCE_ALERT',
                userId: undefined,
            });
        } catch (err) {
            logger.error('Low balance notification failed', { tenantId, error: (err as Error).message });
        }
    }
}
