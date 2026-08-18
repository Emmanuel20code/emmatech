"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const orchestrator_1 = require("../orchestrator");
const wallet_service_1 = require("../services/wallet.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * Universal Aggregator Webhook
 * Handles all payments from the single centralized Paybill
 */
router.post('/callback', async (req, res) => {
    const payload = req.body;
    const { checkoutRequestId, transactionId, status, amount: _amount, metadata: _metadata } = payload;
    logger_1.default.info('Received aggregator callback', { checkoutRequestId, transactionId, status });
    const callbackHash = require('crypto').createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
    try {
        const processedPayment = await models_1.sequelize.transaction(async (t) => {
            const payment = await models_1.Payment.findOne({
                where: { checkoutRequestId },
                include: [models_1.Package],
                lock: true,
                transaction: t
            });
            if (!payment) {
                logger_1.default.error('Aggregator payment not found', { checkoutRequestId });
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
            }
            else {
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
                await wallet_service_1.WalletService.processPayment(processedPayment);
                // 2. Trigger Network Fulfillment
                logger_1.default.info('Initiating network fulfillment', {
                    paymentId: processedPayment.id,
                    mac: processedPayment.macAddress,
                    routerId: processedPayment.routerId
                });
                await fulfillAccess(processedPayment);
                logger_1.default.info('Network fulfillment completed', { paymentId: processedPayment.id });
                logger_1.default.info('Aggregator payment fully processed and SPLIT', {
                    paymentId: processedPayment.id,
                    tenantId: processedPayment.tenantId
                });
            }
            catch (error) {
                logger_1.default.error('Post-payment processing failed', {
                    paymentId: processedPayment.id,
                    error: error.message
                });
            }
        }
        res.status(200).send('OK');
    }
    catch (error) {
        logger_1.default.error('Aggregator Webhook Error', { error: error.message });
        res.status(500).send('Internal Error');
    }
});
async function fulfillAccess(payment) {
    if (payment.subscriberId) {
        const { IspService } = require('../services/isp.service');
        await IspService.renewSubscriber(payment.subscriberId);
    }
    else if (payment.macAddress && payment.routerId) {
        await orchestrator_1.SessionOrchestrator.grantAccess(payment.id, payment.macAddress, payment.ipAddress || undefined);
    }
}
exports.default = router;
