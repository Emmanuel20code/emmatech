"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const marketing_service_1 = require("../services/marketing.service");
const logger_1 = __importDefault(require("../utils/logger"));
const express_validator_1 = require("express-validator");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
// Helper to resolve tenantId safely
const getTenantId = (req) => {
    return req.tenantId || req.user?.tenantId || req.headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
};
// ─────────────────────────────────────────────────────────────
// 1. DASHBOARD SUMMARY
// ─────────────────────────────────────────────────────────────
router.get('/dashboard/summary', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const campaigns = await models_1.AdCampaign.findAll({ where: { tenantId } });
        const running = campaigns.filter(c => c.status === 'RUNNING').length;
        const scheduled = campaigns.filter(c => c.status === 'SCHEDULED').length;
        const expired = campaigns.filter(c => c.status === 'EXPIRED').length;
        const paused = campaigns.filter(c => c.status === 'PAUSED').length;
        const metrics = await marketing_service_1.MarketingService.getCampaignMetrics(tenantId);
        const coupons = await models_1.MarketingCoupon.findAll({ where: { tenantId } });
        const couponsRedeemed = coupons.reduce((acc, curr) => acc + (curr.currentUses || 0), 0);
        const recentActivity = campaigns.slice(0, 5).map(c => ({
            id: c.id,
            action: `Campaign "${c.name}" status updated to ${c.status}`,
            timestamp: c.updatedAt || new Date()
        }));
        const topPerformingAds = await Promise.all(campaigns.slice(0, 5).map(async (c) => {
            const impressions = await models_1.AdAnalytic.count({ where: { tenantId, campaignId: c.id, eventType: 'IMPRESSION' } });
            const clicks = await models_1.AdAnalytic.count({ where: { tenantId, campaignId: c.id, eventType: 'CLICK' } });
            const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : '0.00%';
            return {
                id: c.id,
                name: c.name,
                campaignType: c.campaignType,
                impressions,
                clicks,
                ctr
            };
        }));
        res.json({
            runningCampaigns: running,
            scheduledCampaigns: scheduled,
            expiredCampaigns: expired,
            pausedCampaigns: paused,
            todaysImpressions: metrics.impressions,
            todaysClicks: metrics.clicks,
            ctr: metrics.ctr,
            videoViews: metrics.videoViews,
            totalReach: metrics.totalReach,
            revenueGenerated: metrics.totalRevenueCents / 100,
            couponsRedeemed,
            recentActivity,
            topPerformingAds
        });
    }
    catch (error) {
        logger_1.default.error('Failed to load marketing dashboard summary', { tenantId: getTenantId(req), error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// 2. CAMPAIGN MANAGEMENT
// ─────────────────────────────────────────────────────────────
router.get('/campaigns', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const campaigns = await models_1.AdCampaign.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']]
        });
        res.json(campaigns);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/campaigns', [
    (0, express_validator_1.body)('name').isString().notEmpty().withMessage('Campaign name is required'),
    (0, express_validator_1.body)('campaignType').isString().notEmpty(),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        // Check Starter plan limit
        const existingCount = await models_1.AdCampaign.count({ where: { tenantId } });
        const settings = await models_1.MarketingSetting.findOne({ where: { tenantId } });
        if (existingCount >= 100 && settings?.defaultImpressionsLimit === 50000) {
            return res.status(403).json({ error: 'Campaign creation limit reached for your plan.' });
        }
        const campaign = await models_1.AdCampaign.create({
            tenantId,
            name: req.body.name,
            description: req.body.description || '',
            campaignType: req.body.campaignType,
            mediaUrls: req.body.mediaUrls ? JSON.stringify(req.body.mediaUrls) : JSON.stringify([]),
            headline: req.body.headline || '',
            subheading: req.body.subheading || '',
            buttonText: req.body.buttonText || 'Learn More',
            destinationUrl: req.body.destinationUrl || '',
            whatsappLink: req.body.whatsappLink || '',
            facebookLink: req.body.facebookLink || '',
            instagramLink: req.body.instagramLink || '',
            tiktokLink: req.body.tiktokLink || '',
            emailLink: req.body.emailLink || '',
            ctaType: req.body.ctaType || 'LEARN_MORE',
            priority: req.body.priority || 1,
            status: req.body.status || 'RUNNING',
            budget: req.body.budget ? Math.round(Number(req.body.budget) * 100) : 0,
            spentBudget: 0,
            displayRules: req.body.displayRules ? JSON.stringify(req.body.displayRules) : JSON.stringify(['BEFORE_LOGIN', 'AFTER_LOGIN']),
            startDate: req.body.startDate ? new Date(req.body.startDate) : null,
            endDate: req.body.endDate ? new Date(req.body.endDate) : null,
            startTime: req.body.startTime || null,
            endTime: req.body.endTime || null,
            daysOfWeek: req.body.daysOfWeek ? JSON.stringify(req.body.daysOfWeek) : JSON.stringify([]),
            isRecurring: Boolean(req.body.isRecurring),
            targeting: req.body.targeting ? JSON.stringify(req.body.targeting) : JSON.stringify({}),
            rotationType: req.body.rotationType || 'PRIORITY',
            weight: req.body.weight || 1.0,
            abTestEnabled: Boolean(req.body.abTestEnabled),
            marketingTrigger: req.body.marketingTrigger ? JSON.stringify(req.body.marketingTrigger) : null,
            approvalStatus: settings?.autoApproveAds ? 'APPROVED' : 'PENDING'
        });
        logger_1.default.info('Campaign created successfully', { campaignId: campaign.id, tenantId });
        res.status(201).json(campaign);
    }
    catch (error) {
        logger_1.default.error('Failed to create campaign', { tenantId: getTenantId(req), error: error.message });
        res.status(500).json({ error: error.message });
    }
});
router.put('/campaigns/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const campaign = await models_1.AdCampaign.findOne({ where: { id: req.params.id, tenantId } });
        if (!campaign)
            return res.status(404).json({ error: 'Campaign not found' });
        if (req.body.name)
            campaign.name = req.body.name;
        if (req.body.description !== undefined)
            campaign.description = req.body.description;
        if (req.body.status)
            campaign.status = req.body.status;
        if (req.body.headline !== undefined)
            campaign.headline = req.body.headline;
        if (req.body.subheading !== undefined)
            campaign.subheading = req.body.subheading;
        if (req.body.destinationUrl !== undefined)
            campaign.destinationUrl = req.body.destinationUrl;
        if (req.body.buttonText !== undefined)
            campaign.buttonText = req.body.buttonText;
        if (req.body.mediaUrls)
            campaign.mediaUrls = JSON.stringify(req.body.mediaUrls);
        if (req.body.displayRules)
            campaign.displayRules = JSON.stringify(req.body.displayRules);
        if (req.body.targeting)
            campaign.targeting = JSON.stringify(req.body.targeting);
        await campaign.save();
        res.json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/campaigns/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const campaign = await models_1.AdCampaign.findOne({ where: { id: req.params.id, tenantId } });
        if (!campaign)
            return res.status(404).json({ error: 'Campaign not found' });
        await campaign.destroy();
        res.json({ message: 'Campaign deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// 3. MEDIA LIBRARY
// ─────────────────────────────────────────────────────────────
router.get('/media', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const items = await models_1.MediaItem.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']]
        });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/media/upload', [
    (0, express_validator_1.body)('fileName').isString().notEmpty(),
    (0, express_validator_1.body)('fileUrl').isString().notEmpty(),
    (0, express_validator_1.body)('fileType').isString().notEmpty(),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const media = await marketing_service_1.MarketingService.uploadMedia(tenantId, {
            fileName: req.body.fileName,
            fileUrl: req.body.fileUrl,
            fileType: req.body.fileType,
            fileSize: req.body.fileSize || 1048576,
            mimeType: req.body.mimeType || 'image/jpeg'
        });
        res.status(201).json(media);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// 4. COUPON SYSTEM
// ─────────────────────────────────────────────────────────────
router.get('/coupons', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const coupons = await models_1.MarketingCoupon.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']]
        });
        res.json(coupons);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/coupons', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const code = req.body.couponCode || marketing_service_1.MarketingService.generateCouponCode('SURF');
        const qrCodeUrl = marketing_service_1.MarketingService.generateQRCodeDataUrl(code);
        const coupon = await models_1.MarketingCoupon.create({
            tenantId,
            campaignId: req.body.campaignId || null,
            couponCode: code,
            discountType: req.body.discountType || 'PERCENTAGE',
            discountValue: req.body.discountValue || 10,
            validityDays: req.body.validityDays || 30,
            maxUses: req.body.maxUses || 100,
            currentUses: 0,
            expirationDate: req.body.expirationDate ? new Date(req.body.expirationDate) : null,
            applicablePackageIds: req.body.applicablePackageIds ? JSON.stringify(req.body.applicablePackageIds) : null,
            qrCodeUrl,
            status: 'ACTIVE'
        });
        res.status(201).json(coupon);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// 5. QR CAMPAIGNS
// ─────────────────────────────────────────────────────────────
router.get('/qr-campaigns', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const qrs = await models_1.QRCampaign.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']]
        });
        res.json(qrs);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/qr-campaigns', [
    (0, express_validator_1.body)('title').isString().notEmpty(),
    (0, express_validator_1.body)('targetUrl').isString().notEmpty(),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const qrCodeUrl = marketing_service_1.MarketingService.generateQRCodeDataUrl(req.body.targetUrl);
        const qr = await models_1.QRCampaign.create({
            tenantId,
            title: req.body.title,
            destinationType: req.body.destinationType || 'WEBSITE',
            targetUrl: req.body.targetUrl,
            qrCodeUrl,
            scansCount: 0
        });
        res.status(201).json(qr);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// 6. LANDING PAGE BUILDER
// ─────────────────────────────────────────────────────────────
router.get('/landing-pages', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const pages = await models_1.MarketingLandingPage.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']]
        });
        res.json(pages);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/landing-pages', [
    (0, express_validator_1.body)('title').isString().notEmpty(),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const page = await models_1.MarketingLandingPage.create({
            tenantId,
            slug: `${slug}-${Date.now().toString().substring(8)}`,
            title: req.body.title,
            logoUrl: req.body.logoUrl || null,
            bannerUrl: req.body.bannerUrl || null,
            videoUrl: req.body.videoUrl || null,
            headline: req.body.headline || req.body.title,
            bodyContent: req.body.bodyContent || '',
            ctaButtonText: req.body.ctaButtonText || 'Get Started',
            ctaUrl: req.body.ctaUrl || '',
            contactInfo: req.body.contactInfo ? JSON.stringify(req.body.contactInfo) : null,
            mapEmbedUrl: req.body.mapEmbedUrl || null,
            countdownEndDate: req.body.countdownEndDate ? new Date(req.body.countdownEndDate) : null,
            testimonials: req.body.testimonials ? JSON.stringify(req.body.testimonials) : null,
            status: 'PUBLISHED',
            publishedAt: new Date()
        });
        res.status(201).json(page);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// 7. CUSTOMER SEGMENTS
// ─────────────────────────────────────────────────────────────
router.get('/customer-segments', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const segments = await models_1.CustomerSegment.findAll({
            where: { tenantId }
        });
        res.json(segments);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/customer-segments', [
    (0, express_validator_1.body)('name').isString().notEmpty(),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const segment = await models_1.CustomerSegment.create({
            tenantId,
            name: req.body.name,
            description: req.body.description || '',
            rules: req.body.rules ? JSON.stringify(req.body.rules) : JSON.stringify({}),
            memberCount: 0
        });
        res.status(201).json(segment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// 8. REPORTS EXPORT & SETTINGS
// ─────────────────────────────────────────────────────────────
router.get('/reports/export', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const format = req.query.format || 'csv';
        const campaigns = await models_1.AdCampaign.findAll({ where: { tenantId } });
        const reportData = campaigns.map(c => ({
            ID: c.id,
            Name: c.name,
            Type: c.campaignType,
            Status: c.status,
            Headline: c.headline,
            Created: c.createdAt
        }));
        res.json({
            format,
            generatedAt: new Date().toISOString(),
            recordCount: reportData.length,
            data: reportData
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/settings', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let settings = await models_1.MarketingSetting.findOne({ where: { tenantId } });
        if (!settings) {
            settings = await models_1.MarketingSetting.create({ tenantId });
        }
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/settings', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        let settings = await models_1.MarketingSetting.findOne({ where: { tenantId } });
        if (!settings) {
            settings = await models_1.MarketingSetting.create({ tenantId });
        }
        if (req.body.autoApproveAds !== undefined)
            settings.autoApproveAds = req.body.autoApproveAds;
        if (req.body.moduleEnabled !== undefined)
            settings.moduleEnabled = req.body.moduleEnabled;
        if (req.body.maxUploadSizeBytes !== undefined)
            settings.maxUploadSizeBytes = req.body.maxUploadSizeBytes;
        await settings.save();
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
