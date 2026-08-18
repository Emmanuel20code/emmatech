import { Payment, Session, Package, Router, Voucher } from './models';
import { MikroTikService } from './services/mikrotik.service';

export class SessionOrchestrator {
    /**
     * Internal method to provision access after verification
     */
    private static async provisionAccess(pkg: Package, tenantId: string, routerId: string, macAddress: string, ipAddress?: string, paymentId?: string) {
        const router = await Router.findByPk(routerId);
        if (!router) throw new Error('Router not found');

        const username = `HS-${macAddress.replace(/[: -]/g, '').toUpperCase()}`;
        const password = Math.random().toString(36).slice(-8);

        let expiryTime: Date | undefined;
        if (pkg.durationMinutes) {
            expiryTime = new Date(Date.now() + pkg.durationMinutes * 60 * 1000);
        }

        const session = await Session.create({
            paymentId: paymentId || 'VOUCHER',
            routerId: router.id,
            mikrotikUsername: username,
            mikrotikPassword: password,
            macAddress: macAddress,
            ipAddress: ipAddress,
            startTime: new Date(),
            expiryTime: expiryTime,
            status: 'ACTIVE',
            tenantId: tenantId
        });



        await MikroTikService.createHotspotUser(
            router,
            username,
            password,
            macAddress, // Explicitly bind MAC for production security
            pkg.name, // Use the pre-synced profile name
            `Fulfillment for ${paymentId || 'Voucher'}`
        );

        return session;
    }

    static async grantAccess(paymentId: string, macAddress: string, ipAddress?: string) {
        const payment = await Payment.findByPk(paymentId, { include: [Package] });
        if (!payment || payment.status !== 'SUCCESS') {
            throw new Error('Invalid payment for access grant');
        }

        const pkg = (payment as any).package;
        if (!payment.routerId) throw new Error('No router associated with this payment');

        return await this.provisionAccess(pkg, payment.tenantId, payment.routerId, macAddress, ipAddress, payment.id);
    }

    static async grantVoucherAccess(voucherId: string, routerId: string, macAddress: string, ipAddress?: string) {
        const voucher = await Voucher.findByPk(voucherId, { include: [Package] });
        if (!voucher || voucher.status !== 'USED') {
            throw new Error('Invalid voucher for access grant');
        }

        const pkg = (voucher as any).package;
        return await this.provisionAccess(pkg, voucher.tenantId, routerId, macAddress, ipAddress);
    }

    static async handleExpiry(sessionId: string) {
        const session = await Session.findByPk(sessionId);
        if (!session || session.status === 'EXPIRED') return;

        const router = await Router.findByPk(session.routerId);
        if (!router) return;

        await MikroTikService.disconnectHotspotUser(
            router,
            session.mikrotikUsername
        );

        session.status = 'EXPIRED';
        await session.save();
    }

    /**
     * Update session consumption from MikroTik stats
     */
    static async updateSessionUsage(sessionId: string, bytesIn: number, bytesOut: number) {
        const session = await Session.findByPk(sessionId);
        if (!session) return;

        await session.update({
            bytesIn: bytesIn,
            bytesOut: bytesOut,
            lastUpdated: new Date()
        });
    }

    /**
     * Background task to sync stats for all active sessions on a router
     */
    static async refreshAllSessionStats(routerId: string) {
        const router = await Router.findByPk(routerId);
        if (!router) return;

        try {
            const sessions = await Session.findAll({
                where: {
                    routerId: routerId,
                    status: 'ACTIVE'
                }
            });

            if (sessions.length === 0) return;

            // OPTIMIZATION: Fetch once from MikroTik (O(1) vs O(N))
            const activeHotspotSessions = await MikroTikService.getActiveHotspotSessions(router);
            const sessionMap = new Map(activeHotspotSessions.map(s => [s.username, s]));

            for (const session of sessions) {
                try {
                    const sessionStats = sessionMap.get(session.mikrotikUsername);

                    if (sessionStats) {
                        await session.update({
                            bytesIn: sessionStats.bytesIn,
                            bytesOut: sessionStats.bytesOut,
                            lastUpdated: new Date()
                        });
                    }
                } catch (error) {
                    console.error(`Failed to refresh stats for session ${session.id}`, error);
                }
            }
        } catch (error) {
            console.error(`Failed to refresh stats for router ${routerId}`, error);
        }
    }
}
