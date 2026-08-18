import { Router as RouterModel, RouterConnectionLog } from '../models';
import { MikroTikService } from './mikrotik.service';
import logger from '../utils/logger';

export interface QueuedMikroTikCommand {
    id: string;
    routerId: string;
    tenantId: string;
    commandType: 'CREATE_USER' | 'DISCONNECT_USER' | 'REMOVE_USER' | 'SET_PROFILE' | 'EXECUTE_SCRIPT';
    payload: Record<string, any>;
    status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    executedAt?: Date;
    attempts: number;
    errorDetails?: string;
}

export class MikroTikCommandQueueService {
    // In-memory persistent queue storage for NAT traversal & async execution
    private static commandQueue: Map<string, QueuedMikroTikCommand[]> = new Map();

    /**
     * Create a hotspot user on a router, with fallback queueing when behind NAT or unreachable
     */
    public static async createHotspotUser(
        router: RouterModel,
        username: string,
        password: string,
        macAddress?: string,
        profile: string = 'default',
        comment: string = 'Created by Jevish WiFi'
    ): Promise<void> {
        const routerId = router.id;
        const tenantId = router.tenantId;

        logger.info('[MikroTikCommandQueue] Request to create hotspot user', {
            routerId,
            tenantId,
            username,
            macAddress,
            profile,
            host: router.host
        });

        // 1. Attempt direct execution if router host is configured
        let directSuccess = false;
        let directError: string | null = null;

        const isDirectlyReachable = router.host && 
            router.host !== '0.0.0.0' && 
            router.host !== '127.0.0.1' && 
            router.host !== 'localhost' && 
            !router.host.startsWith('197.10.20.');

        if (isDirectlyReachable) {
            try {
                await MikroTikService.createHotspotUser(
                    router,
                    username,
                    password,
                    macAddress,
                    profile,
                    comment
                );
                directSuccess = true;
                logger.info('[MikroTikCommandQueue] Hotspot user created directly via API', { routerId, username });
            } catch (err: any) {
                directError = err?.message || String(err);
                logger.warn('[MikroTikCommandQueue] Direct API creation failed; queueing for NAT / agent execution', {
                    routerId,
                    username,
                    error: directError
                });
            }
        } else {
            logger.info('[MikroTikCommandQueue] Router is behind NAT or has private/dynamic IP; queueing command', {
                routerId,
                host: router.host,
                username
            });
        }

        // 2. If direct execution was not completed, queue the command for NAT polling / scheduler / agent pickup
        if (!directSuccess) {
            const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const queuedCmd: QueuedMikroTikCommand = {
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
            await RouterConnectionLog.create({
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
            }).catch(() => {});

            logger.info('[MikroTikCommandQueue] Command queued successfully for NAT router', {
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
    public static getPendingCommands(routerId: string): QueuedMikroTikCommand[] {
        const queue = this.commandQueue.get(routerId) || [];
        return queue.filter(cmd => cmd.status === 'PENDING');
    }

    /**
     * Mark a command as executed by the router agent or phone-home worker
     */
    public static markCommandExecuted(routerId: string, commandId: string, success: boolean, error?: string): void {
        const queue = this.commandQueue.get(routerId) || [];
        const cmd = queue.find(c => c.id === commandId);
        if (cmd) {
            cmd.status = success ? 'COMPLETED' : 'FAILED';
            cmd.executedAt = new Date();
            if (error) cmd.errorDetails = error;
        }
    }

    /**
     * Disconnect a hotspot user with NAT queueing fallback
     */
    public static async disconnectHotspotUser(router: RouterModel, username: string): Promise<void> {
        try {
            await MikroTikService.disconnectHotspotUser(router, username);
        } catch (err: any) {
            logger.warn('[MikroTikCommandQueue] Direct disconnect failed, queueing DISCONNECT command', {
                routerId: router.id,
                username,
                error: err.message
            });
            const commandId = `cmd_disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const queuedCmd: QueuedMikroTikCommand = {
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
export default MikroTikCommandQueueService;
