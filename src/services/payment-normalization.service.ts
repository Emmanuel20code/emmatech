import { Payment, Package, Subscriber } from '../models';
import logger from '../utils/logger';
import { WalletService } from './wallet.service';
import { SocketService } from './socket.service';

export interface NormalizedPayment {
    transactionReference: string;
    amount: number;
    phoneNumber: string;
    paymentChannel: 'MPESA_PAYBILL' | 'MPESA_TILL' | 'MPESA_POCHI' | 'BANK_TRANSFER';
    paymentMethod: string;
    rawPayload: any;
    tenantId: string;
    externalId?: string;
}

export interface FulfillmentData {
    paymentId: string;
    subscriberId?: string | null;
    macAddress?: string | null;
    ipAddress?: string | null;
    routerId?: string | null;
    packageType?: 'HOTSPOT' | 'ISP';
}

export class PaymentNormalizationService {
    /**
     * Async fulfillment function with retry logic
     */
    static async processFulfillment(fulfillmentData: FulfillmentData) {
        const { paymentId, subscriberId, macAddress, ipAddress: _ipAddress, routerId: _routerId, packageType } = fulfillmentData;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Refetch payment to get package details for accurate renewal
                const payment = await Payment.findByPk(paymentId, { include: [Package] });
                if (!payment) {
                    logger.error('Payment not found during fulfillment', { paymentId });
                    return;
                }
                const pkg = (payment as any).package;

                if (packageType === 'ISP' && subscriberId) {
                    // ISP MODE: Renew subscriber
                    const { IspService } = require('./isp.service');
                    const durationDays = pkg?.validity || 30;
                    await IspService.renewSubscriber(subscriberId, durationDays);
                    logger.info('ISP Subscriber Renewed via Normalization', { subscriberId, paymentId, attempt, durationDays });
                } else if (packageType === 'HOTSPOT' && macAddress && _routerId) {
                    // HOTSPOT MODE: Grant instant access
                    const { HotspotProvisioningService } = require('./hotspot-provisioning.service');
                    await HotspotProvisioningService.grantImmediateAccess(paymentId);
                    logger.info('Hotspot Access Granted via HotspotProvisioningService', { mac: macAddress, paymentId, attempt });
                } else {
                    // Fallback
                    if (subscriberId) {
                        const { IspService } = require('./isp.service');
                        await IspService.renewSubscriber(subscriberId);
                    } else if (macAddress && _routerId) {
                        const { HotspotProvisioningService } = require('./hotspot-provisioning.service');
                        await HotspotProvisioningService.grantImmediateAccess(paymentId);
                    }
                }

                // Audit log
                try {
                    const { AuditService } = require('./audit.service');
                    await AuditService.logEvent('PAYMENT_FULFILLED', {
                        paymentId,
                        macAddress,
                        subscriberId: subscriberId || undefined,
                        routerId: _routerId,
                        timestamp: new Date()
                    });
                } catch (e) {}
                
                break;
            } catch (error: any) {
                logger.warn(`Fulfillment attempt ${attempt} failed`, {
                    paymentId,
                    error: error.message,
                    willRetry: attempt < maxRetries
                });
                if (attempt === maxRetries) {
                    logger.error('Fulfillment failed after all retries', { paymentId, error: error.message });
                } else {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                }
            }
        }
    }
    /**
     * Normalize M-Pesa STK Push result
     */
    static normalizeStkPush(payload: any, tenantId: string): NormalizedPayment {
        const body = payload.Body.stkCallback;
        const meta = body.CallbackMetadata?.Item || [];

        const getVal = (name: string) => meta.find((i: any) => i.Name === name)?.Value;

        return {
            transactionReference: getVal('MpesaReceiptNumber'),
            amount: getVal('Amount'),
            phoneNumber: getVal('PhoneNumber'),
            paymentChannel: 'MPESA_PAYBILL', // Standard STK push usually flows to Paybill
            paymentMethod: 'STK_PUSH',
            rawPayload: payload,
            tenantId: tenantId,
            externalId: body.CheckoutRequestID
        };
    }

    /**
     * Normalize M-Pesa C2B (Paybill/Till) callback
     */
    static normalizeC2B(payload: any, tenantId: string, channel: 'MPESA_PAYBILL' | 'MPESA_TILL'): NormalizedPayment {
        return {
            transactionReference: payload.TransID,
            amount: parseFloat(payload.TransAmount),
            phoneNumber: payload.MSISDN,
            paymentChannel: channel,
            paymentMethod: 'C2B',
            rawPayload: payload,
            tenantId: tenantId,
            externalId: payload.BillRefNumber
        };
    }

    /**
     * Normalize Bank Transfer (Generic)
     */
    static normalizeBankTransfer(payload: any, tenantId: string): NormalizedPayment {
        return {
            transactionReference: payload.reference,
            amount: payload.amount,
            phoneNumber: payload.senderPhone || '',
            paymentChannel: 'BANK_TRANSFER',
            paymentMethod: 'EFT_RTGS',
            rawPayload: payload,
            tenantId: tenantId
        };
    }

    /**
     * Process normalized payment into the system
     */
    static async processPayment(normalized: NormalizedPayment) {
        try {
            // Find or update payment record
            let payment = await Payment.findOne({
                where: {
                    [normalized.externalId ? 'checkoutRequestId' : 'mpesaReceiptNumber']:
                        normalized.externalId || normalized.transactionReference
                }
            });

            if (!payment) {
                // If STK push was initiated elsewhere or it's a direct C2B/Bank transfer
                logger.info('Creating new pending payment record', {
                    ref: normalized.transactionReference,
                    tenantId: normalized.tenantId,
                    amount: normalized.amount
                });
                payment = await Payment.create({
                    mpesaReceiptNumber: normalized.transactionReference,
                    amount: normalized.amount,
                    phoneNumber: normalized.phoneNumber,
                    status: 'PENDING',
                    tenantId: normalized.tenantId,
                    paymentChannel: normalized.paymentChannel,
                    paymentMethod: normalized.paymentMethod,
                    rawCallback: JSON.stringify(normalized.rawPayload),
                    packageId: 0, // Needs to be resolved or handled as generic credit
                });
            }

            if (payment.status === 'SUCCESS') {
                logger.info('Payment already processed', { ref: normalized.transactionReference });
                return payment;
            }

            // Update payment to SUCCESS
            logger.info('Processing payment success', { 
                paymentId: payment.id, 
                amount: normalized.amount,
                tenantId: payment.tenantId,
                packageId: payment.packageId
            });
            await payment.update({
                status: 'SUCCESS',
                mpesaReceiptNumber: normalized.transactionReference,
                completedAt: new Date(),
                rawCallback: JSON.stringify(normalized.rawPayload)
            });

            // Ensure subscriber is linked and active
            let subscriber = await Subscriber.findOne({
                where: { phoneNumber: normalized.phoneNumber, tenantId: normalized.tenantId }
            });

            if (!subscriber) {
                subscriber = await Subscriber.create({
                    phoneNumber: normalized.phoneNumber,
                    tenantId: normalized.tenantId,
                    status: 'ACTIVE',
                    lastPaymentDate: new Date(),
                    macAddress: payment.macAddress,
                    routerId: payment.routerId,
                    packageId: payment.packageId
                });
            } else {
                await subscriber.update({
                    status: 'ACTIVE',
                    lastPaymentDate: new Date(),
                    macAddress: payment.macAddress || subscriber.macAddress,
                    routerId: subscriber.routerId || payment.routerId,
                    packageId: payment.packageId || subscriber.packageId
                });
            }

            if (!payment.subscriberId) {
                await payment.update({ subscriberId: subscriber.id });
            }

            // Real-time broadcast
            SocketService.emitToTenant(payment.tenantId, 'PAYMENT_SUCCESS', {
                paymentId: payment.id,
                amount: payment.amount,
                phoneNumber: payment.phoneNumber,
                macAddress: payment.macAddress
            });

            // Credit the wallet
            await WalletService.processPayment(payment);

            // Trigger fulfillment
            const pkg = await Package.findByPk(payment.packageId);
            logger.info('Triggering fulfillment', { 
                paymentId: payment.id, 
                packageId: payment.packageId,
                packageType: pkg?.type,
                macAddress: payment.macAddress,
                routerId: payment.routerId
            });
            const fulfillmentData: FulfillmentData = {
                paymentId: payment.id,
                subscriberId: payment.subscriberId,
                macAddress: payment.macAddress,
                ipAddress: payment.ipAddress,
                routerId: payment.routerId,
                packageType: pkg?.type as any
            };

            await this.processFulfillment(fulfillmentData);

            return payment;
        } catch (error: any) {
            logger.error('Failed to process normalized payment', { error: error.message, ref: normalized.transactionReference });
            throw error;
        }
    }
}
