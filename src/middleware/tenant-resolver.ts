import { Request, Response, NextFunction } from 'express';
import { Tenant, AuditLog } from '../models';
import { ContextService } from '../services/context.service';
import { SchemaService } from '../services/schema.service';
import logger from '../utils/logger';

export class TenantResolver {
    static async resolveTenant(req: Request, res: Response, next: NextFunction) {
        try {
            // If not authenticated, we can't resolve an admin/tenant context
            if (!req.user) {
                return next();
            }

            const tenantId = req.user.tenantId;

            await ContextService.runWithTenant(tenantId, async () => {
                try {
                    // Set schema context early
                    if (tenantId) {
                        await SchemaService.setSearchPath(tenantId);
                    }

                    // Super admin bypass
                    if (req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'PLATFORM_OWNER') {
                        if (tenantId && !req.tenant) {
                            try {
                                const tenant = await Tenant.findByPk(tenantId);
                                if (tenant) {
                                    req.tenant = tenant;
                                    (req as any).tenantId = tenant.id;
                                }
                            } catch (err) { }
                        }
                        return next();
                    }

                    // Bypass for setup routes
                    const openRoutes = ['/tenants/setup', '/api/v1/admin/tenants/setup', '/onboarding'];
                    if (openRoutes.some(route => req.path.includes(route))) {
                        return next();
                    }

                    if (!tenantId) {
                        await AuditLog.create({
                            action: 'TENANT_RESOLUTION_FAILURE',
                            details: `User ${req.user!.id} has no tenant assigned`,
                            userId: req.user!.id,
                            ipAddress: req.ip
                        });
                        return res.status(403).json({ error: 'No tenant assigned to your account', code: 'TENANT_REQUIRED' });
                    }

                    const tenant = await Tenant.findByPk(tenantId);
                    if (!tenant) {
                        return res.status(403).json({ error: 'Your workspace is not available', code: 'TENANT_ORPHANED' });
                    }

                    if (tenant.status !== 'ACTIVE' && 
                        !req.path.includes('/subscription/status') && 
                        !req.path.includes('/subscription/pay') &&
                        !req.path.includes('/api/v1/platform-billing/status') &&
                        !req.path.includes('/api/v1/platform-billing/pay') &&
                        !req.path.includes('/platform-billing/status') &&
                        !req.path.includes('/platform-billing/pay')) {
                        return res.status(403).json({ error: 'Your workspace is suspended', code: 'TENANT_SUSPENDED' });
                    }

                    // Check for Trial/Subscription Expiry
                    const now = new Date();
                    if (tenant.status === 'ACTIVE' && 
                        !req.path.includes('/subscription/status') && 
                        !req.path.includes('/subscription/pay') &&
                        !req.path.includes('/api/v1/platform-billing/status') &&
                        !req.path.includes('/api/v1/platform-billing/pay') &&
                        !req.path.includes('/platform-billing/status') &&
                        !req.path.includes('/platform-billing/pay')) {
                        // Trial Expiry Check
                        if (tenant.subscriptionStatus === 'TRIAL' && tenant.trialEndsAt && new Date(tenant.trialEndsAt) < now) {
                            await tenant.update({ status: 'SUSPENDED', subscriptionStatus: 'EXPIRED' });
                            return res.status(403).json({ 
                                error: 'Trial period expired', 
                                code: 'SUBSCRIPTION_REQUIRED',
                                message: 'Your 3-day trial has ended. Please pay KES 300 to reactivate your account.'
                            });
                        }

                        // Paid Subscription Expiry Check
                        if (tenant.subscriptionStatus === 'PAID' && tenant.nextPaymentDueDate && new Date(tenant.nextPaymentDueDate) < now) {
                            await tenant.update({ status: 'SUSPENDED', subscriptionStatus: 'EXPIRED' });
                            return res.status(403).json({ 
                                error: 'Subscription expired', 
                                code: 'SUBSCRIPTION_EXPIRED',
                                message: 'Your subscription has expired. Please pay KES 300 to reactivate your account.'
                            });
                        }
                    }

                    req.tenant = tenant;
                    next();
                } catch (innerError: any) {
                    logger.error('Inner tenant resolution error', { error: innerError.message });
                    next(innerError);
                }
            });

        } catch (error: any) {
            // Log the error
            await AuditLog.create({
                action: 'TENANT_RESOLUTION_ERROR',
                details: `Error resolving tenant for user ${req.user!.id}: ${error.message}`,
                userId: req.user!.id,
                ipAddress: req.ip
            });

            return res.status(500).json({
                error: 'System error resolving workspace',
                message: 'Please try again or contact support'
            });
        }
    }

    static async requireTenant(req: Request, res: Response, next: NextFunction) {
        // This is a strict check for routes that MUST have a resolved tenant
        if (req.user?.role === 'SUPER_ADMIN') {
            return next();
        }

        if (!req.tenant) {
            return res.status(403).json({
                error: 'Workspace access required',
                code: 'TENANT_MISSING',
                action: 'SELECT_WORKSPACE',
                message: 'Please select or create a workspace to continue'
            });
        }
        next();
    }
}
