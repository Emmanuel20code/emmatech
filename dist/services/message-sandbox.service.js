"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageSandboxService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
class MessageSandboxService {
    /**
     * Trap and log an outgoing message in the sandbox trap.
     */
    static async trapMessage(input) {
        const log = await models_1.SandboxMessageLog.create({
            channel: input.channel,
            recipient: input.recipient,
            subject: input.subject || null,
            content: input.content,
            gateway: input.gateway || 'SANDBOX_TRAP',
            status: 'CAPTURED',
            cost: input.costCents || (input.channel === 'SMS' ? 100 : input.channel === 'WHATSAPP' ? 150 : 0),
            tenantId: input.tenantId || null,
            metadata: JSON.stringify(input.metadata || {}),
        });
        logger_1.default.info(`[MessageSandbox TRAP] ${input.channel} to ${input.recipient}: "${input.subject || input.content.slice(0, 40)}..."`);
        return log;
    }
    /**
     * Retrieve captured messages with optional channel filtering.
     */
    static async getCapturedMessages(channel, limit = 30) {
        const where = {};
        if (channel)
            where.channel = channel;
        return models_1.SandboxMessageLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
        });
    }
    /**
     * Clear sandbox message trap logs.
     */
    static async clearTrapLogs(channel) {
        const where = {};
        if (channel)
            where.channel = channel;
        return models_1.SandboxMessageLog.destroy({ where });
    }
}
exports.MessageSandboxService = MessageSandboxService;
