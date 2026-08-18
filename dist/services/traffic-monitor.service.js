"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficMonitorService = void 0;
const models_1 = require("../models");
const mikrotik_service_1 = require("./mikrotik.service");
const orchestrator_1 = require("../orchestrator");
const socket_service_1 = require("./socket.service");
const logger_1 = __importDefault(require("../utils/logger"));
class TrafficMonitorService {
    static { this.interval = null; }
    /**
     * Start the background monitoring process
     */
    static start(intervalMs = 300000) {
        if (this.interval)
            return;
        logger_1.default.info('Traffic Monitor Service Started', { intervalMs });
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
            logger_1.default.info('Traffic Monitor Service Stopped');
        }
    }
    /**
     * Iterate through all routers and update status and statistics
     */
    static async monitorAllRouters() {
        try {
            const routers = await models_1.Router.findAll().catch(() => []);
            for (const router of routers) {
                try {
                    // Skip direct TCP query for unroutable host or NAT/phone-home placeholders
                    if (!router.host || router.host === '0.0.0.0' || router.host === '127.0.0.1' || router.host === 'localhost' || router.host.startsWith('197.10.20.')) {
                        // Check if router phoned home within the last 10 minutes
                        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                        const isOnline = router.lastSeen ? new Date(router.lastSeen) > tenMinutesAgo : false;
                        if (router.isOnline !== isOnline) {
                            await router.update({ isOnline });
                            socket_service_1.SocketService.emitToTenant(router.tenantId, 'ROUTER_STATUS', {
                                routerId: router.id,
                                isOnline,
                                lastSeen: router.lastSeen
                            });
                        }
                        continue;
                    }
                    // 1. Connectivity Check & Identity Update
                    const liveSessions = await mikrotik_service_1.MikroTikService.getActiveHotspotSessions(router);
                    await router.update({
                        isOnline: true,
                        lastSeen: new Date()
                    });
                    // Real-time broadcast
                    socket_service_1.SocketService.emitToTenant(router.tenantId, 'ROUTER_STATUS', {
                        routerId: router.id,
                        isOnline: true,
                        lastSeen: new Date()
                    });
                    // 2. Synchronize Session Statistics
                    await orchestrator_1.SessionOrchestrator.refreshAllSessionStats(router.id);
                    logger_1.default.debug('Router monitoring successful', {
                        routerId: router.id,
                        name: router.name
                    });
                    // 3. Broadcast Active Sessions to Dashboard
                    const { Op } = require('sequelize');
                    const activeSessions = await models_1.Session.findAll({
                        where: {
                            routerId: router.id,
                            status: 'ACTIVE',
                            [Op.or]: [
                                { lastUpdated: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } },
                                { lastUpdated: null, startTime: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } }
                            ]
                        }
                    });
                    socket_service_1.SocketService.emitToTenant(router.tenantId, 'LIVE_SESSIONS_UPDATE', {
                        routerId: router.id,
                        sessions: activeSessions
                    });
                }
                catch (error) {
                    // Update online status on failure
                    await router.update({ isOnline: false });
                    // Real-time broadcast
                    socket_service_1.SocketService.emitToTenant(router.tenantId, 'ROUTER_STATUS', {
                        routerId: router.id,
                        isOnline: false
                    });
                    logger_1.default.debug('Router offline or connection failed', {
                        routerId: router.id,
                        host: router.host,
                        error: error?.message || String(error)
                    });
                }
            }
        }
        catch (error) {
            logger_1.default.error('Traffic Monitor loop encountered an error', {
                error: error?.message || String(error)
            });
        }
    }
}
exports.TrafficMonitorService = TrafficMonitorService;
