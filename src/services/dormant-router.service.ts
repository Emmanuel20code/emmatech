import { DormantRouterPolicy, Router as RouterModel, RouterConnectionLog, Session } from '../models';
import { MikroTikService } from './mikrotik.service';
import { AuditService } from './audit.service';
import logger from '../utils/logger';
import { Op } from 'sequelize';

export class DormantRouterService {
    /**
     * Get or initialize the platform dormant router policy
     */
    static async getPolicy(): Promise<any> {
        try {
            let policy = await DormantRouterPolicy.findOne().catch(() => null);
            if (!policy) {
                policy = await DormantRouterPolicy.create({
                    dormantThresholdMinutes: 30,
                    actionOnDormant: 'ALERT_ONLY',
                    notifyTenantAdmin: true,
                    notifyPlatformOwner: true,
                    autoActionEnabled: true
                }).catch(() => null);
            }
            if (policy) return policy;
            throw new Error('Database unavailable');
        } catch (error: any) {
            return {
                dormantThresholdMinutes: 30,
                actionOnDormant: 'ALERT_ONLY',
                notifyTenantAdmin: true,
                notifyPlatformOwner: true,
                autoActionEnabled: true,
                update: async () => {}
            };
        }
    }

    /**
     * Update dormant policy configuration
     */
    static async updatePolicy(updates: {
        dormantThresholdMinutes?: number;
        actionOnDormant?: 'ALERT_ONLY' | 'SUSPEND_ROUTER' | 'DISABLE_SYNC' | 'RECONNECT_ATTEMPT';
        notifyTenantAdmin?: boolean;
        notifyPlatformOwner?: boolean;
        autoActionEnabled?: boolean;
    }, adminUserId?: string) {
        try {
            const policy = await this.getPolicy();
            await policy.update(updates);

            await AuditService.log(
                'DORMANT_POLICY_UPDATED',
                `Dormant router policy updated: threshold ${policy.dormantThresholdMinutes}m, action ${policy.actionOnDormant}`,
                undefined,
                adminUserId
            );

            return policy;
        } catch (error: any) {
            logger.error('Failed to update dormant policy', { error: error.message });
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
            const allRouters = await RouterModel.findAll().catch(() => []);
            const dormantRouters = allRouters.filter(r => !r.lastSeen || new Date(r.lastSeen) < dormantCutoff);

            let processedCount = 0;
            const actionsLog: string[] = [];

            if (dormantRouters.length > 0 && policy.autoActionEnabled) {
                for (const router of dormantRouters) {
                    try {
                        const action = policy.actionOnDormant;

                        if (action === 'ALERT_ONLY') {
                            await RouterConnectionLog.create({
                                routerId: router.id,
                                tenantId: router.tenantId,
                                action: 'ERROR',
                                status: 'FAILED',
                                details: `DORMANT_DETECTED: Router ${router.name} has been inactive for > ${policy.dormantThresholdMinutes} minutes.`
                            });
                            actionsLog.push(`Alerted dormant router ${router.name}`);
                        } else if (action === 'SUSPEND_ROUTER') {
                            await router.update({ isOnline: false, validationStatus: 'FAILED' });
                            await Session.update(
                                { status: 'EXPIRED' },
                                { where: { routerId: router.id, status: 'ACTIVE' } }
                            );
                            await RouterConnectionLog.create({
                                routerId: router.id,
                                tenantId: router.tenantId,
                                action: 'DISCONNECT',
                                status: 'SUCCESS',
                                details: `AUTOMATED_SUSPENSION: Router ${router.name} suspended due to dormancy policy.`
                            });
                            actionsLog.push(`Suspended dormant router ${router.name}`);
                        } else if (action === 'DISABLE_SYNC') {
                            await router.update({ autoConfigStatus: 'FAILED' });
                            actionsLog.push(`Disabled auto-sync for dormant router ${router.name}`);
                        } else if (action === 'RECONNECT_ATTEMPT') {
                            const conn = await MikroTikService.testConnection(router);
                            if (conn.status) {
                                await router.update({ isOnline: true, lastSeen: new Date(), validationStatus: 'VALIDATED' });
                                actionsLog.push(`Successfully reconnected dormant router ${router.name}`);
                            } else {
                                actionsLog.push(`Failed reconnect attempt for dormant router ${router.name}`);
                            }
                        }

                        processedCount++;
                    } catch (e: any) {
                        logger.error(`Error processing dormant router ${router.id}`, { error: e.message });
                    }
                }
            }

            const summary = `Scanned ${allRouters.length} routers. Detected ${dormantRouters.length} dormant routers. Processed ${processedCount} actions.`;
            await policy.update({
                lastExecutionAt: new Date(),
                lastExecutionSummary: summary
            });

            logger.info('Dormant router scan completed', { summary });

            return {
                totalRouters: allRouters.length,
                dormantRoutersCount: dormantRouters.length,
                processedCount,
                summary,
                actionsLog,
                dormantRouters: dormantRouters.map(r => ({ id: r.id, name: r.name, lastSeen: r.lastSeen, tenantId: r.tenantId }))
            };
        } catch (error: any) {
            logger.error('Failed to run dormant router scan', { error: error.message });
            throw error;
        }
    }
}
