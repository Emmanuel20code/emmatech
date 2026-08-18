import { Router as RouterModel, Session } from '../models';
import { MikroTikService } from './mikrotik.service';
import { SessionOrchestrator } from '../orchestrator';
import { SocketService } from './socket.service';
import logger from '../utils/logger';

export class TrafficMonitorService {
    private static interval: NodeJS.Timeout | null = null;

    /**
     * Start the background monitoring process
     */
    static start(intervalMs: number = 300000) { // Default 5 minutes
        if (this.interval) return;

        logger.info('Traffic Monitor Service Started', { intervalMs });
        this.interval = setInterval(() => this.monitorAllRouters(), intervalMs);

        // Initial run in background
        setImmediate(() => this.monitorAllRouters());
    }

    /**
     * Stop the background monitoring process
     */
    static stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            logger.info('Traffic Monitor Service Stopped');
        }
    }

    /**
     * Iterate through all routers and update status and statistics
     */
    private static async monitorAllRouters() {
        try {
            const routers = await RouterModel.findAll().catch(() => []);

            for (const router of routers) {
                try {
                    // Skip direct TCP query for unroutable host or NAT/phone-home placeholders
                    if (!router.host || router.host === '0.0.0.0' || router.host === '127.0.0.1' || router.host === 'localhost' || router.host.startsWith('197.10.20.')) {
                        // Check if router phoned home within the last 10 minutes
                        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                        const isOnline = router.lastSeen ? new Date(router.lastSeen) > tenMinutesAgo : false;
                        if (router.isOnline !== isOnline) {
                            await router.update({ isOnline });
                            SocketService.emitToTenant(router.tenantId, 'ROUTER_STATUS', {
                                routerId: router.id,
                                isOnline,
                                lastSeen: router.lastSeen
                            });
                        }
                        continue;
                    }

                    // 1. Connectivity Check & Identity Update
                    const liveSessions = await MikroTikService.getActiveHotspotSessions(router);

                    await router.update({
                        isOnline: true,
                        lastSeen: new Date()
                    });

                    // Real-time broadcast
                    SocketService.emitToTenant(router.tenantId, 'ROUTER_STATUS', {
                        routerId: router.id,
                        isOnline: true,
                        lastSeen: new Date()
                    });

                    // 2. Synchronize Session Statistics
                    await SessionOrchestrator.refreshAllSessionStats(router.id);

                    logger.debug('Router monitoring successful', {
                        routerId: router.id,
                        name: router.name
                    });

                    // 3. Broadcast Active Sessions to Dashboard
                    const { Op } = require('sequelize');
                    const activeSessions = await Session.findAll({
                        where: { 
                            routerId: router.id, 
                            status: 'ACTIVE',
                            [Op.or]: [
                                { lastUpdated: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } },
                                { lastUpdated: null, startTime: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } }
                            ]
                        }
                    });
                    SocketService.emitToTenant(router.tenantId, 'LIVE_SESSIONS_UPDATE', {
                        routerId: router.id,
                        sessions: activeSessions
                    });
                } catch (error: any) {
                    // Update online status on failure
                    await router.update({ isOnline: false });

                    // Real-time broadcast
                    SocketService.emitToTenant(router.tenantId, 'ROUTER_STATUS', {
                        routerId: router.id,
                        isOnline: false
                    });

                    logger.debug('Router offline or connection failed', {
                        routerId: router.id,
                        host: router.host,
                        error: error?.message || String(error)
                    });
                }
            }
        } catch (error: any) {
            logger.error('Traffic Monitor loop encountered an error', {
                error: error?.message || String(error)
            });
        }
    }
}
