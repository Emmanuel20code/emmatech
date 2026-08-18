import { Router } from 'express';
import { SuperAdminService } from '../../services/superadmin.service';
import logger from '../../utils/logger';

const router = Router();

// Executive Overview & Health
router.get('/overview', async (_req, res) => {
    try {
        const overview = await SuperAdminService.getExecutiveOverview();
        res.json(overview);
    } catch (error: any) {
        logger.error('Error fetching executive overview', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Advanced BI & Forecast Analytics
router.get('/bi-analytics', async (_req, res) => {
    try {
        const analytics = await SuperAdminService.getBIAnalytics();
        res.json(analytics);
    } catch (error: any) {
        logger.error('Error fetching BI analytics', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// NOC Telemetry & Resource Monitoring
router.get('/noc', async (_req, res) => {
    try {
        const telemetry = await SuperAdminService.getNOCTelemetry();
        res.json(telemetry);
    } catch (error: any) {
        logger.error('Error fetching NOC telemetry', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// SOC Security & Threats Audit
router.get('/soc', async (_req, res) => {
    try {
        const security = await SuperAdminService.getSOCSecurity();
        res.json(security);
    } catch (error: any) {
        logger.error('Error fetching SOC security data', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// AI Insights Engine
router.get('/ai-insights', async (_req, res) => {
    try {
        const insights = await SuperAdminService.getAIInsights();
        res.json(insights);
    } catch (error: any) {
        logger.error('Error fetching AI insights', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Tenant Directory & 360 Overview
router.get('/tenants', async (_req, res) => {
    try {
        const tenants = await SuperAdminService.getTenantsDirectory();
        res.json(tenants);
    } catch (error: any) {
        logger.error('Error fetching tenants directory', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Tenant Actions (Approve, Suspend, Impersonate, Credit, Reset Password)
router.post('/tenants/:id/action', async (req: any, res) => {
    try {
        const { action, payload } = req.body;
        const result = await SuperAdminService.executeTenantAction(
            req.params.id,
            action,
            payload || {},
            req.user?.id || 'SUPER_ADMIN'
        );
        res.json(result);
    } catch (error: any) {
        logger.error('Error executing tenant action', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

export default router;
