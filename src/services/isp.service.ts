import { Subscriber, Package, Router } from '../models';
import { Op } from 'sequelize';
import { MikroTikService } from './mikrotik.service';
import logger from '../utils/logger';

export class IspService {
    static async registerSubscriber(data: any) {
        const { name, phoneNumber, pppoeUsername, pppoePassword, packageId, routerId, tenantId, connectionType = 'PPPOE' } = data;

        const pkg = await Package.findByPk(packageId);
        if (!pkg) throw new Error('Package not found');

        const router = await Router.findByPk(routerId);
        if (!router) throw new Error('Router not found');

        // 1. Create in DB
        const subscriber = await Subscriber.create({
            name,
            phoneNumber,
            pppoeUsername,
            pppoePassword,
            packageId,
            routerId,
            tenantId,
            connectionType,
            status: 'ACTIVE' // Start as active
        });

        // 2. Automate PPPoE Onboarding on MikroTik
        if (connectionType === 'PPPOE' && pppoeUsername) {
            await MikroTikService.createPPPoESecret(
                router,
                pppoeUsername,
                pppoePassword || '123456',
                pkg.name || 'default',
                `Jevish PPPoE: ${name}`
            );
        }

        return subscriber;
    }

    static async renewSubscriber(subscriberId: string, durationDays?: number) {
        const subscriber = await Subscriber.findByPk(subscriberId);
        if (!subscriber) throw new Error('Subscriber not found');

        let days = durationDays;
        if (!days) {
            if (subscriber.packageId) {
                const pkg = await Package.findByPk(subscriber.packageId);
                if (pkg) {
                    if (pkg.validity && pkg.validity > 0) {
                        days = pkg.validity;
                    } else if (pkg.durationMinutes && pkg.durationMinutes > 0) {
                        days = pkg.durationMinutes / (24 * 60);
                    }
                }
            }
        }
        if (!days || days <= 0) days = 30;

        const now = new Date();
        const baseDate = (subscriber.expiryDate && new Date(subscriber.expiryDate).getTime() > now.getTime())
            ? new Date(subscriber.expiryDate)
            : now;
        const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

        subscriber.expiryDate = newExpiry;
        subscriber.status = 'ACTIVE';
        subscriber.lastPaymentDate = now;
        await subscriber.save();

        // Automatic connection after payment: Enable PPPoE secret and force reconnect session
        if (subscriber.routerId && subscriber.pppoeUsername) {
            const router = await Router.findByPk(subscriber.routerId);
            if (router) {
                try {
                    await MikroTikService.togglePPPoESecret(router, subscriber.pppoeUsername, true);
                    await MikroTikService.disconnectPPPoEUser(router, subscriber.pppoeUsername);
                } catch (e: any) {
                    logger.warn('Failed to auto-connect PPPoE user on router after payment', { error: e.message });
                }
            }
        }

        return subscriber;
    }

    static async updateSubscriber(id: string, data: any) {
        const subscriber = await Subscriber.findByPk(id);
        if (!subscriber) throw new Error('Subscriber not found');

        const { name, phoneNumber, pppoeUsername, pppoePassword, packageId, routerId, address, notes, status } = data;

        await subscriber.update({
            name: name ?? subscriber.name,
            phoneNumber: phoneNumber ?? subscriber.phoneNumber,
            pppoeUsername: pppoeUsername ?? subscriber.pppoeUsername,
            pppoePassword: pppoePassword ?? subscriber.pppoePassword,
            packageId: packageId ?? subscriber.packageId,
            routerId: routerId ?? subscriber.routerId,
            address: address ?? subscriber.address,
            notes: notes ?? subscriber.notes,
            status: status ?? subscriber.status
        });

        // Sync with MikroTik if router and username available
        if (subscriber.routerId && subscriber.pppoeUsername) {
            const router = await Router.findByPk(subscriber.routerId);
            if (router) {
                const isActive = subscriber.status === 'ACTIVE';
                await MikroTikService.togglePPPoESecret(router, subscriber.pppoeUsername, isActive).catch(() => {});
                if (!isActive) {
                    await MikroTikService.disconnectPPPoEUser(router, subscriber.pppoeUsername).catch(() => {});
                }
            }
        }

        return subscriber;
    }

    static async deleteSubscriber(id: string) {
        const subscriber = await Subscriber.findByPk(id);
        if (!subscriber) throw new Error('Subscriber not found');

        // Remove from MikroTik first
        if (subscriber.routerId && subscriber.pppoeUsername) {
            const router = await Router.findByPk(subscriber.routerId);
            if (router) {
                try {
                    await MikroTikService.removePPPoESecret(router, subscriber.pppoeUsername);
                    await MikroTikService.disconnectPPPoEUser(router, subscriber.pppoeUsername);
                } catch (e: any) {
                    logger.warn('Failed to remove PPPoE secret from router on delete', { error: e.message });
                }
            }
        }

        await subscriber.destroy();
        return { success: true };
    }

    static async suspendExpiredSubscribers() {
        const now = new Date();
        const expired = await Subscriber.findAll({
            where: {
                status: 'ACTIVE',
                expiryDate: { [Op.lt]: now }
            }
        });

        for (const sub of expired) {
            try {
                if (!sub.routerId || !sub.pppoeUsername) continue;

                const router = await Router.findByPk(sub.routerId);
                if (router) {
                    // Automatic disconnection if due date and PPPoE subscription not paid
                    await MikroTikService.togglePPPoESecret(router, sub.pppoeUsername, false);
                    await MikroTikService.disconnectPPPoEUser(router, sub.pppoeUsername).catch(() => {});
                }
                sub.status = 'SUSPENDED';
                await sub.save();
                logger.info(`Automatically suspended expired PPPoE subscriber due to unpaid subscription: ${sub.pppoeUsername}`);
            } catch (error: any) {
                logger.error(`Failed to suspend PPPoE subscriber ${sub.pppoeUsername}:`, { error: error.message });
            }
        }
    }
}
