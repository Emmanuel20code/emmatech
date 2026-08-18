import { Package, Router, AuditLog, Payment } from '../models';
import { MikroTikService } from './mikrotik.service';
import logger from '../utils/logger';

export class PackageService {

    /**
     * Validate package configuration before saving
     */
    static validatePackageConfiguration(config: any): string[] {
        const errors: string[] = [];
        if (!config.name || config.name.length < 3) errors.push('Name must be at least 3 characters');
        if (config.price < 0) errors.push('Price cannot be negative');
        if (!config.validityDays && !config.validityHours) errors.push('Must specify duration (hours or days)');
        return errors;
    }

    /**
     * Create a new package
     */
    static async createPackage(tenantId: string, data: any, userId?: string) {
        const pkg = await Package.create({ ...data, tenantId });

        if (userId) {
            await AuditLog.create({
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
    static async getTenantPackages(tenantId: string) {
        return await Package.findAll({ where: { tenantId } });
    }

    /**
     * Get package with compatibility info
     */
    static async getPackageWithCompatibility(id: string, tenantId: string): Promise<{
        package: any;
        compatibleRouters: any[];
        incompatibleRouters: any[];
    }> {
        const pkg = await Package.findOne({ where: { id, tenantId } });
        if (!pkg) throw new Error('Package not found');

        const routers = await Router.findAll({ 
            where: { tenantId, validationStatus: 'VALIDATED' } 
        });

        return {
            package: pkg,
            compatibleRouters: routers || [],
            incompatibleRouters: [] as any[]
        };
    }

    /**
     * Update package
     */
    static async updatePackage(id: string, tenantId: string, data: any, userId?: string) {
        const pkg = await Package.findOne({ where: { id, tenantId } });
        
        if (!pkg) throw new Error('Package not found');

        await pkg.update(data);

        if (userId) {
            await AuditLog.create({
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
    static async deletePackage(id: string, tenantId: string, userId?: string) {
        const pkg = await Package.findOne({ where: { id, tenantId } });
        if (!pkg) throw new Error('Package not found');

        await pkg.destroy();

        if (userId) {
            await AuditLog.create({
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
    static async getPackageStats(id: string, tenantId: string) {
        const pkg = await Package.findOne({ where: { id, tenantId } });
        if (!pkg) throw new Error('Package not found');

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
    static async getPublicPackages(tenantId: string) {
        return await Package.findAll({ 
            where: { tenantId, isEnabled: true } 
        });
    }

    /**
     * Sync a specific package to all active routers for a tenant
     */
    static async syncPackageToAllRouters(packageId: number | string, tenantId: string): Promise<{
        success: boolean;
        results: { routerName: string; status: 'SUCCESS' | 'FAILED'; error?: string }[];
    }> {
        const pkg = await Package.findOne({ where: { id: packageId } });
        if (!pkg) throw new Error('Package not found');

        const routers = await Router.findAll({ 
            where: { tenantId, validationStatus: 'VALIDATED' } 
        });

        const results: any[] = [];

        for (const router of (routers || [])) {
            try {
                await this.syncPackageToRouter(pkg, router);
                results.push({ routerName: router.name, status: 'SUCCESS' });
            } catch (error: any) {
                logger.error(`Failed to sync package ${pkg.name} to router ${router.name}`, { error });
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
    static async syncPackageToRouter(pkg: any, router: any) {
        const rateLimit = pkg.uploadSpeed && pkg.downloadSpeed
            ? `${pkg.uploadSpeed}/${pkg.downloadSpeed}`
            : null;

        await MikroTikService.createOrUpdateHotspotProfile(router, pkg.name, {
            rateLimit,
            sharedUsers: pkg.sharedUsers || 1,
            transparentProxy: true,
        });
    }

    /**
     * Get analytics for packages
     */
    static async getPackageAnalytics(tenantId: string) {
        const packages = await Package.findAll({ where: { tenantId } });
        const payments = await Payment.findAll({ where: { tenantId, status: 'SUCCESS' } });

        return packages.map((pkg: any) => {
            const pkgPayments = payments.filter((p: any) => String(p.packageId) === String(pkg.id));
            const salesCount = pkgPayments.length;
            const revenue = pkgPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
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