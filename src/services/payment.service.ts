import { MpesaService } from './mpesa.service';
import { IntaSendService } from './intasend.service';
import { WalletService } from './wallet.service';
import { SessionOrchestrator } from '../orchestrator';
import { Payment } from '../models';
import { Op } from 'sequelize';
import logger from '../utils/logger';

export class PaymentService {
    /**
     * Finds payments that have been PENDING for too long and checks Safaricom status
     */
    static async pollPendingPayments() {
        try {
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

            const pendingPayments = await Payment.findAll({
                where: {
                    status: 'PENDING',
                    [Op.or]: [
                        { checkoutRequestId: { [Op.ne]: null } },
                        { intasendTrackingId: { [Op.ne]: null } }
                    ],
                    createdAt: { [Op.lt]: twoMinutesAgo }
                }
            });

            for (const payment of pendingPayments) {
                try {
                    logger.info('Polling status for pending payment', { paymentId: payment.id });

                    let isSuccess = false;
                    let updateData: any = {};

                    if (payment.checkoutRequestId) {
                        // Original M-Pesa polling
                        const status = await MpesaService.checkTransactionStatus(payment.checkoutRequestId);
                        if (status && status.ResultCode === "0") {
                            updateData.mpesaReceiptNumber = status.MpesaReceiptNumber || `QUERY-${payment.id.slice(0, 8)}`;
                            isSuccess = true;
                        } else if (status && ["1032", "2001", "1"].includes(status.ResultCode)) {
                            updateData.status = 'FAILED';
                        }
                    } else if (payment.intasendTrackingId) {
                        // IntaSend polling
                        const status = await IntaSendService.checkStatus(payment.intasendTrackingId);
                        if (status && status.state === "COMPLETE") {
                            updateData.intasendState = status.state;
                            isSuccess = true;
                        } else if (status && ["FAILED", "CANCELLED"].includes(status.state)) {
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
                            await WalletService.processPayment(payment);
                            
                            // Execute fulfillment
                            await this.fulfillPayment(payment);
                        }
                    }

                } catch (error: any) {
                    logger.error('Polling error', { paymentId: payment.id, error: error.message });
                }
            }
        } catch (e) {
            logger.error('Payment polling background job failed', { error: (e as Error).message });
        }
    }

    private static async fulfillPayment(payment: any) {
        try {
            if (payment.subscriberId) {
                const { IspService } = require('./isp.service');
                await IspService.renewSubscriber(payment.subscriberId);
            } else if (payment.macAddress) {
                await SessionOrchestrator.grantAccess(
                    payment.id,
                    payment.macAddress,
                    payment.ipAddress as string
                );
            }
        } catch (error: any) {
            logger.error('Fulfillment error during polling', { paymentId: payment.id, error: error.message });
        }
    }
}
