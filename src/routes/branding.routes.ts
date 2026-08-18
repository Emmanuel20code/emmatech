import { Router } from 'express';
import { BrandingService } from '../services/branding.service';
import { authMiddleware } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/branding/public
 * Public endpoint for frontend, landing page, login page, captive portal & footers
 */
router.get('/public', async (_req, res) => {
    try {
        const branding = await BrandingService.getPlatformBranding();
        res.json({ branding });
    } catch (error: any) {
        logger.error('Failed to fetch public branding', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch public branding' });
    }
});

/**
 * GET /api/v1/superadmin/branding
 * Super Admin branding settings
 */
router.get('/superadmin', authMiddleware, async (req: any, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Super Admin access required' });
        }
        const branding = await BrandingService.getPlatformBranding();
        res.json({ branding });
    } catch (error: any) {
        logger.error('Failed to fetch admin branding', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch admin branding' });
    }
});

/**
 * PUT /api/v1/superadmin/branding
 * Super Admin update branding identity, logos & colors
 */
router.put('/superadmin', authMiddleware, async (req: any, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Super Admin access required' });
        }
        const updated = await BrandingService.updatePlatformBranding(req.body);
        res.json({ success: true, branding: updated });
    } catch (error: any) {
        logger.error('Failed to update platform branding', { error: error.message });
        res.status(400).json({ error: error.message || 'Failed to update platform branding' });
    }
});

/**
 * GET /api/v1/branding/tenant/my-tenant
 * Authenticated endpoint for Tenant Dashboard to load its own branding
 */
router.get('/tenant/my-tenant', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace required' });
        }
        const branding = await BrandingService.getTenantCaptivePortalBranding(tenantId);
        res.json(branding);
    } catch (error: any) {
        logger.error('Failed to fetch authenticated tenant branding', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch tenant branding' });
    }
});

/**
 * GET /api/v1/branding/tenant/:identifier
 * Public endpoint for Captive Portal to fetch tenant-isolated branding
 * identifier can be tenantId, subdomain, or customDomain (e.g. wifi.company.com)
 */
router.get('/tenant/:identifier', async (req, res) => {
    try {
        const branding = await BrandingService.getTenantCaptivePortalBranding(req.params.identifier);
        res.json(branding);
    } catch (error: any) {
        logger.error('Failed to fetch tenant captive portal branding', { identifier: req.params.identifier, error: error.message });
        res.status(500).json({ error: error.message || 'Failed to fetch tenant branding' });
    }
});

/**
 * PUT /api/v1/branding/tenant
 * Tenant update their Captive Portal branding settings
 */
router.put('/tenant', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace required' });
        }
        const updated = await BrandingService.updateTenantCaptivePortalBranding(tenantId, req.body);
        res.json({ success: true, branding: updated });
    } catch (error: any) {
        logger.error('Failed to update tenant captive portal branding', { error: error.message });
        res.status(400).json({ error: error.message || 'Failed to update branding' });
    }
});

/**
 * POST /api/v1/branding/tenant/reset
 * Reset tenant captive portal branding to system defaults
 */
router.post('/tenant/reset', authMiddleware, async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace required' });
        }
        const reset = await BrandingService.resetTenantCaptivePortalBranding(tenantId);
        res.json({ success: true, branding: reset });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to reset tenant branding' });
    }
});

export default router;
