"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const crypto_1 = __importDefault(require("crypto"));
const sms_credits_service_1 = require("../services/sms-credits.service");
const sms_gateway_service_1 = require("../services/sms-gateway.service");
const models_1 = require("../models");
const express_validator_1 = require("express-validator");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
// SMS-specific rate limiter for purchases
const purchaseLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200,
    message: 'Too many purchase attempts. Please try again in 5 minutes.',
    validate: false,
    keyGenerator: (req) => req.user?.tenantId || req.user?.id || (req.ip || '127.0.0.1').replace(/^::ffff:/, ''),
});
// ================================================================
// SMS PACKAGES (Public to tenant, no secrets)
// ================================================================
router.get('/packages', async (_req, res) => {
    try {
        const packages = await sms_credits_service_1.SmsCreditsService.getActivePackages();
        res.json(packages);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// SMS WALLET BALANCE & STATS
// ================================================================
router.get('/balance', async (req, res) => {
    try {
        const balance = await sms_credits_service_1.SmsCreditsService.getBalance(req.user.tenantId);
        res.json(balance);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const stats = await sms_credits_service_1.SmsCreditsService.getDashboardStats(req.user.tenantId);
        res.json(stats);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// GATEWAY INFO (sanitized — no secrets)
// ================================================================
router.get('/gateway-info', async (_req, res) => {
    try {
        const gateways = await sms_gateway_service_1.SmsGatewayService.getAllGatewaysSafe();
        const active = gateways.find(g => g.isActive);
        if (!active)
            return res.json({ configured: false });
        // Only expose non-sensitive fields
        res.json({
            configured: true,
            provider: active.provider,
            senderId: active.senderId,
            supportedCountries: active.supportedCountries,
            supportedCurrencies: active.supportedCurrencies,
            taxRate: active.taxRate,
            minPurchaseAmount: active.minPurchaseAmount,
            maxPurchaseAmount: active.maxPurchaseAmount,
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// PURCHASE — WALLET
// ================================================================
router.post('/purchase/wallet', [
    purchaseLimiter,
    (0, express_validator_1.body)('packageId').isUUID().withMessage('Invalid package ID format'),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const { packageId } = req.body;
        // Generate idempotency key
        const idempotencyKey = `WALLET-${req.user.tenantId}-${packageId}-${Date.now()}`;
        const result = await sms_credits_service_1.SmsCreditsService.purchaseWithWallet(req.user.tenantId, packageId, req.user.id, idempotencyKey);
        res.json({
            success: true,
            message: `Successfully purchased ${result.creditsAdded} SMS credits`,
            creditsAdded: result.creditsAdded,
            newBalance: result.newBalance,
            invoiceNumber: result.smsTransaction.invoiceNumber,
            transactionId: result.smsTransaction.id,
        });
    }
    catch (e) {
        if (e.message?.startsWith('DUPLICATE_PURCHASE')) {
            return res.status(409).json({ error: 'This purchase has already been processed' });
        }
        if (e.message?.startsWith('INSUFFICIENT_BALANCE')) {
            return res.status(402).json({ error: e.message.replace('INSUFFICIENT_BALANCE: ', '') });
        }
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// PURCHASE — INTASEND (STK Push)
// ================================================================
router.post('/purchase/intasend', [
    purchaseLimiter,
    (0, express_validator_1.body)('packageId').isUUID().withMessage('Invalid package ID format'),
    (0, express_validator_1.body)('phoneNumber').isString().matches(/^(?:254|\+254|0)?([17][0-9]{8})$/).withMessage('Invalid phone number format'),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const { packageId, phoneNumber } = req.body;
        // Idempotency key bound to tenant + package + phone + time window (10 min)
        const timeWindow = Math.floor(Date.now() / (10 * 60 * 1000));
        const idempotencyKey = crypto_1.default
            .createHash('sha256')
            .update(`${req.user.tenantId}-${packageId}-${phoneNumber}-${timeWindow}`)
            .digest('hex');
        const result = await sms_credits_service_1.SmsCreditsService.initiateIntasendPurchase(req.user.tenantId, packageId, phoneNumber, req.user.id, idempotencyKey);
        res.json({
            success: true,
            message: 'STK Push sent. Complete payment on your phone.',
            checkoutId: result.checkoutId,
            trackingId: result.trackingId,
            smsTransactionId: result.smsTransactionId,
        });
    }
    catch (e) {
        if (e.message?.startsWith('DUPLICATE_PURCHASE')) {
            return res.status(409).json({ error: 'A purchase is already pending. Please complete or wait before retrying.' });
        }
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// PURCHASE STATUS POLLING (for IntaSend)
// ================================================================
router.get('/purchase/status/:transactionId', async (req, res) => {
    try {
        const tx = await models_1.SmsTransaction.findOne({
            where: { id: req.params.transactionId, tenantId: req.user.tenantId }
        });
        if (!tx)
            return res.status(404).json({ error: 'Transaction not found' });
        res.json({
            id: tx.id,
            status: tx.status,
            creditsAdded: tx.creditsAdded,
            invoiceNumber: tx.invoiceNumber,
            completedAt: tx.completedAt,
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// PAYMENT CALLBACK (IntaSend webhook for SMS purchases)
// ================================================================
router.post('/purchase/callback', async (req, res) => {
    try {
        const { tracking_id, state } = req.body;
        if (!tracking_id) {
            return res.status(400).json({ error: 'Invalid callback payload' });
        }
        if (state === 'COMPLETE' || state === 'completed') {
            const result = await sms_credits_service_1.SmsCreditsService.fulfillIntasendPurchase(tracking_id);
            if (result.success) {
                return res.json({ message: 'SMS credits fulfilled', creditsAdded: result.creditsAdded });
            }
        }
        res.json({ message: 'Callback received', state });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// PURCHASE HISTORY
// ================================================================
router.get('/history', async (req, res) => {
    try {
        const { page, limit, status } = req.query;
        const result = await sms_credits_service_1.SmsCreditsService.getHistory(req.user.tenantId, Number(page) || 1, Number(limit) || 20, status);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// HISTORY EXPORT (CSV)
// ================================================================
router.get('/history/export', async (req, res) => {
    try {
        const transactions = await models_1.SmsTransaction.findAll({
            where: { tenantId: req.user.tenantId },
            order: [['createdAt', 'DESC']],
            include: [{ model: models_1.SmsPackage, attributes: ['name', 'smsCount'], required: false }],
        });
        const rows = transactions.map((tx) => [
            new Date(tx.createdAt).toISOString(),
            tx.sms_package?.name || 'Custom',
            tx.creditsAdded,
            `KES ${(Number(tx.amount) / 100).toFixed(2)}`,
            tx.paymentMethod,
            tx.status,
            tx.invoiceNumber || '',
            tx.paymentReference || '',
        ]);
        const csv = [
            ['Date', 'Package', 'Credits', 'Amount', 'Payment Method', 'Status', 'Invoice', 'Reference'],
            ...rows
        ].map(r => r.join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="sms-history-${Date.now()}.csv"`);
        res.send(csv);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// SMS CAMPAIGNS
// ================================================================
router.get('/campaigns', async (req, res) => {
    try {
        const campaigns = await models_1.Campaign.findAll({
            where: { tenantId: req.user.tenantId, type: 'SMS' },
            order: [['createdAt', 'DESC']],
            limit: 50,
        });
        res.json(campaigns);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/campaigns', [
    (0, express_validator_1.body)('name').isString().isLength({ min: 1, max: 255 }).withMessage('Invalid campaign name'),
    (0, express_validator_1.body)('content').isString().isLength({ min: 1 }).withMessage('Campaign content is required'),
    (0, express_validator_1.body)('recipientType').optional().isIn(['ALL', 'ACTIVE', 'EXPIRED', 'CUSTOM']).withMessage('Invalid recipient type'),
    (0, express_validator_1.body)('templateId').optional().isUUID().withMessage('Invalid template ID'),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const { name, content, recipientType, phoneNumbers, scheduledAt, templateId } = req.body;
        const result = await sms_credits_service_1.SmsCreditsService.createAndSendSmsCampaign(req.user.tenantId, { name, content, recipientType: recipientType || 'ALL', phoneNumbers, scheduledAt, templateId }, req.user.id);
        res.status(201).json({
            success: true,
            message: `Campaign created. ${result.recipientCount} recipients. ${result.creditsRequired} credits deducted.`,
            ...result,
        });
    }
    catch (e) {
        if (e.message?.startsWith('INSUFFICIENT_CREDITS')) {
            return res.status(402).json({ error: e.message.replace('INSUFFICIENT_CREDITS: ', '') });
        }
        res.status(500).json({ error: e.message });
    }
});
router.get('/campaigns/:id', async (req, res) => {
    try {
        const campaign = await models_1.Campaign.findOne({
            where: { id: req.params.id, tenantId: req.user.tenantId },
        });
        if (!campaign)
            return res.status(404).json({ error: 'Campaign not found' });
        res.json(campaign);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/campaigns/:id/messages', async (req, res) => {
    try {
        const messages = await models_1.SmsCampaignMessage.findAll({
            where: { campaignId: req.params.id, tenantId: req.user.tenantId },
            order: [['createdAt', 'DESC']],
            limit: 200,
        });
        res.json(messages);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ================================================================
// SMS TEMPLATES (tenant-scoped SMS templates)
// ================================================================
router.get('/templates', async (req, res) => {
    try {
        const templates = await models_1.MessageTemplate.findAll({
            where: { tenantId: req.user.tenantId, channel: 'SMS' },
            order: [['createdAt', 'DESC']],
        });
        res.json(templates);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/templates', [
    (0, express_validator_1.body)('name').isString().isLength({ min: 1, max: 255 }).withMessage('Invalid template name'),
    (0, express_validator_1.body)('content').isString().isLength({ min: 1 }).withMessage('Template content is required'),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const { name, content } = req.body;
        const template = await models_1.MessageTemplate.create({
            name,
            content,
            channel: 'SMS',
            status: 'APPROVED',
            tenantId: req.user.tenantId,
        });
        res.status(201).json(template);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.put('/templates/:id', async (req, res) => {
    try {
        const tmpl = await models_1.MessageTemplate.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
        if (!tmpl)
            return res.status(404).json({ error: 'Template not found' });
        await tmpl.update(req.body);
        res.json(tmpl);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.delete('/templates/:id', async (req, res) => {
    try {
        const tmpl = await models_1.MessageTemplate.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
        if (!tmpl)
            return res.status(404).json({ error: 'Template not found' });
        await tmpl.destroy();
        res.json({ message: 'Template deleted' });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ================================================================
// REPORTS
// ================================================================
router.get('/reports/monthly', async (req, res) => {
    try {
        const year = Number(req.query.year) || new Date().getFullYear();
        const month = Number(req.query.month) || (new Date().getMonth() + 1);
        const report = await sms_credits_service_1.SmsCreditsService.getMonthlyReport(req.user.tenantId, year, month);
        res.json(report);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
