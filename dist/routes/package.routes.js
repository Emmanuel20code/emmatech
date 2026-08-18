"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const package_service_1 = require("../services/package.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * Utility to ensure a value from req.params or req.query is a string
 */
const ensureString = (value) => {
    if (Array.isArray(value)) {
        return String(value[0]);
    }
    return String(value);
};
/**
 * POST /api/v1/packages
 * Create a new package
 */
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const { name, description, price, validityHours, validityDays, dataLimitMB, uploadSpeed, downloadSpeed, sharedUsers, isActive } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        // Validate package configuration
        const validationErrors = package_service_1.PackageService.validatePackageConfiguration({
            name, price, validityHours, validityDays, dataLimitMB, uploadSpeed, downloadSpeed, sharedUsers
        });
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Package validation failed',
                errors: validationErrors
            });
        }
        const packageData = {
            name,
            description,
            price,
            durationMinutes: validityHours ? validityHours * 60 : null,
            dataLimitBytes: dataLimitMB ? dataLimitMB * 1024 * 1024 : null,
            speedLimit: uploadSpeed && downloadSpeed ? `${uploadSpeed}/${downloadSpeed}` : null,
            uploadSpeed,
            downloadSpeed,
            sharedUsers,
            isEnabled: isActive
        };
        const packageRecord = await package_service_1.PackageService.createPackage(tenantId, packageData, userId);
        logger_1.default.info('Package created via API', {
            packageId: packageRecord.id,
            name: packageRecord.name,
            tenantId,
            userId
        });
        res.status(201).json({
            success: true,
            message: 'Package created successfully',
            package: {
                id: packageRecord.id,
                name: packageRecord.name,
                description: packageRecord.description,
                price: packageRecord.price,
                validityHours: packageRecord.durationMinutes ? packageRecord.durationMinutes / 60 : null,
                validityDays: packageRecord.validity,
                dataLimitMB: packageRecord.dataLimitBytes ? packageRecord.dataLimitBytes / (1024 * 1024) : null,
                uploadSpeed: packageRecord.uploadSpeed,
                downloadSpeed: packageRecord.downloadSpeed,
                sharedUsers: packageRecord.sharedUsers,
                isActive: packageRecord.isEnabled
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error('Failed to create package', { error: errorMessage });
        res.status(500).json({
            success: false,
            message: 'Failed to create package',
            error: errorMessage
        });
    }
});
/**
 * GET /api/v1/packages
 * Get all packages for tenant
 */
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const packages = await package_service_1.PackageService.getTenantPackages(tenantId);
        res.json({
            success: true,
            packages: packages.map(pkg => ({
                id: pkg.id,
                name: pkg.name,
                description: pkg.description,
                price: pkg.price,
                validityHours: pkg.durationMinutes ? pkg.durationMinutes / 60 : null,
                validityDays: pkg.validity,
                dataLimitMB: pkg.dataLimitBytes ? pkg.dataLimitBytes / (1024 * 1024) : null,
                uploadSpeed: pkg.uploadSpeed,
                downloadSpeed: pkg.downloadSpeed,
                sharedUsers: pkg.sharedUsers,
                isActive: pkg.isEnabled
            }))
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get packages', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get packages',
            error: error.message
        });
    }
});
/**
 * GET /api/v1/packages/:id
 * Get package details with compatibility
 */
router.get('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = ensureString(req.params.id);
        const tenantId = req.user?.tenantId;
        if (!tenantId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const result = await package_service_1.PackageService.getPackageWithCompatibility(id, tenantId);
        res.json({
            success: true,
            package: {
                id: result.package.id,
                name: result.package.name,
                description: result.package.description,
                price: result.package.price,
                validityHours: result.package.durationMinutes ? result.package.durationMinutes / 60 : null,
                validityDays: result.package.validity,
                dataLimitMB: result.package.dataLimitBytes ? result.package.dataLimitBytes / (1024 * 1024) : null,
                uploadSpeed: result.package.uploadSpeed,
                downloadSpeed: result.package.downloadSpeed,
                sharedUsers: result.package.sharedUsers,
                isActive: result.package.isEnabled
            },
            compatibleRouters: result.compatibleRouters.map(r => ({
                id: r.id,
                name: r.name,
                host: r.host,
                version: r.version,
                identity: r.identity
            })),
            incompatibleRouters: result.incompatibleRouters.map(r => ({
                id: r.id,
                name: r.name,
                host: r.host,
                version: r.version,
                identity: r.identity
            }))
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get package details', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get package details',
            error: error.message
        });
    }
});
/**
 * PUT /api/v1/packages/:id
 * Update package
 */
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = ensureString(req.params.id);
        const { name, description, price, validityHours, validityDays, dataLimitMB, uploadSpeed, downloadSpeed, sharedUsers, isActive } = req.body;
        const tenantId = req.user?.tenantId;
        const userId = req.user?.id;
        if (!tenantId || !userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (price !== undefined)
            updateData.price = price;
        if (validityHours !== undefined)
            updateData.durationMinutes = validityHours * 60;
        if (validityDays !== undefined)
            updateData.validity = validityDays;
        if (dataLimitMB !== undefined)
            updateData.dataLimitBytes = dataLimitMB * 1024 * 1024;
        if (uploadSpeed !== undefined)
            updateData.uploadSpeed = uploadSpeed;
        if (downloadSpeed !== undefined)
            updateData.downloadSpeed = downloadSpeed;
        if (sharedUsers !== undefined)
            updateData.sharedUsers = sharedUsers;
        if (isActive !== undefined)
            updateData.isEnabled = isActive;
        const packageRecord = await package_service_1.PackageService.updatePackage(id, tenantId, updateData, userId);
        res.json({
            success: true,
            message: 'Package updated successfully',
            package: {
                id: packageRecord.id,
                name: packageRecord.name,
                description: packageRecord.description,
                price: packageRecord.price,
                validityHours: packageRecord.durationMinutes ? packageRecord.durationMinutes / 60 : null,
                validityDays: packageRecord.validity,
                dataLimitMB: packageRecord.dataLimitBytes ? packageRecord.dataLimitBytes / (1024 * 1024) : null,
                uploadSpeed: packageRecord.uploadSpeed,
                downloadSpeed: packageRecord.downloadSpeed,
                sharedUsers: packageRecord.sharedUsers,
                isActive: packageRecord.isEnabled
            }
        });
    }
    catch (error) {
        logger_1.default.error('Failed to update package', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to update package',
            error: error.message
        });
    }
});
/**
 * DELETE /api/v1/packages/:id
 * Delete package
 */
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = ensureString(req.params.id);
        const tenantId = req.user?.tenantId;
        const userId = req.user?.id;
        if (!tenantId || !userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        await package_service_1.PackageService.deletePackage(id, tenantId, userId);
        res.json({
            success: true,
            message: 'Package deleted successfully'
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error('Failed to delete package', { error: errorMessage });
        res.status(500).json({
            success: false,
            message: 'Failed to delete package',
            error: errorMessage
        });
    }
});
/**
 * GET /api/v1/packages/:id/stats
 * Get package statistics
 */
router.get('/:id/stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = ensureString(req.params.id);
        const tenantId = req.user.tenantId;
        const stats = await package_service_1.PackageService.getPackageStats(id, tenantId);
        res.json({
            success: true,
            package: {
                id: stats.package.id,
                name: stats.package.name,
                price: stats.package.price
            },
            statistics: {
                totalSales: stats.totalSales,
                activeSubscribers: stats.activeSubscribers,
                revenue: stats.revenue,
                recentSales: stats.recentSales
            }
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get package stats', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get package statistics',
            error: error.message
        });
    }
});
/**
 * GET /api/v1/packages/public
 * Get packages available for sale on captive portal
 */
router.get('/public/:tenantId', async (req, res) => {
    try {
        const tenantId = ensureString(req.params.tenantId);
        const packages = await package_service_1.PackageService.getPublicPackages(tenantId);
        res.json({
            success: true,
            packages: packages.map(pkg => ({
                id: pkg.id,
                name: pkg.name,
                description: pkg.description,
                price: pkg.price,
                validityHours: pkg.durationMinutes ? pkg.durationMinutes / 60 : null,
                validityDays: pkg.validity,
                dataLimitMB: pkg.dataLimitBytes ? pkg.dataLimitBytes / (1024 * 1024) : null,
                uploadSpeed: pkg.uploadSpeed,
                downloadSpeed: pkg.downloadSpeed,
                sharedUsers: pkg.sharedUsers
            }))
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get public packages', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to get public packages',
            error: error.message
        });
    }
});
/**
 * POST /api/v1/packages/:id/sync
 * Sync package to all compatible routers
 */
router.post('/:id/sync', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = ensureString(req.params.id);
        const tenantId = req.user?.tenantId;
        if (!tenantId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const result = await package_service_1.PackageService.getPackageWithCompatibility(id, tenantId);
        // Sync to all compatible routers
        for (const routerRecord of result.compatibleRouters) {
            try {
                await package_service_1.PackageService.syncPackageToRouter(result.package, routerRecord);
            }
            catch (error) {
                logger_1.default.error('Failed to sync package to router', {
                    packageId: id,
                    routerId: routerRecord.id,
                    error
                });
            }
        }
        res.json({
            success: true,
            message: `Package synced to ${result.compatibleRouters.length} compatible routers`,
            syncedRouters: result.compatibleRouters.length,
            incompatibleRouters: result.incompatibleRouters.length
        });
    }
    catch (error) {
        logger_1.default.error('Failed to sync package', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to sync package',
            error: error.message
        });
    }
});
exports.default = router;
