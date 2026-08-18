import { Router, Request, Response } from 'express';
import { authMiddleware, authorize } from '../middleware/auth';
import { PlatformOwnerService } from '../services/platform-owner.service';
import { DormantRouterService } from '../services/dormant-router.service';
import { MpesaService } from '../services/mpesa.service';
import logger from '../utils/logger';

const router = Router();

// Protect all routes under platform owner suite
router.use(authMiddleware);
router.use(authorize(['PLATFORM_OWNER', 'SUPER_ADMIN']));

/**
 * GET /api/v1/platform-owner/overview
 * Real platform-wide overview statistics
 */
router.get('/overview', async (_req: Request, res: Response) => {
    try {
        const stats = await PlatformOwnerService.getPlatformOverview();
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/platform-owner/tenants
 * List all tenants with subscriber counts, router counts, revenue, and status
 */
router.get('/tenants', async (_req: Request, res: Response) => {
    try {
        const tenants = await PlatformOwnerService.getTenantDirectory();
        res.json(tenants);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/v1/platform-owner/tenants/:id/status
 * Suspend or Activate a tenant
 */
router.put('/tenants/:id/status', async (req: any, res: Response) => {
    try {
        const { status } = req.body;
        if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
            return res.status(400).json({ error: 'Status must be ACTIVE or SUSPENDED' });
        }
        const updated = await PlatformOwnerService.updateTenantStatus(req.params.id, status, req.user?.id);
        res.json({ message: `Tenant status updated to ${status}`, tenant: updated });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/v1/platform-owner/routers
 * List all connected MikroTik routers across all tenants
 */
router.get('/routers', async (_req: Request, res: Response) => {
    try {
        const routers = await PlatformOwnerService.getGlobalRouters();
        res.json(routers);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/platform-owner/routers/:id/action
 * Perform one-click administrative action on any router (PING, RECONNECT, SUSPEND, BACKUP, DISCONNECT_SESSIONS)
 */
router.post('/routers/:id/action', async (req: any, res: Response) => {
    try {
        const { action } = req.body;
        if (!['PING', 'SUSPEND', 'DISABLE', 'RECONNECT', 'BACKUP', 'DISCONNECT_SESSIONS'].includes(action)) {
            return res.status(400).json({ error: 'Invalid router action' });
        }
        const result = await PlatformOwnerService.executeRouterAction(req.params.id, action, req.user?.id);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/v1/platform-owner/routers/dormant-policy
 * Get dormant router detection policy
 */
router.get('/routers/dormant-policy', async (_req: Request, res: Response) => {
    try {
        const policy = await DormantRouterService.getPolicy();
        res.json(policy);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/v1/platform-owner/routers/dormant-policy
 * Update dormant router detection policy
 */
router.put('/routers/dormant-policy', async (req: any, res: Response) => {
    try {
        const updated = await DormantRouterService.updatePolicy(req.body, req.user?.id);
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/v1/platform-owner/routers/run-dormant-check
 * Trigger real-time dormant router scan and execute automated policies
 */
router.post('/routers/run-dormant-check', async (_req: Request, res: Response) => {
    try {
        const result = await DormantRouterService.scanAndEnforceDormantRouters();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/platform-owner/analytics
 * Real platform-wide financial & operational time-series analytics
 */
router.get('/analytics', async (_req: Request, res: Response) => {
    try {
        const analytics = await PlatformOwnerService.getPlatformAnalytics();
        res.json(analytics);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/platform-owner/security-events
 * Platform-wide security audit trail and breach logs
 */
router.get('/security-events', async (req: Request, res: Response) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const events = await PlatformOwnerService.getSecurityEvents(limit);
        res.json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/platform-owner/reports
 * Consolidated reports across all SaaS modules
 */
router.get('/reports', async (_req: Request, res: Response) => {
    try {
        const reports = await PlatformOwnerService.getConsolidatedReports();
        res.json(reports);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/platform-owner/impersonate/:tenantId
 * Impersonate tenant for troubleshooting
 */
router.post('/impersonate/:tenantId', async (req: any, res: Response) => {
    try {
        const result = await PlatformOwnerService.impersonateTenant(req.params.tenantId, req.user?.id);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/v1/platform-owner/quick-actions
 * One-click administrative operations (Mass backup, cache flush, session purge)
 */
router.post('/quick-actions', async (req: any, res: Response) => {
    try {
        const { actionType, payload } = req.body;
        if (!actionType) return res.status(400).json({ error: 'Action type required' });

        const result = await PlatformOwnerService.executeQuickAction(actionType, payload, req.user?.id);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/v1/platform-owner/master-daraja
 * Get Master Daraja status
 */
router.get('/master-daraja', async (_req: Request, res: Response) => {
    try {
        const status = await MpesaService.getMasterStatus();
        res.json({ success: true, ...status });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/v1/platform-owner/master-daraja
 * Save Master Daraja credentials
 */
router.put('/master-daraja', async (req: Request, res: Response) => {
    try {
        const status = await MpesaService.saveMasterCredentials(req.body);
        res.json({ success: true, message: 'Master Daraja credentials updated', status });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/platform-owner/master-daraja/test
 * Test Master Daraja live connection
 */
router.post('/master-daraja/test', async (_req: Request, res: Response) => {
    try {
        const result = await MpesaService.testMasterConnection();
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
});

export default router;
