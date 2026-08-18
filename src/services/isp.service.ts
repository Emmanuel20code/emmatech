import { Subscriber, Package, Router } from '../models';
import { Op } from 'sequelize';
import { MikroTikService } from './mikrotik.service';

export class IspService {
    static async registerSubscriber(data: any) {
        const { name, phoneNumber, pppoeUsername, pppoePassword, packageId, routerId, tenantId } = data;

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
            status: 'ACTIVE' // Start as active (usually after first payment)
        });

        // 2. Create on MikroTik (using profile from package)
        await MikroTikService.createHotspotUser(
            router,
            pppoeUsername,
            pppoePassword,
            undefined, // macAddress
            pkg.name,
            `Subscriber: ${name}`
        );

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

        // Ensure active on MikroTik if router exists
        if (subscriber.routerId) {
            const router = await Router.findByPk(subscriber.routerId);
            if (router && subscriber.pppoeUsername) {
                await MikroTikService.toggleHotspotUser(router, subscriber.pppoeUsername, true).catch(() => {});
            }
        }

        return subscriber;
    }

    static async updateSubscriber(id: string, data: any) {
        const subscriber = await Subscriber.findByPk(id);
        if (!subscriber) throw new Error('Subscriber not found');

        const { name, phoneNumber, pppoeUsername, pppoePassword, packageId, routerId, address, notes, status } = data;

        // If username/password changes, we might need to handle MikroTik differently
        // For simplicity, let's update DB first and then sync status if needed
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
            const pkg = subscriber.packageId ? await Package.findByPk(subscriber.packageId) : null;
            if (router && pkg) {
                // In a real system, we'd update the user on MikroTik
                // For now, toggle status based on subscriber status
                await MikroTikService.toggleHotspotUser(router, subscriber.pppoeUsername, subscriber.status === 'ACTIVE');
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
                    // We don't have a direct deleteUser in MikroTikService yet, 
                    // but we can use toggle or add a delete method.
                    // Let's assume for now we just disable them or add a method.
                    await MikroTikService.toggleHotspotUser(router, subscriber.pppoeUsername, false);
                } catch (e) {
                    console.error('Failed to remove user from MikroTik', e);
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
                    await MikroTikService.toggleHotspotUser(router, sub.pppoeUsername, false);
                }
                sub.status = 'SUSPENDED';
                await sub.save();
                console.log(`Suspended subscriber: ${sub.pppoeUsername}`);
            } catch (error) {
                console.error(`Failed to suspend ${sub.pppoeUsername}:`, error);
            }
        }
    }
}
