import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { SmsCreditsService } from '../services/sms-credits.service';
import { SmsGatewayService } from '../services/sms-gateway.service';
import { SmsTransaction, SmsPackage, Campaign, SmsCampaignMessage, MessageTemplate, Subscriber } from '../models';
import { Op } from 'sequelize';
import { body, validationResult } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';

const router = Router();

// SMS-specific rate limiter for purchases
const purchaseLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200,
    message: 'Too many purchase attempts. Please try again in 5 minutes.',
    validate: false,
    keyGenerator: (req: any) => req.user?.tenantId || req.user?.id || (req.ip || '127.0.0.1').replace(/^::ffff:/, ''),
});

// ================================================================
// SMS PACKAGES (Public to tenant, no secrets)
// ================================================================

router.get('/packages', async (_req, res) => {
    try {
        const packages = await SmsCreditsService.getActivePackages();
        res.json(packages);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// SMS WALLET BALANCE & STATS
// ================================================================

router.get('/balance', async (req: any, res) => {
    try {
        const balance = await SmsCreditsService.getBalance(req.user.tenantId);
        res.json(balance);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/stats', async (req: any, res) => {
    try {
        const stats = await SmsCreditsService.getDashboardStats(req.user.tenantId);
        res.json(stats);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// GATEWAY INFO (sanitized — no secrets)
// ================================================================

router.get('/gateway-info', async (_req, res) => {
    try {
        const gateways = await SmsGatewayService.getAllGatewaysSafe();
        const active = (gateways as any[]).find(g => g.isActive);
        if (!active) return res.json({ configured: false });
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// PURCHASE — WALLET
// ================================================================

router.post('/purchase/wallet', [
    purchaseLimiter,
    body('packageId').isUUID().withMessage('Invalid package ID format'),
    handleValidationErrors
], async (req: any, res: any) => {
    try {
        const { packageId } = req.body;

        // Generate idempotency key
        const idempotencyKey = `WALLET-${req.user.tenantId}-${packageId}-${Date.now()}`;

        const result = await SmsCreditsService.purchaseWithWallet(
            req.user.tenantId,
            packageId,
            req.user.id,
            idempotencyKey
        );

        res.json({
            success: true,
            message: `Successfully purchased ${result.creditsAdded} SMS credits`,
            creditsAdded: result.creditsAdded,
            newBalance: result.newBalance,
            invoiceNumber: result.smsTransaction.invoiceNumber,
            transactionId: result.smsTransaction.id,
        });
    } catch (e: any) {
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
    body('packageId').isUUID().withMessage('Invalid package ID format'),
    body('phoneNumber').isString().matches(/^(?:254|\+254|0)?([17][0-9]{8})$/).withMessage('Invalid phone number format'),
    handleValidationErrors
], async (req: any, res: any) => {
    try {
        const { packageId, phoneNumber } = req.body;

        // Idempotency key bound to tenant + package + phone + time window (10 min)
        const timeWindow = Math.floor(Date.now() / (10 * 60 * 1000));
        const idempotencyKey = crypto
            .createHash('sha256')
            .update(`${req.user.tenantId}-${packageId}-${phoneNumber}-${timeWindow}`)
            .digest('hex');

        const result = await SmsCreditsService.initiateIntasendPurchase(
            req.user.tenantId,
            packageId,
            phoneNumber,
            req.user.id,
            idempotencyKey
        );

        res.json({
            success: true,
            message: 'STK Push sent. Complete payment on your phone.',
            checkoutId: result.checkoutId,
            trackingId: result.trackingId,
            smsTransactionId: result.smsTransactionId,
        });
    } catch (e: any) {
        if (e.message?.startsWith('DUPLICATE_PURCHASE')) {
            return res.status(409).json({ error: 'A purchase is already pending. Please complete or wait before retrying.' });
        }
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// PURCHASE STATUS POLLING (for IntaSend)
// ================================================================

router.get('/purchase/status/:transactionId', async (req: any, res) => {
    try {
        const tx = await SmsTransaction.findOne({
            where: { id: req.params.transactionId, tenantId: req.user.tenantId }
        });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        res.json({
            id: tx.id,
            status: tx.status,
            creditsAdded: tx.creditsAdded,
            invoiceNumber: tx.invoiceNumber,
            completedAt: tx.completedAt,
        });
    } catch (e: any) {
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
            const result = await SmsCreditsService.fulfillIntasendPurchase(tracking_id);
            if (result.success) {
                return res.json({ message: 'SMS credits fulfilled', creditsAdded: result.creditsAdded });
            }
        }

        res.json({ message: 'Callback received', state });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// PURCHASE HISTORY
// ================================================================

router.get('/history', async (req: any, res) => {
    try {
        const { page, limit, status } = req.query;
        const result = await SmsCreditsService.getHistory(
            req.user.tenantId,
            Number(page) || 1,
            Number(limit) || 20,
            status as string
        );
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// HISTORY EXPORT (CSV)
// ================================================================

router.get('/history/export', async (req: any, res) => {
    try {
        const transactions = await SmsTransaction.findAll({
            where: { tenantId: req.user.tenantId },
            order: [['createdAt', 'DESC']],
            include: [{ model: SmsPackage, attributes: ['name', 'smsCount'], required: false }],
        });

        const rows = transactions.map((tx: any) => [
            new Date((tx as any).createdAt).toISOString(),
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// SMS CAMPAIGNS
// ================================================================

router.get('/campaigns', async (req: any, res) => {
    try {
        const campaigns = await Campaign.findAll({
            where: { tenantId: req.user.tenantId, type: 'SMS' },
            order: [['createdAt', 'DESC']],
            limit: 50,
        });
        res.json(campaigns);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/campaigns', [
    body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Invalid campaign name'),
    body('content').isString().isLength({ min: 1 }).withMessage('Campaign content is required'),
    body('recipientType').optional().isIn(['ALL', 'ACTIVE', 'EXPIRED', 'CUSTOM']).withMessage('Invalid recipient type'),
    body('templateId').optional().isUUID().withMessage('Invalid template ID'),
    handleValidationErrors
], async (req: any, res: any) => {
    try {
        const { name, content, recipientType, phoneNumbers, scheduledAt, templateId } = req.body;

        const result = await SmsCreditsService.createAndSendSmsCampaign(
            req.user.tenantId,
            { name, content, recipientType: recipientType || 'ALL', phoneNumbers, scheduledAt, templateId },
            req.user.id
        );

        res.status(201).json({
            success: true,
            message: `Campaign created. ${result.recipientCount} recipients. ${result.creditsRequired} credits deducted.`,
            ...result,
        });
    } catch (e: any) {
        if (e.message?.startsWith('INSUFFICIENT_CREDITS')) {
            return res.status(402).json({ error: e.message.replace('INSUFFICIENT_CREDITS: ', '') });
        }
        res.status(500).json({ error: e.message });
    }
});

router.get('/campaigns/:id', async (req: any, res) => {
    try {
        const campaign = await Campaign.findOne({
            where: { id: req.params.id, tenantId: req.user.tenantId },
        });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        res.json(campaign);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/campaigns/:id/messages', async (req: any, res) => {
    try {
        const messages = await SmsCampaignMessage.findAll({
            where: { campaignId: req.params.id, tenantId: req.user.tenantId },
            order: [['createdAt', 'DESC']],
            limit: 200,
        });
        res.json(messages);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ================================================================
// SMS TEMPLATES (tenant-scoped SMS templates)
// ================================================================

router.get('/templates', async (req: any, res) => {
    try {
        const templates = await MessageTemplate.findAll({
            where: { tenantId: req.user.tenantId, channel: 'SMS' },
            order: [['createdAt', 'DESC']],
        });
        res.json(templates);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/templates', [
    body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Invalid template name'),
    body('content').isString().isLength({ min: 1 }).withMessage('Template content is required'),
    handleValidationErrors
], async (req: any, res: any) => {
    try {
        const { name, content } = req.body;
        const template = await MessageTemplate.create({
            name,
            content,
            channel: 'SMS',
            status: 'APPROVED',
            tenantId: req.user.tenantId,
        });
        res.status(201).json(template);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.put('/templates/:id', async (req: any, res) => {
    try {
        const tmpl = await MessageTemplate.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
        if (!tmpl) return res.status(404).json({ error: 'Template not found' });
        await tmpl.update(req.body);
        res.json(tmpl);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.delete('/templates/:id', async (req: any, res) => {
    try {
        const tmpl = await MessageTemplate.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
        if (!tmpl) return res.status(404).json({ error: 'Template not found' });
        await tmpl.destroy();
        res.json({ message: 'Template deleted' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ================================================================
// REPORTS
// ================================================================

router.get('/reports/monthly', async (req: any, res) => {
    try {
        const year = Number(req.query.year) || new Date().getFullYear();
        const month = Number(req.query.month) || (new Date().getMonth() + 1);
        const report = await SmsCreditsService.getMonthlyReport(req.user.tenantId, year, month);
        res.json(report);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
