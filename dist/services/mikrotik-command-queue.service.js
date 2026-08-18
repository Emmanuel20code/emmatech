"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikroTikCommandQueueService = void 0;
const models_1 = require("../models");
const mikrotik_service_1 = require("./mikrotik.service");
const logger_1 = __importDefault(require("../utils/logger"));
class MikroTikCommandQueueService {
    // In-memory persistent queue storage for NAT traversal & async execution
    static { this.commandQueue = new Map(); }
    /**
     * Create a hotspot user on a router, with fallback queueing when behind NAT or unreachable
     */
    static async createHotspotUser(router, username, password, macAddress, profile = 'default', comment = 'Created by Jevish WiFi') {
        const routerId = router.id;
        const tenantId = router.tenantId;
        logger_1.default.info('[MikroTikCommandQueue] Request to create hotspot user', {
            routerId,
            tenantId,
            username,
            macAddress,
            profile,
            host: router.host
        });
        // 1. Attempt direct execution if router host is configured
        let directSuccess = false;
        let directError = null;
        const isDirectlyReachable = router.host &&
            router.host !== '0.0.0.0' &&
            router.host !== '127.0.0.1' &&
            router.host !== 'localhost' &&
            !router.host.startsWith('197.10.20.');
        if (isDirectlyReachable) {
            try {
                await mikrotik_service_1.MikroTikService.createHotspotUser(router, username, password, macAddress, profile, comment);
                directSuccess = true;
                logger_1.default.info('[MikroTikCommandQueue] Hotspot user created directly via API', { routerId, username });
            }
            catch (err) {
                directError = err?.message || String(err);
                logger_1.default.warn('[MikroTikCommandQueue] Direct API creation failed; queueing for NAT / agent execution', {
                    routerId,
                    username,
                    error: directError
                });
            }
        }
        else {
            logger_1.default.info('[MikroTikCommandQueue] Router is behind NAT or has private/dynamic IP; queueing command', {
                routerId,
                host: router.host,
                username
            });
        }
        // 2. If direct execution was not completed, queue the command for NAT polling / scheduler / agent pickup
        if (!directSuccess) {
            const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const queuedCmd = {
                id: commandId,
                routerId,
                tenantId,
                commandType: 'CREATE_USER',
                payload: {
                    username,
                    password,
                    macAddress,
                    profile,
                    comment
                },
                status: 'PENDING',
                createdAt: new Date(),
                attempts: directError ? 1 : 0,
                errorDetails: directError || undefined
            };
            const queue = this.commandQueue.get(routerId) || [];
            queue.push(queuedCmd);
            this.commandQueue.set(routerId, queue);
            // Log action in audit logs for tenant transparency
            await models_1.RouterConnectionLog.create({
                routerId,
                tenantId,
                action: 'CREATE_USER',
                status: 'SUCCESS',
                details: `Hotspot user ${username} provisioned and queued for NAT router dispatch`,
                metadata: JSON.stringify({
                    commandId,
                    username,
                    macAddress,
                    profile,
                    natQueued: true,
                    directAttemptFailed: !!directError
                })
            }).catch(() => { });
            logger_1.default.info('[MikroTikCommandQueue] Command queued successfully for NAT router', {
                commandId,
                routerId,
                username,
                queueLength: queue.length
            });
        }
    }
    /**
     * Get pending queued commands for a router (called by router agent / phone-home polling behind NAT)
     */
    static getPendingCommands(routerId) {
        const queue = this.commandQueue.get(routerId) || [];
        return queue.filter(cmd => cmd.status === 'PENDING');
    }
    /**
     * Mark a command as executed by the router agent or phone-home worker
     */
    static markCommandExecuted(routerId, commandId, success, error) {
        const queue = this.commandQueue.get(routerId) || [];
        const cmd = queue.find(c => c.id === commandId);
        if (cmd) {
            cmd.status = success ? 'COMPLETED' : 'FAILED';
            cmd.executedAt = new Date();
            if (error)
                cmd.errorDetails = error;
        }
    }
    /**
     * Disconnect a hotspot user with NAT queueing fallback
     */
    static async disconnectHotspotUser(router, username) {
        try {
            await mikrotik_service_1.MikroTikService.disconnectHotspotUser(router, username);
        }
        catch (err) {
            logger_1.default.warn('[MikroTikCommandQueue] Direct disconnect failed, queueing DISCONNECT command', {
                routerId: router.id,
                username,
                error: err.message
            });
            const commandId = `cmd_disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const queuedCmd = {
                id: commandId,
                routerId: router.id,
                tenantId: router.tenantId,
                commandType: 'DISCONNECT_USER',
                payload: { username },
                status: 'PENDING',
                createdAt: new Date(),
                attempts: 1,
                errorDetails: err.message
            };
            const queue = this.commandQueue.get(router.id) || [];
            queue.push(queuedCmd);
            this.commandQueue.set(router.id, queue);
        }
    }
}
exports.MikroTikCommandQueueService = MikroTikCommandQueueService;
exports.default = MikroTikCommandQueueService;
