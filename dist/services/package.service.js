"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageService = void 0;
const models_1 = require("../models");
const mikrotik_service_1 = require("./mikrotik.service");
const logger_1 = __importDefault(require("../utils/logger"));
class PackageService {
    /**
     * Validate package configuration before saving
     */
    static validatePackageConfiguration(config) {
        const errors = [];
        if (!config.name || config.name.length < 3)
            errors.push('Name must be at least 3 characters');
        if (config.price < 0)
            errors.push('Price cannot be negative');
        if (!config.validityDays && !config.validityHours)
            errors.push('Must specify duration (hours or days)');
        return errors;
    }
    /**
     * Create a new package
     */
    static async createPackage(tenantId, data, userId) {
        const pkg = await models_1.Package.create({ ...data, tenantId });
        if (userId) {
            await models_1.AuditLog.create({
                action: 'CREATE_PACKAGE',
                details: `Created package ${pkg.name}`,
                userId,
                tenantId
            });
        }
        return pkg;
    }
    /**
     * Get all packages for a tenant
     */
    static async getTenantPackages(tenantId) {
        return await models_1.Package.findAll({ where: { tenantId } });
    }
    /**
     * Get package with compatibility info
     */
    static async getPackageWithCompatibility(id, tenantId) {
        const pkg = await models_1.Package.findOne({ where: { id, tenantId } });
        if (!pkg)
            throw new Error('Package not found');
        const routers = await models_1.Router.findAll({
            where: { tenantId, validationStatus: 'VALIDATED' }
        });
        return {
            package: pkg,
            compatibleRouters: routers || [],
            incompatibleRouters: []
        };
    }
    /**
     * Update package
     */
    static async updatePackage(id, tenantId, data, userId) {
        const pkg = await models_1.Package.findOne({ where: { id, tenantId } });
        if (!pkg)
            throw new Error('Package not found');
        await pkg.update(data);
        if (userId) {
            await models_1.AuditLog.create({
                action: 'UPDATE_PACKAGE',
                details: `Updated package ${pkg.name}`,
                userId,
                tenantId
            });
        }
        return pkg;
    }
    /**
     * Delete package
     */
    static async deletePackage(id, tenantId, userId) {
        const pkg = await models_1.Package.findOne({ where: { id, tenantId } });
        if (!pkg)
            throw new Error('Package not found');
        await pkg.destroy();
        if (userId) {
            await models_1.AuditLog.create({
                action: 'DELETE_PACKAGE',
                details: `Deleted package ${pkg.name}`,
                userId,
                tenantId
            });
        }
    }
    /**
     * Get package statistics
     */
    static async getPackageStats(id, tenantId) {
        const pkg = await models_1.Package.findOne({ where: { id, tenantId } });
        if (!pkg)
            throw new Error('Package not found');
        return {
            package: pkg,
            totalSales: 0,
            activeSubscribers: 0,
            revenue: 0,
            recentSales: []
        };
    }
    /**
     * Get public packages (for captive portal)
     */
    static async getPublicPackages(tenantId) {
        return await models_1.Package.findAll({
            where: { tenantId, isEnabled: true }
        });
    }
    /**
     * Sync a specific package to all active routers for a tenant
     */
    static async syncPackageToAllRouters(packageId, tenantId) {
        const pkg = await models_1.Package.findOne({ where: { id: packageId } });
        if (!pkg)
            throw new Error('Package not found');
        const routers = await models_1.Router.findAll({
            where: { tenantId, validationStatus: 'VALIDATED' }
        });
        const results = [];
        for (const router of (routers || [])) {
            try {
                await this.syncPackageToRouter(pkg, router);
                results.push({ routerName: router.name, status: 'SUCCESS' });
            }
            catch (error) {
                logger_1.default.error(`Failed to sync package ${pkg.name} to router ${router.name}`, { error });
                results.push({
                    routerName: router.name,
                    status: 'FAILED',
                    error: error.message || 'Unknown sync error'
                });
            }
        }
        return {
            success: results.length > 0 && results.every(r => r.status === 'SUCCESS'),
            results
        };
    }
    /**
     * Sync single package to router
     */
    static async syncPackageToRouter(pkg, router) {
        const rateLimit = pkg.uploadSpeed && pkg.downloadSpeed
            ? `${pkg.uploadSpeed}/${pkg.downloadSpeed}`
            : null;
        await mikrotik_service_1.MikroTikService.createOrUpdateHotspotProfile(router, pkg.name, {
            rateLimit,
            sharedUsers: pkg.sharedUsers || 1,
            transparentProxy: true,
        });
    }
    /**
     * Get analytics for packages
     */
    static async getPackageAnalytics(tenantId) {
        const packages = await models_1.Package.findAll({ where: { tenantId } });
        const payments = await models_1.Payment.findAll({ where: { tenantId, status: 'SUCCESS' } });
        return packages.map((pkg) => {
            const pkgPayments = payments.filter((p) => String(p.packageId) === String(pkg.id));
            const salesCount = pkgPayments.length;
            const revenue = pkgPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            return {
                id: pkg.id,
                salesCount,
                revenue,
                activeUsers: 0,
                expiredSessions: 0
            };
        });
    }
}
exports.PackageService = PackageService;
