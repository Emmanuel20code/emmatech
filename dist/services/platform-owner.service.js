"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformOwnerService = void 0;
const models_1 = require("../models");
const mikrotik_service_1 = require("./mikrotik.service");
const audit_service_1 = require("./audit.service");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const logger_1 = __importDefault(require("../utils/logger"));
const sequelize_1 = require("sequelize");
class PlatformOwnerService {
    /**
     * Get platform-wide overview KPI statistics computed strictly from real DB data
     */
    static async getPlatformOverview() {
        try {
            const totalTenants = await models_1.Tenant.count();
            const activeTenants = await models_1.Tenant.count({ where: { status: 'ACTIVE' } });
            const suspendedTenants = await models_1.Tenant.count({ where: { status: 'SUSPENDED' } });
            const totalSubscribers = await models_1.Subscriber.count();
            const activeSubscribers = await models_1.Subscriber.count({ where: { status: 'ACTIVE' } });
            const inactiveSubscribers = await models_1.Subscriber.count({ where: { status: 'INACTIVE' } });
            const suspendedSubscribers = await models_1.Subscriber.count({ where: { status: 'SUSPENDED' } });
            const totalRouters = await models_1.Router.count();
            const onlineRouters = await models_1.Router.count({ where: { isOnline: true } });
            const offlineRouters = totalRouters - onlineRouters;
            // Financial sums from real successful payments
            const successfulPayments = await models_1.Payment.findAll({
                where: { status: 'SUCCESS' },
                attributes: ['amount', 'platformFee', 'netAmount']
            });
            let totalGrossRevenue = 0;
            let totalPlatformCommission = 0;
            let totalTenantProceeds = 0;
            successfulPayments.forEach((p) => {
                const amt = Number(p.amount) || 0;
                const pFee = Number(p.platformFee) || 0;
                const net = Number(p.netAmount) || (amt - pFee);
                totalGrossRevenue += amt;
                totalPlatformCommission += pFee;
                totalTenantProceeds += net;
            });
            const activeSessions = await models_1.Session.count({ where: { status: 'ACTIVE' } });
            const totalSmsSent = await models_1.SMSLog.count({ where: { status: 'SENT' } });
            const dormantPolicy = await models_1.DormantRouterPolicy.findOne();
            return {
                tenants: {
                    total: totalTenants,
                    active: activeTenants,
                    suspended: suspendedTenants
                },
                subscribers: {
                    total: totalSubscribers,
                    active: activeSubscribers,
                    inactive: inactiveSubscribers,
                    suspended: suspendedSubscribers
                },
                routers: {
                    total: totalRouters,
                    online: onlineRouters,
                    offline: offlineRouters,
                    healthPercentage: totalRouters > 0 ? Math.round((onlineRouters / totalRouters) * 100) : 100
                },
                financials: {
                    totalGrossRevenue,
                    totalPlatformCommission,
                    totalTenantProceeds,
                    currency: 'KES'
                },
                sessions: {
                    activeSessions
                },
                sms: {
                    totalSent: totalSmsSent
                },
                dormantPolicy: dormantPolicy ? {
                    thresholdMinutes: dormantPolicy.dormantThresholdMinutes,
                    actionOnDormant: dormantPolicy.actionOnDormant,
                    autoActionEnabled: dormantPolicy.autoActionEnabled
                } : null
            };
        }
        catch (error) {
            logger_1.default.error('Failed to calculate platform overview stats', { error: error.message });
            throw error;
        }
    }
    /**
     * Get detailed tenant directory with real stats per tenant
     */
    static async getTenantDirectory() {
        try {
            const tenants = await models_1.Tenant.findAll({
                order: [['createdAt', 'DESC']]
            });
            const enrichedTenants = await Promise.all(tenants.map(async (t) => {
                const subscriberCount = await models_1.Subscriber.count({ where: { tenantId: t.id } });
                const activeSubscriberCount = await models_1.Subscriber.count({ where: { tenantId: t.id, status: 'ACTIVE' } });
                const routerCount = await models_1.Router.count({ where: { tenantId: t.id } });
                const onlineRouterCount = await models_1.Router.count({ where: { tenantId: t.id, isOnline: true } });
                const payments = await models_1.Payment.findAll({
                    where: { tenantId: t.id, status: 'SUCCESS' },
                    attributes: ['amount', 'platformFee']
                });
                let totalRevenue = 0;
                let platformCommission = 0;
                payments.forEach((p) => {
                    totalRevenue += Number(p.amount) || 0;
                    platformCommission += Number(p.platformFee) || 0;
                });
                const wallet = await models_1.Wallet.findOne({ where: { ownerId: t.id } });
                const activeSessions = await models_1.Session.count({ where: { tenantId: t.id, status: 'ACTIVE' } });
                return {
                    id: t.id,
                    name: t.name,
                    subdomain: t.subdomain,
                    status: t.status,
                    businessEmail: t.businessEmail || t.contactPhone,
                    contactPhone: t.contactPhone,
                    commissionPercentage: t.commissionPercentage || 10,
                    baseMonthlyFee: t.baseMonthlyFee || 0,
                    createdAt: t.createdAt,
                    subscriberCount,
                    activeSubscriberCount,
                    routerCount,
                    onlineRouterCount,
                    totalRevenue,
                    platformCommission,
                    tenantNetRevenue: totalRevenue - platformCommission,
                    walletBalance: wallet ? Number(wallet.balance) : 0,
                    activeSessionsCount: activeSessions
                };
            }));
            return enrichedTenants;
        }
        catch (error) {
            logger_1.default.error('Failed to get tenant directory', { error: error.message });
            throw error;
        }
    }
    /**
     * Suspend or Activate a tenant
     */
    static async updateTenantStatus(tenantId, status, adminUserId) {
        try {
            const tenant = await models_1.Tenant.findByPk(tenantId);
            if (!tenant)
                throw new Error('Tenant not found');
            await tenant.update({ status });
            if (status === 'SUSPENDED') {
                // Expire all active user sessions for this tenant
                await models_1.Session.update({ status: 'EXPIRED' }, { where: { tenantId, status: 'ACTIVE' } });
            }
            await audit_service_1.AuditService.log(status === 'SUSPENDED' ? 'TENANT_SUSPENDED' : 'TENANT_ACTIVATED', `Tenant ${tenant.name} (${tenant.subdomain}) set to ${status} by Platform Owner`, tenant.id, adminUserId);
            return tenant;
        }
        catch (error) {
            logger_1.default.error('Failed to update tenant status', { tenantId, status, error: error.message });
            throw error;
        }
    }
    /**
     * Get list of all connected MikroTik routers across all tenants
     */
    static async getGlobalRouters() {
        try {
            const routers = await models_1.Router.findAll({
                include: [{ model: models_1.Tenant, attributes: ['id', 'name', 'subdomain', 'status'] }],
                order: [['lastSeen', 'DESC']]
            });
            const enrichedRouters = await Promise.all(routers.map(async (r) => {
                const activeSessionsCount = await models_1.Session.count({
                    where: { routerId: r.id, status: 'ACTIVE' }
                });
                const lastLog = await models_1.RouterConnectionLog.findOne({
                    where: { routerId: r.id },
                    order: [['createdAt', 'DESC']]
                });
                // Determine dormant status if lastSeen is older than 30 mins
                const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
                const isDormant = !r.lastSeen || new Date(r.lastSeen) < thirtyMinsAgo;
                return {
                    id: r.id,
                    name: r.name,
                    host: r.host,
                    port: r.port,
                    username: r.username,
                    tenantId: r.tenantId,
                    tenantName: r.tenant?.name || 'Unknown',
                    tenantSubdomain: r.tenant?.subdomain || '',
                    tenantStatus: r.tenant?.status || 'ACTIVE',
                    location: r.location,
                    isOnline: r.isOnline,
                    isDormant,
                    lastSeen: r.lastSeen,
                    identity: r.identity,
                    validationStatus: r.validationStatus,
                    autoConfigStatus: r.autoConfigStatus,
                    version: r.version,
                    model: r.model,
                    architecture: r.architecture,
                    activeSessionsCount,
                    lastLog: lastLog ? {
                        action: lastLog.action,
                        status: lastLog.status,
                        details: lastLog.details,
                        createdAt: lastLog.createdAt
                    } : null
                };
            }));
            return enrichedRouters;
        }
        catch (error) {
            logger_1.default.error('Failed to get global routers', { error: error.message });
            throw error;
        }
    }
    /**
     * Perform direct one-click administrative actions on any MikroTik router
     */
    static async executeRouterAction(routerId, action, userId) {
        try {
            const router = await models_1.Router.findByPk(routerId, {
                include: [{ model: models_1.Tenant, attributes: ['name', 'subdomain'] }]
            });
            if (!router)
                throw new Error('Router not found');
            let result = {};
            switch (action) {
                case 'PING': {
                    const conn = await mikrotik_service_1.MikroTikService.testConnection(router);
                    if (conn.status) {
                        const resources = await mikrotik_service_1.MikroTikService.getSystemResources(router);
                        await router.update({
                            isOnline: true,
                            lastSeen: new Date(),
                            version: conn.version || router.version,
                            identity: conn.identity || router.identity,
                            validationStatus: 'VALIDATED'
                        });
                        result = { connected: true, resources, message: conn.message };
                    }
                    else {
                        await router.update({ isOnline: false });
                        result = { connected: false, message: conn.message };
                    }
                    break;
                }
                case 'RECONNECT': {
                    const conn = await mikrotik_service_1.MikroTikService.testConnection(router);
                    await router.update({
                        isOnline: conn.status,
                        lastSeen: conn.status ? new Date() : router.lastSeen,
                        validationStatus: conn.status ? 'VALIDATED' : 'FAILED'
                    });
                    result = { success: conn.status, message: conn.message };
                    break;
                }
                case 'SUSPEND':
                case 'DISABLE': {
                    await router.update({ isOnline: false, validationStatus: 'FAILED' });
                    // Disconnect all sessions on this router
                    await models_1.Session.update({ status: 'EXPIRED' }, { where: { routerId: router.id, status: 'ACTIVE' } });
                    result = { success: true, message: `Router ${router.name} suspended & active sessions expired` };
                    break;
                }
                case 'BACKUP': {
                    const backupName = `backup_${router.name.replace(/\s+/g, '_')}_${Date.now()}`;
                    const backupRes = await mikrotik_service_1.MikroTikService.generateBackup(router, backupName);
                    result = { success: true, backup: backupRes };
                    break;
                }
                case 'DISCONNECT_SESSIONS': {
                    const activeSessions = await models_1.Session.findAll({
                        where: { routerId: router.id, status: 'ACTIVE' }
                    });
                    let disconnectedCount = 0;
                    for (const s of activeSessions) {
                        try {
                            await mikrotik_service_1.MikroTikService.disconnectHotspotUser(router, s.mikrotikUsername);
                            await s.update({ status: 'EXPIRED' });
                            disconnectedCount++;
                        }
                        catch (e) {
                            // Continue best effort
                        }
                    }
                    result = { success: true, disconnectedCount };
                    break;
                }
                default:
                    throw new Error('Unsupported router action');
            }
            await models_1.RouterConnectionLog.create({
                routerId: router.id,
                tenantId: router.tenantId,
                action: action,
                status: 'SUCCESS',
                details: `Platform Owner executed ${action} on router ${router.name}`,
                userId: userId || null
            });
            return result;
        }
        catch (error) {
            logger_1.default.error(`Failed to execute router action ${action}`, { routerId, error: error.message });
            throw error;
        }
    }
    /**
     * Get platform-wide financial & operational analytics
     */
    static async getPlatformAnalytics() {
        try {
            // Calculate last 30 days daily revenue trends
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const payments = await models_1.Payment.findAll({
                where: {
                    status: 'SUCCESS',
                    createdAt: { [sequelize_1.Op.gte]: thirtyDaysAgo }
                },
                order: [['createdAt', 'ASC']]
            });
            const dailyMap = {};
            payments.forEach((p) => {
                const dateStr = new Date(p.createdAt).toISOString().split('T')[0];
                if (!dailyMap[dateStr]) {
                    dailyMap[dateStr] = { gross: 0, platformFee: 0, count: 0 };
                }
                dailyMap[dateStr].gross += Number(p.amount) || 0;
                dailyMap[dateStr].platformFee += Number(p.platformFee) || 0;
                dailyMap[dateStr].count += 1;
            });
            const revenueTimeSeries = Object.keys(dailyMap).map(date => ({
                date,
                grossRevenue: dailyMap[date].gross,
                platformCommission: dailyMap[date].platformFee,
                tenantRevenue: dailyMap[date].gross - dailyMap[date].platformFee,
                transactionCount: dailyMap[date].count
            }));
            // Payment Channel distribution
            const channelDistribution = {};
            payments.forEach((p) => {
                const channel = p.paymentChannel || 'MPESA';
                channelDistribution[channel] = (channelDistribution[channel] || 0) + (Number(p.amount) || 0);
            });
            // Top Revenue Tenants
            const tenantRevenueMap = {};
            payments.forEach((p) => {
                tenantRevenueMap[p.tenantId] = (tenantRevenueMap[p.tenantId] || 0) + (Number(p.amount) || 0);
            });
            const sortedTenantIds = Object.keys(tenantRevenueMap).sort((a, b) => tenantRevenueMap[b] - tenantRevenueMap[a]).slice(0, 5);
            const topTenants = await Promise.all(sortedTenantIds.map(async (id) => {
                const tenant = await models_1.Tenant.findByPk(id, { attributes: ['name', 'subdomain'] });
                return {
                    tenantId: id,
                    name: tenant?.name || 'Unknown',
                    revenue: tenantRevenueMap[id]
                };
            }));
            return {
                revenueTimeSeries,
                channelDistribution,
                topTenants
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get platform analytics', { error: error.message });
            throw error;
        }
    }
    /**
     * Get platform-wide security audit & breach logs
     */
    static async getSecurityEvents(limit = 50) {
        try {
            const auditLogs = await models_1.AuditLog.findAll({
                limit,
                order: [['createdAt', 'DESC']]
            });
            const routerLogs = await models_1.RouterConnectionLog.findAll({
                where: { status: 'FAILED' },
                limit: 20,
                order: [['createdAt', 'DESC']],
                include: [{ model: models_1.Router, attributes: ['name'] }]
            });
            const fraudLogs = await models_1.FraudLog.findAll({
                limit: 20,
                order: [['id', 'DESC']]
            });
            return {
                auditLogs,
                failedRouterLogs: routerLogs,
                fraudLogs
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get security events', { error: error.message });
            throw error;
        }
    }
    /**
     * Consolidated Platform Reports Hub Data
     */
    static async getConsolidatedReports() {
        try {
            const overview = await this.getPlatformOverview();
            const analytics = await this.getPlatformAnalytics();
            const topTenants = await this.getTenantDirectory();
            return {
                summary: overview,
                analytics,
                topTenants: topTenants.slice(0, 10),
                generatedAt: new Date().toISOString()
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get consolidated reports', { error: error.message });
            throw error;
        }
    }
    /**
     * Generate Impersonation Token for Platform Owner to troubleshoot a tenant
     */
    static async impersonateTenant(tenantId, platformOwnerUserId) {
        try {
            const tenant = await models_1.Tenant.findByPk(tenantId);
            if (!tenant)
                throw new Error('Tenant not found');
            // Find or get a tenant admin user to represent impersonation
            const tenantAdmin = await models_1.AdminUser.findOne({
                where: { tenantId, role: 'TENANT' }
            });
            const secret = env_1.config.auth.jwtSecret;
            const impersonationToken = jsonwebtoken_1.default.sign({
                id: tenantAdmin ? tenantAdmin.id : platformOwnerUserId,
                role: 'TENANT',
                tenantId: tenant.id,
                isImpersonated: true,
                impersonatorId: platformOwnerUserId,
                impersonatedTenantName: tenant.name
            }, secret, { expiresIn: '2h' });
            await audit_service_1.AuditService.log('TENANT_IMPERSONATED', `Platform Owner impersonated tenant ${tenant.name} (${tenant.id})`, tenant.id, platformOwnerUserId);
            return {
                token: impersonationToken,
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    subdomain: tenant.subdomain
                }
            };
        }
        catch (error) {
            logger_1.default.error('Failed to generate tenant impersonation token', { tenantId, error: error.message });
            throw error;
        }
    }
    /**
     * Mass Administrative Actions (Cache flush, global broadcasts, mass router backup)
     */
    static async executeQuickAction(actionType, payload, userId) {
        try {
            let result = {};
            if (actionType === 'BACKUP_ALL_ROUTERS') {
                const routers = await models_1.Router.findAll({ where: { isOnline: true } });
                let successCount = 0;
                let failCount = 0;
                for (const r of routers) {
                    try {
                        const backupName = `global_backup_${r.name.replace(/\s+/g, '_')}_${Date.now()}`;
                        await mikrotik_service_1.MikroTikService.generateBackup(r, backupName);
                        successCount++;
                    }
                    catch (e) {
                        failCount++;
                    }
                }
                result = { message: `Mass backup completed. Success: ${successCount}, Failed: ${failCount}` };
            }
            else if (actionType === 'CLEAR_ACTIVE_STALE_SESSIONS') {
                const expiredCount = await models_1.Session.update({ status: 'EXPIRED' }, { where: { expiryTime: { [sequelize_1.Op.lt]: new Date() }, status: 'ACTIVE' } });
                result = { message: `Cleared ${expiredCount[0]} stale sessions across all tenants` };
            }
            else {
                result = { message: `Quick action ${actionType} executed` };
            }
            await audit_service_1.AuditService.log('PLATFORM_QUICK_ACTION', `Platform Owner executed quick action: ${actionType}`, undefined, userId);
            return result;
        }
        catch (error) {
            logger_1.default.error('Failed to execute quick action', { actionType, error: error.message });
            throw error;
        }
    }
}
exports.PlatformOwnerService = PlatformOwnerService;
