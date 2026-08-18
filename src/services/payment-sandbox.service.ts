import { SandboxPaymentLog } from '../models';
import logger from '../utils/logger';
import crypto from 'crypto';

export interface PaymentSimulationInput {
    provider: 'WALLET' | 'INTASEND' | 'MPESA';
    transactionType: 'PAYMENT' | 'REFUND' | 'CREDIT_PURCHASE';
    amount: number; // in cents
    phoneNumber?: string;
    scenario: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'DUPLICATE';
    tenantId: string;
    metadata?: Record<string, any>;
}

export class PaymentSandboxService {
    /**
     * Execute a simulated payment transaction in sandbox mode.
     */
    static async simulatePayment(input: PaymentSimulationInput): Promise<{
        success: boolean;
        reference: string;
        status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'DUPLICATE';
        message: string;
        logId: string;
        simulatedWebhookPayload: object;
    }> {
        const reference = `SANDBOX-${input.provider}-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        let status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'DUPLICATE' = input.scenario;
        let failureReason: string | null = null;
        let success = false;

        switch (input.scenario) {
            case 'SUCCESS':
                success = true;
                break;
            case 'FAILED':
                failureReason = 'SIMULATED_FAILURE: Insufficient funds or subscriber rejected STK push.';
                break;
            case 'TIMEOUT':
                failureReason = 'SIMULATED_TIMEOUT: Payment gateway callback timed out (no response after 60s).';
                break;
            case 'DUPLICATE':
                failureReason = 'SIMULATED_DUPLICATE: Transaction reference already processed.';
                break;
        }

        const log = await SandboxPaymentLog.create({
            provider: input.provider,
            transactionType: input.transactionType,
            reference,
            amount: input.amount,
            phoneNumber: input.phoneNumber || '+254700000000',
            status,
            failureReason,
            retryCount: input.scenario === 'TIMEOUT' ? 3 : 0,
            tenantId: input.tenantId,
            metadata: JSON.stringify(input.metadata || {}),
        });

        const simulatedWebhookPayload = {
            event: 'payment.sandbox_simulation',
            provider: input.provider,
            reference,
            amountCents: input.amount,
            currency: 'KES',
            status,
            failureReason,
            timestamp: new Date().toISOString(),
            sandboxNotice: 'DO NOT HONOR IN PRODUCTION - SIMULATION ONLY',
        };

        logger.info(`[PaymentSandbox] Simulated ${input.provider} ${input.transactionType}: ${status}`, { reference, amount: input.amount });

        return {
            success,
            reference,
            status,
            message: success ? 'Sandbox payment processed successfully.' : `Sandbox payment failed: ${failureReason}`,
            logId: log.id,
            simulatedWebhookPayload,
        };
    }

    /**
     * Get recent sandbox payment logs.
     */
    static async getSandboxPaymentLogs(tenantId?: string, limit: number = 20): Promise<SandboxPaymentLog[]> {
        const where: any = {};
        if (tenantId) where.tenantId = tenantId;

        return SandboxPaymentLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
        });
    }
}
