"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const supabaseClient_1 = require("../lib/supabaseClient");
const emailService_1 = require("./emailService");
const sms_service_1 = require("./sms.service");
const whatsapp_service_1 = require("./whatsapp.service");
const logger_1 = __importDefault(require("../utils/logger"));
class CampaignService {
    /**
     * Dispatch a campaign to all eligible recipients
     */
    static async runCampaign(campaignId) {
        const { data: campaign, error: campError } = await supabaseClient_1.supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();
        if (campError || !campaign)
            throw new Error('Campaign not found');
        await supabaseClient_1.supabase
            .from('campaigns')
            .update({ status: 'SENDING' })
            .eq('id', campaignId);
        // 1. Fetch Recipients based on Filter
        const { data: recipients, error: subError } = await supabaseClient_1.supabase
            .from('subscribers')
            .select('*')
            .eq('tenantId', campaign.tenantId)
            .eq('status', 'ACTIVE');
        if (subError)
            throw subError;
        await supabaseClient_1.supabase
            .from('campaigns')
            .update({ totalRecipients: (recipients || []).length })
            .eq('id', campaignId);
        // 2. Queue delivery
        for (const sub of (recipients || [])) {
            try {
                let deliveryResult = { status: 'SENT', ref: null };
                // Handle Channels
                if (campaign.type === 'EMAIL' || campaign.type === 'BOTH') {
                    if (sub.email) {
                        await (0, emailService_1.sendEmail)({
                            to: sub.email,
                            subject: campaign.subject || 'Jevish Notification',
                            html: campaign.content,
                            tenantId: campaign.tenantId,
                            action: 'CAMPAIGN'
                        });
                    }
                    else {
                        logger_1.default.warn(`Skipping email for subscriber ${sub.id} - No email address.`);
                    }
                }
                if (campaign.type === 'SMS' || campaign.type === 'BOTH') {
                    const sms = await sms_service_1.SMSService.sendSMS({
                        to: sub.phoneNumber,
                        message: campaign.content,
                        tenantId: campaign.tenantId,
                        action: 'CAMPAIGN'
                    });
                    deliveryResult.ref = sms.reference;
                }
                if (campaign.type === 'WHATSAPP') {
                    if (!campaign.templateId)
                        throw new Error('WhatsApp campaigns require a template');
                    const delivery = await whatsapp_service_1.WhatsAppService.sendTemplateMessage({
                        to: sub.phoneNumber,
                        templateId: campaign.templateId,
                        variables: [sub.name || 'Subscriber'],
                        tenantId: campaign.tenantId,
                        campaignId: campaign.id
                    });
                    deliveryResult.status = delivery.status;
                    deliveryResult.ref = delivery.providerReference;
                }
                // Log outcome
                await supabaseClient_1.supabase
                    .from('campaign_logs')
                    .insert({
                    campaignId: campaign.id,
                    subscriberId: sub.id,
                    status: deliveryResult.status,
                    providerReference: deliveryResult.ref,
                    sentAt: new Date().toISOString(),
                });
                await supabaseClient_1.supabase
                    .from('campaigns')
                    .update({ sentCount: campaign.sentCount + 1 })
                    .eq('id', campaignId);
            }
            catch (err) {
                logger_1.default.error(`Campaign delivery failed for ${sub.phoneNumber}: ${err.message}`);
                await supabaseClient_1.supabase
                    .from('campaign_logs')
                    .insert({
                    campaignId: campaign.id,
                    subscriberId: sub.id,
                    status: 'FAILED',
                    error: err.message,
                });
                await supabaseClient_1.supabase
                    .from('campaigns')
                    .update({ failedCount: campaign.failedCount + 1 })
                    .eq('id', campaignId);
            }
        }
        await supabaseClient_1.supabase
            .from('campaigns')
            .update({ status: 'COMPLETED' })
            .eq('id', campaignId);
        return campaign;
    }
}
exports.CampaignService = CampaignService;
