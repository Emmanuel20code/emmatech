import { SandboxMessageLog } from '../models';
import logger from '../utils/logger';

export interface TrapMessageInput {
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
    recipient: string;
    subject?: string;
    content: string;
    gateway?: string;
    tenantId?: string;
    costCents?: number;
    metadata?: Record<string, any>;
}

export class MessageSandboxService {
    /**
     * Trap and log an outgoing message in the sandbox trap.
     */
    static async trapMessage(input: TrapMessageInput): Promise<SandboxMessageLog> {
        const log = await SandboxMessageLog.create({
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

        logger.info(`[MessageSandbox TRAP] ${input.channel} to ${input.recipient}: "${input.subject || input.content.slice(0, 40)}..."`);
        return log;
    }

    /**
     * Retrieve captured messages with optional channel filtering.
     */
    static async getCapturedMessages(channel?: 'EMAIL' | 'SMS' | 'WHATSAPP', limit: number = 30): Promise<SandboxMessageLog[]> {
        const where: any = {};
        if (channel) where.channel = channel;

        return SandboxMessageLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
        });
    }

    /**
     * Clear sandbox message trap logs.
     */
    static async clearTrapLogs(channel?: 'EMAIL' | 'SMS' | 'WHATSAPP'): Promise<number> {
        const where: any = {};
        if (channel) where.channel = channel;
        return SandboxMessageLog.destroy({ where });
    }
}
