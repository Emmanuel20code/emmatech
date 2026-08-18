import { Router } from 'express';
import { RouterPowerService } from '../services/router-power.service';
import { authMiddleware } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/routers/management
 * Fetch tenant router management overview, metrics, power, and maintenance states
 */
router.get('/management', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace required' });
        }
        const data = await RouterPowerService.getTenantRouterOverview(tenantId);
        res.json(data);
    } catch (error: any) {
        logger.error('Failed to fetch router management overview', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to fetch router management overview' });
    }
});

/**
 * POST /api/v1/routers/:id/maintenance
 * Enable or Disable Maintenance / Blackout Mode
 */
router.post('/:id/maintenance', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        const routerId = req.params.id;
        if (!tenantId) return res.status(403).json({ error: 'Tenant workspace required' });

        const result = await RouterPowerService.setRouterMaintenanceMode(routerId, tenantId, {
            ...req.body,
            createdBy: req.user.email || req.user.displayName
        });

        res.json(result);
    } catch (error: any) {
        logger.error('Failed to update router maintenance state', { error: error.message });
        res.status(400).json({ error: error.message || 'Failed to update maintenance state' });
    }
});

/**
 * POST /api/v1/routers/:id/compensate
 * Trigger subscriber downtime compensation & session extensions
 */
router.post('/:id/compensate', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        const routerId = req.params.id;
        const { incidentId, extraMinutes } = req.body;

        if (!tenantId) return res.status(403).json({ error: 'Tenant workspace required' });

        const result = await RouterPowerService.compensateSubscribers(
            routerId,
            tenantId,
            incidentId,
            Number(extraMinutes || 60)
        );

        res.json({ success: true, result });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to compensate subscribers' });
    }
});

/**
 * POST /api/v1/routers/:id/control
 * Execute remote MikroTik commands (Disable/Enable Hotspot/PPPoE, Reboot, Backup, Diagnostics)
 */
router.post('/:id/control', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        const routerId = req.params.id;
        const { command, params } = req.body;

        if (!tenantId) return res.status(403).json({ error: 'Tenant workspace required' });

        const result = await RouterPowerService.executeRemoteControl(routerId, tenantId, command, params);
        res.json(result);
    } catch (error: any) {
        logger.error('Failed to execute remote router control', { error: error.message });
        res.status(400).json({ error: error.message || 'Remote control execution failed' });
    }
});

/**
 * POST /api/v1/routers/:id/power
 * Execute Smart PDU / UPS Hardware Power Control (Power On, Power Off, Reboot)
 */
router.post('/:id/power', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        const routerId = req.params.id;
        const { action } = req.body;

        if (!tenantId) return res.status(403).json({ error: 'Tenant workspace required' });
        if (!['POWER_ON', 'POWER_OFF', 'REBOOT'].includes(action)) {
            return res.status(400).json({ error: 'Invalid power action. Must be POWER_ON, POWER_OFF, or REBOOT' });
        }

        const result = await RouterPowerService.executePowerControl(routerId, tenantId, action);
        res.json(result);
    } catch (error: any) {
        logger.error('Failed to execute smart power control', { error: error.message });
        res.status(400).json({ error: error.message || 'Smart power control failed' });
    }
});

/**
 * GET /api/v1/routers/superadmin/outages
 * Super Admin cross-tenant outage dashboard
 */
router.get('/superadmin/outages', authMiddleware, async (req: any, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'PLATFORM_OWNER') {
            return res.status(403).json({ error: 'Super Admin privileges required' });
        }
        const data = await RouterPowerService.getSuperAdminOutageOverview();
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch Super Admin outage overview' });
    }
});

export default router;
