"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const subscriber_service_1 = require("../services/subscriber.service");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Middleware: Authenticated Tenant/Staff/SuperAdmin
router.use(auth_1.authMiddleware);
/**
 * GET /api/v1/admin/subscribers/stats
 * Tab count summary statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const subscribers = await models_1.Subscriber.findAll({ where: { tenantId } });
        const groups = await models_1.SubscriberGroup.count({ where: { tenantId } });
        const total = subscribers.length;
        const active = subscribers.filter(s => s.status === 'ACTIVE' && !s.isDraft).length;
        const expired = subscribers.filter(s => s.status === 'INACTIVE' && !s.isDraft).length;
        const suspended = subscribers.filter(s => s.status === 'SUSPENDED').length;
        const drafts = subscribers.filter(s => s.isDraft).length;
        res.json({
            total,
            active,
            expired,
            suspended,
            drafts,
            groupsCount: groups,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch subscriber stats', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch subscriber stats' });
    }
});
/**
 * GET /api/v1/admin/subscribers
 * List all subscribers with filters and search
 */
router.get('/', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { status, type, customerGroupId, search, isDraft } = req.query;
        const where = { tenantId };
        if (status === 'ACTIVE')
            where.status = 'ACTIVE';
        else if (status === 'EXPIRED')
            where.status = 'INACTIVE';
        else if (status === 'SUSPENDED')
            where.status = 'SUSPENDED';
        if (isDraft === 'true')
            where.isDraft = true;
        else if (isDraft === 'false')
            where.isDraft = false;
        if (type)
            where.customerType = type;
        if (customerGroupId)
            where.customerGroupId = customerGroupId;
        const subscribers = await models_1.Subscriber.findAll({
            where,
            include: [
                { model: models_1.Package, attributes: ['id', 'name', 'price', 'durationMinutes'] },
                { model: models_1.SubscriberGroup, attributes: ['id', 'name', 'discountPercentage'] }
            ],
            order: [['createdAt', 'DESC']],
        });
        // Filter by search query if provided
        let filtered = subscribers;
        if (search) {
            const term = search.toLowerCase();
            filtered = subscribers.filter(s => (s.name && s.name.toLowerCase().includes(term)) ||
                (s.phoneNumber && s.phoneNumber.includes(term)) ||
                (s.username && s.username.toLowerCase().includes(term)) ||
                (s.email && s.email.toLowerCase().includes(term)) ||
                (s.idNumber && s.idNumber.toLowerCase().includes(term)));
        }
        res.json({ subscribers: filtered, total: filtered.length });
    }
    catch (error) {
        logger_1.default.error('Failed to list subscribers', { error: error.message });
        res.status(500).json({ error: 'Failed to list subscribers' });
    }
});
/**
 * POST /api/v1/admin/subscribers
 * Create subscriber manually
 */
router.post('/', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const performedBy = req.user.id;
        if (!tenantId)
            return res.status(403).json({ error: 'Tenant context required' });
        const result = await subscriber_service_1.SubscriberService.createSubscriber({
            ...req.body,
            tenantId,
            performedBy,
            ipAddress: req.ip,
        });
        res.status(201).json({ success: true, ...result });
    }
    catch (error) {
        logger_1.default.error('Failed to create subscriber', { error: error.message });
        res.status(400).json({ error: error.message || 'Failed to create subscriber' });
    }
});
/**
 * GET /api/v1/admin/subscribers/template
 * Download CSV Bulk Import Template
 */
router.get('/template', (_req, res) => {
    const csvContent = [
        'firstName,lastName,phoneNumber,altPhone,email,idNumber,username,password,customerType,connectionType,address,location,initialBalanceKES',
        'John,Doe,254712345678,254798765432,john@example.com,12345678,johndoe,Pass123!,RESIDENTIAL,HOTSPOT,House 4B,Nairobi,500',
        'Jane,Smith,254722334455,,jane@company.com,87654321,janesmith,Pass456!,BUSINESS,PPPOE,Suite 10,Mombasa,1000'
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=jevish-subscriber-import-template.csv');
    res.send(csvContent);
});
/**
 * POST /api/v1/admin/subscribers/bulk-import
 * CSV Bulk Import subscribers with validation & rollback
 */
router.post('/bulk-import', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const performedBy = req.user.id;
        const { rows } = req.body;
        if (!rows || !Array.isArray(rows)) {
            return res.status(400).json({ error: 'Array of subscriber rows required under "rows"' });
        }
        const result = await subscriber_service_1.SubscriberService.bulkImportSubscribers(tenantId, rows, performedBy, req.ip);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Bulk import error', { error: error.message });
        res.status(400).json({ error: error.message || 'Bulk import failed' });
    }
});
/**
 * GET /api/v1/admin/subscribers/groups
 * List Subscriber Groups
 */
router.get('/groups', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const groups = await models_1.SubscriberGroup.findAll({
            where: { tenantId },
            include: [{ model: models_1.Subscriber, attributes: ['id'] }]
        });
        res.json({ groups });
    }
    catch (error) {
        logger_1.default.error('Failed to list subscriber groups', { error: error.message });
        res.status(500).json({ error: 'Failed to list subscriber groups' });
    }
});
/**
 * POST /api/v1/admin/subscribers/groups
 * Create / Update Subscriber Group
 */
router.post('/groups', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { id, name, description, discountPercentage } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Group name is required' });
        if (id) {
            const group = await models_1.SubscriberGroup.findOne({ where: { id, tenantId } });
            if (group) {
                await group.update({ name, description, discountPercentage: Number(discountPercentage) || 0 });
                return res.json({ success: true, group });
            }
        }
        const group = await models_1.SubscriberGroup.create({
            tenantId,
            name,
            description: description || null,
            discountPercentage: Number(discountPercentage) || 0,
        });
        res.status(201).json({ success: true, group });
    }
    catch (error) {
        logger_1.default.error('Failed to save subscriber group', { error: error.message });
        res.status(500).json({ error: 'Failed to save subscriber group' });
    }
});
/**
 * GET /api/v1/admin/subscribers/reports
 * Onboarding & LTV Reports
 */
router.get('/reports', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const reports = await subscriber_service_1.SubscriberService.generateSubscriberReports(tenantId);
        res.json(reports);
    }
    catch (error) {
        logger_1.default.error('Failed to generate subscriber reports', { error: error.message });
        res.status(500).json({ error: 'Failed to generate subscriber reports' });
    }
});
/**
 * GET /api/v1/admin/subscribers/:id
 * Get 360 Full Details of single subscriber
 */
router.get('/:id', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;
        const subscriber = await models_1.Subscriber.findOne({
            where: { id, tenantId },
            include: [
                { model: models_1.Package },
                { model: models_1.SubscriberGroup },
                { model: models_1.Router, attributes: ['id', 'name', 'host', 'isOnline'] }
            ]
        });
        if (!subscriber)
            return res.status(404).json({ error: 'Subscriber not found' });
        const wallet = await models_1.Wallet.findOne({ where: { ownerId: id, ownerType: 'SUBSCRIBER' } });
        const walletTransactions = wallet ? await models_1.WalletTransaction.findAll({ where: { walletId: wallet.id }, order: [['createdAt', 'DESC']], limit: 10 }) : [];
        const payments = await models_1.Payment.findAll({ where: { subscriberId: id }, order: [['createdAt', 'DESC']], limit: 10 });
        const sessions = await models_1.Session.findAll({ where: { macAddress: subscriber.macAddress }, order: [['createdAt', 'DESC']], limit: 10 });
        res.json({
            subscriber,
            wallet: wallet ? { balanceKES: Number(wallet.balance) / 100, transactions: walletTransactions } : { balanceKES: 0, transactions: [] },
            payments,
            sessions,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch subscriber details', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch subscriber details' });
    }
});
/**
 * PUT /api/v1/admin/subscribers/:id
 * Edit subscriber
 */
router.put('/:id', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;
        const subscriber = await models_1.Subscriber.findOne({ where: { id, tenantId } });
        if (!subscriber)
            return res.status(404).json({ error: 'Subscriber not found' });
        await subscriber.update(req.body);
        res.json({ success: true, subscriber });
    }
    catch (error) {
        logger_1.default.error('Failed to update subscriber', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});
/**
 * POST /api/v1/admin/subscribers/:id/status
 * Change subscriber status (SUSPEND, REACTIVATE, ARCHIVE, DELETE)
 */
router.post('/:id/status', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const performedBy = req.user.id;
        const { id } = req.params;
        const { action } = req.body;
        if (!action || !['SUSPEND', 'REACTIVATE', 'ARCHIVE', 'DELETE'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Must be SUSPEND, REACTIVATE, ARCHIVE, or DELETE' });
        }
        const result = await subscriber_service_1.SubscriberService.changeSubscriberStatus(id, tenantId, action, performedBy, req.ip);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to change subscriber status', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});
/**
 * DELETE /api/v1/admin/subscribers/:id
 * Delete subscriber
 */
router.delete('/:id', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const performedBy = req.user.id;
        const { id } = req.params;
        const result = await subscriber_service_1.SubscriberService.changeSubscriberStatus(id, tenantId, 'DELETE', performedBy, req.ip);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to delete subscriber', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});
/**
 * POST /api/v1/admin/subscribers/:id/wallet
 * Credit or Debit Customer Wallet
 */
router.post('/:id/wallet', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const performedBy = req.user.id;
        const { id } = req.params;
        const { action, amountKES, reason } = req.body;
        if (!action || !['CREDIT', 'DEBIT'].includes(action) || !amountKES) {
            return res.status(400).json({ error: 'Action (CREDIT/DEBIT) and amountKES required' });
        }
        const result = await subscriber_service_1.SubscriberService.manageCustomerWallet(id, tenantId, action, Number(amountKES), reason, performedBy);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to manage wallet', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
