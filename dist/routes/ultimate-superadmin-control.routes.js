"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ultimate_superadmin_control_service_1 = require("../services/ultimate-superadmin-control.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Global Platform Search
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const results = await ultimate_superadmin_control_service_1.UltimateSuperAdminControlService.globalSearch(query);
        res.json(results);
    }
    catch (error) {
        logger_1.default.error('Error in global search', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// Tenant 360 Deep Inspection
router.get('/tenant-360/:id', async (req, res) => {
    try {
        const data = await ultimate_superadmin_control_service_1.UltimateSuperAdminControlService.getTenant360Inspection(req.params.id);
        res.json(data);
    }
    catch (error) {
        logger_1.default.error('Error in tenant 360 inspection', { error: error.message });
        res.status(404).json({ error: error.message });
    }
});
// Live Real-Time Activity Feed
router.get('/activity-stream', async (_req, res) => {
    try {
        const stream = await ultimate_superadmin_control_service_1.UltimateSuperAdminControlService.getLiveActivityStream();
        res.json(stream);
    }
    catch (error) {
        logger_1.default.error('Error fetching activity stream', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// One-Click Actions (Diagnostics, Clear Cache, Retry Webhooks, Restart Router, Approve Refund)
router.post('/action', async (req, res) => {
    try {
        const { actionType, targetId, payload } = req.body;
        const result = await ultimate_superadmin_control_service_1.UltimateSuperAdminControlService.executeOneClickAction(actionType, targetId, payload || {}, req.user?.id || 'SUPER_ADMIN');
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Error executing one-click action', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});
// Unified Report Exporter
router.get('/reports/export', async (req, res) => {
    try {
        const reportType = req.query.type || 'revenue';
        const data = await ultimate_superadmin_control_service_1.UltimateSuperAdminControlService.getUnifiedReportData(reportType);
        if (req.query.format === 'csv') {
            if (data.length === 0)
                return res.send('No data available');
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => Object.values(row).join(','));
            const csv = [headers, ...rows].join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report.csv`);
            return res.send(csv);
        }
        res.json(data);
    }
    catch (error) {
        logger_1.default.error('Error exporting report', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
