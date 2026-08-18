"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const mpesa_service_1 = require("./mpesa.service");
const intasend_service_1 = require("./intasend.service");
const wallet_service_1 = require("./wallet.service");
const orchestrator_1 = require("../orchestrator");
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const logger_1 = __importDefault(require("../utils/logger"));
class PaymentService {
    /**
     * Finds payments that have been PENDING for too long and checks Safaricom status
     */
    static async pollPendingPayments() {
        try {
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const pendingPayments = await models_1.Payment.findAll({
                where: {
                    status: 'PENDING',
                    [sequelize_1.Op.or]: [
                        { checkoutRequestId: { [sequelize_1.Op.ne]: null } },
                        { intasendTrackingId: { [sequelize_1.Op.ne]: null } }
                    ],
                    createdAt: { [sequelize_1.Op.lt]: twoMinutesAgo }
                }
            });
            for (const payment of pendingPayments) {
                try {
                    logger_1.default.info('Polling status for pending payment', { paymentId: payment.id });
                    let isSuccess = false;
                    let updateData = {};
                    if (payment.checkoutRequestId) {
                        // Original M-Pesa polling
                        const status = await mpesa_service_1.MpesaService.checkTransactionStatus(payment.checkoutRequestId);
                        if (status && status.ResultCode === "0") {
                            updateData.mpesaReceiptNumber = status.MpesaReceiptNumber || `QUERY-${payment.id.slice(0, 8)}`;
                            isSuccess = true;
                        }
                        else if (status && ["1032", "2001", "1"].includes(status.ResultCode)) {
                            updateData.status = 'FAILED';
                        }
                    }
                    else if (payment.intasendTrackingId) {
                        // IntaSend polling
                        const status = await intasend_service_1.IntaSendService.checkStatus(payment.intasendTrackingId);
                        if (status && status.state === "COMPLETE") {
                            updateData.intasendState = status.state;
                            isSuccess = true;
                        }
                        else if (status && ["FAILED", "CANCELLED"].includes(status.state)) {
                            updateData.status = 'FAILED';
                            updateData.intasendState = status.state;
                        }
                    }
                    if (isSuccess) {
                        updateData.status = 'SUCCESS';
                        updateData.completedAt = new Date();
                    }
                    if (Object.keys(updateData).length > 0) {
                        await payment.update(updateData);
                        if (isSuccess) {
                            // Process Revenue Split
                            await wallet_service_1.WalletService.processPayment(payment);
                            // Execute fulfillment
                            await this.fulfillPayment(payment);
                        }
                    }
                }
                catch (error) {
                    logger_1.default.error('Polling error', { paymentId: payment.id, error: error.message });
                }
            }
        }
        catch (e) {
            logger_1.default.error('Payment polling background job failed', { error: e.message });
        }
    }
    static async fulfillPayment(payment) {
        try {
            if (payment.subscriberId) {
                const { IspService } = require('./isp.service');
                await IspService.renewSubscriber(payment.subscriberId);
            }
            else if (payment.macAddress) {
                await orchestrator_1.SessionOrchestrator.grantAccess(payment.id, payment.macAddress, payment.ipAddress);
            }
        }
        catch (error) {
            logger_1.default.error('Fulfillment error during polling', { paymentId: payment.id, error: error.message });
        }
    }
}
exports.PaymentService = PaymentService;
