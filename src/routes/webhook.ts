import { Router } from 'express';
import { Payment, Package, CampaignLog } from '../models';
import { IntaSendService } from '../services/intasend.service';
import { PaymentNormalizationService } from '../services/payment-normalization.service';
import logger from '../utils/logger';
import { config } from '../config/env';

const router = Router();

// SAFE SAFARICOM IPS (PROD)
const SAFARICOM_IPS = [
    '196.201.214.200', '196.201.214.206', '196.201.213.114',
    '196.201.214.207', '196.201.214.208', '196.201.213.44',
    '196.201.212.127', '196.201.212.138'
];

// WHATSAPP STATUS WEBHOOK
router.post('/whatsapp-status', async (req, res) => {
    const { MessageSid, MessageStatus, ErrorCode } = req.body;
    logger.info('WhatsApp status callback received', { MessageSid, MessageStatus });

    try {
        const log = await CampaignLog.findOne({ where: { providerReference: MessageSid } });
        if (log) {
            let status: any = 'SENT';
            if (MessageStatus === 'delivered') status = 'DELIVERED';
            if (MessageStatus === 'read') status = 'READ';
            if (MessageStatus === 'failed') status = 'FAILED';

            await log.update({
                status,
                error: ErrorCode ? `Twilio Error: ${ErrorCode}` : null
            });
        }
        res.status(200).send('OK');
    } catch (err: any) {
        logger.error('WhatsApp Status Webhook Error', { error: err.message });
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

            const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
            const clientIp = rawIp.split(',')[0].trim();

            const isSafaricomIp = SAFARICOM_IPS.some(ip => clientIp.includes(ip)) || clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('10.') || clientIp.startsWith('172.');
            if (process.env.ENFORCE_SAFARICOM_IP === 'true' && !isSafaricomIp) {
                logger.warn('Unauthorized M-Pesa Callback IP', { clientIp, rawIp });
                return res.status(403).send('Unauthorized IP');
            }

            if (!Body || !Body.stkCallback) {
                logger.warn('Invalid M-Pesa callback payload', { ip: clientIp });
                return res.status(400).send('Invalid payload');
            }

            const callback = Body.stkCallback;
            const checkoutRequestId = callback.CheckoutRequestID;
            const resultCode = callback.ResultCode;

            // Security Validation: Validate payment existence and tenant isolation
            const payment = await Payment.findOne({ 
                where: { checkoutRequestId },
                include: [Package]
            });

            if (payment && _tenantId && payment.tenantId !== _tenantId) {
                logger.warn('M-Pesa STK Callback tenant mismatch security violation!', { expected: payment.tenantId, received: _tenantId });
                return res.status(403).send('Tenant isolation violation');
            }

            if (resultCode === 0) {
                const normalized = PaymentNormalizationService.normalizeStkPush(req.body, (_tenantId as string) || 'DEFAULT');
                
                if (payment && (payment as any).package) {
                    const pkg = (payment as any).package;
                    if (Number(normalized.amount) < Number(pkg.price)) {
                        logger.warn('Payment amount mismatch (Normalizer)', { expected: pkg.price, received: normalized.amount });
                        await payment.update({ status: 'FAILED', rawCallback: JSON.stringify(req.body) });
                        return res.status(200).send('OK');
                    }
                }

                await PaymentNormalizationService.processPayment(normalized);
            } else {
                if (payment) {
                    await payment.update({ status: 'FAILED', rawCallback: JSON.stringify(req.body) });
                }
            }

            res.status(200).send('OK');
        } catch (err: any) {
            logger.error('M-Pesa Webhook Error', { error: err.message });
            res.status(500).send('Internal Server Error');
        }
    });
});

// INTASEND WEBHOOK
router.post('/intasend', async (req, res) => {
    const signature = req.headers['intasend-signature'] as string;
    const rawBody = (req as any).rawBody;
    const bodyForVerification = rawBody || JSON.stringify(req.body);

    if (!config.payments.intasend.isMock) {
        if (!signature || !IntaSendService.verifySignature(bodyForVerification, signature)) {
            logger.warn('Invalid IntaSend Signature', { signature });
            return res.status(403).send('Invalid Signature');
        }
    }

    const { tracking_id, state, api_ref } = req.body;
    const paymentId = api_ref;

    try {
        const payment = await Payment.findByPk(paymentId, { include: [Package] });
        if (!payment) return res.status(404).send('Payment not found');

        if (state === 'COMPLETE') {
            const normalized: any = {
                transactionReference: tracking_id,
                amount: payment.amount,
                phoneNumber: payment.phoneNumber,
                paymentChannel: 'INTASEND',
                paymentMethod: 'INTASEND',
                rawPayload: req.body,
                tenantId: payment.tenantId,
                externalId: payment.checkoutRequestId
            };
            await PaymentNormalizationService.processPayment(normalized);
        } else if (['FAILED', 'CANCELLED'].includes(state)) {
            await payment.update({ status: 'FAILED', rawCallback: JSON.stringify(req.body) });
        }

        res.status(200).send('OK');
    } catch (err: any) {
        logger.error('IntaSend Webhook Error', { error: err.message, paymentId });
        res.status(500).send('Internal Server Error');
    }
});

export default router;
