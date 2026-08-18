"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branding_service_1 = require("../services/branding.service");
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * GET /api/v1/branding/public
 * Public endpoint for frontend, landing page, login page, captive portal & footers
 */
router.get('/public', async (_req, res) => {
    try {
        const branding = await branding_service_1.BrandingService.getPlatformBranding();
        res.json({ branding });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch public branding', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch public branding' });
    }
});
/**
 * GET /api/v1/superadmin/branding
 * Super Admin branding settings
 */
router.get('/superadmin', auth_1.authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Super Admin access required' });
        }
        const branding = await branding_service_1.BrandingService.getPlatformBranding();
        res.json({ branding });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch admin branding', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch admin branding' });
    }
});
/**
 * PUT /api/v1/superadmin/branding
 * Super Admin update branding identity, logos & colors
 */
router.put('/superadmin', auth_1.authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Super Admin access required' });
        }
        const updated = await branding_service_1.BrandingService.updatePlatformBranding(req.body);
        res.json({ success: true, branding: updated });
    }
    catch (error) {
        logger_1.default.error('Failed to update platform branding', { error: error.message });
        res.status(400).json({ error: error.message || 'Failed to update platform branding' });
    }
});
/**
 * GET /api/v1/branding/tenant/my-tenant
 * Authenticated endpoint for Tenant Dashboard to load its own branding
 */
router.get('/tenant/my-tenant', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace required' });
        }
        const branding = await branding_service_1.BrandingService.getTenantCaptivePortalBranding(tenantId);
        res.json(branding);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch authenticated tenant branding', { error: error.message });
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
        const branding = await branding_service_1.BrandingService.getTenantCaptivePortalBranding(req.params.identifier);
        res.json(branding);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch tenant captive portal branding', { identifier: req.params.identifier, error: error.message });
        res.status(500).json({ error: error.message || 'Failed to fetch tenant branding' });
    }
});
/**
 * PUT /api/v1/branding/tenant
 * Tenant update their Captive Portal branding settings
 */
router.put('/tenant', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace required' });
        }
        const updated = await branding_service_1.BrandingService.updateTenantCaptivePortalBranding(tenantId, req.body);
        res.json({ success: true, branding: updated });
    }
    catch (error) {
        logger_1.default.error('Failed to update tenant captive portal branding', { error: error.message });
        res.status(400).json({ error: error.message || 'Failed to update branding' });
    }
});
/**
 * POST /api/v1/branding/tenant/reset
 * Reset tenant captive portal branding to system defaults
 */
router.post('/tenant/reset', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace required' });
        }
        const reset = await branding_service_1.BrandingService.resetTenantCaptivePortalBranding(tenantId);
        res.json({ success: true, branding: reset });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to reset tenant branding' });
    }
});
exports.default = router;
