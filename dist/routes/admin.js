"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const mikrotik_auto_config_service_1 = require("../services/mikrotik-auto-config.service");
const tenant_bootstrap_service_1 = require("../services/tenant-bootstrap.service");
const logger_1 = __importDefault(require("../utils/logger"));
const isp_service_1 = require("../services/isp.service");
const router = (0, express_1.Router)();
// Workspace Setup for new users
router.post('/tenants/setup', async (req, res) => {
    try {
        const { tenantName, subdomain } = req.body;
        const userId = req.user.id;
        // Check if user already has a tenant
        const user = await models_1.AdminUser.findByPk(userId);
        if (user?.tenantId) {
            return res.status(400).json({ error: 'You already have an active workspace' });
        }
        // Validate subdomain
        const existingTenant = await models_1.Tenant.findOne({ where: { subdomain } });
        if (existingTenant) {
            return res.status(400).json({ error: 'This subdomain is already in use. Please choose another one.' });
        }
        // 1. Create Tenant
        const tenant = await models_1.Tenant.create({
            name: tenantName,
            subdomain: subdomain,
            status: 'ACTIVE'
        });
        // 2. Assign to user
        await user.update({ tenantId: tenant.id });
        // 3. Bootstrap essential data
        await tenant_bootstrap_service_1.TenantBootstrapService.bootstrapNewTenant(tenant.id, userId);
        await models_1.AuditLog.create({
            action: 'WORKSPACE_SETUP',
            details: `User ${user.email} initialized workspace: ${tenant.name}`,
            userId: userId,
            tenantId: tenant.id,
            ipAddress: req.ip
        });
        res.status(201).json({
            message: 'Workspace created successfully',
            tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain }
        });
    }
    catch (error) {
        logger_1.default.error('Workspace setup failed', { error });
        res.status(500).json({ error: `Setup failed: ${error.message}` });
    }
});
// Recent Transactions with Session Info
router.get('/recent-transactions', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const transactions = await models_1.Payment.findAll({
            where: { tenantId },
            include: [
                { model: models_1.Session, required: false }
            ],
            order: [['createdAt', 'DESC']],
            limit: 20,
        });
        res.json(transactions);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch recent transactions', { error });
        res.status(500).json({ error: 'Failed to fetch recent transactions' });
    }
});
// Admin dashboard summary - Full BI Dashboard (18 KPIs)
router.get('/dashboard-summary', async (req, res) => {
    try {
        let tenantId = req.user.tenantId;
        if (!tenantId) {
            const activeTenant = await models_1.Tenant.findOne({ where: { status: 'ACTIVE' }, order: [['createdAt', 'ASC']] });
            if (activeTenant) {
                tenantId = activeTenant.id;
            }
        }
        if (!tenantId) {
            return res.json({
                tenantId: 'primary',
                tenantName: 'Jevish Workspace',
                tenantLogo: undefined,
                tenantColor: '#0ea5e9',
                subscriberCount: 0,
                activeSessions: 0,
                pendingPayments: 0,
                plan: 'Standard',
                revenueToday: 0, revenueWeek: 0, revenueMonth: 0, revenueYear: 0,
                totalSubscribers: 0, activeSubscribers: 0, expiredSubscribers: 0,
                onlineUsers: 0, offlineUsers: 0,
                totalRouters: 0, connectedRouters: 0, disconnectedRouters: 0,
                successPayments: 0, failedPayments: 0, activeCampaigns: 0,
                pendingWithdrawals: 0, networkHealth: 100,
            });
        }
        // Get tenant info
        const tenant = await models_1.Tenant.findByPk(tenantId, {
            attributes: ['id', 'name', 'primaryColor', 'logoUrl']
        });
        if (!tenant) {
            return res.json({
                tenantId: 'primary',
                tenantName: 'Jevish Workspace',
                tenantLogo: undefined,
                tenantColor: '#0ea5e9',
                subscriberCount: 0,
                activeSessions: 0,
                pendingPayments: 0,
                plan: 'Standard',
                revenueToday: 0, revenueWeek: 0, revenueMonth: 0, revenueYear: 0,
                totalSubscribers: 0, activeSubscribers: 0, expiredSubscribers: 0,
                onlineUsers: 0, offlineUsers: 0,
                totalRouters: 0, connectedRouters: 0, disconnectedRouters: 0,
                successPayments: 0, failedPayments: 0, activeCampaigns: 0,
                pendingWithdrawals: 0, networkHealth: 100,
            });
        }
        // Load AnalyticsService for full stats
        const { AnalyticsService } = require('../services/analytics.service');
        const biStats = await AnalyticsService.getFullDashboardStats(tenantId);
        res.json({
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantLogo: tenant.logoUrl,
            tenantColor: tenant.primaryColor,
            plan: 'Standard',
            // Legacy fields (for backwards compat)
            subscriberCount: biStats.totalSubscribers,
            activeSessions: biStats.onlineUsers,
            pendingPayments: biStats.pendingPayments,
            // Full BI KPIs
            ...biStats,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get dashboard summary', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
});
// List subscribers
router.get('/subscribers', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const subscribers = await models_1.Subscriber.findAll({
            where: { tenantId },
            include: [models_1.Package],
            order: [['createdAt', 'DESC']]
        });
        // Get all active sessions for this tenant
        const activeSessions = await models_1.Session.findAll({
            where: {
                tenantId,
                status: 'ACTIVE',
                [sequelize_1.Op.or]: [
                    { lastUpdated: { [sequelize_1.Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } },
                    { lastUpdated: null, startTime: { [sequelize_1.Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } }
                ]
            }
        });
        const enriched = subscribers.map(sub => {
            const session = activeSessions.find(s => s.macAddress === sub.macAddress);
            const pkg = sub.package;
            let usage = 0;
            if (session && pkg && pkg.dataLimitBytes) {
                const totalBytes = BigInt(session.bytesIn) + BigInt(session.bytesOut);
                usage = Math.min(100, Math.floor((Number(totalBytes) / Number(pkg.dataLimitBytes)) * 100));
            }
            else if (session) {
                // If no data limit, show some activity based on time if durationMinutes exists
                const elapsed = Date.now() - new Date(session.startTime).getTime();
                const total = (pkg?.durationMinutes || 60) * 60 * 1000;
                usage = Math.min(100, Math.floor((elapsed / total) * 100));
            }
            return {
                ...sub.toJSON(),
                activeSession: session ? session.toJSON() : null,
                usagePercent: usage,
                // Map status for frontend
                displayStatus: session ? 'Active' : (sub.status === 'SUSPENDED' ? 'Warning' : 'Expired'),
                expiresIn: session ? 'Active' : (sub.lastPaymentDate ? 'Last seen ' + new Date(sub.lastPaymentDate).toLocaleDateString() : 'Never')
            };
        });
        res.json(enriched);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch subscribers', { error });
        res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
});
// Create Subscriber
router.post('/subscribers', async (req, res) => {
    try {
        const subscriber = await isp_service_1.IspService.registerSubscriber({
            ...req.body,
            tenantId: req.user.tenantId
        });
        res.status(201).json(subscriber);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update Subscriber
router.put('/subscribers/:id', async (req, res) => {
    try {
        const subscriber = await isp_service_1.IspService.updateSubscriber(req.params.id, req.body);
        res.json(subscriber);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Delete Subscriber
router.delete('/subscribers/:id', async (req, res) => {
    try {
        const result = await isp_service_1.IspService.deleteSubscriber(req.params.id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Initialize tenant data (bootstrap)
router.post('/initialize', async (req, res) => {
    try {
        let tenantId = req.user.tenantId;
        const userId = req.user.id;
        if (!tenantId) {
            const defaultTenant = await models_1.Tenant.findOne({ where: { status: 'ACTIVE' }, order: [['createdAt', 'ASC']] });
            if (defaultTenant) {
                tenantId = defaultTenant.id;
            }
        }
        if (!tenantId) {
            return res.json({
                message: 'No tenant workspace available to initialize.',
                status: 'NO_TENANT'
            });
        }
        // Check if tenant is already bootstrapped
        const isBootstrapped = await tenant_bootstrap_service_1.TenantBootstrapService.isTenantBootstrapped(tenantId);
        if (isBootstrapped) {
            return res.json({
                message: 'Tenant already initialized',
                status: 'ALREADY_BOOTSTRAPPED'
            });
        }
        // Bootstrap the tenant
        await tenant_bootstrap_service_1.TenantBootstrapService.bootstrapNewTenant(tenantId, userId);
        res.json({
            message: 'Tenant initialized successfully',
            status: 'BOOTSTRAPPED',
            packagesCreated: 4,
            walletInitialized: true
        });
    }
    catch (error) {
        logger_1.default.error('Failed to initialize tenant', { error });
        res.status(500).json({ error: 'Failed to initialize tenant data' });
    }
});
// Check tenant initialization status
router.get('/initialize/status', async (req, res) => {
    try {
        let tenantId = req.user.tenantId;
        if (!tenantId) {
            const defaultTenant = await models_1.Tenant.findOne({ where: { status: 'ACTIVE' }, order: [['createdAt', 'ASC']] });
            if (defaultTenant) {
                tenantId = defaultTenant.id;
            }
        }
        if (!tenantId) {
            return res.json({
                isBootstrapped: true,
                message: 'No active tenant workspace found'
            });
        }
        const isBootstrapped = await tenant_bootstrap_service_1.TenantBootstrapService.isTenantBootstrapped(tenantId);
        res.json({
            isBootstrapped,
            message: isBootstrapped ? 'Tenant is fully initialized' : 'Tenant needs initialization'
        });
    }
    catch (error) {
        logger_1.default.error('Failed to check tenant initialization status', { error });
        res.status(500).json({ error: 'Failed to check initialization status' });
    }
});
// Real-time Analytics Routes
router.get('/analytics/revenue', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const stats = await AnalyticsService.getRealTimeRevenue(req.user.tenantId);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
});
router.get('/analytics/bandwidth', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const stats = await AnalyticsService.getBandwidthUsage(req.user.tenantId);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch bandwidth analytics' });
    }
});
router.get('/analytics/performance', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const stats = await AnalyticsService.getPaymentPerformance(req.user.tenantId);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch payment performance' });
    }
});
router.get('/analytics/sms', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const stats = await AnalyticsService.getSmsMetrics(req.user.tenantId);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch SMS metrics' });
    }
});
router.get('/analytics/context', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const context = await AnalyticsService.getTrafficContext(req.user.tenantId);
        res.json(context);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch traffic context', { error });
        res.status(500).json({ error: 'Failed to fetch traffic context' });
    }
});
router.get('/analytics/subscriber-growth', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const data = await AnalyticsService.getSubscriberGrowth(req.user.tenantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch subscriber growth' });
    }
});
router.get('/analytics/package-sales', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const data = await AnalyticsService.getPackageSales(req.user.tenantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch package sales' });
    }
});
router.get('/analytics/monthly-trend', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const data = await AnalyticsService.getMonthlyRevenueTrend(req.user.tenantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch monthly trend' });
    }
});
router.get('/analytics/full-stats', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const data = await AnalyticsService.getFullDashboardStats(req.user.tenantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch full dashboard stats' });
    }
});
router.get('/analytics/hourly-trends', async (req, res) => {
    try {
        const { AnalyticsService } = require('../services/analytics.service');
        const data = await AnalyticsService.getHourlyTrends(req.user.tenantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch hourly trends' });
    }
});
// MikroTik Script Center
router.get('/mikrotik/generate-script', async (req, res) => {
    try {
        const { type, version } = req.query;
        if (!type)
            return res.status(400).json({ error: 'Script type is required' });
        const { MikroTikService } = require('../services/mikrotik.service');
        const script = await MikroTikService.generateConfigScript(type, req.user.tenantId, version);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=jevish_${type}_${version || 'v7'}.rsc`);
        res.send(script);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate MikroTik script' });
    }
});
// --- ROUTER MANAGEMENT ---
// List routers
router.get('/routers', async (req, res) => {
    try {
        let tenantId = req.user.tenantId;
        if (!tenantId) {
            const activeTenant = await models_1.Tenant.findOne({ where: { status: 'ACTIVE' }, order: [['createdAt', 'ASC']] });
            if (activeTenant)
                tenantId = activeTenant.id;
        }
        const routers = tenantId ? await models_1.Router.findAll({ where: { tenantId } }) : await models_1.Router.findAll();
        const enriched = await Promise.all(routers.map(async (r) => {
            const [onlineCount, activeCount, expiredCount] = await Promise.all([
                models_1.Session.count({
                    where: {
                        routerId: r.id,
                        status: 'ACTIVE',
                        [sequelize_1.Op.or]: [
                            { lastUpdated: { [sequelize_1.Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } },
                            { lastUpdated: null, startTime: { [sequelize_1.Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } }
                        ]
                    }
                }),
                models_1.Subscriber.count({ where: { routerId: r.id, status: 'ACTIVE' } }),
                models_1.Subscriber.count({ where: { routerId: r.id, status: { [sequelize_1.Op.in]: ['INACTIVE', 'SUSPENDED'] } } }),
            ]);
            return {
                ...r.toJSON(),
                onlineCount,
                activeCount,
                expiredCount
            };
        }));
        res.json(enriched);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch routers', { error });
        res.status(500).json({ error: 'Failed to fetch routers' });
    }
});
// Add router
router.post('/routers', async (req, res) => {
    try {
        const { name, host, port, username, password, location } = req.body;
        const routerObj = await models_1.Router.create({
            name, host, port: port || 8728, username, password, location,
            tenantId: req.user.tenantId,
            validationStatus: 'PENDING'
        });
        const { AuditService } = require('../services/audit.service');
        await AuditService.log('ROUTER_CREATED', `Manual router created: ${name} (${host})`, req.user.tenantId, req.user.id);
        res.status(201).json(routerObj);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add router' });
    }
});
// Generate router setup command (For Wizard)
router.post('/routers/generate-setup', async (req, res) => {
    try {
        const { name, host, port, version } = req.body;
        let tenantId = req.user.tenantId;
        // Allow Super Admins to specify a tenantId in the body
        if (!tenantId && req.user.role === 'SUPER_ADMIN') {
            tenantId = req.body.tenantId;
        }
        if (!tenantId) {
            logger_1.default.error('Router generation failed: No tenant context found', { user: req.user });
            return res.status(403).json({
                error: 'Tenant context required',
                message: 'Non-tenant users must provide a tenantId in the request body.'
            });
        }
        if (!name || !host) {
            return res.status(400).json({ error: 'Router name and host are required' });
        }
        // 1. Find or create router record
        let routerObj = await models_1.Router.findOne({
            where: { host, tenantId }
        });
        if (!routerObj) {
            // Create a new router record with placeholders for initial creds
            // These will be auto-updated during script generation to the new apiUser/apiPassword
            routerObj = await models_1.Router.create({
                name,
                host,
                port: port || 8728,
                username: 'admin', // Default initial username
                password: '', // Default initial password (blank)
                tenantId,
                validationStatus: 'PENDING'
            });
            logger_1.default.info('New router created for wizard', { routerId: routerObj.id, host });
        }
        else {
            // Update name if it changed
            if (name && routerObj.name !== name) {
                routerObj.name = name;
                await routerObj.save();
            }
        }
        // 2. Load tenant info
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        // 3. Generate script
        const script = await mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateAutoConfigScript(routerObj, tenant, version || 'v7');
        logger_1.default.info('Setup script generated for wizard', {
            routerId: routerObj.id,
            tenantId,
            version: version || 'v7'
        });
        res.json({
            success: true,
            script,
            router: {
                id: routerObj.id,
                name: routerObj.name,
                host: routerObj.host
            }
        });
    }
    catch (error) {
        logger_1.default.error('Failed to generate router setup', { error: error.message });
        res.status(500).json({
            error: 'Failed to generate setup command',
            message: error.message
        });
    }
});
// Test router connection & compatibility
router.post('/routers/:id/test', async (req, res) => {
    try {
        const routerId = req.params.id;
        const routerObj = await models_1.Router.findOne({ where: { id: routerId, tenantId: req.user.tenantId } });
        if (!routerObj)
            return res.status(404).json({ error: 'Router not found' });
        const { MikroTikService } = require('../services/mikrotik.service');
        // 1. Connectivity Test
        const connTest = await MikroTikService.testConnection(routerObj);
        if (!connTest.status) {
            routerObj.validationStatus = 'FAILED';
            routerObj.isOnline = false;
            await routerObj.save();
            return res.json({ success: false, message: connTest.message });
        }
        // 2. Compatibility Test
        const compTest = await MikroTikService.validateCompatibility(routerObj);
        routerObj.validationStatus = compTest.status ? 'VALIDATED' : 'FAILED';
        routerObj.identity = connTest.identity || routerObj.identity;
        routerObj.isOnline = true;
        routerObj.lastSeen = new Date();
        await routerObj.save();
        res.json({
            success: compTest.status,
            message: compTest.status ? 'Router validated and ready' : 'Connectivity passed but compatibility issues found',
            details: connTest,
            issues: compTest.issues
        });
    }
    catch (error) {
        logger_1.default.error('Router verification failed', { error });
        res.status(500).json({ error: 'Verification failed' });
    }
});
// --- PACKAGE MANAGEMENT ---
const serializePackage = (pkg) => {
    const json = pkg.toJSON ? pkg.toJSON() : pkg;
    return {
        ...json,
        price: json.price !== undefined && json.price !== null ? json.price.toString() : '0',
        dataLimitBytes: json.dataLimitBytes !== undefined && json.dataLimitBytes !== null ? json.dataLimitBytes.toString() : null
    };
};
// List packages with optional analytics
router.get('/packages', async (req, res) => {
    try {
        const { PackageService } = require('../services/package.service');
        const [packages, analytics] = await Promise.all([
            models_1.Package.findAll({ where: { tenantId: req.user.tenantId }, order: [['createdAt', 'DESC']] }),
            PackageService.getPackageAnalytics(req.user.tenantId).catch(() => [])
        ]);
        // Merge analytics into packages
        const enriched = packages.map(pkg => {
            const stats = (analytics || []).find((a) => a.id === pkg.id) || {
                salesCount: 0, revenue: 0, activeUsers: 0, expiredSessions: 0
            };
            return {
                ...serializePackage(pkg),
                stats
            };
        });
        res.json(enriched);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch packages', { error });
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});
// Create manual package with validation & auto-sync
router.post('/packages', async (req, res) => {
    try {
        const { name, price, type, durationMinutes, dataLimitBytes, downloadSpeed, uploadSpeed, validity, sharedUsers, expiryAction, description, isVisible } = req.body;
        // Validation
        if (!name || price === undefined)
            return res.status(400).json({ error: 'Package Name and Price are mandatory' });
        // Ensure name is unique for this tenant
        const existing = await models_1.Package.findOne({ where: { name, tenantId: req.user.tenantId } });
        if (existing)
            return res.status(400).json({ error: 'A package with this name already exists' });
        const pkg = await models_1.Package.create({
            name,
            price: BigInt(price),
            type: type || 'HOTSPOT',
            durationMinutes: durationMinutes || null,
            dataLimitBytes: dataLimitBytes ? BigInt(dataLimitBytes) : null,
            downloadSpeed: downloadSpeed || '2M',
            uploadSpeed: uploadSpeed || '1M',
            validity: validity || 30, // Default 30 days
            sharedUsers: sharedUsers || 1,
            expiryAction: expiryAction || 'SUSPEND',
            description,
            isVisible: isVisible !== undefined ? isVisible : true,
            tenantId: req.user.tenantId,
            isEnabled: true
        });
        // Trigger auto-sync
        const { PackageService } = require('../services/package.service');
        PackageService.syncPackageToAllRouters(pkg.id, req.user.tenantId).catch((err) => {
            logger_1.default.warn('Auto-sync failed on package creation', { error: err.message });
        });
        const { AuditService } = require('../services/audit.service');
        await AuditService.log('PACKAGE_CREATED', `Package created and synced: ${name}`, req.user.tenantId, req.user.id).catch(() => { });
        res.status(201).json(serializePackage(pkg));
    }
    catch (error) {
        logger_1.default.error('Package creation failed', { error: error.message || error });
        res.status(500).json({ error: `Creation failed: ${error.message || 'Server error'}` });
    }
});
// Update package
router.put('/packages/:id', async (req, res) => {
    try {
        const pkg = await models_1.Package.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
        if (!pkg)
            return res.status(404).json({ error: 'Package not found' });
        const updates = { ...req.body };
        // Prevent editing tenantId or id
        delete updates.id;
        delete updates.tenantId;
        if (updates.price !== undefined && updates.price !== null) {
            updates.price = BigInt(updates.price);
        }
        if (updates.dataLimitBytes !== undefined && updates.dataLimitBytes !== null) {
            updates.dataLimitBytes = BigInt(updates.dataLimitBytes);
        }
        await pkg.update(updates);
        // Re-sync after update
        const { PackageService } = require('../services/package.service');
        PackageService.syncPackageToAllRouters(pkg.id, req.user.tenantId).catch(() => { });
        res.json({ message: 'Package updated and re-synced', package: serializePackage(pkg) });
    }
    catch (error) {
        res.status(500).json({ error: `Update failed: ${error.message || 'Server error'}` });
    }
});
// Delete package (safety check)
router.post('/packages/:id/delete', async (req, res) => {
    try {
        const pkg = await models_1.Package.findOne({ where: { id: req.params.id, tenantId: req.user.tenantId } });
        if (!pkg)
            return res.status(404).json({ error: 'Package not found' });
        // Check if in use by active subscribers
        const { Subscriber } = require('../models');
        const usageCount = await Subscriber.count({ where: { packageId: pkg.id, status: 'ACTIVE' } });
        if (usageCount > 0) {
            return res.status(400).json({
                error: `Cannot delete package while it has ${usageCount} active subscribers. Disable it instead.`
            });
        }
        await pkg.destroy();
        res.json({ message: 'Package deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: `Deletion failed: ${error.message}` });
    }
});
// Manual Sync
router.post('/packages/:id/sync', async (req, res) => {
    try {
        const { PackageService } = require('../services/package.service');
        const result = await PackageService.syncPackageToAllRouters(req.params.id, req.user.tenantId);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- PRODUCTION READINESS & GO-LIVE ---
// Get readiness checklist
router.get('/production/readiness', async (req, res) => {
    try {
        const { ProductionService } = require('../services/production.service');
        const readiness = await ProductionService.getReadinessChecklist(req.user.tenantId);
        res.json(readiness);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch readiness checklist' });
    }
});
// Clean for Production (Sanitize)
router.post('/production/sanitize', async (req, res) => {
    try {
        const { ProductionService } = require('../services/production.service');
        const result = await ProductionService.sanitizeForProduction(req.user.tenantId, req.user.id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Toggle Production Mode (Go Live)
router.post('/production/go-live', async (req, res) => {
    try {
        const { isProduction } = req.body;
        const { ProductionService } = require('../services/production.service');
        const result = await ProductionService.toggleProductionMode(req.user.tenantId, isProduction, req.user.id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// --- VOUCHER MANAGEMENT ---
router.get('/vouchers', async (req, res) => {
    try {
        const { status, batch, packageId, search, limit = 500 } = req.query;
        const where = { tenantId: req.user.tenantId };
        if (status && status !== 'ALL') {
            where.status = status;
        }
        if (batch && batch !== 'ALL') {
            where.batch = batch;
        }
        if (packageId && packageId !== 'ALL') {
            where.packageId = Number(packageId);
        }
        if (search) {
            where.code = { [sequelize_1.Op.iLike || sequelize_1.Op.like]: `%${String(search).trim()}%` };
        }
        const vouchers = await models_1.Voucher.findAll({
            where,
            include: [{ model: models_1.Package, attributes: ['id', 'name', 'price', 'validity', 'durationMinutes'] }],
            order: [['createdAt', 'DESC']],
            limit: Math.min(1000, Number(limit) || 500)
        });
        const mapped = vouchers.map((v) => ({
            id: v.id,
            code: v.code,
            packageId: v.packageId,
            price: v.package ? Number(v.package.price) : 50,
            plan: v.package ? v.package.name : 'Standard Plan',
            validity: v.package ? v.package.validity : undefined,
            batch: v.batch || 'DEFAULT',
            status: v.status,
            usedAt: v.usedAt,
            createdAt: v.createdAt
        }));
        res.json(mapped);
    }
    catch (error) {
        logger_1.default.error('Failed to list vouchers', { error: error.message });
        res.status(500).json({ error: 'Failed to list vouchers' });
    }
});
router.get('/vouchers/stats', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const total = await models_1.Voucher.count({ where: { tenantId } });
        const available = await models_1.Voucher.count({ where: { tenantId, status: 'AVAILABLE' } });
        const used = await models_1.Voucher.count({ where: { tenantId, status: 'USED' } });
        const expired = await models_1.Voucher.count({ where: { tenantId, status: 'EXPIRED' } });
        // Distinct batches
        const batches = await models_1.Voucher.findAll({
            attributes: [[models_1.sequelize.fn('DISTINCT', models_1.sequelize.col('batch')), 'batch']],
            where: { tenantId },
            raw: true
        });
        res.json({
            total,
            available,
            used,
            expired,
            batches: batches.map((b) => b.batch).filter(Boolean)
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get voucher stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get voucher stats' });
    }
});
router.post('/vouchers/generate', async (req, res) => {
    try {
        const { packageId, count = 10, batch, prefix, codeLength = 6 } = req.body;
        const { VoucherService } = require('../services/voucher.service');
        const created = await VoucherService.generateVouchers({
            tenantId: req.user.tenantId,
            packageId: Number(packageId),
            count: Number(count),
            batch,
            prefix,
            codeLength: Number(codeLength)
        });
        res.status(201).json({ success: true, count: created.length, vouchers: created });
    }
    catch (error) {
        logger_1.default.error('Failed to generate vouchers', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to generate vouchers' });
    }
});
router.delete('/vouchers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await models_1.Voucher.findOne({
            where: { id, tenantId: req.user.tenantId }
        });
        if (!voucher) {
            return res.status(404).json({ error: 'Voucher not found' });
        }
        if (voucher.status === 'USED') {
            return res.status(400).json({ error: 'Cannot delete an already used voucher' });
        }
        await voucher.destroy();
        res.json({ success: true, message: 'Voucher deleted successfully' });
    }
    catch (error) {
        logger_1.default.error('Failed to delete voucher', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to delete voucher' });
    }
});
router.post('/vouchers/bulk-delete', async (req, res) => {
    try {
        const { batch, ids } = req.body;
        const where = { tenantId: req.user.tenantId, status: 'AVAILABLE' };
        if (batch) {
            where.batch = batch;
        }
        else if (Array.isArray(ids) && ids.length > 0) {
            where.id = ids;
        }
        else {
            return res.status(400).json({ error: 'Please specify batch name or voucher IDs to delete' });
        }
        const count = await models_1.Voucher.destroy({ where });
        res.json({ success: true, deletedCount: count });
    }
    catch (error) {
        logger_1.default.error('Failed to bulk delete vouchers', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to bulk delete vouchers' });
    }
});
exports.default = router;
