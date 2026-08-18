"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const platform_owner_service_1 = require("../services/platform-owner.service");
const dormant_router_service_1 = require("../services/dormant-router.service");
const mpesa_service_1 = require("../services/mpesa.service");
const router = (0, express_1.Router)();
// Protect all routes under platform owner suite
router.use(auth_1.authMiddleware);
router.use((0, auth_1.authorize)(['PLATFORM_OWNER', 'SUPER_ADMIN']));
/**
 * GET /api/v1/platform-owner/overview
 * Real platform-wide overview statistics
 */
router.get('/overview', async (_req, res) => {
    try {
        const stats = await platform_owner_service_1.PlatformOwnerService.getPlatformOverview();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/v1/platform-owner/tenants
 * List all tenants with subscriber counts, router counts, revenue, and status
 */
router.get('/tenants', async (_req, res) => {
    try {
        const tenants = await platform_owner_service_1.PlatformOwnerService.getTenantDirectory();
        res.json(tenants);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * PUT /api/v1/platform-owner/tenants/:id/status
 * Suspend or Activate a tenant
 */
router.put('/tenants/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
            return res.status(400).json({ error: 'Status must be ACTIVE or SUSPENDED' });
        }
        const updated = await platform_owner_service_1.PlatformOwnerService.updateTenantStatus(req.params.id, status, req.user?.id);
        res.json({ message: `Tenant status updated to ${status}`, tenant: updated });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * GET /api/v1/platform-owner/routers
 * List all connected MikroTik routers across all tenants
 */
router.get('/routers', async (_req, res) => {
    try {
        const routers = await platform_owner_service_1.PlatformOwnerService.getGlobalRouters();
        res.json(routers);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/v1/platform-owner/routers/:id/action
 * Perform one-click administrative action on any router (PING, RECONNECT, SUSPEND, BACKUP, DISCONNECT_SESSIONS)
 */
router.post('/routers/:id/action', async (req, res) => {
    try {
        const { action } = req.body;
        if (!['PING', 'SUSPEND', 'DISABLE', 'RECONNECT', 'BACKUP', 'DISCONNECT_SESSIONS'].includes(action)) {
            return res.status(400).json({ error: 'Invalid router action' });
        }
        const result = await platform_owner_service_1.PlatformOwnerService.executeRouterAction(req.params.id, action, req.user?.id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * GET /api/v1/platform-owner/routers/dormant-policy
 * Get dormant router detection policy
 */
router.get('/routers/dormant-policy', async (_req, res) => {
    try {
        const policy = await dormant_router_service_1.DormantRouterService.getPolicy();
        res.json(policy);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * PUT /api/v1/platform-owner/routers/dormant-policy
 * Update dormant router detection policy
 */
router.put('/routers/dormant-policy', async (req, res) => {
    try {
        const updated = await dormant_router_service_1.DormantRouterService.updatePolicy(req.body, req.user?.id);
        res.json(updated);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * POST /api/v1/platform-owner/routers/run-dormant-check
 * Trigger real-time dormant router scan and execute automated policies
 */
router.post('/routers/run-dormant-check', async (_req, res) => {
    try {
        const result = await dormant_router_service_1.DormantRouterService.scanAndEnforceDormantRouters();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/v1/platform-owner/analytics
 * Real platform-wide financial & operational time-series analytics
 */
router.get('/analytics', async (_req, res) => {
    try {
        const analytics = await platform_owner_service_1.PlatformOwnerService.getPlatformAnalytics();
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/v1/platform-owner/security-events
 * Platform-wide security audit trail and breach logs
 */
router.get('/security-events', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const events = await platform_owner_service_1.PlatformOwnerService.getSecurityEvents(limit);
        res.json(events);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/v1/platform-owner/reports
 * Consolidated reports across all SaaS modules
 */
router.get('/reports', async (_req, res) => {
    try {
        const reports = await platform_owner_service_1.PlatformOwnerService.getConsolidatedReports();
        res.json(reports);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/v1/platform-owner/impersonate/:tenantId
 * Impersonate tenant for troubleshooting
 */
router.post('/impersonate/:tenantId', async (req, res) => {
    try {
        const result = await platform_owner_service_1.PlatformOwnerService.impersonateTenant(req.params.tenantId, req.user?.id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * POST /api/v1/platform-owner/quick-actions
 * One-click administrative operations (Mass backup, cache flush, session purge)
 */
router.post('/quick-actions', async (req, res) => {
    try {
        const { actionType, payload } = req.body;
        if (!actionType)
            return res.status(400).json({ error: 'Action type required' });
        const result = await platform_owner_service_1.PlatformOwnerService.executeQuickAction(actionType, payload, req.user?.id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * GET /api/v1/platform-owner/master-daraja
 * Get Master Daraja status
 */
router.get('/master-daraja', async (_req, res) => {
    try {
        const status = await mpesa_service_1.MpesaService.getMasterStatus();
        res.json({ success: true, ...status });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * PUT /api/v1/platform-owner/master-daraja
 * Save Master Daraja credentials
 */
router.put('/master-daraja', async (req, res) => {
    try {
        const status = await mpesa_service_1.MpesaService.saveMasterCredentials(req.body);
        res.json({ success: true, message: 'Master Daraja credentials updated', status });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/v1/platform-owner/master-daraja/test
 * Test Master Daraja live connection
 */
router.post('/master-daraja/test', async (_req, res) => {
    try {
        const result = await mpesa_service_1.MpesaService.testMasterConnection();
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});
exports.default = router;
