import { Router } from 'express';
import { authMiddleware, authorize } from '../middleware/auth';
import { Campaign, CampaignLog, Subscriber, MessageTemplate } from '../models';
import { CampaignService } from '../services/campaign.service';
import { AuditService } from '../services/audit.service';

const router = Router();
router.use(authMiddleware);
router.use(authorize(['TENANT', 'TENANT_ADMIN', 'STAFF']));

// 1. List Campaigns
router.get('/', async (req: any, res) => {
    try {
        const campaigns = await Campaign.findAll({
            where: { tenantId: req.user.tenantId },
            order: [['createdAt', 'DESC']]
        });
        res.json(campaigns);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 1b. List Templates
router.get('/templates', async (req: any, res) => {
    try {
        const templates = await MessageTemplate.findAll({
            where: { tenantId: req.user.tenantId, channel: 'WHATSAPP' }
        });
        res.json(templates);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Create Campaign
router.post('/', async (req: any, res) => {
    try {
        const { name, type, content, subject, filterCriteria, scheduledAt, templateId } = req.body;
        const campaign = await Campaign.create({
            tenantId: req.user.tenantId,
            name,
            type,
            content,
            subject,
            templateId,
            filterCriteria: filterCriteria ? JSON.stringify(filterCriteria) : null,
            scheduledAt,
            status: 'DRAFT'
        });

        await AuditService.log('CAMPAIGN_CREATED', `Campaign ${name} created`, req.user.tenantId, req.user.id);
        res.status(201).json(campaign);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// 3. Trigger Campaign
router.post('/:id/send', async (req: any, res) => {
    try {
        const campaign = await Campaign.findOne({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        if (campaign.status === 'SENDING' || campaign.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Campaign already sent or in progress' });
        }

        // Run in background
        CampaignService.runCampaign(campaign.id).catch(err => {
            console.error(`Background campaign ${campaign.id} failed:`, err);
        });

        await AuditService.log('CAMPAIGN_TRIGGERED', `Campaign ${campaign.name} triggered`, req.user.tenantId, req.user.id);
        res.json({ message: 'Campaign sending started' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Get Campaign Stats
router.get('/:id/stats', async (req: any, res) => {
    try {
        const campaign = await Campaign.findOne({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const logs = await CampaignLog.findAll({
            where: { campaignId: campaign.id },
            include: [{ model: Subscriber, attributes: ['name', 'phoneNumber'] }],
            limit: 100,
            order: [['sentAt', 'DESC']]
        });

        res.json({ campaign, logs });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
