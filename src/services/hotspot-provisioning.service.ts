import { Payment, Package, Router, Session } from '../models';
import { MikroTikCommandQueueService } from './mikrotik-command-queue.service';
import logger from '../utils/logger';

export class HotspotProvisioningService {
    /**
     * Trigger MikroTik queue service to grant Wi-Fi access for a successful payment (with NAT traversal support)
     */
    static async grantImmediateAccess(paymentId: string) {
        try {
            const payment = await Payment.findByPk(paymentId, { include: [Package, Router] });
            if (!payment || payment.status !== 'SUCCESS') {
                throw new Error('Payment not found or not successful');
            }

            const pkg = (payment as any).package;
            const router = (payment as any).router;

            if (!router) {
                throw new Error('No router associated with this payment');
            }

            if (!payment.macAddress) {
                logger.warn('No MAC address found for payment, skipping immediate WiFi grant', { paymentId });
                return;
            }

            const username = `HS-${payment.macAddress.replace(/[: -]/g, '').toUpperCase()}`;
            const password = Math.random().toString(36).slice(-8);

            // Create session record for tracking
            let expiryTime: Date | undefined;
            if (pkg.durationMinutes) {
                expiryTime = new Date(Date.now() + pkg.durationMinutes * 60 * 1000);
            }

            await Session.create({
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
            await MikroTikCommandQueueService.createHotspotUser(
                router,
                username,
                password,
                payment.macAddress,
                pkg.name || 'default',
                `Paid: ${paymentId}`
            );

            logger.info('Immediate WiFi access granted via HotspotProvisioningService', { 
                paymentId, 
                username, 
                routerId: router.id 
            });

        } catch (error: any) {
            logger.error('Failed to grant immediate WiFi access', { paymentId, error: error.message });
            throw error;
        }
    }
}

