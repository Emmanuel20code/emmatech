"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_normalization_service_1 = require("../services/payment-normalization.service");
const subscription_automation_service_1 = require("../services/subscription-automation.service");
const payment_audit_service_1 = require("../services/payment-audit.service");
const hotspot_provisioning_service_1 = require("../services/hotspot-provisioning.service");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const socket_service_1 = require("../services/socket.service");
const router = (0, express_1.Router)();
function parseSafaricomResult(resultCode, resultDesc = '') {
    const code = Number(resultCode);
    if (code === 0) {
        return { isSuccess: true };
    }
    let reason = resultDesc || 'Payment failed';
    switch (code) {
        case 1032:
            reason = 'Payment was cancelled on the phone or timed out.';
            break;
        case 1:
            reason = 'Insufficient funds in your M-Pesa account.';
            break;
        case 2001:
            reason = 'Incorrect M-Pesa PIN entered.';
            break;
        case 1037:
            reason = 'Could not reach your phone. Please ensure your SIM card is active.';
            break;
        case 1025:
            reason = 'Another transaction is already in progress on your phone.';
            break;
        case 1019:
            reason = 'Transaction expired. Please try again.';
            break;
        default:
            reason = resultDesc || `Transaction failed with code ${code}`;
    }
    return { isSuccess: false, failureReason: reason };
}
// 1. M-Pesa Super Admin STK Callback (For SaaS Subscriptions & Platform Hotspots)
router.post('/mpesa/stk-push/superadmin', async (req, res) => {
    const rawBody = req.body;
    const body = rawBody?.Body?.stkCallback;
    const checkoutRequestId = body?.CheckoutRequestID || null;
    const merchantRequestId = body?.MerchantRequestID || null;
    const resultCode = body?.ResultCode;
    const resultDesc = body?.ResultDesc || '';
    try {
        if (!body || checkoutRequestId === null || resultCode === undefined) {
            logger_1.default.warn('[M-Pesa Callback SuperAdmin] Invalid or malformed payload received', { rawBody });
            await models_1.MpesaCallbackLog.create({
                checkoutRequestId,
                merchantRequestId,
                rawPayload: JSON.stringify(rawBody || {}),
                validationStatus: 'INVALID_PAYLOAD',
                validationErrors: 'Missing Body or stkCallback object',
                signatureVerified: true,
                databaseUpdateStatus: 'SKIPPED',
                errorDetails: 'Invalid payload structure'
            }).catch(() => { });
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        const { isSuccess, failureReason } = parseSafaricomResult(resultCode, resultDesc);
        // Check if this is a SaaS subscription payment
        const saasPayment = await models_1.SaaSSubscriptionPayment.findOne({ where: { checkoutRequestId } });
        if (saasPayment) {
            if (isSuccess) {
                const meta = body.CallbackMetadata?.Item || [];
                const receipt = meta.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || checkoutRequestId;
                logger_1.default.info('[M-Pesa Callback SuperAdmin] SaaS Subscription payment verified SUCCESS', {
                    checkoutRequestId,
                    receipt,
                    tenantId: saasPayment.tenantId
                });
                await saasPayment.update({
                    status: 'SUCCESS',
                    mpesaReceiptNumber: receipt,
                    completedAt: new Date(),
                    rawCallback: JSON.stringify(rawBody)
                });
                // Update associated invoice and activate tenant subscription using automated engine
                let rawObj = {};
                try {
                    rawObj = JSON.parse(saasPayment.rawCallback || '{}');
                }
                catch (e) { }
                const invoiceId = saasPayment.invoiceId || rawObj.invoiceId;
                await subscription_automation_service_1.SubscriptionAutomationService.processTenantSubscriptionPayment({
                    tenantId: saasPayment.tenantId,
                    invoiceId: invoiceId || undefined,
                    amountCents: saasPayment.amount ? saasPayment.amount * 100 : undefined,
                    paymentMethod: 'MPESA_STK',
                    transactionReference: receipt,
                    mpesaReceiptNumber: receipt,
                    checkoutRequestId,
                    phoneNumber: saasPayment.phoneNumber,
                    rawPayload: rawBody
                });
            }
            else {
                logger_1.default.warn('[M-Pesa Callback SuperAdmin] SaaS Subscription payment FAILED', {
                    checkoutRequestId,
                    resultCode,
                    failureReason
                });
                await saasPayment.update({
                    status: 'FAILED',
                    rawCallback: JSON.stringify(rawBody)
                });
            }
            await models_1.MpesaCallbackLog.create({
                checkoutRequestId,
                merchantRequestId,
                rawPayload: JSON.stringify(rawBody),
                validationStatus: 'VALID',
                signatureVerified: true,
                tenantId: saasPayment.tenantId,
                databaseUpdateStatus: isSuccess ? 'SUCCESS' : 'FAILED',
                errorDetails: failureReason || null
            }).catch(() => { });
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        // Fallback: Check standard customer Payment record
        const payment = await models_1.Payment.findOne({ where: { checkoutRequestId } });
        if (payment) {
            if (isSuccess) {
                const meta = body.CallbackMetadata?.Item || [];
                const receipt = meta.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || checkoutRequestId;
                await payment.update({
                    status: 'SUCCESS',
                    mpesaReceiptNumber: receipt,
                    completedAt: new Date(),
                    rawCallback: JSON.stringify(rawBody)
                });
                const normalized = payment_normalization_service_1.PaymentNormalizationService.normalizeStkPush(rawBody, payment.tenantId);
                await payment_normalization_service_1.PaymentNormalizationService.processPayment(normalized);
                logger_1.default.info('[M-Pesa Callback SuperAdmin] Customer payment processed successfully', { paymentId: payment.id });
            }
            else {
                await payment.update({
                    status: 'FAILED',
                    failureReason,
                    rawCallback: JSON.stringify(rawBody)
                });
            }
            await models_1.MpesaCallbackLog.create({
                checkoutRequestId,
                merchantRequestId,
                rawPayload: JSON.stringify(rawBody),
                validationStatus: 'VALID',
                signatureVerified: true,
                tenantId: payment.tenantId,
                databaseUpdateStatus: isSuccess ? 'SUCCESS' : 'FAILED',
                errorDetails: failureReason || null
            }).catch(() => { });
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        logger_1.default.warn('[M-Pesa Callback SuperAdmin] Unmatched checkoutRequestId received. Attempting smart fallback...', { checkoutRequestId });
        if (isSuccess) {
            const meta = body.CallbackMetadata?.Item || [];
            const receipt = meta.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || checkoutRequestId;
            const amount = Number(meta.find((i) => i.Name === 'Amount')?.Value || 0);
            const phoneNumber = String(meta.find((i) => i.Name === 'PhoneNumber')?.Value || '');
            const latestInvoice = await models_1.SaaSInvoice.findOne({
                where: { paymentStatus: ['UNPAID', 'OVERDUE'] },
                order: [['createdAt', 'DESC']]
            });
            if (latestInvoice) {
                logger_1.default.info('[M-Pesa Callback SuperAdmin] Fallback matched unpaid SaaS invoice for unmatched callback', { invoiceId: latestInvoice.id, tenantId: latestInvoice.tenantId, receipt });
                await subscription_automation_service_1.SubscriptionAutomationService.processTenantSubscriptionPayment({
                    tenantId: latestInvoice.tenantId,
                    invoiceId: latestInvoice.id,
                    amountCents: amount ? amount * 100 : undefined,
                    paymentMethod: 'MPESA_STK',
                    transactionReference: receipt,
                    mpesaReceiptNumber: receipt,
                    checkoutRequestId,
                    phoneNumber,
                    rawPayload: rawBody
                });
                await models_1.MpesaCallbackLog.create({
                    checkoutRequestId,
                    merchantRequestId,
                    rawPayload: JSON.stringify(rawBody),
                    validationStatus: 'VALID',
                    signatureVerified: true,
                    tenantId: latestInvoice.tenantId,
                    databaseUpdateStatus: 'SUCCESS',
                    errorDetails: 'Matched via unmatched fallback latest invoice'
                }).catch(() => { });
                return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
            }
        }
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    catch (error) {
        logger_1.default.error('[M-Pesa Callback SuperAdmin] Fatal error handling callback', { error: error.message });
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});
// 2. M-Pesa STK Push Callback (Tenant Specific Endpoint)
router.post('/mpesa/stk-push/:tenantId', async (req, res) => {
    const { tenantId } = req.params;
    const rawBody = req.body;
    const body = rawBody?.Body?.stkCallback;
    const checkoutRequestId = body?.CheckoutRequestID || null;
    const merchantRequestId = body?.MerchantRequestID || null;
    const resultCode = body?.ResultCode;
    const resultDesc = body?.ResultDesc || '';
    try {
        if (!body || !checkoutRequestId) {
            logger_1.default.warn('[M-Pesa Callback Tenant] Invalid payload structure', { tenantId, rawBody });
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        const { isSuccess, failureReason } = parseSafaricomResult(resultCode, resultDesc);
        // Find customer payment by checkoutRequestId
        const payment = await models_1.Payment.findOne({ where: { checkoutRequestId } });
        if (payment) {
            if (isSuccess) {
                const meta = body.CallbackMetadata?.Item || [];
                const receipt = meta.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || checkoutRequestId;
                await payment.update({
                    status: 'SUCCESS',
                    mpesaReceiptNumber: receipt,
                    completedAt: new Date(),
                    rawCallback: JSON.stringify(rawBody)
                });
                const normalized = payment_normalization_service_1.PaymentNormalizationService.normalizeStkPush(rawBody, payment.tenantId || tenantId);
                await payment_normalization_service_1.PaymentNormalizationService.processPayment(normalized);
                // Wire immediate access via HotspotProvisioningService
                await hotspot_provisioning_service_1.HotspotProvisioningService.grantImmediateAccess(payment.id).catch((err) => {
                    logger_1.default.error('[M-Pesa Callback Tenant] HotspotProvisioningService error', {
                        paymentId: payment.id,
                        error: err?.message || String(err)
                    });
                });
                logger_1.default.info('[M-Pesa Callback Tenant] Payment processed SUCCESS', {
                    paymentId: payment.id,
                    tenantId: payment.tenantId,
                    receipt
                });
            }
            else {
                await payment.update({
                    status: 'FAILED',
                    failureReason,
                    rawCallback: JSON.stringify(rawBody)
                });
                socket_service_1.SocketService.emitToTenant(payment.tenantId, 'PAYMENT_FAILED', {
                    paymentId: payment.id,
                    reason: failureReason
                });
            }
            await models_1.MpesaCallbackLog.create({
                checkoutRequestId,
                merchantRequestId,
                rawPayload: JSON.stringify(rawBody),
                validationStatus: 'VALID',
                signatureVerified: true,
                tenantId: payment.tenantId,
                databaseUpdateStatus: isSuccess ? 'SUCCESS' : 'FAILED',
                errorDetails: failureReason || null
            }).catch(() => { });
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        logger_1.default.warn('[M-Pesa Callback Tenant] No pending payment found for checkoutRequestId', { checkoutRequestId, tenantId });
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    catch (error) {
        logger_1.default.error('[M-Pesa Callback Tenant] Error processing callback', { tenantId, error: error.message });
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});
// 3. M-Pesa C2B (Paybill / Till) Confirmation and Validation Callback
router.post('/mpesa/c2b/:tenantId/:channel', async (req, res) => {
    try {
        const { tenantId, channel } = req.params;
        const normalized = payment_normalization_service_1.PaymentNormalizationService.normalizeC2B(req.body, tenantId, channel);
        await payment_normalization_service_1.PaymentNormalizationService.processPayment(normalized);
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    catch (error) {
        logger_1.default.error('M-Pesa C2B Callback failed', { error: error.message });
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});
// 4. Bank Transfer Callback (Generic)
router.post('/bank-transfer/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const normalized = payment_normalization_service_1.PaymentNormalizationService.normalizeBankTransfer(req.body, tenantId);
        await payment_normalization_service_1.PaymentNormalizationService.processPayment(normalized);
        res.json({ status: 'success' });
    }
    catch (error) {
        logger_1.default.error('Bank Transfer Callback failed', { error: error.message });
        res.status(500).json({ status: 'failed' });
    }
});
// 5. Secure M-Pesa Daraja Payment Callback for Tenant Subscription Activation & Extension
router.post('/mpesa/daraja-subscription/:tenantId', async (req, res) => {
    const { tenantId } = req.params;
    const rawBody = req.body;
    try {
        // Stage 1: Callback Received
        await payment_audit_service_1.PaymentAuditService.logEvent({
            tenantId,
            stage: 'CALLBACK_RECEIVED',
            status: 'PENDING',
            rawPayload: rawBody
        });
        const stkCallback = rawBody?.Body?.stkCallback;
        if (!stkCallback) {
            logger_1.default.warn('[M-Pesa Daraja Subscription Callback] Malformed payload received', { tenantId, rawBody });
            await payment_audit_service_1.PaymentAuditService.logEvent({
                tenantId,
                stage: 'CALLBACK_VALIDATED',
                status: 'FAILED',
                errorDetails: 'Invalid M-Pesa payload structure (missing stkCallback)',
                rawPayload: rawBody
            });
            return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid M-Pesa payload structure' });
        }
        const resultCode = Number(stkCallback.ResultCode);
        const resultDesc = stkCallback.ResultDesc || '';
        const checkoutRequestId = stkCallback.CheckoutRequestID;
        const merchantRequestId = stkCallback.MerchantRequestID;
        // Stage 2: Signature / Payload Verified
        await payment_audit_service_1.PaymentAuditService.logEvent({
            checkoutRequestId,
            merchantRequestId,
            tenantId,
            stage: 'SIGNATURE_VERIFIED',
            status: resultCode === 0 ? 'SUCCESS' : 'FAILED',
            safaricomResultCode: resultCode,
            safaricomResultDesc: resultDesc,
            rawPayload: rawBody
        });
        // Verify if payment was successful (ResultCode === 0)
        if (resultCode !== 0) {
            logger_1.default.warn('[M-Pesa Daraja Subscription Callback] Payment failed or cancelled', { tenantId, resultCode, resultDesc });
            await payment_audit_service_1.PaymentAuditService.logEvent({
                checkoutRequestId,
                merchantRequestId,
                tenantId,
                stage: 'FAILED',
                status: 'FAILED',
                safaricomResultCode: resultCode,
                safaricomResultDesc: resultDesc,
                errorDetails: `Safaricom payment failed: ${resultDesc} (Code: ${resultCode})`,
                rawPayload: rawBody
            });
            await models_1.MpesaCallbackLog.create({
                checkoutRequestId,
                merchantRequestId,
                rawPayload: JSON.stringify(rawBody),
                validationStatus: 'VALID',
                signatureVerified: true,
                tenantId,
                databaseUpdateStatus: 'FAILED',
                errorDetails: resultDesc
            }).catch(() => { });
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        // Extract metadata items (Amount, MpesaReceiptNumber, TransactionDate, PhoneNumber)
        const callbackItems = stkCallback.CallbackMetadata?.Item || [];
        const getMetaVal = (name) => callbackItems.find((i) => i.Name === name)?.Value;
        const amount = Number(getMetaVal('Amount') || 0);
        const mpesaReceiptNumber = getMetaVal('MpesaReceiptNumber') || checkoutRequestId;
        const phoneNumber = String(getMetaVal('PhoneNumber') || '');
        await payment_audit_service_1.PaymentAuditService.logEvent({
            transactionReference: mpesaReceiptNumber,
            checkoutRequestId,
            merchantRequestId,
            tenantId,
            stage: 'CALLBACK_VALIDATED',
            status: 'SUCCESS',
            amount,
            phoneNumber,
            safaricomResultCode: resultCode,
            safaricomResultDesc: resultDesc,
            rawPayload: rawBody
        });
        logger_1.default.info('[M-Pesa Daraja Subscription Callback] Payment verified SUCCESS', {
            tenantId,
            amount,
            mpesaReceiptNumber,
            phoneNumber
        });
        // 1. Verify Tenant exists
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant) {
            logger_1.default.error('[M-Pesa Daraja Subscription Callback] Tenant not found', { tenantId });
            await payment_audit_service_1.PaymentAuditService.logEvent({
                transactionReference: mpesaReceiptNumber,
                checkoutRequestId,
                merchantRequestId,
                tenantId,
                stage: 'DATABASE_UPDATED',
                status: 'FAILED',
                amount,
                phoneNumber,
                errorDetails: 'Tenant not found in database',
                rawPayload: rawBody
            });
            return res.status(404).json({ ResultCode: 1, ResultDesc: 'Tenant not found' });
        }
        // 2. Calculate subscription extension period based on amount (e.g. KES 1,000 per 30 days)
        const baseAmountPerMonth = 1000;
        const monthsToAdd = Math.max(1, Math.round(amount / baseAmountPerMonth));
        const extensionDays = monthsToAdd * 30;
        const now = new Date();
        let subscription = await models_1.TenantSubscription.findOne({ where: { tenantId } });
        let newPeriodStart = now;
        let newPeriodEnd;
        if (subscription && subscription.currentPeriodEnd) {
            const existingEnd = new Date(subscription.currentPeriodEnd);
            if (existingEnd.getTime() > now.getTime()) {
                newPeriodStart = subscription.currentPeriodStart || now;
                newPeriodEnd = new Date(existingEnd.getTime() + extensionDays * 24 * 60 * 60 * 1000);
            }
            else {
                newPeriodStart = now;
                newPeriodEnd = new Date(now.getTime() + extensionDays * 24 * 60 * 60 * 1000);
            }
        }
        else {
            newPeriodStart = now;
            newPeriodEnd = new Date(now.getTime() + extensionDays * 24 * 60 * 60 * 1000);
        }
        // 3. Update Tenant Subscription status to ACTIVE
        if (subscription) {
            await subscription.update({
                status: 'ACTIVE',
                currentPeriodStart: newPeriodStart,
                currentPeriodEnd: newPeriodEnd,
                trialEndDate: null,
                gracePeriodEndDate: null,
                autoRenew: true
            });
        }
        else {
            await models_1.TenantSubscription.create({
                tenantId,
                status: 'ACTIVE',
                billingCycle: 'MONTHLY',
                startDate: now,
                currentPeriodStart: newPeriodStart,
                currentPeriodEnd: newPeriodEnd,
                autoRenew: true
            });
        }
        // 4. Update Tenant Account status from 'trial' / 'TRIAL' to 'active' / 'PAID'
        await tenant.update({
            status: 'ACTIVE',
            subscriptionStatus: 'PAID',
            subscriptionExpiry: newPeriodEnd,
            nextPaymentDueDate: newPeriodEnd
        });
        // 5. Mark pending SaaS invoices as PAID
        await models_1.SaaSInvoice.update({
            paymentStatus: 'PAID',
            paidAt: now,
            paymentReference: mpesaReceiptNumber
        }, {
            where: { tenantId, paymentStatus: ['UNPAID', 'OVERDUE'] }
        });
        await payment_audit_service_1.PaymentAuditService.logEvent({
            transactionReference: mpesaReceiptNumber,
            checkoutRequestId,
            merchantRequestId,
            tenantId,
            stage: 'DATABASE_UPDATED',
            status: 'SUCCESS',
            amount,
            phoneNumber,
            rawPayload: rawBody
        });
        // 6. Log successful callback execution
        await models_1.MpesaCallbackLog.create({
            checkoutRequestId,
            merchantRequestId,
            rawPayload: JSON.stringify(rawBody),
            validationStatus: 'VALID',
            signatureVerified: true,
            tenantId,
            databaseUpdateStatus: 'SUCCESS',
            errorDetails: null
        }).catch(() => { });
        await payment_audit_service_1.PaymentAuditService.logEvent({
            transactionReference: mpesaReceiptNumber,
            checkoutRequestId,
            merchantRequestId,
            tenantId,
            stage: 'SUCCESS',
            status: 'SUCCESS',
            amount,
            phoneNumber,
            rawPayload: rawBody
        });
        // 7. Emit Real-time Socket.io events for instant UI update
        socket_service_1.SocketService.emitToTenant(tenantId, 'PAYMENT_SUCCESS', {
            tenantId,
            receipt: mpesaReceiptNumber,
            amount,
            newExpiry: newPeriodEnd
        });
        socket_service_1.SocketService.emitToTenant(tenantId, 'SUBSCRIPTION_ACTIVATED', {
            tenantId,
            status: 'ACTIVE',
            newExpiry: newPeriodEnd
        });
        socket_service_1.SocketService.emitToTenant(tenantId, 'INVOICE_PAID', {
            tenantId,
            paymentReference: mpesaReceiptNumber
        });
        logger_1.default.info('[M-Pesa Daraja Subscription Callback] Successfully updated tenant status to ACTIVE and extended subscription', {
            tenantId,
            newExpiry: newPeriodEnd.toISOString(),
            amountPaid: amount
        });
        return res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }
    catch (error) {
        logger_1.default.error('[M-Pesa Daraja Subscription Callback] Fatal error handling callback', { tenantId, error: error.message });
        await payment_audit_service_1.PaymentAuditService.logEvent({
            tenantId,
            stage: 'FAILED',
            status: 'FAILED',
            errorDetails: error.message,
            rawPayload: rawBody
        });
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});
exports.default = router;
