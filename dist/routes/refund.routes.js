"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const refund_service_1 = require("../services/refund.service");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const sequelize_1 = require("sequelize");
const router = (0, express_1.Router)();
// Middleware: Require Authenticated Tenant/Staff/SuperAdmin User
router.use(auth_1.authMiddleware);
/**
 * GET /api/v1/admin/refunds/stats
 * Dashboard KPI Summary Stats
 */
router.get('/stats', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Tenant context required' });
        }
        const targetTenantId = tenantId || req.query.tenantId;
        const stats = await refund_service_1.RefundService.getRefundStats(targetTenantId);
        res.json(stats);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch refund stats', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch refund stats' });
    }
});
/**
 * GET /api/v1/admin/refunds
 * List all refunds with status, category, date filters & search
 */
router.get('/', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { status, category, type, search, startDate, endDate } = req.query;
        const where = {};
        if (tenantId)
            where.tenantId = tenantId;
        if (status)
            where.status = status;
        if (category)
            where.category = category;
        if (type)
            where.type = type;
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date();
            end.setHours(23, 59, 59, 999);
            where.createdAt = { [sequelize_1.Op.between]: [start, end] };
        }
        const refunds = await models_1.RefundRequest.findAll({
            where,
            include: [
                { model: models_1.Subscriber, attributes: ['id', 'name', 'phoneNumber', 'email', 'macAddress'] },
                { model: models_1.Payment, attributes: ['id', 'mpesaReceiptNumber', 'amount', 'completedAt'] }
            ],
            order: [['createdAt', 'DESC']],
        });
        // Filter by search term if provided
        let filtered = refunds;
        if (search) {
            const term = search.toLowerCase();
            filtered = refunds.filter(r => {
                const sub = r.subscriber;
                return (r.reason.toLowerCase().includes(term) ||
                    r.id.toLowerCase().includes(term) ||
                    (sub && (sub.name?.toLowerCase().includes(term) || sub.phoneNumber?.includes(term))));
            });
        }
        res.json({ refunds: filtered, total: filtered.length });
    }
    catch (error) {
        logger_1.default.error('Failed to list refunds', { error: error.message });
        res.status(500).json({ error: 'Failed to list refunds' });
    }
});
/**
 * POST /api/v1/admin/refunds
 * Create a new customer refund / compensation request
 */
router.post('/', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const requestedBy = req.user.id;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant context required' });
        }
        const { subscriberId, paymentId, packageId, type, category, amount, extensionMinutes, freeDataBytes, reason, notes, evidenceUrl, autoExecute } = req.body;
        if (!subscriberId || !type || !reason) {
            return res.status(400).json({ error: 'Missing required fields: subscriberId, type, reason' });
        }
        const refund = await refund_service_1.RefundService.createRefundRequest({
            tenantId,
            subscriberId,
            paymentId,
            packageId,
            type,
            category: category || 'GOODWILL',
            amount: amount ? Number(amount) : 0,
            extensionMinutes: extensionMinutes ? Number(extensionMinutes) : 0,
            freeDataBytes: freeDataBytes ? Number(freeDataBytes) : 0,
            reason,
            notes,
            evidenceUrl,
            requestedBy,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            autoExecute: !!autoExecute,
        });
        res.status(201).json({ success: true, refund });
    }
    catch (error) {
        logger_1.default.error('Failed to create refund request', { error: error.message });
        res.status(400).json({ error: error.message || 'Failed to create refund request' });
    }
});
/**
 * PUT /api/v1/admin/refunds/:id/status
 * Transition refund status (APPROVE, REJECT, CANCEL, EXECUTE)
 */
router.put('/:id/status', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const performedBy = req.user.id;
        const { id } = req.params;
        const { action, rejectionReason } = req.body;
        if (!action || !['APPROVE', 'REJECT', 'CANCEL', 'EXECUTE'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Must be APPROVE, REJECT, CANCEL, or EXECUTE' });
        }
        const refund = await refund_service_1.RefundService.transitionStatus(id, tenantId, action, performedBy, rejectionReason, req.ip, req.get('User-Agent'));
        res.json({ success: true, refund });
    }
    catch (error) {
        logger_1.default.error('Failed to transition refund status', { error: error.message });
        res.status(400).json({ error: error.message || 'Status transition failed' });
    }
});
/**
 * GET /api/v1/admin/refunds/subscriber/:subscriberId
 * Get refund history for a specific subscriber
 */
router.get('/subscriber/:subscriberId', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { subscriberId } = req.params;
        const refunds = await models_1.RefundRequest.findAll({
            where: { tenantId, subscriberId },
            include: [{ model: models_1.Payment, attributes: ['mpesaReceiptNumber', 'amount'] }],
            order: [['createdAt', 'DESC']],
        });
        res.json({ refunds });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch subscriber refund history', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch subscriber refund history' });
    }
});
/**
 * GET /api/v1/admin/refunds/rules
 * List compensation rules
 */
router.get('/rules', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const rules = await models_1.CompensationRule.findAll({ where: { tenantId } });
        res.json({ rules });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch compensation rules', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch compensation rules' });
    }
});
/**
 * POST /api/v1/admin/refunds/rules
 * Create or update compensation rule
 */
router.post('/rules', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { id, name, triggerType, downtimeThresholdMinutes, compensationType, compensationValue, autoApprove, isEnabled } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Rule name is required' });
        if (id) {
            const existing = await models_1.CompensationRule.findOne({ where: { id, tenantId } });
            if (existing) {
                await existing.update({
                    name, triggerType, downtimeThresholdMinutes,
                    compensationType, compensationValue, autoApprove, isEnabled
                });
                return res.json({ success: true, rule: existing });
            }
        }
        const rule = await models_1.CompensationRule.create({
            tenantId,
            name,
            triggerType: triggerType || 'ROUTER_DOWNTIME',
            downtimeThresholdMinutes: downtimeThresholdMinutes || 60,
            compensationType: compensationType || 'PACKAGE_EXTENSION',
            compensationValue: compensationValue || 60,
            autoApprove: autoApprove !== undefined ? autoApprove : true,
            isEnabled: isEnabled !== undefined ? isEnabled : true,
        });
        res.status(201).json({ success: true, rule });
    }
    catch (error) {
        logger_1.default.error('Failed to save compensation rule', { error: error.message });
        res.status(500).json({ error: 'Failed to save compensation rule' });
    }
});
/**
 * POST /api/v1/admin/refunds/evaluate-outages
 * Trigger automated outage evaluation and compensation
 */
router.post('/evaluate-outages', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const performedBy = req.user.id;
        const result = await refund_service_1.RefundService.evaluateAutomatedOutageCompensation(tenantId, performedBy);
        res.json({ success: true, ...result });
    }
    catch (error) {
        logger_1.default.error('Failed to evaluate outage compensation', { error: error.message });
        res.status(500).json({ error: 'Failed to evaluate outage compensation' });
    }
});
/**
 * GET /api/v1/admin/refunds/reports
 * Generate CSV report of refunds & compensations
 */
router.get('/reports', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { startDate, endDate, format } = req.query;
        const where = { tenantId };
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date();
            end.setHours(23, 59, 59, 999);
            where.createdAt = { [sequelize_1.Op.between]: [start, end] };
        }
        const refunds = await models_1.RefundRequest.findAll({
            where,
            include: [{ model: models_1.Subscriber, attributes: ['name', 'phoneNumber'] }],
            order: [['createdAt', 'DESC']],
        });
        if (format === 'csv') {
            const lines = [
                'ID,Date,Subscriber,Phone,Type,Category,Amount (KES),Status,Reason,Completed Date',
                ...refunds.map(r => {
                    const sub = r.subscriber;
                    return [
                        r.id,
                        new Date(r.createdAt).toISOString().slice(0, 10),
                        sub?.name || 'Anonymous',
                        sub?.phoneNumber || '',
                        r.type,
                        r.category,
                        (Number(r.amount) / 100).toFixed(2),
                        r.status,
                        `"${(r.reason || '').replace(/"/g, '""')}"`,
                        r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : '',
                    ].join(',');
                })
            ];
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=refunds-compensation-report.csv');
            return res.send(lines.join('\n'));
        }
        res.json({ refunds });
    }
    catch (error) {
        logger_1.default.error('Failed to generate refund report', { error: error.message });
        res.status(500).json({ error: 'Failed to generate refund report' });
    }
});
exports.default = router;
