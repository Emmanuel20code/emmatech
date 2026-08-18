"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const models_1 = require("../models");
const campaign_service_1 = require("../services/campaign.service");
const audit_service_1 = require("../services/audit.service");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.use((0, auth_1.authorize)(['TENANT', 'TENANT_ADMIN', 'STAFF']));
// 1. List Campaigns
router.get('/', async (req, res) => {
    try {
        const campaigns = await models_1.Campaign.findAll({
            where: { tenantId: req.user.tenantId },
            order: [['createdAt', 'DESC']]
        });
        res.json(campaigns);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 1b. List Templates
router.get('/templates', async (req, res) => {
    try {
        const templates = await models_1.MessageTemplate.findAll({
            where: { tenantId: req.user.tenantId, channel: 'WHATSAPP' }
        });
        res.json(templates);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 2. Create Campaign
router.post('/', async (req, res) => {
    try {
        const { name, type, content, subject, filterCriteria, scheduledAt, templateId } = req.body;
        const campaign = await models_1.Campaign.create({
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
        await audit_service_1.AuditService.log('CAMPAIGN_CREATED', `Campaign ${name} created`, req.user.tenantId, req.user.id);
        res.status(201).json(campaign);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// 3. Trigger Campaign
router.post('/:id/send', async (req, res) => {
    try {
        const campaign = await models_1.Campaign.findOne({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });
        if (!campaign)
            return res.status(404).json({ error: 'Campaign not found' });
        if (campaign.status === 'SENDING' || campaign.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Campaign already sent or in progress' });
        }
        // Run in background
        campaign_service_1.CampaignService.runCampaign(campaign.id).catch(err => {
            console.error(`Background campaign ${campaign.id} failed:`, err);
        });
        await audit_service_1.AuditService.log('CAMPAIGN_TRIGGERED', `Campaign ${campaign.name} triggered`, req.user.tenantId, req.user.id);
        res.json({ message: 'Campaign sending started' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 4. Get Campaign Stats
router.get('/:id/stats', async (req, res) => {
    try {
        const campaign = await models_1.Campaign.findOne({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });
        if (!campaign)
            return res.status(404).json({ error: 'Campaign not found' });
        const logs = await models_1.CampaignLog.findAll({
            where: { campaignId: campaign.id },
            include: [{ model: models_1.Subscriber, attributes: ['name', 'phoneNumber'] }],
            limit: 100,
            order: [['sentAt', 'DESC']]
        });
        res.json({ campaign, logs });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
