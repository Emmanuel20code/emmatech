"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotspotProvisioningService = void 0;
const models_1 = require("../models");
const mikrotik_command_queue_service_1 = require("./mikrotik-command-queue.service");
const logger_1 = __importDefault(require("../utils/logger"));
class HotspotProvisioningService {
    /**
     * Trigger MikroTik queue service to grant Wi-Fi access for a successful payment (with NAT traversal support)
     */
    static async grantImmediateAccess(paymentId) {
        try {
            const payment = await models_1.Payment.findByPk(paymentId, { include: [models_1.Package, models_1.Router] });
            if (!payment || payment.status !== 'SUCCESS') {
                throw new Error('Payment not found or not successful');
            }
            const pkg = payment.package;
            const router = payment.router;
            if (!router) {
                throw new Error('No router associated with this payment');
            }
            if (!payment.macAddress) {
                logger_1.default.warn('No MAC address found for payment, skipping immediate WiFi grant', { paymentId });
                return;
            }
            const username = `HS-${payment.macAddress.replace(/[: -]/g, '').toUpperCase()}`;
            const password = Math.random().toString(36).slice(-8);
            // Create session record for tracking
            let expiryTime;
            if (pkg.durationMinutes) {
                expiryTime = new Date(Date.now() + pkg.durationMinutes * 60 * 1000);
            }
            await models_1.Session.create({
                paymentId: payment.id,
                routerId: router.id,
                mikrotikUsername: username,
                mikrotikPassword: password,
                macAddress: payment.macAddress,
                ipAddress: payment.ipAddress,
                startTime: new Date(),
                expiryTime: expiryTime,
                status: 'ACTIVE',
                tenantId: payment.tenantId
            });
            // Grant access on MikroTik via Command Queue (handles direct API and NAT router queues)
            await mikrotik_command_queue_service_1.MikroTikCommandQueueService.createHotspotUser(router, username, password, payment.macAddress, pkg.name || 'default', `Paid: ${paymentId}`);
            logger_1.default.info('Immediate WiFi access granted via HotspotProvisioningService', {
                paymentId,
                username,
                routerId: router.id
            });
        }
        catch (error) {
            logger_1.default.error('Failed to grant immediate WiFi access', { paymentId, error: error.message });
            throw error;
        }
    }
}
exports.HotspotProvisioningService = HotspotProvisioningService;
