"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentAuditService = void 0;
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const logger_1 = __importDefault(require("../utils/logger"));
class PaymentAuditService {
    /**
     * Record a lifecycle audit event for a payment transaction.
     */
    static async logEvent(params) {
        try {
            const logEntry = await models_1.PaymentLog.create({
                transactionReference: params.transactionReference || null,
                checkoutRequestId: params.checkoutRequestId || null,
                merchantRequestId: params.merchantRequestId || null,
                tenantId: params.tenantId || null,
                stage: params.stage,
                status: params.status,
                amount: params.amount !== undefined ? params.amount : null,
                phoneNumber: params.phoneNumber || null,
                safaricomResultCode: params.safaricomResultCode !== undefined ? String(params.safaricomResultCode) : null,
                safaricomResultDesc: params.safaricomResultDesc || null,
                errorDetails: params.errorDetails || null,
                rawPayload: params.rawPayload ? (typeof params.rawPayload === 'string' ? params.rawPayload : JSON.stringify(params.rawPayload)) : null
            });
            logger_1.default.info(`[PaymentAudit] Stage: ${params.stage} | Status: ${params.status} | CheckoutID: ${params.checkoutRequestId || 'N/A'}`);
            return logEntry;
        }
        catch (error) {
            logger_1.default.error('[PaymentAudit] Failed to record payment audit log', { error: error.message, params });
            return null;
        }
    }
    /**
     * Retrieve complete lifecycle audit trail for a transaction.
     */
    static async getLogsForTransaction(identifier) {
        try {
            return await models_1.PaymentLog.findAll({
                where: {
                    [sequelize_1.Op.or]: [
                        { checkoutRequestId: identifier },
                        { transactionReference: identifier },
                        { merchantRequestId: identifier }
                    ]
                },
                order: [['createdAt', 'ASC']]
            });
        }
        catch (error) {
            logger_1.default.error('[PaymentAudit] Failed to retrieve logs', { error: error.message, identifier });
            return [];
        }
    }
}
exports.PaymentAuditService = PaymentAuditService;
