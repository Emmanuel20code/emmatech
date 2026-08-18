import logger from '../utils/logger';
import { MessageTemplate, Tenant } from '../models';
import axios from 'axios';

export class WhatsAppService {
    /**
     * Send a template message via Twilio WhatsApp API
     */
    static async sendTemplateMessage({
        to,
        templateId,
        variables,
        tenantId,
        campaignId: _campaignId
    }: {
        to: string;
        templateId: string;
        variables: string[];
        tenantId: string;
        campaignId?: string;
    }) {
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) throw new Error('Tenant not found');

        const template = await MessageTemplate.findByPk(templateId);
        if (!template || template.channel !== 'WHATSAPP') {
            throw new Error('Invalid WhatsApp template');
        }

        if (template.status !== 'APPROVED') {
            throw new Error('Template is not approved for use');
        }

        try {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const from = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. 'whatsapp:+14155238886'

            if (!accountSid || !authToken || !from) {
                throw new Error('Twilio credentials not configured');
            }

            // Real Twilio API Call
            const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

            // Format: to and from must have 'whatsapp:' prefix for Twilio
            const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`;

            // Template message parameters (Twilio specific)
            // Note: Twilio Content API is different but legacy template messaging uses Body
            // For production compliance, we assume Content SID or pre-approved Body
            const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                new URLSearchParams({
                    To: formattedTo,
                    From: from,
                    Body: this.formatTemplate(template.content, variables)
                }),
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const messageSid = response.data.sid;
            logger.info('WhatsApp message sent via Twilio', { messageSid, to: formattedTo });

            return {
                success: true,
                providerReference: messageSid,
                status: 'SENT'
            };

        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message;
            logger.error('WhatsApp delivery failed', { error: errorMsg, to });
            throw new Error(`WhatsApp provider error: ${errorMsg}`);
        }
    }

    /**
     * Helper to inject variables into template
     * e.g. "Hello {{1}}, welcome to {{2}}"
     */
    private static formatTemplate(content: string, variables: string[]): string {
        let formatted = content;
        variables.forEach((val, index) => {
            formatted = formatted.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), val);
        });
        return formatted;
    }

    /**
     * Opt-in Verification (Placeholder for production compliance logic)
     */
    static async verifyOptIn(_phoneNumber: string, _tenantId: string): Promise<boolean> {
        // In production, this would check a subscriber_preferences table
        // For now, assume all subscribers opted in or add a field to Subscriber
        return true;
    }
}
