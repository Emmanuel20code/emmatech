import { AuditLog } from '../models';
import logger from '../utils/logger';

export class AuditService {
    /**
     * Standard log method
     */
    static async log(action: string, details: string, tenantId?: string, userId?: string, ipAddress?: string) {
        try {
            await AuditLog.create({
                action,
                details,
                tenantId: tenantId || null,
                userId: userId || null,
                ipAddress: ipAddress || null
            });
            logger.info('Audit Log Created', { action, tenantId, userId });
        } catch (error) {
            logger.error('Failed to create audit log:', error);
        }
    }

    /**
     * Enhanced log event method with metadata support
     */
    static async logEvent(action: string, metadata: any, tenantId?: string, userId?: string, ipAddress?: string) {
        const details = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
        return this.log(action, details, tenantId, userId, ipAddress);
    }

    /**
     * Fetch logs for a specific tenant or all logs (super admin)
     */
    static async getLogs(tenantId?: string, limit: number = 100) {
        const where: any = {};
        if (tenantId) {
            where.tenantId = tenantId;
        }

        const logs = await AuditLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit
        });
        return logs;
    }
}

