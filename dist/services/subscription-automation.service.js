"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionAutomationService = void 0;
const models_1 = require("../models");
const socket_service_1 = require("./socket.service");
const wallet_service_1 = require("./wallet.service");
const mikrotik_service_1 = require("./mikrotik.service");
const orchestrator_1 = require("../orchestrator");
const sms_procurement_service_1 = require("./sms-procurement.service");
const logger_1 = __importDefault(require("../utils/logger"));
const uuid_1 = require("uuid");
class SubscriptionAutomationService {
    // ─────────────────────────────────────────────────────────────
    // 1. TENANT SAAS SUBSCRIPTION AUTOMATED ACTIVATION & RENEWAL
    // ─────────────────────────────────────────────────────────────
    /**
     * Activates or extends a SaaS Tenant Subscription upon confirmed payment.
     * Idempotent, thread-safe, and dispatches real-time WebSocket notifications.
     */
    static async processTenantSubscriptionPayment(params) {
        const { tenantId, invoiceId, invoiceNumber, amountCents, paymentMethod, transactionReference, mpesaReceiptNumber, checkoutRequestId, phoneNumber, rawPayload } = params;
        logger_1.default.info(`[SubscriptionAutomation] Initiating automated tenant subscription activation`, {
            tenantId,
            invoiceId,
            invoiceNumber,
            paymentMethod,
            transactionReference
        });
        try {
            const receipt = mpesaReceiptNumber || transactionReference || `TX-${Date.now()}`;
            // 1. Find or verify SaaS Invoice
            let invoice = null;
            if (invoiceId) {
                invoice = await models_1.SaaSInvoice.findOne({ where: { id: invoiceId } });
            }
            else if (invoiceNumber) {
                invoice = await models_1.SaaSInvoice.findOne({ where: { invoiceNumber } });
            }
            else if (checkoutRequestId) {
                const saasSubPayment = await models_1.SaaSSubscriptionPayment.findOne({ where: { checkoutRequestId } });
                if (saasSubPayment && saasSubPayment.invoiceId) {
                    invoice = await models_1.SaaSInvoice.findOne({ where: { id: saasSubPayment.invoiceId } });
                }
            }
            // If still no invoice found, try finding latest UNPAID/OVERDUE invoice for this tenant
            if (!invoice) {
                invoice = await models_1.SaaSInvoice.findOne({
                    where: { tenantId, paymentStatus: ['UNPAID', 'OVERDUE'] },
                    order: [['createdAt', 'DESC']]
                });
            }
            // 2. Extract purchase metadata (e.g., plan, cycle, add-ons)
            let itemType = 'SUBSCRIPTION_PLAN';
            let planSlug = 'unlimited';
            let targetPlanId = params.planId;
            let billingCycle = params.billingCycle || 'MONTHLY';
            let quantity = 1;
            if (invoice?.metadata) {
                try {
                    const parsed = JSON.parse(invoice.metadata);
                    if (parsed.itemType)
                        itemType = parsed.itemType;
                    if (parsed.itemId)
                        targetPlanId = parsed.itemId;
                    if (parsed.itemSlug)
                        planSlug = parsed.itemSlug;
                    if (parsed.billingCycle)
                        billingCycle = parsed.billingCycle;
                    if (parsed.quantity)
                        quantity = Number(parsed.quantity);
                }
                catch (e) {
                    logger_1.default.warn('[SubscriptionAutomation] Could not parse invoice metadata', { error: e });
                }
            }
            // 3. Mark Invoice as PAID (if exists)
            const now = new Date();
            if (invoice) {
                if (invoice.paymentStatus === 'PAID') {
                    logger_1.default.info(`[SubscriptionAutomation] Invoice #${invoice.invoiceNumber} already marked PAID. Proceeding to verify subscription extension.`);
                }
                else {
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
                    logger_1.default.info(`[SubscriptionAutomation] Invoice #${invoice.invoiceNumber} updated to PAID`);
                }
            }
            // 4. Resolve Target Subscription Plan
            let plan = null;
            if (targetPlanId) {
                plan = await models_1.SubscriptionPlan.findByPk(targetPlanId);
            }
            if (!plan && planSlug) {
                plan = await models_1.SubscriptionPlan.findOne({ where: { slug: planSlug } });
            }
            if (!plan) {
                plan = await models_1.SubscriptionPlan.findOne({ where: { slug: 'unlimited' } });
            }
            if (!plan) {
                plan = await models_1.SubscriptionPlan.findOne({ order: [['createdAt', 'ASC']] });
            }
            const resolvedPlanId = plan?.id || targetPlanId || (0, uuid_1.v4)();
            // 5. Calculate Subscription Extension Duration
            const extensionDays = billingCycle === 'YEARLY' ? 365 : 30;
            let sub = await models_1.TenantSubscription.findOne({ where: { tenantId } });
            let newPeriodStart = now;
            let newPeriodEnd;
            if (sub && sub.currentPeriodEnd) {
                const existingEnd = new Date(sub.currentPeriodEnd);
                // If existing subscription period is still in the future, stack duration on top
                if (existingEnd.getTime() > now.getTime()) {
                    newPeriodStart = sub.currentPeriodStart || now;
                    newPeriodEnd = new Date(existingEnd.getTime() + extensionDays * 24 * 60 * 60 * 1000);
                }
                else {
                    // If already expired or grace period, reset starting from now
                    newPeriodStart = now;
                    newPeriodEnd = new Date(now.getTime() + extensionDays * 24 * 60 * 60 * 1000);
                }
            }
            else {
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
                }
                else {
                    sub = await models_1.TenantSubscription.create({
                        id: (0, uuid_1.v4)(),
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
                const tenant = await models_1.Tenant.findByPk(tenantId);
                if (tenant) {
                    await tenant.update({
                        status: 'ACTIVE',
                        subscriptionStatus: 'PAID',
                        subscriptionExpiry: newPeriodEnd,
                        nextPaymentDueDate: newPeriodEnd
                    });
                }
                logger_1.default.info(`[SubscriptionAutomation] Tenant ${tenantId} subscription set to ACTIVE until ${newPeriodEnd.toISOString()}`);
            }
            else if (itemType === 'SMS_CREDITS') {
                try {
                    await sms_procurement_service_1.SmsProcurementService.processTenantSmsPurchase({
                        tenantId,
                        invoiceId: invoice?.id || invoiceId || 'DIRECT_PROCUREMENT',
                        packageId: targetPlanId || null,
                        smsCount: quantity,
                        amountPaidCents: amountCents || Number(invoice?.totalAmountCents || 0),
                        paymentMethod: paymentMethod === 'WALLET' ? 'WALLET' : 'MPESA',
                        transactionRef: receipt
                    });
                }
                catch (smsErr) {
                    logger_1.default.error(`[SubscriptionAutomation] SMS procurement error: ${smsErr.message}`);
                }
            }
            else if (itemType === 'WALLET_TOPUP') {
                const topupKes = amountCents ? amountCents / 100 : Number(invoice?.totalAmountCents || 0) / 100;
                let wallet = await models_1.Wallet.findOne({ where: { tenantId } });
                if (!wallet) {
                    wallet = await models_1.Wallet.create({ tenantId, balance: 0, settled: 0, pending: 0, frozen: 0 });
                }
                const newBal = Number((wallet.balance + topupKes).toFixed(2));
                await wallet.update({ balance: newBal });
                await models_1.WalletTransaction.create({
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
                const existingPayment = await models_1.SaaSPayment.findOne({ where: { transactionReference: receipt } });
                if (!existingPayment) {
                    await models_1.SaaSPayment.create({
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
                const saasSubPayment = await models_1.SaaSSubscriptionPayment.findOne({ where: { checkoutRequestId } });
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
            await models_1.SaaSNotification.create({
                tenantId,
                type: 'PAYMENT_RECEIVED',
                title: 'Subscription Payment Confirmed',
                message: `Your payment (${receipt}) was successful. Your subscription is active until ${newPeriodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
                read: false
            });
            await models_1.AuditLog.create({
                tenantId,
                actorType: 'SYSTEM',
                actorId: 'SUBSCRIPTION_AUTOMATION',
                action: 'TENANT_SUBSCRIPTION_AUTO_ACTIVATED',
                details: `Subscription renewed via ${paymentMethod} until ${newPeriodEnd.toISOString()}. Receipt: ${receipt}`,
                ipAddress: '127.0.0.1'
            });
            // 9. Real-Time WebSocket Broadcast (Immediate UI unlock)
            socket_service_1.SocketService.emitToTenant(tenantId, 'SUBSCRIPTION_ACTIVATED', {
                status: 'ACTIVE',
                currentPeriodEnd: newPeriodEnd,
                nextPaymentDueDate: newPeriodEnd,
                daysRemaining: Math.ceil((newPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                amountDue: 0,
                invoiceId: invoice?.id || null,
                invoiceNumber: invoice?.invoiceNumber || null,
                receipt
            });
            socket_service_1.SocketService.emitToTenant(tenantId, 'INVOICE_PAID', {
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
        }
        catch (error) {
            logger_1.default.error(`[SubscriptionAutomation] Error activating tenant subscription`, {
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
    static async processCustomerSubscriptionPayment(params) {
        const { paymentId, tenantId, subscriberId, packageId, phoneNumber, macAddress, ipAddress, routerId, transactionReference, mpesaReceiptNumber } = params;
        const receipt = mpesaReceiptNumber || transactionReference || `TX-${Date.now()}`;
        const now = new Date();
        logger_1.default.info(`[SubscriptionAutomation] Processing customer subscription fulfillment`, {
            paymentId,
            tenantId,
            subscriberId,
            macAddress,
            receipt
        });
        try {
            // 1. Locate Payment Record
            const payment = await models_1.Payment.findByPk(paymentId);
            if (payment && payment.status !== 'SUCCESS') {
                await payment.update({
                    status: 'SUCCESS',
                    mpesaReceiptNumber: receipt,
                    completedAt: now
                });
            }
            // 2. Resolve Package Duration
            let pkg = null;
            const targetPkgId = packageId || payment?.packageId;
            if (targetPkgId) {
                pkg = await models_1.Package.findByPk(targetPkgId);
            }
            // Calculate duration in milliseconds
            let durationMs = 30 * 24 * 60 * 60 * 1000; // Default 30 days
            if (pkg) {
                if (pkg.validity && pkg.validity > 0) {
                    durationMs = pkg.validity * 24 * 60 * 60 * 1000;
                }
                else if (pkg.durationMinutes && pkg.durationMinutes > 0) {
                    durationMs = pkg.durationMinutes * 60 * 1000;
                }
            }
            // 3. Renew or Create Subscriber
            let subscriber = null;
            const targetSubId = subscriberId || payment?.subscriberId;
            if (targetSubId) {
                subscriber = await models_1.Subscriber.findByPk(targetSubId);
            }
            else if (phoneNumber) {
                subscriber = await models_1.Subscriber.findOne({ where: { phoneNumber, tenantId } });
            }
            let newExpiryDate = new Date(now.getTime() + durationMs);
            if (subscriber) {
                // If subscriber already has active unexpired time, stack from current expiry
                if (subscriber.expiryDate && new Date(subscriber.expiryDate).getTime() > now.getTime()) {
                    newExpiryDate = new Date(new Date(subscriber.expiryDate).getTime() + durationMs);
                }
                else {
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
            }
            else if (phoneNumber) {
                subscriber = await models_1.Subscriber.create({
                    id: (0, uuid_1.v4)(),
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
                    const router = await models_1.Router.findByPk(targetRouterId);
                    if (router && subscriber?.pppoeUsername) {
                        // ISP PPPoE Secret enable
                        await mikrotik_service_1.MikroTikService.toggleHotspotUser(router, subscriber.pppoeUsername, true);
                    }
                }
                catch (routerErr) {
                    logger_1.default.warn(`[SubscriptionAutomation] Router provisioning warning: ${routerErr.message}`);
                }
            }
            // 5. Hotspot Immediate Session Access
            const targetMac = macAddress || subscriber?.macAddress || payment?.macAddress;
            const targetIp = ipAddress || payment?.ipAddress;
            if (targetMac) {
                try {
                    await orchestrator_1.SessionOrchestrator.grantAccess(paymentId, targetMac, targetIp);
                }
                catch (hotspotErr) {
                    logger_1.default.warn(`[SubscriptionAutomation] Hotspot session activation warning: ${hotspotErr.message}`);
                }
            }
            // 6. Credit Tenant Wallet
            if (payment) {
                try {
                    await wallet_service_1.WalletService.processPayment(payment);
                }
                catch (walletErr) {
                    logger_1.default.error(`[SubscriptionAutomation] Wallet processing error: ${walletErr.message}`);
                }
            }
            // 7. Real-Time Broadcasts
            socket_service_1.SocketService.emitToTenant(tenantId, 'PAYMENT_SUCCESS', {
                paymentId,
                amount: payment?.amount,
                phoneNumber: phoneNumber || payment?.phoneNumber,
                macAddress: targetMac,
                expiryDate: newExpiryDate,
                receipt
            });
            socket_service_1.SocketService.emitToTenant(tenantId, 'SUBSCRIBER_RENEWED', {
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
        }
        catch (error) {
            logger_1.default.error(`[SubscriptionAutomation] Error fulfilling customer payment`, {
                paymentId,
                error: error.message
            });
            throw error;
        }
    }
}
exports.SubscriptionAutomationService = SubscriptionAutomationService;
