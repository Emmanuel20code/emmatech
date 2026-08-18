"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DormantRouterService = void 0;
const models_1 = require("../models");
const mikrotik_service_1 = require("./mikrotik.service");
const audit_service_1 = require("./audit.service");
const logger_1 = __importDefault(require("../utils/logger"));
class DormantRouterService {
    /**
     * Get or initialize the platform dormant router policy
     */
    static async getPolicy() {
        try {
            let policy = await models_1.DormantRouterPolicy.findOne().catch(() => null);
            if (!policy) {
                policy = await models_1.DormantRouterPolicy.create({
                    dormantThresholdMinutes: 30,
                    actionOnDormant: 'ALERT_ONLY',
                    notifyTenantAdmin: true,
                    notifyPlatformOwner: true,
                    autoActionEnabled: true
                }).catch(() => null);
            }
            if (policy)
                return policy;
            throw new Error('Database unavailable');
        }
        catch (error) {
            return {
                dormantThresholdMinutes: 30,
                actionOnDormant: 'ALERT_ONLY',
                notifyTenantAdmin: true,
                notifyPlatformOwner: true,
                autoActionEnabled: true,
                update: async () => { }
            };
        }
    }
    /**
     * Update dormant policy configuration
     */
    static async updatePolicy(updates, adminUserId) {
        try {
            const policy = await this.getPolicy();
            await policy.update(updates);
            await audit_service_1.AuditService.log('DORMANT_POLICY_UPDATED', `Dormant router policy updated: threshold ${policy.dormantThresholdMinutes}m, action ${policy.actionOnDormant}`, undefined, adminUserId);
            return policy;
        }
        catch (error) {
            logger_1.default.error('Failed to update dormant policy', { error: error.message });
            throw error;
        }
    }
    /**
     * Scan all routers across tenants, detect dormant routers, and execute automated actions
     */
    static async scanAndEnforceDormantRouters() {
        try {
            const policy = await this.getPolicy();
            const thresholdMs = (policy.dormantThresholdMinutes || 30) * 60 * 1000;
            const dormantCutoff = new Date(Date.now() - thresholdMs);
            // Find routers whose lastSeen is before cutoff or lastSeen is null
            const allRouters = await models_1.Router.findAll().catch(() => []);
            const dormantRouters = allRouters.filter(r => !r.lastSeen || new Date(r.lastSeen) < dormantCutoff);
            let processedCount = 0;
            const actionsLog = [];
            if (dormantRouters.length > 0 && policy.autoActionEnabled) {
                for (const router of dormantRouters) {
                    try {
                        const action = policy.actionOnDormant;
                        if (action === 'ALERT_ONLY') {
                            await models_1.RouterConnectionLog.create({
                                routerId: router.id,
                                tenantId: router.tenantId,
                                action: 'ERROR',
                                status: 'FAILED',
                                details: `DORMANT_DETECTED: Router ${router.name} has been inactive for > ${policy.dormantThresholdMinutes} minutes.`
                            });
                            actionsLog.push(`Alerted dormant router ${router.name}`);
                        }
                        else if (action === 'SUSPEND_ROUTER') {
                            await router.update({ isOnline: false, validationStatus: 'FAILED' });
                            await models_1.Session.update({ status: 'EXPIRED' }, { where: { routerId: router.id, status: 'ACTIVE' } });
                            await models_1.RouterConnectionLog.create({
                                routerId: router.id,
                                tenantId: router.tenantId,
                                action: 'DISCONNECT',
                                status: 'SUCCESS',
                                details: `AUTOMATED_SUSPENSION: Router ${router.name} suspended due to dormancy policy.`
                            });
                            actionsLog.push(`Suspended dormant router ${router.name}`);
                        }
                        else if (action === 'DISABLE_SYNC') {
                            await router.update({ autoConfigStatus: 'FAILED' });
                            actionsLog.push(`Disabled auto-sync for dormant router ${router.name}`);
                        }
                        else if (action === 'RECONNECT_ATTEMPT') {
                            const conn = await mikrotik_service_1.MikroTikService.testConnection(router);
                            if (conn.status) {
                                await router.update({ isOnline: true, lastSeen: new Date(), validationStatus: 'VALIDATED' });
                                actionsLog.push(`Successfully reconnected dormant router ${router.name}`);
                            }
                            else {
                                actionsLog.push(`Failed reconnect attempt for dormant router ${router.name}`);
                            }
                        }
                        processedCount++;
                    }
                    catch (e) {
                        logger_1.default.error(`Error processing dormant router ${router.id}`, { error: e.message });
                    }
                }
            }
            const summary = `Scanned ${allRouters.length} routers. Detected ${dormantRouters.length} dormant routers. Processed ${processedCount} actions.`;
            await policy.update({
                lastExecutionAt: new Date(),
                lastExecutionSummary: summary
            });
            logger_1.default.info('Dormant router scan completed', { summary });
            return {
                totalRouters: allRouters.length,
                dormantRoutersCount: dormantRouters.length,
                processedCount,
                summary,
                actionsLog,
                dormantRouters: dormantRouters.map(r => ({ id: r.id, name: r.name, lastSeen: r.lastSeen, tenantId: r.tenantId }))
            };
        }
        catch (error) {
            logger_1.default.error('Failed to run dormant router scan', { error: error.message });
            throw error;
        }
    }
}
exports.DormantRouterService = DormantRouterService;
