"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
class AuditService {
    /**
     * Standard log method
     */
    static async log(action, details, tenantId, userId, ipAddress) {
        try {
            await models_1.AuditLog.create({
                action,
                details,
                tenantId: tenantId || null,
                userId: userId || null,
                ipAddress: ipAddress || null
            });
            logger_1.default.info('Audit Log Created', { action, tenantId, userId });
        }
        catch (error) {
            logger_1.default.error('Failed to create audit log:', error);
        }
    }
    /**
     * Enhanced log event method with metadata support
     */
    static async logEvent(action, metadata, tenantId, userId, ipAddress) {
        const details = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
        return this.log(action, details, tenantId, userId, ipAddress);
    }
    /**
     * Fetch logs for a specific tenant or all logs (super admin)
     */
    static async getLogs(tenantId, limit = 100) {
        const where = {};
        if (tenantId) {
            where.tenantId = tenantId;
        }
        const logs = await models_1.AuditLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit
        });
        return logs;
    }
}
exports.AuditService = AuditService;
