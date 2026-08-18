"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionOrchestrator = void 0;
const models_1 = require("./models");
const mikrotik_service_1 = require("./services/mikrotik.service");
class SessionOrchestrator {
    /**
     * Internal method to provision access after verification
     */
    static async provisionAccess(pkg, tenantId, routerId, macAddress, ipAddress, paymentId) {
        const router = await models_1.Router.findByPk(routerId);
        if (!router)
            throw new Error('Router not found');
        const username = `HS-${macAddress.replace(/[: -]/g, '').toUpperCase()}`;
        const password = Math.random().toString(36).slice(-8);
        let expiryTime;
        if (pkg.durationMinutes) {
            expiryTime = new Date(Date.now() + pkg.durationMinutes * 60 * 1000);
        }
        const session = await models_1.Session.create({
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
        await mikrotik_service_1.MikroTikService.createHotspotUser(router, username, password, macAddress, // Explicitly bind MAC for production security
        pkg.name, // Use the pre-synced profile name
        `Fulfillment for ${paymentId || 'Voucher'}`);
        return session;
    }
    static async grantAccess(paymentId, macAddress, ipAddress) {
        const payment = await models_1.Payment.findByPk(paymentId, { include: [models_1.Package] });
        if (!payment || payment.status !== 'SUCCESS') {
            throw new Error('Invalid payment for access grant');
        }
        const pkg = payment.package;
        if (!payment.routerId)
            throw new Error('No router associated with this payment');
        return await this.provisionAccess(pkg, payment.tenantId, payment.routerId, macAddress, ipAddress, payment.id);
    }
    static async grantVoucherAccess(voucherId, routerId, macAddress, ipAddress) {
        const voucher = await models_1.Voucher.findByPk(voucherId, { include: [models_1.Package] });
        if (!voucher || voucher.status !== 'USED') {
            throw new Error('Invalid voucher for access grant');
        }
        const pkg = voucher.package;
        return await this.provisionAccess(pkg, voucher.tenantId, routerId, macAddress, ipAddress);
    }
    static async handleExpiry(sessionId) {
        const session = await models_1.Session.findByPk(sessionId);
        if (!session || session.status === 'EXPIRED')
            return;
        const router = await models_1.Router.findByPk(session.routerId);
        if (!router)
            return;
        await mikrotik_service_1.MikroTikService.disconnectHotspotUser(router, session.mikrotikUsername);
        session.status = 'EXPIRED';
        await session.save();
    }
    /**
     * Update session consumption from MikroTik stats
     */
    static async updateSessionUsage(sessionId, bytesIn, bytesOut) {
        const session = await models_1.Session.findByPk(sessionId);
        if (!session)
            return;
        await session.update({
            bytesIn: bytesIn,
            bytesOut: bytesOut,
            lastUpdated: new Date()
        });
    }
    /**
     * Background task to sync stats for all active sessions on a router
     */
    static async refreshAllSessionStats(routerId) {
        const router = await models_1.Router.findByPk(routerId);
        if (!router)
            return;
        try {
            const sessions = await models_1.Session.findAll({
                where: {
                    routerId: routerId,
                    status: 'ACTIVE'
                }
            });
            if (sessions.length === 0)
                return;
            // OPTIMIZATION: Fetch once from MikroTik (O(1) vs O(N))
            const activeHotspotSessions = await mikrotik_service_1.MikroTikService.getActiveHotspotSessions(router);
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
                }
                catch (error) {
                    console.error(`Failed to refresh stats for session ${session.id}`, error);
                }
            }
        }
        catch (error) {
            console.error(`Failed to refresh stats for router ${routerId}`, error);
        }
    }
}
exports.SessionOrchestrator = SessionOrchestrator;
