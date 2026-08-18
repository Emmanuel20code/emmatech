import { Router } from 'express';
import { Payment, Package, sequelize } from '../models';
import { SessionOrchestrator } from '../orchestrator';
import { WalletService } from '../services/wallet.service';
import logger from '../utils/logger';

const router = Router();

/**
 * Universal Aggregator Webhook
 * Handles all payments from the single centralized Paybill
 */
router.post('/callback', async (req, res) => {
    const payload = req.body;
    const { checkoutRequestId, transactionId, status, amount: _amount, metadata: _metadata } = payload;

    logger.info('Received aggregator callback', { checkoutRequestId, transactionId, status });

    const callbackHash = require('crypto').createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

    try {
        const processedPayment = await sequelize.transaction(async (t) => {
            const payment = await Payment.findOne({
                where: { checkoutRequestId },
                include: [Package],
                lock: true,
                transaction: t
            });

            if (!payment) {
                logger.error('Aggregator payment not found', { checkoutRequestId });
                return null;
            }

            if (payment.processedCallbackHash === callbackHash) {
                return null;
            }

            payment.rawAggregatorPayload = JSON.stringify(payload);
            payment.processedCallbackHash = callbackHash;
            payment.aggregatorTransactionId = transactionId;

            if (payment.status !== 'PENDING') {
                await payment.save({ transaction: t });
                return null;
            }

            if (status === 'SUCCESS') {
                payment.status = 'SUCCESS';
                payment.completedAt = new Date();
                payment.mpesaReceiptNumber = transactionId;
                await payment.save({ transaction: t });
                return payment;
            } else {
                payment.status = 'FAILED';
                payment.failureReason = payload.message || 'Aggregator reported failure';
                await payment.save({ transaction: t });
                return null;
            }
        });

        // Outside transaction: Process Split and Fulfillment
        if (processedPayment) {
            try {
                // 1. Trigger Automated Split (90/10)
                await WalletService.processPayment(processedPayment);

                // 2. Trigger Network Fulfillment
                logger.info('Initiating network fulfillment', {
                    paymentId: processedPayment.id,
                    mac: processedPayment.macAddress,
                    routerId: processedPayment.routerId
                });
                await fulfillAccess(processedPayment);
                logger.info('Network fulfillment completed', { paymentId: processedPayment.id });

                logger.info('Aggregator payment fully processed and SPLIT', {
                    paymentId: processedPayment.id,
                    tenantId: processedPayment.tenantId
                });
            } catch (error: any) {
                logger.error('Post-payment processing failed', {
                    paymentId: processedPayment.id,
                    error: error.message
                });
            }
        }

        res.status(200).send('OK');
    } catch (error: any) {
        logger.error('Aggregator Webhook Error', { error: error.message });
        res.status(500).send('Internal Error');
    }
});

async function fulfillAccess(payment: Payment) {
    if (payment.subscriberId) {
        const { IspService } = require('../services/isp.service');
        await IspService.renewSubscriber(payment.subscriberId);
    } else if (payment.macAddress && payment.routerId) {
        await SessionOrchestrator.grantAccess(payment.id, payment.macAddress, payment.ipAddress || undefined);
    }
}

export default router;
