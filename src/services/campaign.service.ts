import { supabase } from '../lib/supabaseClient';
import { sendEmail } from './emailService';
import { SMSService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';
import logger from '../utils/logger';

export class CampaignService {
    /**
     * Dispatch a campaign to all eligible recipients
     */
    static async runCampaign(campaignId: string) {
        const { data: campaign, error: campError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();
        if (campError || !campaign) throw new Error('Campaign not found');

        await supabase
            .from('campaigns')
            .update({ status: 'SENDING' })
            .eq('id', campaignId);

        // 1. Fetch Recipients based on Filter
        const { data: recipients, error: subError } = await supabase
            .from('subscribers')
            .select('*')
            .eq('tenantId', campaign.tenantId)
            .eq('status', 'ACTIVE');
        if (subError) throw subError;

        await supabase
            .from('campaigns')
            .update({ totalRecipients: (recipients || []).length })
            .eq('id', campaignId);

        // 2. Queue delivery
        for (const sub of (recipients || [])) {
            try {
                let deliveryResult = { status: 'SENT', ref: null as string | null };

                // Handle Channels
                if (campaign.type === 'EMAIL' || campaign.type === 'BOTH') {
                    if (sub.email) {
                        await sendEmail({
                            to: sub.email,
                            subject: campaign.subject || 'Jevish Notification',
                            html: campaign.content,
                            tenantId: campaign.tenantId,
                            action: 'CAMPAIGN'
                        });
                    } else {
                        logger.warn(`Skipping email for subscriber ${sub.id} - No email address.`);
                    }
                }

                if (campaign.type === 'SMS' || campaign.type === 'BOTH') {
                    const sms = await SMSService.sendSMS({
                        to: sub.phoneNumber,
                        message: campaign.content,
                        tenantId: campaign.tenantId,
                        action: 'CAMPAIGN'
                    });
                    deliveryResult.ref = sms.reference;
                }

                if (campaign.type === 'WHATSAPP') {
                    if (!campaign.templateId) throw new Error('WhatsApp campaigns require a template');

                    const delivery = await WhatsAppService.sendTemplateMessage({
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
                await supabase
                    .from('campaign_logs')
                    .insert({
                        campaignId: campaign.id,
                        subscriberId: sub.id,
                        status: deliveryResult.status,
                        providerReference: deliveryResult.ref,
                        sentAt: new Date().toISOString(),
                    });

                await supabase
                    .from('campaigns')
                    .update({ sentCount: campaign.sentCount + 1 })
                    .eq('id', campaignId);
            } catch (err: any) {
                logger.error(`Campaign delivery failed for ${sub.phoneNumber}: ${err.message}`);
                await supabase
                    .from('campaign_logs')
                    .insert({
                        campaignId: campaign.id,
                        subscriberId: sub.id,
                        status: 'FAILED',
                        error: err.message,
                    });
                await supabase
                    .from('campaigns')
                    .update({ failedCount: campaign.failedCount + 1 })
                    .eq('id', campaignId);
            }
        }

        await supabase
            .from('campaigns')
            .update({ status: 'COMPLETED' })
            .eq('id', campaignId);
            
        return campaign;
    }
}
