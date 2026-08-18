"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/** Format amount in cents to readable KES string */
const formatAmount = (cents) => (cents / 100).toFixed(2);
/** Date range filter helper */
function buildDateFilter(startDate, endDate) {
    const filter = {};
    if (startDate)
        filter[sequelize_1.Op.gte] = new Date(startDate);
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter[sequelize_1.Op.lte] = end;
    }
    return Object.keys(filter).length > 0 ? { createdAt: filter } : {};
}
// ─── REVENUE REPORT ──────────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/reports/revenue
 * Revenue report with optional date range and CSV export
 */
router.get('/revenue', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { startDate, endDate, format } = req.query;
        const dateFilter = buildDateFilter(startDate, endDate);
        const payments = await models_1.Payment.findAll({
            where: { tenantId, status: 'SUCCESS', ...dateFilter },
            include: [{ model: models_1.Package, attributes: ['name'] }],
            order: [['createdAt', 'DESC']],
        });
        if (format === 'csv') {
            const lines = [
                'Date,Reference,Package,Amount (KES),Phone,Channel',
                ...payments.map(p => {
                    const pkg = p.package?.name || 'Unknown';
                    return [
                        new Date(p.createdAt).toISOString().slice(0, 10),
                        p.mpesaReceiptNumber || p.id,
                        pkg,
                        formatAmount(Number(p.amount)),
                        p.phoneNumber,
                        p.paymentChannel || 'MPESA'
                    ].join(',');
                })
            ];
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=revenue-report.csv');
            return res.send(lines.join('\n'));
        }
        // Summary stats
        const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
        const avgTransaction = payments.length > 0 ? totalRevenue / payments.length : 0;
        res.json({
            summary: {
                total: totalRevenue,
                count: payments.length,
                average: Math.round(avgTransaction),
            },
            payments: payments.map(p => ({
                id: p.id,
                date: p.createdAt,
                reference: p.mpesaReceiptNumber || p.id,
                package: p.package?.name || 'Unknown',
                amount: Number(p.amount),
                phone: p.phoneNumber,
                channel: p.paymentChannel || 'MPESA',
            })),
        });
    }
    catch (error) {
        logger_1.default.error('Revenue report failed', { error });
        res.status(500).json({ error: 'Failed to generate revenue report' });
    }
});
// ─── SUBSCRIBER REPORT ───────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/reports/subscribers
 * Subscriber report with status breakdown
 */
router.get('/subscribers', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { startDate, endDate, format } = req.query;
        const dateFilter = buildDateFilter(startDate, endDate);
        const subscribers = await models_1.Subscriber.findAll({
            where: { tenantId, ...dateFilter },
            include: [{ model: models_1.Package, attributes: ['name', 'price'] }],
            order: [['createdAt', 'DESC']],
        });
        if (format === 'csv') {
            const lines = [
                'Name,Phone,Package,Status,Expiry,Created',
                ...subscribers.map(s => {
                    const pkg = s.package?.name || 'No Package';
                    return [
                        s.name || 'Anonymous',
                        s.phoneNumber || '',
                        pkg,
                        s.status,
                        s.expiryDate ? new Date(s.expiryDate).toISOString().slice(0, 10) : '',
                        new Date(s.createdAt).toISOString().slice(0, 10),
                    ].join(',');
                })
            ];
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=subscriber-report.csv');
            return res.send(lines.join('\n'));
        }
        const active = subscribers.filter(s => s.status === 'ACTIVE').length;
        const expired = subscribers.filter(s => s.status !== 'ACTIVE').length;
        res.json({
            summary: { total: subscribers.length, active, expired },
            subscribers: subscribers.map(s => ({
                id: s.id,
                name: s.name,
                phone: s.phoneNumber,
                package: s.package?.name || 'No Package',
                status: s.status,
                expiryDate: s.expiryDate,
                createdAt: s.createdAt,
            })),
        });
    }
    catch (error) {
        logger_1.default.error('Subscriber report failed', { error });
        res.status(500).json({ error: 'Failed to generate subscriber report' });
    }
});
// ─── ROUTER REPORT ───────────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/reports/routers
 * Router status and performance report
 */
router.get('/routers', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { format } = req.query;
        const routers = await models_1.Router.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']],
        });
        if (format === 'csv') {
            const lines = [
                'Name,Host,Status,Online,Version,Last Seen,Validation',
                ...routers.map(r => [
                    r.name,
                    r.host,
                    r.isOnline ? 'Online' : 'Offline',
                    r.isOnline ? 'Yes' : 'No',
                    r.version || '',
                    r.lastSeen ? new Date(r.lastSeen).toISOString().slice(0, 16) : 'Never',
                    r.validationStatus,
                ].join(','))
            ];
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=router-report.csv');
            return res.send(lines.join('\n'));
        }
        const online = routers.filter(r => r.isOnline).length;
        res.json({
            summary: { total: routers.length, online, offline: routers.length - online },
            routers: routers.map(r => ({
                id: r.id,
                name: r.name,
                host: r.host,
                isOnline: r.isOnline,
                version: r.version,
                identity: r.identity,
                lastSeen: r.lastSeen,
                validationStatus: r.validationStatus,
                createdAt: r.createdAt,
            })),
        });
    }
    catch (error) {
        logger_1.default.error('Router report failed', { error });
        res.status(500).json({ error: 'Failed to generate router report' });
    }
});
// ─── BANDWIDTH REPORT ────────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/reports/bandwidth
 * Bandwidth usage report from active sessions
 */
router.get('/bandwidth', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { startDate, endDate, format } = req.query;
        const dateFilter = buildDateFilter(startDate, endDate);
        const sessions = await models_1.Session.findAll({
            where: { tenantId, ...dateFilter },
            order: [['startTime', 'DESC']],
        });
        const totalIn = sessions.reduce((s, sess) => s + Number(sess.bytesIn || 0), 0);
        const totalOut = sessions.reduce((s, sess) => s + Number(sess.bytesOut || 0), 0);
        if (format === 'csv') {
            const lines = [
                'MAC Address,IP Address,Start Time,Status,Bytes In,Bytes Out',
                ...sessions.map(s => [
                    s.macAddress,
                    s.ipAddress || '',
                    new Date(s.startTime).toISOString().slice(0, 16),
                    s.status,
                    s.bytesIn || 0,
                    s.bytesOut || 0,
                ].join(','))
            ];
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=bandwidth-report.csv');
            return res.send(lines.join('\n'));
        }
        res.json({
            summary: {
                totalSessions: sessions.length,
                activeSessions: sessions.filter(s => s.status === 'ACTIVE').length,
                totalIn,
                totalOut,
                totalBytes: totalIn + totalOut,
            },
            sessions: sessions.map(s => ({
                id: s.id,
                macAddress: s.macAddress,
                ipAddress: s.ipAddress,
                startTime: s.startTime,
                status: s.status,
                bytesIn: Number(s.bytesIn || 0),
                bytesOut: Number(s.bytesOut || 0),
            })),
        });
    }
    catch (error) {
        logger_1.default.error('Bandwidth report failed', { error });
        res.status(500).json({ error: 'Failed to generate bandwidth report' });
    }
});
// ─── PAYMENTS REPORT ─────────────────────────────────────────────────────────
/**
 * GET /api/v1/admin/reports/payments
 * All payments (success, failed, pending) with status breakdown
 */
router.get('/payments', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { startDate, endDate, status, format } = req.query;
        const dateFilter = buildDateFilter(startDate, endDate);
        const where = { tenantId, ...dateFilter };
        if (status)
            where.status = status;
        const payments = await models_1.Payment.findAll({
            where,
            include: [{ model: models_1.Package, attributes: ['name'] }],
            order: [['createdAt', 'DESC']],
        });
        if (format === 'csv') {
            const lines = [
                'Date,Reference,Package,Amount (KES),Phone,Status,Channel,Failure Reason',
                ...payments.map(p => {
                    const pkg = p.package?.name || 'Unknown';
                    return [
                        new Date(p.createdAt).toISOString().slice(0, 10),
                        p.mpesaReceiptNumber || p.id,
                        pkg,
                        formatAmount(Number(p.amount)),
                        p.phoneNumber,
                        p.status,
                        p.paymentChannel || 'MPESA',
                        p.failureReason || '',
                    ].join(',');
                })
            ];
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=payments-report.csv');
            return res.send(lines.join('\n'));
        }
        const success = payments.filter(p => p.status === 'SUCCESS').length;
        const failed = payments.filter(p => p.status === 'FAILED').length;
        const pending = payments.filter(p => p.status === 'PENDING').length;
        const totalRevenue = payments.filter(p => p.status === 'SUCCESS').reduce((s, p) => s + Number(p.amount), 0);
        res.json({
            summary: { total: payments.length, success, failed, pending, totalRevenue },
            payments: payments.map(p => ({
                id: p.id,
                date: p.createdAt,
                reference: p.mpesaReceiptNumber || p.id,
                package: p.package?.name || 'Unknown',
                amount: Number(p.amount),
                phone: p.phoneNumber,
                status: p.status,
                channel: p.paymentChannel || 'MPESA',
                failureReason: p.failureReason,
            })),
        });
    }
    catch (error) {
        logger_1.default.error('Payments report failed', { error });
        res.status(500).json({ error: 'Failed to generate payments report' });
    }
});
// ─── BRANDED INVOICE / RECEIPT GENERATOR ──────────────────────────────────────
/**
 * GET /api/v1/admin/reports/invoice/:paymentId
 * Generates branded HTML invoice/receipt document for print/PDF export
 */
router.get('/invoice/:paymentId', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { paymentId } = req.params;
        const payment = await models_1.Payment.findOne({
            where: { id: paymentId, tenantId },
            include: [{ model: models_1.Package }],
        });
        if (!payment) {
            return res.status(404).send('Invoice not found');
        }
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Invoice #${payment.mpesaReceiptNumber || payment.id}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f8fafc; color: #1e293b; }
                    .invoice-card { max-width: 700px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
                    .header { display: flex; justify-content: space-between; items-center; border-b: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; }
                    .brand { font-size: 24px; font-weight: 900; color: #0284c7; }
                    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
                    .val { font-size: 14px; font-weight: 700; margin-top: 2px; }
                    .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                    .table th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; color: #475569; }
                    .total { text-align: right; font-size: 18px; font-weight: 900; color: #0284c7; }
                    .footer { text-align: center; border-top: 1px solid #e2e8f0; pt: 20px; margin-top: 30px; font-size: 12px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="invoice-card">
                    <div class="header">
                        <div>
                            <div class="brand">Jevish Pro</div>
                            <div style="font-size: 12px; color: #64748b; font-weight: 600;">Official Payment Receipt</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 18px; font-weight: 800;">INVOICE</div>
                            <div style="font-size: 12px; color: #0284c7; font-weight: 700;">#${payment.mpesaReceiptNumber || payment.id.slice(0, 8)}</div>
                        </div>
                    </div>

                    <div class="details-grid">
                        <div>
                            <div class="label">Billed To</div>
                            <div class="val">${payment.phoneNumber}</div>
                            <div style="font-size: 12px; color: #64748b;">Account ID: ${payment.subscriberId || 'Hotspot Guest'}</div>
                        </div>
                        <div>
                            <div class="label">Payment Date</div>
                            <div class="val">${new Date(payment.createdAt).toLocaleString()}</div>
                            <div style="font-size: 12px; color: #16a34a; font-weight: 700;">STATUS: ${payment.status}</div>
                        </div>
                    </div>

                    <table class="table">
                        <thead>
                            <tr>
                                <th>Item Description</th>
                                <th>Channel</th>
                                <th style="text-align: right;">Amount (KES)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${payment.package?.name || 'WiFi Plan Subscription'}</td>
                                <td>${payment.paymentChannel || 'M-PESA'}</td>
                                <td style="text-align: right; font-weight: 700;">KES ${(Number(payment.amount) / 100).toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="total">
                        Total Paid: KES ${(Number(payment.amount) / 100).toFixed(2)}
                    </div>

                    <div class="footer">
                        Need assistance? Support Phone: <strong>0768926965</strong> | Support Email: <strong>emmanueloyaro3@gmail.com</strong>
                    </div>
                </div>
            </body>
            </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }
    catch (error) {
        logger_1.default.error('Failed to generate invoice', { error });
        res.status(500).send('Failed to generate invoice');
    }
});
exports.default = router;
