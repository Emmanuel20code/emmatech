"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const intasend_service_1 = require("../services/intasend.service");
const payment_normalization_service_1 = require("../services/payment-normalization.service");
const logger_1 = __importDefault(require("../utils/logger"));
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
// SAFE SAFARICOM IPS (PROD)
const SAFARICOM_IPS = [
    '196.201.214.200', '196.201.214.206', '196.201.213.114',
    '196.201.214.207', '196.201.214.208', '196.201.213.44',
    '196.201.212.127', '196.201.212.138'
];
// WHATSAPP STATUS WEBHOOK
router.post('/whatsapp-status', async (req, res) => {
    const { MessageSid, MessageStatus, ErrorCode } = req.body;
    logger_1.default.info('WhatsApp status callback received', { MessageSid, MessageStatus });
    try {
        const log = await models_1.CampaignLog.findOne({ where: { providerReference: MessageSid } });
        if (log) {
            let status = 'SENT';
            if (MessageStatus === 'delivered')
                status = 'DELIVERED';
            if (MessageStatus === 'read')
                status = 'READ';
            if (MessageStatus === 'failed')
                status = 'FAILED';
            await log.update({
                status,
                error: ErrorCode ? `Twilio Error: ${ErrorCode}` : null
            });
        }
        res.status(200).send('OK');
    }
    catch (err) {
        logger_1.default.error('WhatsApp Status Webhook Error', { error: err.message });
        res.status(500).send('Error');
    }
});
// M-PESA WEBHOOK
router.post(['/mpesa', '/mpesa/:tenantId'], async (req, res) => {
    const { Body } = req.body;
    const { tenantId: _tenantId } = req.params;
    const { ContextService } = require('../services/context.service');
    const { SchemaService } = require('../services/schema.service');
    await ContextService.runWithTenant(_tenantId || null, async () => {
        try {
            if (_tenantId) {
                await SchemaService.setSearchPath(_tenantId);
            }
            const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
            const clientIp = rawIp.split(',')[0].trim();
            const isSafaricomIp = SAFARICOM_IPS.some(ip => clientIp.includes(ip)) || clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('10.') || clientIp.startsWith('172.');
            if (process.env.ENFORCE_SAFARICOM_IP === 'true' && !isSafaricomIp) {
                logger_1.default.warn('Unauthorized M-Pesa Callback IP', { clientIp, rawIp });
                return res.status(403).send('Unauthorized IP');
            }
            if (!Body || !Body.stkCallback) {
                logger_1.default.warn('Invalid M-Pesa callback payload', { ip: clientIp });
                return res.status(400).send('Invalid payload');
            }
            const callback = Body.stkCallback;
            const checkoutRequestId = callback.CheckoutRequestID;
            const resultCode = callback.ResultCode;
            // Security Validation: Validate payment existence and tenant isolation
            const payment = await models_1.Payment.findOne({
                where: { checkoutRequestId },
                include: [models_1.Package]
            });
            if (payment && _tenantId && payment.tenantId !== _tenantId) {
                logger_1.default.warn('M-Pesa STK Callback tenant mismatch security violation!', { expected: payment.tenantId, received: _tenantId });
                return res.status(403).send('Tenant isolation violation');
            }
            if (resultCode === 0) {
                const normalized = payment_normalization_service_1.PaymentNormalizationService.normalizeStkPush(req.body, _tenantId || 'DEFAULT');
                if (payment && payment.package) {
                    const pkg = payment.package;
                    if (Number(normalized.amount) < Number(pkg.price)) {
                        logger_1.default.warn('Payment amount mismatch (Normalizer)', { expected: pkg.price, received: normalized.amount });
                        await payment.update({ status: 'FAILED', rawCallback: JSON.stringify(req.body) });
                        return res.status(200).send('OK');
                    }
                }
                await payment_normalization_service_1.PaymentNormalizationService.processPayment(normalized);
            }
            else {
                if (payment) {
                    await payment.update({ status: 'FAILED', rawCallback: JSON.stringify(req.body) });
                }
            }
            res.status(200).send('OK');
        }
        catch (err) {
            logger_1.default.error('M-Pesa Webhook Error', { error: err.message });
            res.status(500).send('Internal Server Error');
        }
    });
});
// INTASEND WEBHOOK
router.post('/intasend', async (req, res) => {
    const signature = req.headers['intasend-signature'];
    const rawBody = req.rawBody;
    const bodyForVerification = rawBody || JSON.stringify(req.body);
    if (!env_1.config.payments.intasend.isMock) {
        if (!signature || !intasend_service_1.IntaSendService.verifySignature(bodyForVerification, signature)) {
            logger_1.default.warn('Invalid IntaSend Signature', { signature });
            return res.status(403).send('Invalid Signature');
        }
    }
    const { tracking_id, state, api_ref } = req.body;
    const paymentId = api_ref;
    try {
        const payment = await models_1.Payment.findByPk(paymentId, { include: [models_1.Package] });
        if (!payment)
            return res.status(404).send('Payment not found');
        if (state === 'COMPLETE') {
            const normalized = {
                transactionReference: tracking_id,
                amount: payment.amount,
                phoneNumber: payment.phoneNumber,
                paymentChannel: 'INTASEND',
                paymentMethod: 'INTASEND',
                rawPayload: req.body,
                tenantId: payment.tenantId,
                externalId: payment.checkoutRequestId
            };
            await payment_normalization_service_1.PaymentNormalizationService.processPayment(normalized);
        }
        else if (['FAILED', 'CANCELLED'].includes(state)) {
            await payment.update({ status: 'FAILED', rawCallback: JSON.stringify(req.body) });
        }
        res.status(200).send('OK');
    }
    catch (err) {
        logger_1.default.error('IntaSend Webhook Error', { error: err.message, paymentId });
        res.status(500).send('Internal Server Error');
    }
});
exports.default = router;
