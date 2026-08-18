import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { supabase } from '../lib/supabaseClient';
import { SmsCreditsService } from './sms-credits.service';

dotenv.config();

/**
 * Production-grade SMS Service (Credit-Aware)
 * Supports generic HTTP gateways or service-specific integrations
 */
export class SMSService {
    /**
     * Send a single SMS (credit-aware)
     */
    static async sendSMS({ to, message, tenantId, userId, action }: {
        to: string;
        message: string;
        tenantId: string;
        userId?: string;
        action?: string;
    }) {
        // 1. Credit-aware check & deduction
        const creditDeducted = await SmsCreditsService.deductCredits(tenantId, 1);
        if (!creditDeducted) {
            throw new Error('INSUFFICIENT_CREDITS: Tenant has insufficient SMS credits to send message.');
        }

        try {
            // Configuration from .env
            const username = process.env.SMS_USERNAME;
            const apiKey = process.env.SMS_API_KEY;
            const senderId = process.env.SMS_SENDER_ID;
            const provider = process.env.SMS_PROVIDER || 'TALKSASA'; // e.g. TALKSASA, AFRICASTALKING

            let providerResult: any;

            if (provider === 'TALKSASA') {
                // TalkSasa Bulk SMS Integration (Default Kenya & East Africa provider)
                providerResult = await this.sendTalkSasa(to, message, apiKey!, senderId!);
            } else if (provider === 'AFRICASTALKING') {
                // Africa's Talking Integration (Common in East Africa)
                providerResult = await this.sendAfricaTalking(to, message, username!, apiKey!, senderId!);
            } else {
                // STRICT CHECK: No mocks in production
                if (process.env.NODE_ENV === 'production') {
                    throw new Error('SMS Provider not configured. Mocking invalid in production.');
                }

                // Mock or Generic Gateway logic (Dev only)
                logger.warn(`[SMS MOCK] Sending to ${to}: ${message}`);
                providerResult = { reference: `GEN_${Date.now()}`, cost: 1.0 };
            }

            // Log for Tenant Visibility and Billing
            const { data: smsLog, error: smsLogError } = await supabase
                .from('sms_logs')
                .insert({
                    tenantId,
                    phoneNumber: to,
                    message,
                    status: 'SENT',
                    cost: Math.round(providerResult.cost * 100),
                    providerReference: providerResult.reference,
                })
                .select()
                .single();

            if (smsLogError) throw new Error(smsLogError.message);

            if (action) {
                const { error: auditError } = await supabase
                    .from('audit_logs')
                    .insert({
                        action: `SMS_${action}`,
                        details: `SMS sent to ${to}. Cost: ${providerResult.cost}`,
                        tenantId,
                        userId,
                    });
                if (auditError) logger.error('Failed to log audit:', auditError.message);
            }

            return { success: true, logId: smsLog.id, reference: providerResult.reference };
        } catch (error: any) {
            logger.error(`SMS failure to ${to}: ${error.message}`);

            await supabase
                .from('sms_logs')
                .insert({
                    tenantId,
                    phoneNumber: to,
                    message,
                    status: 'FAILED',
                    cost: 0,
                });

            throw new Error(`SMS delivery failed: ${error.message}`);
        }
    }

    /**
     * Africa's Talking Specific Implementation
     */
    private static async sendAfricaTalking(to: string, message: string, username: string, apiKey: string, senderId: string) {
        const response = await axios.post(
            'https://api.africastalking.com/version1/messaging',
            new URLSearchParams({
                username,
                to,
                message,
                from: senderId,
            }),
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'apiKey': apiKey,
                },
            }
        );

        const recipientData = response.data.SMSMessageData.Recipients[0];
        if (recipientData.status !== 'Success') {
            throw new Error(`Provider Status: ${recipientData.status}`);
        }

        return {
            reference: recipientData.messageId,
            cost: parseFloat(recipientData.cost.split(' ')[1]) || 1.0,
        };
    }

    /**
     * TalkSasa Specific Implementation
     */
    private static async sendTalkSasa(to: string, message: string, apiKey: string, senderId: string) {
        const url = process.env.TALKSASA_API_URL || 'https://api.talksasa.com/v1/send';
        const response = await axios.post(
            url,
            {
                sender_id: senderId || process.env.SMS_SENDER_ID || 'TALKSASA',
                recipient: to,
                message: message,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        if (response.data?.status !== 'success' && response.data?.status !== true && response.data?.code !== 200) {
            throw new Error(`TalkSasa Error: ${response.data?.message || 'Failed to send SMS'}`);
        }

        return {
            reference: response.data?.message_id || response.data?.id || `TS_${Date.now()}`,
            cost: response.data?.cost || 0.70
        };
    }
}
