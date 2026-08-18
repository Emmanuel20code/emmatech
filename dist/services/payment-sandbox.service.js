"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSandboxService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = __importDefault(require("crypto"));
class PaymentSandboxService {
    /**
     * Execute a simulated payment transaction in sandbox mode.
     */
    static async simulatePayment(input) {
        const reference = `SANDBOX-${input.provider}-${Date.now()}-${crypto_1.default.randomBytes(2).toString('hex').toUpperCase()}`;
        let status = input.scenario;
        let failureReason = null;
        let success = false;
        switch (input.scenario) {
            case 'SUCCESS':
                success = true;
                break;
            case 'FAILED':
                failureReason = 'SIMULATED_FAILURE: Insufficient funds or subscriber rejected STK push.';
                break;
            case 'TIMEOUT':
                failureReason = 'SIMULATED_TIMEOUT: Payment gateway callback timed out (no response after 60s).';
                break;
            case 'DUPLICATE':
                failureReason = 'SIMULATED_DUPLICATE: Transaction reference already processed.';
                break;
        }
        const log = await models_1.SandboxPaymentLog.create({
            provider: input.provider,
            transactionType: input.transactionType,
            reference,
            amount: input.amount,
            phoneNumber: input.phoneNumber || '+254700000000',
            status,
            failureReason,
            retryCount: input.scenario === 'TIMEOUT' ? 3 : 0,
            tenantId: input.tenantId,
            metadata: JSON.stringify(input.metadata || {}),
        });
        const simulatedWebhookPayload = {
            event: 'payment.sandbox_simulation',
            provider: input.provider,
            reference,
            amountCents: input.amount,
            currency: 'KES',
            status,
            failureReason,
            timestamp: new Date().toISOString(),
            sandboxNotice: 'DO NOT HONOR IN PRODUCTION - SIMULATION ONLY',
        };
        logger_1.default.info(`[PaymentSandbox] Simulated ${input.provider} ${input.transactionType}: ${status}`, { reference, amount: input.amount });
        return {
            success,
            reference,
            status,
            message: success ? 'Sandbox payment processed successfully.' : `Sandbox payment failed: ${failureReason}`,
            logId: log.id,
            simulatedWebhookPayload,
        };
    }
    /**
     * Get recent sandbox payment logs.
     */
    static async getSandboxPaymentLogs(tenantId, limit = 20) {
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        return models_1.SandboxPaymentLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
        });
    }
}
exports.PaymentSandboxService = PaymentSandboxService;
