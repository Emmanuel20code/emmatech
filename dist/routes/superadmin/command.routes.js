"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const superadmin_service_1 = require("../../services/superadmin.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const router = (0, express_1.Router)();
// Executive Overview & Health
router.get('/overview', async (_req, res) => {
    try {
        const overview = await superadmin_service_1.SuperAdminService.getExecutiveOverview();
        res.json(overview);
    }
    catch (error) {
        logger_1.default.error('Error fetching executive overview', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// Advanced BI & Forecast Analytics
router.get('/bi-analytics', async (_req, res) => {
    try {
        const analytics = await superadmin_service_1.SuperAdminService.getBIAnalytics();
        res.json(analytics);
    }
    catch (error) {
        logger_1.default.error('Error fetching BI analytics', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// NOC Telemetry & Resource Monitoring
router.get('/noc', async (_req, res) => {
    try {
        const telemetry = await superadmin_service_1.SuperAdminService.getNOCTelemetry();
        res.json(telemetry);
    }
    catch (error) {
        logger_1.default.error('Error fetching NOC telemetry', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// SOC Security & Threats Audit
router.get('/soc', async (_req, res) => {
    try {
        const security = await superadmin_service_1.SuperAdminService.getSOCSecurity();
        res.json(security);
    }
    catch (error) {
        logger_1.default.error('Error fetching SOC security data', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// AI Insights Engine
router.get('/ai-insights', async (_req, res) => {
    try {
        const insights = await superadmin_service_1.SuperAdminService.getAIInsights();
        res.json(insights);
    }
    catch (error) {
        logger_1.default.error('Error fetching AI insights', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// Tenant Directory & 360 Overview
router.get('/tenants', async (_req, res) => {
    try {
        const tenants = await superadmin_service_1.SuperAdminService.getTenantsDirectory();
        res.json(tenants);
    }
    catch (error) {
        logger_1.default.error('Error fetching tenants directory', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// Tenant Actions (Approve, Suspend, Impersonate, Credit, Reset Password)
router.post('/tenants/:id/action', async (req, res) => {
    try {
        const { action, payload } = req.body;
        const result = await superadmin_service_1.SuperAdminService.executeTenantAction(req.params.id, action, payload || {}, req.user?.id || 'SUPER_ADMIN');
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Error executing tenant action', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
