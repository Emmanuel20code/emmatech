"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models");
const mikrotik_auto_config_service_1 = require("../services/mikrotik-auto-config.service");
const mikrotik_service_1 = require("../services/mikrotik.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * Helper to resolve public backend URL for MikroTik callback commands
 */
function getPublicAppBaseUrl(req) {
    // 1. Check explicit environment variables (Render, custom domain, production config)
    let envUrl = (process.env.PUBLIC_APP_URL ||
        process.env.BACKEND_URL ||
        process.env.APP_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        process.env.PUBLIC_BACKEND_URL ||
        '').trim();
    // If an explicit production URL (non-localhost) is provided in env, use it!
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
            envUrl = `https://${envUrl}`;
        }
        else if (envUrl.startsWith('http://')) {
            envUrl = envUrl.replace('http://', 'https://');
        }
        return envUrl.replace(/\/+$/, '');
    }
    // 2. Try deriving from incoming HTTP request headers (works on Render, Cloud Run, custom proxies)
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const hostHeader = req.headers['x-forwarded-host'] || req.get('host') || '';
    if (hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')) {
        let derivedUrl = `${proto}://${hostHeader}`;
        if (derivedUrl.startsWith('http://')) {
            derivedUrl = derivedUrl.replace('http://', 'https://');
        }
        return derivedUrl.replace(/\/+$/, '');
    }
    // 3. Fallback for local development or default AI Studio preview URL
    let fallbackUrl = envUrl || 'https://ais-dev-azzbe4ifucmcgc3nw7q27r-296303536462.europe-west3.run.app';
    if (!fallbackUrl.startsWith('http://') && !fallbackUrl.startsWith('https://')) {
        fallbackUrl = `https://${fallbackUrl}`;
    }
    return fallbackUrl.replace(/\/+$/, '');
}
/**
 * POST /api/v1/routers/quick-onboard
 * Automated MikroTik Onboarding - Tenant inputs location name only
 */
router.post('/quick-onboard', async (req, res) => {
    try {
        const { location, name } = req.body;
        const user = req.user;
        let tenantId = user?.tenantId || req.body?.tenantId || req.headers['x-tenant-id'];
        // Fallback for Super Admin / Platform Owner context if tenantId not specified
        if (!tenantId && (user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_OWNER')) {
            const firstTenant = await models_1.Tenant.findOne();
            if (firstTenant) {
                tenantId = firstTenant.id;
            }
        }
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant workspace context required. Please select or set up a tenant workspace.' });
        }
        const locationName = (location || name || '').trim();
        if (!locationName) {
            return res.status(400).json({ error: 'Location name is required for automated onboarding' });
        }
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant workspace not found' });
        }
        // Generate onboarding token and API credentials
        const onboardToken = crypto_1.default.randomBytes(16).toString('hex');
        const routerId = crypto_1.default.randomUUID();
        const { apiUser, apiPassword } = mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateApiCredentials(tenantId, routerId);
        // Derive public HTTPS base URL for router fetch commands
        const appBaseUrl = getPublicAppBaseUrl(req);
        // Create router record
        const routerRecord = await models_1.Router.create({
            id: routerId,
            name: name || locationName,
            location: locationName,
            host: '0.0.0.0', // Updated automatically when router calls home
            port: 8728,
            username: apiUser,
            password: apiPassword,
            apiUser,
            apiPassword,
            tenantId,
            onboardToken,
            isOnline: false,
            validationStatus: 'PENDING',
            autoConfigStatus: 'PENDING'
        });
        // Generate universal cross-version script
        const script = mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateUniversalAutoConfigScript(routerRecord, tenant, onboardToken, appBaseUrl);
        await routerRecord.update({ autoConfigScript: script });
        const shortCode = `/tool fetch url="${appBaseUrl}/api/v1/routers/onboard/${onboardToken}/script" check-certificate=no dst-path=jevish.rsc; :delay 2s; /import jevish.rsc`;
        logger_1.default.info('Automated router onboarding initiated', {
            routerId: routerRecord.id,
            location: locationName,
            tenantId,
            appBaseUrl
        });
        res.json({
            success: true,
            message: 'Automated onboarding session initialized',
            router: {
                id: routerRecord.id,
                name: routerRecord.name,
                location: routerRecord.location,
                onboardToken: routerRecord.onboardToken,
                status: routerRecord.autoConfigStatus
            },
            shortCode,
            script,
            scriptUrl: `${appBaseUrl}/api/v1/routers/onboard/${onboardToken}/script`
        });
    }
    catch (error) {
        logger_1.default.error('Quick onboarding failed', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to initialize automated onboarding', message: error.message });
    }
});
/**
 * POST /api/v1/routers
 * Create router or fallback to quick onboarding if host omitted
 */
router.post('/', async (req, res) => {
    try {
        const { name, location, host, port, username, password } = req.body;
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant access required' });
        }
        // If host is not provided, delegate to quick automated onboarding
        if (!host) {
            const locationName = (location || name || '').trim();
            if (!locationName) {
                return res.status(400).json({ error: 'Please enter a Location Name for your MikroTik router' });
            }
            const tenant = await models_1.Tenant.findByPk(tenantId);
            if (!tenant)
                return res.status(404).json({ error: 'Tenant not found' });
            const onboardToken = crypto_1.default.randomBytes(16).toString('hex');
            const routerId = crypto_1.default.randomUUID();
            const { apiUser, apiPassword } = mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateApiCredentials(tenantId, routerId);
            const appBaseUrl = getPublicAppBaseUrl(req);
            const routerRecord = await models_1.Router.create({
                id: routerId,
                name: name || locationName,
                location: locationName,
                host: '0.0.0.0',
                port: port || 8728,
                username: apiUser,
                password: apiPassword,
                apiUser,
                apiPassword,
                tenantId,
                onboardToken,
                isOnline: false,
                validationStatus: 'PENDING',
                autoConfigStatus: 'PENDING'
            });
            const script = mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateUniversalAutoConfigScript(routerRecord, tenant, onboardToken, appBaseUrl);
            await routerRecord.update({ autoConfigScript: script });
            const shortCode = `/tool fetch url="${appBaseUrl}/api/v1/routers/onboard/${onboardToken}/script" check-certificate=no dst-path=jevish.rsc; :delay 2s; /import jevish.rsc`;
            return res.json({
                success: true,
                message: 'Automated onboarding code generated successfully',
                router: routerRecord,
                shortCode,
                script
            });
        }
        // Legacy manual creation
        const routerRecord = await models_1.Router.create({
            name: name || location || 'Router',
            host,
            port: port || 8728,
            username: username || 'admin',
            password: password || '',
            tenantId,
            location: location || name || null,
            isOnline: false,
            validationStatus: 'PENDING',
            autoConfigStatus: 'PENDING'
        });
        res.json({
            success: true,
            message: 'Router created successfully',
            router: routerRecord
        });
    }
    catch (error) {
        logger_1.default.error('Failed to create router', { error: error.message });
        res.status(500).json({ error: 'Failed to create router', message: error.message });
    }
});
/**
 * POST /api/v1/routers/connect
 * Initiate router connection and generate auto-config script
 */
router.post('/connect', async (req, res) => {
    try {
        const { name, host, port, username, password, location } = req.body;
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant access required' });
        }
        // Validate required fields
        if (!name || !host || !username || !password) {
            return res.status(400).json({
                error: 'Missing required fields: name, host, username, password'
            });
        }
        // Test initial connection with admin credentials
        const testResult = await mikrotik_auto_config_service_1.MikroTikAutoConfigService.testInitialConnection(host, port || 8728, username, password);
        if (!testResult.success) {
            return res.status(400).json({
                error: 'Connection test failed',
                message: testResult.message,
                suggestion: 'Please verify router IP, credentials, and ensure API service is enabled on port 8728'
            });
        }
        // Create router record
        const routerRecord = await models_1.Router.create({
            name,
            host,
            port: port || 8728,
            username,
            password,
            tenantId,
            location: location || null,
            isOnline: true,
            lastSeen: new Date(),
            identity: testResult.identity,
            version: testResult.version,
            validationStatus: 'PENDING',
            autoConfigStatus: 'PENDING'
        });
        // Get tenant info
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        // Detect RouterOS version
        const version = testResult.version?.startsWith('7') ? 'v7' : 'v6';
        // Generate auto-config script
        const script = await mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateAutoConfigScript(routerRecord, tenant, version);
        logger_1.default.info('Router connection initiated', {
            routerId: routerRecord.id,
            tenantId,
            host,
            version
        });
        res.json({
            success: true,
            message: 'Router connection initiated successfully',
            router: {
                id: routerRecord.id,
                name: routerRecord.name,
                host: routerRecord.host,
                port: routerRecord.port,
                location: routerRecord.location,
                version: testResult.version,
                identity: testResult.identity,
                autoConfigStatus: routerRecord.autoConfigStatus
            },
            script,
            version,
            nextSteps: [
                'Copy the script above',
                'Open Winbox and connect to your router',
                'Go to New Terminal',
                'Paste the entire script and press Enter',
                'Wait for execution to complete',
                'Click "Verify Connection" in the dashboard'
            ]
        });
    }
    catch (error) {
        logger_1.default.error('Router connection failed', { error: error.message });
        res.status(500).json({
            error: 'Failed to initiate router connection',
            message: error.message
        });
    }
});
/**
 * GET /api/v1/routers/:id/script
 * Get auto-config script for a router
 */
router.get('/:id/script', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const routerRecord = await models_1.Router.findOne({
            where: { id, tenantId }
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        if (!routerRecord.autoConfigScript) {
            return res.status(404).json({
                error: 'Auto-config script not available',
                message: 'Please reconnect the router to generate a new script'
            });
        }
        res.json({
            script: routerRecord.autoConfigScript,
            router: {
                id: routerRecord.id,
                name: routerRecord.name,
                version: routerRecord.version
            }
        });
    }
    catch (error) {
        logger_1.default.error('Failed to retrieve script', { error: error.message });
        res.status(500).json({ error: 'Failed to retrieve script' });
    }
});
/**
 * POST /api/v1/routers/:id/verify
 * Verify router configuration after script execution
 */
router.post('/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const routerRecord = await models_1.Router.findOne({
            where: { id, tenantId }
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        // Verify configuration
        const verificationResult = await mikrotik_auto_config_service_1.MikroTikAutoConfigService.verifyConfiguration(routerRecord, userId);
        if (!verificationResult.success) {
            return res.status(400).json({
                success: false,
                message: verificationResult.message,
                troubleshooting: [
                    'Ensure you pasted the entire script in the terminal',
                    'Check if there were any error messages in the terminal',
                    'Verify that the router can reach the billing system',
                    'Ensure API service is enabled on port 8728',
                    'Check firewall rules on the router'
                ]
            });
        }
        res.json({
            success: true,
            message: 'Router configured and verified successfully!',
            router: {
                id: routerRecord.id,
                name: routerRecord.name,
                host: routerRecord.host,
                status: routerRecord.autoConfigStatus,
                version: routerRecord.version,
                identity: routerRecord.identity,
                capabilities: routerRecord.capabilities ? JSON.parse(routerRecord.capabilities) : null
            },
            details: verificationResult.details
        });
    }
    catch (error) {
        logger_1.default.error('Router verification failed', { error: error.message });
        res.status(500).json({
            error: 'Verification failed',
            message: error.message
        });
    }
});
/**
 * GET /api/v1/routers
 * List all routers for tenant
 */
router.get('/', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant access required' });
        }
        const routers = await models_1.Router.findAll({
            where: { tenantId },
            attributes: [
                'id', 'name', 'host', 'port', 'location', 'isOnline',
                'lastSeen', 'identity', 'version', 'model', 'architecture',
                'validationStatus', 'autoConfigStatus', 'capabilities',
                'createdAt', 'updatedAt'
            ],
            order: [['createdAt', 'DESC']]
        });
        const routersWithStats = routers.map(r => ({
            ...r.toJSON(),
            capabilities: r.capabilities ? JSON.parse(r.capabilities) : null
        }));
        res.json({
            routers: routersWithStats,
            total: routers.length
        });
    }
    catch (error) {
        logger_1.default.error('Failed to list routers', { error: error.message });
        res.status(500).json({ error: 'Failed to list routers' });
    }
});
/**
 * PUT /api/v1/routers/:id
 * Update router details
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location } = req.body;
        const tenantId = req.user.tenantId;
        const routerRecord = await models_1.Router.findOne({
            where: { id, tenantId }
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        await routerRecord.update({
            name: name || routerRecord.name,
            location: location !== undefined ? location : routerRecord.location
        });
        res.json({
            success: true,
            message: 'Router updated successfully',
            router: {
                id: routerRecord.id,
                name: routerRecord.name,
                location: routerRecord.location
            }
        });
    }
    catch (error) {
        logger_1.default.error('Failed to update router', { error: error.message });
        res.status(500).json({ error: 'Failed to update router' });
    }
});
/**
 * DELETE /api/v1/routers/:id
 * Remove router and cleanup configuration
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const routerRecord = await models_1.Router.findOne({
            where: { id, tenantId }
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        // Generate rollback script
        const rollbackScript = await mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateRollbackScript(routerRecord);
        // Log the disconnection
        await models_1.RouterConnectionLog.create({
            routerId: routerRecord.id,
            tenantId,
            action: 'DISCONNECT',
            status: 'SUCCESS',
            details: 'Router removed from billing system',
            userId
        });
        // Delete router
        await routerRecord.destroy();
        res.json({
            success: true,
            message: 'Router removed successfully',
            rollbackScript,
            note: 'Optional: Run the rollback script on your router to remove Jevish configuration'
        });
    }
    catch (error) {
        logger_1.default.error('Failed to delete router', { error: error.message });
        res.status(500).json({ error: 'Failed to delete router' });
    }
});
/**
 * GET /api/v1/routers/:id/discovery
 * Discover connected devices (DHCP leases) on the router
 */
router.get('/:id/discovery', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const routerRecord = await models_1.Router.findOne({
            where: { id, tenantId }
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        const leases = await mikrotik_service_1.MikroTikService.getDhcpLeases(routerRecord);
        res.json({ success: true, devices: leases });
    }
    catch (error) {
        logger_1.default.error('Failed to discover devices', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to discover devices' });
    }
});
/**
 * GET /api/v1/routers/:id/health
 * Check router health and status
 */
router.get('/:id/health', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const routerRecord = await models_1.Router.findOne({
            where: { id, tenantId }
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        // Test connection
        const connectionTest = await mikrotik_service_1.MikroTikService.testConnection(routerRecord);
        // Update online status
        await routerRecord.update({
            isOnline: connectionTest.status,
            lastSeen: connectionTest.status ? new Date() : routerRecord.lastSeen
        });
        res.json({
            online: connectionTest.status,
            message: connectionTest.message,
            lastSeen: routerRecord.lastSeen,
            identity: connectionTest.identity,
            version: connectionTest.version
        });
    }
    catch (error) {
        logger_1.default.error('Health check failed', { error: error.message });
        res.status(500).json({
            online: false,
            error: 'Health check failed',
            message: error.message
        });
    }
});
/**
 * POST /api/v1/routers/:id/test
 * Test router connection
 */
router.post('/:id/test', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const routerRecord = await models_1.Router.findOne({
            where: { id, tenantId }
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        const testResult = await mikrotik_service_1.MikroTikService.testConnection(routerRecord);
        await models_1.RouterConnectionLog.create({
            routerId: routerRecord.id,
            tenantId,
            action: 'TEST',
            status: testResult.status ? 'SUCCESS' : 'FAILED',
            details: testResult.message,
            metadata: JSON.stringify({
                version: testResult.version,
                identity: testResult.identity
            }),
            userId
        });
        res.json({
            success: testResult.status,
            message: testResult.message,
            version: testResult.version,
            identity: testResult.identity
        });
    }
    catch (error) {
        logger_1.default.error('Connection test failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Connection test failed',
            message: error.message
        });
    }
});
exports.default = router;
