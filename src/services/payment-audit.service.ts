import { PaymentLog } from '../models';
import { Op } from 'sequelize';
import logger from '../utils/logger';

export interface PaymentAuditParams {
    transactionReference?: string;
    checkoutRequestId?: string;
    merchantRequestId?: string;
    tenantId?: string;
    stage: 'STK_INITIATED' | 'STK_PENDING' | 'CALLBACK_RECEIVED' | 'SIGNATURE_VERIFIED' | 'CALLBACK_VALIDATED' | 'DATABASE_UPDATED' | 'SUCCESS' | 'FAILED';
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    amount?: number;
    phoneNumber?: string;
    safaricomResultCode?: string | number;
    safaricomResultDesc?: string;
    errorDetails?: string;
    rawPayload?: any;
}

export class PaymentAuditService {
    /**
     * Record a lifecycle audit event for a payment transaction.
     */
    public static async logEvent(params: PaymentAuditParams): Promise<PaymentLog | null> {
        try {
            const logEntry = await PaymentLog.create({
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

            logger.info(`[PaymentAudit] Stage: ${params.stage} | Status: ${params.status} | CheckoutID: ${params.checkoutRequestId || 'N/A'}`);
            return logEntry;
        } catch (error: any) {
            logger.error('[PaymentAudit] Failed to record payment audit log', { error: error.message, params });
            return null;
        }
    }

    /**
     * Retrieve complete lifecycle audit trail for a transaction.
     */
    public static async getLogsForTransaction(identifier: string): Promise<PaymentLog[]> {
        try {
            return await PaymentLog.findAll({
                where: {
                    [Op.or]: [
                        { checkoutRequestId: identifier },
                        { transactionReference: identifier },
                        { merchantRequestId: identifier }
                    ]
                },
                order: [['createdAt', 'ASC']]
            });
        } catch (error: any) {
            logger.error('[PaymentAudit] Failed to retrieve logs', { error: error.message, identifier });
            return [];
        }
    }
}
