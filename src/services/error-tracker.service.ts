import { StagingErrorLog } from '../models';
import logger from '../utils/logger';

export interface LogErrorInput {
    severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    source: 'FRONTEND' | 'BACKEND' | 'API' | 'PAYMENT' | 'DATABASE' | 'ROUTER' | 'EMAIL' | 'SMS' | 'WHATSAPP';
    message: string;
    stackTrace?: string;
    requestPath?: string;
    userId?: string;
    tenantId?: string;
    suggestedFix?: string;
    metadata?: Record<string, any>;
}

export class ErrorTrackerService {
    /**
     * Log a centralized error with AI-guided suggested fixes.
     */
    static async captureError(input: LogErrorInput): Promise<StagingErrorLog> {
        let suggestedFix = input.suggestedFix;

        if (!suggestedFix) {
            suggestedFix = this.generateSuggestedFix(input.source, input.message);
        }

        const log = await StagingErrorLog.create({
            severity: input.severity || 'ERROR',
            source: input.source,
            message: input.message,
            stackTrace: input.stackTrace || null,
            requestPath: input.requestPath || null,
            userId: input.userId || null,
            tenantId: input.tenantId || null,
            suggestedFix,
            metadata: JSON.stringify(input.metadata || {}),
        });

        logger.error(`[ErrorTracker] [${input.source}] [${input.severity || 'ERROR'}] ${input.message}`);
        return log;
    }

    /**
     * Fetch error logs with optional source or severity filter.
     */
    static async getErrorLogs(options?: {
        source?: string;
        severity?: string;
        limit?: number;
    }): Promise<StagingErrorLog[]> {
        const where: any = {};
        if (options?.source) where.source = options.source;
        if (options?.severity) where.severity = options.severity;

        return StagingErrorLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: options?.limit || 50,
        });
    }

    /**
     * Clear staging error logs.
     */
    static async clearErrorLogs(): Promise<number> {
        return StagingErrorLog.destroy({ where: {} });
    }

    /**
     * Auto-generate suggested fixes based on error patterns.
     */
    private static generateSuggestedFix(source: string, message: string): string {
        const msg = message.toLowerCase();
        if (msg.includes('econndefused') || msg.includes('connect etimedout')) {
            return 'Check router/database host IP & port accessibility. Verify firewall rules.';
        }
        if (msg.includes('insufficient_credits') || msg.includes('insufficient credits')) {
            return 'Tenant SMS wallet is low. Instruct tenant to purchase an SMS package from the SMS Credits page.';
        }
        if (msg.includes('jwt') || msg.includes('unauthorized') || msg.includes('token')) {
            return 'JWT token expired or secret key mismatch. Prompt user to re-authenticate.';
        }
        if (msg.includes('unique constraint') || msg.includes('duplicate')) {
            return 'Duplicate database key collision. Verify idempotency key or primary key uniqueness.';
        }
        if (source === 'PAYMENT') {
            return 'Verify M-Pesa / IntaSend API keys and callback URL webhook configuration.';
        }
        if (source === 'ROUTER') {
            return 'Check RouterOS API credentials, IP whitelist, and port 8728 accessibility.';
        }
        return 'Inspect full stack trace and verify request payload schema and database constraints.';
    }
}
