"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentNormalizationService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const wallet_service_1 = require("./wallet.service");
const socket_service_1 = require("./socket.service");
class PaymentNormalizationService {
    /**
     * Async fulfillment function with retry logic
     */
    static async processFulfillment(fulfillmentData) {
        const { paymentId, subscriberId, macAddress, ipAddress: _ipAddress, routerId: _routerId, packageType } = fulfillmentData;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Refetch payment to get package details for accurate renewal
                const payment = await models_1.Payment.findByPk(paymentId, { include: [models_1.Package] });
                if (!payment) {
                    logger_1.default.error('Payment not found during fulfillment', { paymentId });
                    return;
                }
                const pkg = payment.package;
                if (packageType === 'ISP' && subscriberId) {
                    // ISP MODE: Renew subscriber
                    const { IspService } = require('./isp.service');
                    const durationDays = pkg?.validity || 30;
                    await IspService.renewSubscriber(subscriberId, durationDays);
                    logger_1.default.info('ISP Subscriber Renewed via Normalization', { subscriberId, paymentId, attempt, durationDays });
                }
                else if (packageType === 'HOTSPOT' && macAddress && _routerId) {
                    // HOTSPOT MODE: Grant instant access
                    const { HotspotProvisioningService } = require('./hotspot-provisioning.service');
                    await HotspotProvisioningService.grantImmediateAccess(paymentId);
                    logger_1.default.info('Hotspot Access Granted via HotspotProvisioningService', { mac: macAddress, paymentId, attempt });
                }
                else {
                    // Fallback
                    if (subscriberId) {
                        const { IspService } = require('./isp.service');
                        await IspService.renewSubscriber(subscriberId);
                    }
                    else if (macAddress && _routerId) {
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
                }
                catch (e) { }
                break;
            }
            catch (error) {
                logger_1.default.warn(`Fulfillment attempt ${attempt} failed`, {
                    paymentId,
                    error: error.message,
                    willRetry: attempt < maxRetries
                });
                if (attempt === maxRetries) {
                    logger_1.default.error('Fulfillment failed after all retries', { paymentId, error: error.message });
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                }
            }
        }
    }
    /**
     * Normalize M-Pesa STK Push result
     */
    static normalizeStkPush(payload, tenantId) {
        const body = payload.Body.stkCallback;
        const meta = body.CallbackMetadata?.Item || [];
        const getVal = (name) => meta.find((i) => i.Name === name)?.Value;
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
    static normalizeC2B(payload, tenantId, channel) {
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
    static normalizeBankTransfer(payload, tenantId) {
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
    static async processPayment(normalized) {
        try {
            // Find or update payment record
            let payment = await models_1.Payment.findOne({
                where: {
                    [normalized.externalId ? 'checkoutRequestId' : 'mpesaReceiptNumber']: normalized.externalId || normalized.transactionReference
                }
            });
            if (!payment) {
                // If STK push was initiated elsewhere or it's a direct C2B/Bank transfer
                logger_1.default.info('Creating new pending payment record', {
                    ref: normalized.transactionReference,
                    tenantId: normalized.tenantId,
                    amount: normalized.amount
                });
                payment = await models_1.Payment.create({
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
                logger_1.default.info('Payment already processed', { ref: normalized.transactionReference });
                return payment;
            }
            // Update payment to SUCCESS
            logger_1.default.info('Processing payment success', {
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
            let subscriber = await models_1.Subscriber.findOne({
                where: { phoneNumber: normalized.phoneNumber, tenantId: normalized.tenantId }
            });
            if (!subscriber) {
                subscriber = await models_1.Subscriber.create({
                    phoneNumber: normalized.phoneNumber,
                    tenantId: normalized.tenantId,
                    status: 'ACTIVE',
                    lastPaymentDate: new Date(),
                    macAddress: payment.macAddress,
                    routerId: payment.routerId,
                    packageId: payment.packageId
                });
            }
            else {
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
            socket_service_1.SocketService.emitToTenant(payment.tenantId, 'PAYMENT_SUCCESS', {
                paymentId: payment.id,
                amount: payment.amount,
                phoneNumber: payment.phoneNumber,
                macAddress: payment.macAddress
            });
            // Credit the wallet
            await wallet_service_1.WalletService.processPayment(payment);
            // Trigger fulfillment
            const pkg = await models_1.Package.findByPk(payment.packageId);
            logger_1.default.info('Triggering fulfillment', {
                paymentId: payment.id,
                packageId: payment.packageId,
                packageType: pkg?.type,
                macAddress: payment.macAddress,
                routerId: payment.routerId
            });
            const fulfillmentData = {
                paymentId: payment.id,
                subscriberId: payment.subscriberId,
                macAddress: payment.macAddress,
                ipAddress: payment.ipAddress,
                routerId: payment.routerId,
                packageType: pkg?.type
            };
            await this.processFulfillment(fulfillmentData);
            return payment;
        }
        catch (error) {
            logger_1.default.error('Failed to process normalized payment', { error: error.message, ref: normalized.transactionReference });
            throw error;
        }
    }
}
exports.PaymentNormalizationService = PaymentNormalizationService;
