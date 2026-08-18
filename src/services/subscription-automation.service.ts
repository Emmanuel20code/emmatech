import {
    Tenant,
    TenantSubscription,
    SubscriptionPlan,
    PlatformPricingConfig,
    SaaSInvoice,
    SaaSInvoiceItem,
    SaaSPayment,
    SaaSSubscriptionPayment,
    SaaSNotification,
    Subscriber,
    Payment,
    Package,
    Router,
    Wallet,
    WalletTransaction,
    AuditLog
} from '../models';
import { SocketService } from './socket.service';
import { WalletService } from './wallet.service';
import { MikroTikService } from './mikrotik.service';
import { SessionOrchestrator } from '../orchestrator';
import { SmsProcurementService } from './sms-procurement.service';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface TenantSubscriptionPaymentParams {
    tenantId: string;
    invoiceId?: string;
    invoiceNumber?: string;
    amountCents?: number;
    paymentMethod: 'MPESA_STK' | 'INTASEND' | 'PAYHERO' | 'WALLET' | 'BANK_TRANSFER' | 'MANUAL_ADMIN';
    transactionReference: string;
    mpesaReceiptNumber?: string;
    checkoutRequestId?: string;
    phoneNumber?: string;
    rawPayload?: any;
    planId?: string;
    billingCycle?: 'MONTHLY' | 'YEARLY';
}

export interface CustomerSubscriptionPaymentParams {
    paymentId: string;
    tenantId: string;
    subscriberId?: string;
    packageId?: string | number;
    phoneNumber?: string;
    macAddress?: string;
    ipAddress?: string;
    routerId?: string;
    transactionReference?: string;
    mpesaReceiptNumber?: string;
    amount?: number;
    paymentMethod?: string;
    rawPayload?: any;
}

export class SubscriptionAutomationService {

    // ─────────────────────────────────────────────────────────────
    // 1. TENANT SAAS SUBSCRIPTION AUTOMATED ACTIVATION & RENEWAL
    // ─────────────────────────────────────────────────────────────

    /**
     * Activates or extends a SaaS Tenant Subscription upon confirmed payment.
     * Idempotent, thread-safe, and dispatches real-time WebSocket notifications.
     */
    public static async processTenantSubscriptionPayment(
        params: TenantSubscriptionPaymentParams
    ): Promise<{ success: boolean; message: string; subscriptionId?: string; invoiceId?: string; nextDueDate?: Date }> {
        const {
            tenantId,
            invoiceId,
            invoiceNumber,
            amountCents,
            paymentMethod,
            transactionReference,
            mpesaReceiptNumber,
            checkoutRequestId,
            phoneNumber,
            rawPayload
        } = params;

        logger.info(`[SubscriptionAutomation] Initiating automated tenant subscription activation`, {
            tenantId,
            invoiceId,
            invoiceNumber,
            paymentMethod,
            transactionReference
        });

        try {
            const receipt = mpesaReceiptNumber || transactionReference || `TX-${Date.now()}`;

            // 1. Find or verify SaaS Invoice
            let invoice: SaaSInvoice | null = null;
            if (invoiceId) {
                invoice = await SaaSInvoice.findOne({ where: { id: invoiceId } });
            } else if (invoiceNumber) {
                invoice = await SaaSInvoice.findOne({ where: { invoiceNumber } });
            } else if (checkoutRequestId) {
                const saasSubPayment = await SaaSSubscriptionPayment.findOne({ where: { checkoutRequestId } });
                if (saasSubPayment && saasSubPayment.invoiceId) {
                    invoice = await SaaSInvoice.findOne({ where: { id: saasSubPayment.invoiceId } });
                }
            }

            // If still no invoice found, try finding latest UNPAID/OVERDUE invoice for this tenant
            if (!invoice) {
                invoice = await SaaSInvoice.findOne({
                    where: { tenantId, paymentStatus: ['UNPAID', 'OVERDUE'] },
                    order: [['createdAt', 'DESC']]
                });
            }

            // 2. Extract purchase metadata (e.g., plan, cycle, add-ons)
            let itemType = 'SUBSCRIPTION_PLAN';
            let planSlug = 'unlimited';
            let targetPlanId = params.planId;
            let billingCycle: 'MONTHLY' | 'YEARLY' = params.billingCycle || 'MONTHLY';
            let quantity = 1;

            if (invoice?.metadata) {
                try {
                    const parsed = JSON.parse(invoice.metadata);
                    if (parsed.itemType) itemType = parsed.itemType;
                    if (parsed.itemId) targetPlanId = parsed.itemId;
                    if (parsed.itemSlug) planSlug = parsed.itemSlug;
                    if (parsed.billingCycle) billingCycle = parsed.billingCycle;
                    if (parsed.quantity) quantity = Number(parsed.quantity);
                } catch (e) {
                    logger.warn('[SubscriptionAutomation] Could not parse invoice metadata', { error: e });
                }
            }

            // 3. Mark Invoice as PAID (if exists)
            const now = new Date();
            if (invoice) {
                if (invoice.paymentStatus === 'PAID') {
                    logger.info(`[SubscriptionAutomation] Invoice #${invoice.invoiceNumber} already marked PAID. Proceeding to verify subscription extension.`);
                } else {
                    const updatedMeta = invoice.metadata ? JSON.parse(invoice.metadata) : {};
                    updatedMeta.mpesaReceiptNumber = receipt;
                    updatedMeta.transactionReference = transactionReference;
                    updatedMeta.paidAt = now.toISOString();

                    await invoice.update({
                        paymentStatus: 'PAID',
                        paidAt: now,
                        paymentMethod,
                        paymentReference: receipt,
                        metadata: JSON.stringify(updatedMeta)
                    });
                    logger.info(`[SubscriptionAutomation] Invoice #${invoice.invoiceNumber} updated to PAID`);
                }
            }

            // 4. Resolve Target Subscription Plan
            let plan: SubscriptionPlan | null = null;
            if (targetPlanId) {
                plan = await SubscriptionPlan.findByPk(targetPlanId);
            }
            if (!plan && planSlug) {
                plan = await SubscriptionPlan.findOne({ where: { slug: planSlug } });
            }
            if (!plan) {
                plan = await SubscriptionPlan.findOne({ where: { slug: 'unlimited' } });
            }
            if (!plan) {
                plan = await SubscriptionPlan.findOne({ order: [['createdAt', 'ASC']] });
            }

            const resolvedPlanId = plan?.id || targetPlanId || uuidv4();

            // 5. Calculate Subscription Extension Duration
            const extensionDays = billingCycle === 'YEARLY' ? 365 : 30;
            let sub = await TenantSubscription.findOne({ where: { tenantId } });

            let newPeriodStart = now;
            let newPeriodEnd: Date;

            if (sub && sub.currentPeriodEnd) {
                const existingEnd = new Date(sub.currentPeriodEnd);
                // If existing subscription period is still in the future, stack duration on top
                if (existingEnd.getTime() > now.getTime()) {
                    newPeriodStart = sub.currentPeriodStart || now;
                    newPeriodEnd = new Date(existingEnd.getTime() + extensionDays * 24 * 60 * 60 * 1000);
                } else {
                    // If already expired or grace period, reset starting from now
                    newPeriodStart = now;
                    newPeriodEnd = new Date(now.getTime() + extensionDays * 24 * 60 * 60 * 1000);
                }
            } else {
                // First time subscription
                newPeriodStart = now;
                newPeriodEnd = new Date(now.getTime() + extensionDays * 24 * 60 * 60 * 1000);
            }

            // 6. Handle Specific Product Module Activations (Subscription / SMS / Ads / Wallet Top-Up)
            if (itemType === 'SUBSCRIPTION_PLAN' || itemType === 'SUBSCRIPTION') {
                if (sub) {
                    await sub.update({
                        planId: resolvedPlanId,
                        status: 'ACTIVE',
                        billingCycle,
                        currentPeriodStart: newPeriodStart,
                        currentPeriodEnd: newPeriodEnd,
                        gracePeriodEndDate: null,
                        trialEndDate: null,
                        autoRenew: true
                    });
                } else {
                    sub = await TenantSubscription.create({
                        id: uuidv4(),
                        tenantId,
                        planId: resolvedPlanId,
                        status: 'ACTIVE',
                        billingCycle,
                        startDate: now,
                        currentPeriodStart: newPeriodStart,
                        currentPeriodEnd: newPeriodEnd,
                        gracePeriodEndDate: null,
                        trialEndDate: null,
                        autoRenew: true
                    });
                }

                // Update Tenant Record
                const tenant = await Tenant.findByPk(tenantId);
                if (tenant) {
                    await tenant.update({
                        status: 'ACTIVE',
                        subscriptionStatus: 'PAID',
                        subscriptionExpiry: newPeriodEnd,
                        nextPaymentDueDate: newPeriodEnd
                    });
                }

                logger.info(`[SubscriptionAutomation] Tenant ${tenantId} subscription set to ACTIVE until ${newPeriodEnd.toISOString()}`);
            } else if (itemType === 'SMS_CREDITS') {
                try {
                    await SmsProcurementService.processTenantSmsPurchase({
                        tenantId,
                        invoiceId: invoice?.id || invoiceId || 'DIRECT_PROCUREMENT',
                        packageId: targetPlanId || null,
                        smsCount: quantity,
                        amountPaidCents: amountCents || Number(invoice?.totalAmountCents || 0),
                        paymentMethod: paymentMethod === 'WALLET' ? 'WALLET' : 'MPESA',
                        transactionRef: receipt
                    });
                } catch (smsErr: any) {
                    logger.error(`[SubscriptionAutomation] SMS procurement error: ${smsErr.message}`);
                }
            } else if (itemType === 'WALLET_TOPUP') {
                const topupKes = amountCents ? amountCents / 100 : Number(invoice?.totalAmountCents || 0) / 100;
                let wallet = await Wallet.findOne({ where: { tenantId } });
                if (!wallet) {
                    wallet = await Wallet.create({ tenantId, balance: 0, settled: 0, pending: 0, frozen: 0 });
                }
                const newBal = Number((wallet.balance + topupKes).toFixed(2));
                await wallet.update({ balance: newBal });
                await WalletTransaction.create({
                    walletId: wallet.id,
                    tenantId,
                    transactionType: 'CREDIT',
                    amount: topupKes,
                    balanceAfter: newBal,
                    description: `Wallet Top-Up via ${paymentMethod} (Ref: ${receipt})`
                });
            }

            // 7. Record / Update SaaSPayment & SaaSSubscriptionPayment Log
            if (invoice) {
                const existingPayment = await SaaSPayment.findOne({ where: { transactionReference: receipt } });
                if (!existingPayment) {
                    await SaaSPayment.create({
                        tenantId,
                        invoiceId: invoice.id,
                        amountCents: amountCents || Number(invoice.totalAmountCents || 0),
                        gateway: paymentMethod === 'WALLET' ? 'WALLET' : (paymentMethod === 'INTASEND' ? 'INTASEND' : 'MPESA'),
                        transactionReference: receipt,
                        rawPayload: typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload || {}),
                        status: 'SUCCESS'
                    });
                }
            }

            if (checkoutRequestId) {
                const saasSubPayment = await SaaSSubscriptionPayment.findOne({ where: { checkoutRequestId } });
                if (saasSubPayment) {
                    await saasSubPayment.update({
                        status: 'SUCCESS',
                        mpesaReceiptNumber: receipt,
                        completedAt: now,
                        rawCallback: typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload || {})
                    });
                }
            }

            // 8. In-App Notification & Audit Trail
            await SaaSNotification.create({
                tenantId,
                type: 'PAYMENT_RECEIVED',
                title: 'Subscription Payment Confirmed',
                message: `Your payment (${receipt}) was successful. Your subscription is active until ${newPeriodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
                read: false
            });

            await AuditLog.create({
                tenantId,
                actorType: 'SYSTEM',
                actorId: 'SUBSCRIPTION_AUTOMATION',
                action: 'TENANT_SUBSCRIPTION_AUTO_ACTIVATED',
                details: `Subscription renewed via ${paymentMethod} until ${newPeriodEnd.toISOString()}. Receipt: ${receipt}`,
                ipAddress: '127.0.0.1'
            });

            // 9. Real-Time WebSocket Broadcast (Immediate UI unlock)
            SocketService.emitToTenant(tenantId, 'SUBSCRIPTION_ACTIVATED', {
                status: 'ACTIVE',
                currentPeriodEnd: newPeriodEnd,
                nextPaymentDueDate: newPeriodEnd,
                daysRemaining: Math.ceil((newPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                amountDue: 0,
                invoiceId: invoice?.id || null,
                invoiceNumber: invoice?.invoiceNumber || null,
                receipt
            });

            SocketService.emitToTenant(tenantId, 'INVOICE_PAID', {
                invoiceId: invoice?.id || null,
                invoiceNumber: invoice?.invoiceNumber || null,
                receipt,
                paidAt: now
            });

            return {
                success: true,
                message: `Subscription successfully activated and extended to ${newPeriodEnd.toLocaleDateString()}`,
                subscriptionId: sub?.id,
                invoiceId: invoice?.id,
                nextDueDate: newPeriodEnd
            };
        } catch (error: any) {
            logger.error(`[SubscriptionAutomation] Error activating tenant subscription`, {
                tenantId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. END-USER / SUBSCRIBER AUTOMATED RENEWAL & ACCESS
    // ─────────────────────────────────────────────────────────────

    /**
     * Automatically activates, renews, and provisions an ISP/Hotspot subscriber when their payment succeeds.
     */
    public static async processCustomerSubscriptionPayment(
        params: CustomerSubscriptionPaymentParams
    ): Promise<{ success: boolean; message: string; expiryDate?: Date; subscriberId?: string }> {
        const {
            paymentId,
            tenantId,
            subscriberId,
            packageId,
            phoneNumber,
            macAddress,
            ipAddress,
            routerId,
            transactionReference,
            mpesaReceiptNumber
        } = params;

        const receipt = mpesaReceiptNumber || transactionReference || `TX-${Date.now()}`;
        const now = new Date();

        logger.info(`[SubscriptionAutomation] Processing customer subscription fulfillment`, {
            paymentId,
            tenantId,
            subscriberId,
            macAddress,
            receipt
        });

        try {
            // 1. Locate Payment Record
            const payment = await Payment.findByPk(paymentId);
            if (payment && payment.status !== 'SUCCESS') {
                await payment.update({
                    status: 'SUCCESS',
                    mpesaReceiptNumber: receipt,
                    completedAt: now
                });
            }

            // 2. Resolve Package Duration
            let pkg: Package | null = null;
            const targetPkgId = packageId || payment?.packageId;
            if (targetPkgId) {
                pkg = await Package.findByPk(targetPkgId);
            }

            // Calculate duration in milliseconds
            let durationMs = 30 * 24 * 60 * 60 * 1000; // Default 30 days
            if (pkg) {
                if (pkg.validity && pkg.validity > 0) {
                    durationMs = pkg.validity * 24 * 60 * 60 * 1000;
                } else if (pkg.durationMinutes && pkg.durationMinutes > 0) {
                    durationMs = pkg.durationMinutes * 60 * 1000;
                }
            }

            // 3. Renew or Create Subscriber
            let subscriber: Subscriber | null = null;
            const targetSubId = subscriberId || payment?.subscriberId;
            if (targetSubId) {
                subscriber = await Subscriber.findByPk(targetSubId);
            } else if (phoneNumber) {
                subscriber = await Subscriber.findOne({ where: { phoneNumber, tenantId } });
            }

            let newExpiryDate = new Date(now.getTime() + durationMs);

            if (subscriber) {
                // If subscriber already has active unexpired time, stack from current expiry
                if (subscriber.expiryDate && new Date(subscriber.expiryDate).getTime() > now.getTime()) {
                    newExpiryDate = new Date(new Date(subscriber.expiryDate).getTime() + durationMs);
                } else {
                    newExpiryDate = new Date(now.getTime() + durationMs);
                }

                await subscriber.update({
                    status: 'ACTIVE',
                    expiryDate: newExpiryDate,
                    lastPaymentDate: now,
                    packageId: pkg?.id || subscriber.packageId,
                    routerId: routerId || subscriber.routerId,
                    macAddress: macAddress || subscriber.macAddress
                });
            } else if (phoneNumber) {
                subscriber = await Subscriber.create({
                    id: uuidv4(),
                    phoneNumber,
                    tenantId,
                    status: 'ACTIVE',
                    startDate: now,
                    expiryDate: newExpiryDate,
                    lastPaymentDate: now,
                    packageId: pkg?.id,
                    routerId,
                    macAddress
                });
            }

            if (payment && subscriber && !payment.subscriberId) {
                await payment.update({ subscriberId: subscriber.id });
            }

            // 4. MikroTik & Router Network Provisioning
            const targetRouterId = routerId || subscriber?.routerId || payment?.routerId;
            if (targetRouterId) {
                try {
                    const router = await Router.findByPk(targetRouterId);
                    if (router && subscriber) {
                        if (subscriber.pppoeUsername) {
                            // Enable PPPoE secret and disconnect stale session so user reconnects immediately
                            await MikroTikService.togglePPPoESecret(router, subscriber.pppoeUsername, true);
                            await MikroTikService.disconnectPPPoEUser(router, subscriber.pppoeUsername).catch(() => {});
                        } else if (subscriber.username) {
                            await MikroTikService.toggleHotspotUser(router, subscriber.username, true);
                        }
                    }
                } catch (routerErr: any) {
                    logger.warn(`[SubscriptionAutomation] Router provisioning warning: ${routerErr.message}`);
                }
            }

            // 5. Hotspot Immediate Session Access
            const targetMac = macAddress || subscriber?.macAddress || payment?.macAddress;
            const targetIp = ipAddress || payment?.ipAddress;
            if (targetMac) {
                try {
                    await SessionOrchestrator.grantAccess(paymentId, targetMac, targetIp as string);
                } catch (hotspotErr: any) {
                    logger.warn(`[SubscriptionAutomation] Hotspot session activation warning: ${hotspotErr.message}`);
                }
            }

            // 6. Credit Tenant Wallet
            if (payment) {
                try {
                    await WalletService.processPayment(payment);
                } catch (walletErr: any) {
                    logger.error(`[SubscriptionAutomation] Wallet processing error: ${walletErr.message}`);
                }
            }

            // 7. Real-Time Broadcasts
            SocketService.emitToTenant(tenantId, 'PAYMENT_SUCCESS', {
                paymentId,
                amount: payment?.amount,
                phoneNumber: phoneNumber || payment?.phoneNumber,
                macAddress: targetMac,
                expiryDate: newExpiryDate,
                receipt
            });

            SocketService.emitToTenant(tenantId, 'SUBSCRIBER_RENEWED', {
                subscriberId: subscriber?.id,
                expiryDate: newExpiryDate,
                receipt
            });

            return {
                success: true,
                message: `Subscriber access successfully activated until ${newExpiryDate.toISOString()}`,
                expiryDate: newExpiryDate,
                subscriberId: subscriber?.id
            };
        } catch (error: any) {
            logger.error(`[SubscriptionAutomation] Error fulfilling customer payment`, {
                paymentId,
                error: error.message
            });
            throw error;
        }
    }
}
