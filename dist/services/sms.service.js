"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSService = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("../utils/logger"));
const supabaseClient_1 = require("../lib/supabaseClient");
const sms_credits_service_1 = require("./sms-credits.service");
dotenv_1.default.config();
/**
 * Production-grade SMS Service (Credit-Aware)
 * Supports generic HTTP gateways or service-specific integrations
 */
class SMSService {
    /**
     * Send a single SMS (credit-aware)
     */
    static async sendSMS({ to, message, tenantId, userId, action }) {
        // 1. Credit-aware check & deduction
        const creditDeducted = await sms_credits_service_1.SmsCreditsService.deductCredits(tenantId, 1);
        if (!creditDeducted) {
            throw new Error('INSUFFICIENT_CREDITS: Tenant has insufficient SMS credits to send message.');
        }
        try {
            // Configuration from .env
            const username = process.env.SMS_USERNAME;
            const apiKey = process.env.SMS_API_KEY;
            const senderId = process.env.SMS_SENDER_ID;
            const provider = process.env.SMS_PROVIDER || 'TALKSASA'; // e.g. TALKSASA, AFRICASTALKING
            let providerResult;
            if (provider === 'TALKSASA') {
                // TalkSasa Bulk SMS Integration (Default Kenya & East Africa provider)
                providerResult = await this.sendTalkSasa(to, message, apiKey, senderId);
            }
            else if (provider === 'AFRICASTALKING') {
                // Africa's Talking Integration (Common in East Africa)
                providerResult = await this.sendAfricaTalking(to, message, username, apiKey, senderId);
            }
            else {
                // STRICT CHECK: No mocks in production
                if (process.env.NODE_ENV === 'production') {
                    throw new Error('SMS Provider not configured. Mocking invalid in production.');
                }
                // Mock or Generic Gateway logic (Dev only)
                logger_1.default.warn(`[SMS MOCK] Sending to ${to}: ${message}`);
                providerResult = { reference: `GEN_${Date.now()}`, cost: 1.0 };
            }
            // Log for Tenant Visibility and Billing
            const { data: smsLog, error: smsLogError } = await supabaseClient_1.supabase
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
            if (smsLogError)
                throw new Error(smsLogError.message);
            if (action) {
                const { error: auditError } = await supabaseClient_1.supabase
                    .from('audit_logs')
                    .insert({
                    action: `SMS_${action}`,
                    details: `SMS sent to ${to}. Cost: ${providerResult.cost}`,
                    tenantId,
                    userId,
                });
                if (auditError)
                    logger_1.default.error('Failed to log audit:', auditError.message);
            }
            return { success: true, logId: smsLog.id, reference: providerResult.reference };
        }
        catch (error) {
            logger_1.default.error(`SMS failure to ${to}: ${error.message}`);
            await supabaseClient_1.supabase
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
    static async sendAfricaTalking(to, message, username, apiKey, senderId) {
        const response = await axios_1.default.post('https://api.africastalking.com/version1/messaging', new URLSearchParams({
            username,
            to,
            message,
            from: senderId,
        }), {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'apiKey': apiKey,
            },
        });
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
    static async sendTalkSasa(to, message, apiKey, senderId) {
        const url = process.env.TALKSASA_API_URL || 'https://api.talksasa.com/v1/send';
        const response = await axios_1.default.post(url, {
            sender_id: senderId || process.env.SMS_SENDER_ID || 'TALKSASA',
            recipient: to,
            message: message,
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        if (response.data?.status !== 'success' && response.data?.status !== true && response.data?.code !== 200) {
            throw new Error(`TalkSasa Error: ${response.data?.message || 'Failed to send SMS'}`);
        }
        return {
            reference: response.data?.message_id || response.data?.id || `TS_${Date.now()}`,
            cost: response.data?.cost || 0.70
        };
    }
}
exports.SMSService = SMSService;
