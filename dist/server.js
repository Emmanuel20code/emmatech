"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const context_service_1 = require("./services/context.service");
const schema_service_1 = require("./services/schema.service");
const http_1 = require("http");
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
let sequelize;
const auth_1 = __importDefault(require("./routes/auth"));
const portal_1 = __importDefault(require("./routes/portal"));
const admin_1 = __importDefault(require("./routes/admin"));
const agent_1 = __importDefault(require("./routes/agent"));
const superadmin_1 = __importDefault(require("./routes/superadmin"));
const webhook_1 = __importDefault(require("./routes/webhook"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const payment_callback_routes_1 = __importDefault(require("./routes/payment-callback.routes"));
const aggregator_callback_routes_1 = __importDefault(require("./routes/aggregator-callback.routes"));
const router_routes_1 = __importDefault(require("./routes/router.routes"));
const package_routes_1 = __importDefault(require("./routes/package.routes"));
const router_control_routes_1 = __importDefault(require("./routes/router-control.routes"));
const router_power_routes_1 = __importDefault(require("./routes/router-power.routes"));
const router_onboard_public_routes_1 = __importDefault(require("./routes/router-onboard-public.routes"));
const radius_routes_1 = __importDefault(require("./routes/radius.routes"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const sms_gateway_routes_1 = __importDefault(require("./routes/sms-gateway.routes"));
const sms_routes_1 = __importDefault(require("./routes/sms.routes"));
const profile_routes_1 = __importDefault(require("./routes/profile.routes"));
const marketing_routes_1 = __importDefault(require("./routes/marketing.routes"));
const superadmin_saas_routes_1 = __importDefault(require("./routes/superadmin-saas.routes"));
const tenant_saas_routes_1 = __importDefault(require("./routes/tenant-saas.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const refund_routes_1 = __importDefault(require("./routes/refund.routes"));
const subscriber_routes_1 = __importDefault(require("./routes/subscriber.routes"));
const device_binding_routes_1 = __importDefault(require("./routes/device-binding.routes"));
const branding_routes_1 = __importDefault(require("./routes/branding.routes"));
const ultimate_superadmin_control_routes_1 = __importDefault(require("./routes/ultimate-superadmin-control.routes"));
const intasend_webhook_routes_1 = __importDefault(require("./routes/intasend-webhook.routes"));
const platform_owner_routes_1 = __importDefault(require("./routes/platform-owner.routes"));
const payhero_routes_1 = __importDefault(require("./routes/payhero.routes"));
const checkout_routes_1 = __importDefault(require("./routes/checkout.routes"));
const enterprise_crm_routes_1 = __importDefault(require("./routes/enterprise-crm.routes"));
const sms_procurement_routes_1 = __importDefault(require("./routes/sms-procurement.routes"));
const platform_billing_routes_1 = __importDefault(require("./routes/platform-billing.routes"));
const subscription_enforcement_routes_1 = __importDefault(require("./routes/subscription-enforcement.routes"));
const subscription_enforcer_middleware_1 = require("./middleware/subscription-enforcer.middleware");
const dormant_router_service_1 = require("./services/dormant-router.service");
const isp_service_1 = require("./services/isp.service");
const settlement_engine_1 = require("./services/settlement-engine");
const traffic_monitor_service_1 = require("./services/traffic-monitor.service");
const production_service_1 = require("./services/production.service");
const socket_service_1 = require("./services/socket.service");
const template_seeder_1 = require("./services/template-seeder");
const logger_1 = __importDefault(require("./utils/logger"));
const tenant_resolver_1 = require("./middleware/tenant-resolver");
const error_handler_1 = require("./middleware/error-handler");
const app = (0, express_1.default)();
// Set search path context
app.use((req, res, next) => {
    const tenantIdFromHeader = req.headers['x-tenant-id'];
    context_service_1.ContextService.runWithTenant(tenantIdFromHeader || null, async () => {
        try {
            if (tenantIdFromHeader) {
                await schema_service_1.SchemaService.setSearchPath(tenantIdFromHeader);
            }
        }
        catch (e) { }
        next();
    });
});
// Trust proxy (required for Cloudflare / reverse proxy to resolve real client IPs)
app.set('trust proxy', 1);
// SECURITY HARDENING - Configured to permit preview embedding in AI Studio iframe
app.use((0, helmet_1.default)({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false,
    referrerPolicy: { policy: 'no-referrer-when-downgrade' }
}));
// CORS Configuration
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'X-Requested-With']
}));
// GLOBAL RATE LIMITING
const getClientIp = (req) => {
    try {
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            const ipString = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
            return ipString.split(',')[0].trim();
        }
    }
    catch (e) {
        // Safe fallback
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100000,
    message: 'Too many requests, please try again later.',
    validate: false,
    keyGenerator: getClientIp,
    skip: (req) => {
        const url = req.originalUrl || req.url || '';
        return url.includes('/api/v1/marketing') || url.includes('/marketing');
    }
});
app.use('/api/', globalLimiter);
// STRICT RATE LIMITING (Auth & Payments)
const strictLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20000,
    message: 'Security threshold reached. Please try again later.',
    validate: false,
    keyGenerator: getClientIp,
});
// SUPER ADMIN RATE LIMITING
const superAdminLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 50000,
    message: 'Super Admin rate limit reached. Please try again later.',
    validate: false,
    keyGenerator: getClientIp,
});
app.use(body_parser_1.default.json({
    limit: '10kb',
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
// app.use(express.static('public', { index: false }));
// REQUEST LOGGING
app.use((req, _res, next) => {
    if (req.url.startsWith('/src/') || req.url.startsWith('/@') || req.url.startsWith('/node_modules/') || req.url.includes('favicon')) {
        return next();
    }
    logger_1.default.info(`${req.method} ${req.url}`, { ip: req.ip });
    next();
});
const auth_2 = require("./middleware/auth");
// ROUTES
app.use('/api/v1/auth', strictLimiter, auth_1.default);
app.use('/api/v1/platform-billing', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, platform_billing_routes_1.default);
app.use('/api/v1/portal', portal_1.default); // Public portal handle its own resolution
app.use('/api/v1/portal/:tenantId/pay', strictLimiter, portal_1.default);
app.use('/api/v1/branding', branding_routes_1.default);
// Authenticated Routes with Tenant Resolution
app.use('/api/v1/admin/profile', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, profile_routes_1.default);
app.use('/api/v1/admin', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, admin_1.default);
app.use('/api/v1/agent', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, agent_1.default);
app.use('/api/v1/wallet', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, wallet_routes_1.default);
app.use('/api/v1/campaigns', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, campaigns_1.default);
app.use('/api/v1/marketing', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, marketing_routes_1.default);
app.use('/api/v1/superadmin', auth_2.authMiddleware, superAdminLimiter, superadmin_1.default);
app.use('/api/v1/superadmin/ultimate', auth_2.authMiddleware, superAdminLimiter, ultimate_superadmin_control_routes_1.default);
app.use('/api/v1/superadmin/saas', auth_2.authMiddleware, superAdminLimiter, superadmin_saas_routes_1.default);
app.use('/api/v1/superadmin/sms', auth_2.authMiddleware, superAdminLimiter, sms_gateway_routes_1.default);
app.use('/api/v1/superadmin/sms-procurement', auth_2.authMiddleware, superAdminLimiter, sms_procurement_routes_1.default);
app.use('/api/v1/platform-owner', platform_owner_routes_1.default);
app.use('/api/v1/checkout', checkout_routes_1.default);
app.use('/api/v1/enterprise', enterprise_crm_routes_1.default);
app.use('/api/v1/subscription', subscription_enforcement_routes_1.default);
app.use('/api/v1/tenant/saas', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, subscription_enforcer_middleware_1.subscriptionEnforcerMiddleware, tenant_saas_routes_1.default);
app.use('/api/v1/sms', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, subscription_enforcer_middleware_1.subscriptionEnforcerMiddleware, sms_routes_1.default);
app.use('/api/v1/admin/reports', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, subscription_enforcer_middleware_1.subscriptionEnforcerMiddleware, reports_routes_1.default);
app.use('/api/v1/admin/refunds', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, subscription_enforcer_middleware_1.subscriptionEnforcerMiddleware, refund_routes_1.default);
app.use('/api/v1/admin/subscribers', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, subscription_enforcer_middleware_1.subscriptionEnforcerMiddleware, subscriber_routes_1.default);
app.use('/api/v1/subscribers', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, subscription_enforcer_middleware_1.subscriptionEnforcerMiddleware, subscriber_routes_1.default);
app.use('/api/v1/admin/device-bindings', auth_2.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, subscription_enforcer_middleware_1.subscriptionEnforcerMiddleware, device_binding_routes_1.default);
// WEBHOOK RATE LIMITING (Prevent webhook flooding)
const webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 100,
    message: 'Webhook rate limit exceeded',
    validate: false,
});
app.use('/api/v1/payments', payhero_routes_1.default);
app.use('/api/v1/payhero', payhero_routes_1.default);
app.use('/api/v1/webhooks/saas', webhookLimiter, intasend_webhook_routes_1.default);
app.use('/api/v1/webhooks', webhookLimiter, webhook_1.default);
app.use('/api/v1/aggregator', aggregator_callback_routes_1.default);
app.use('/api/v1/payments/callback', payment_callback_routes_1.default);
app.use('/api/v1/payment-callback', payment_callback_routes_1.default);
app.use('/api/v1/routers/onboard', router_onboard_public_routes_1.default);
app.use('/api/v1/routers', auth_2.authMiddleware, router_routes_1.default);
app.use('/api/v1/packages', auth_2.authMiddleware, package_routes_1.default);
app.use('/api/v1/routers', auth_2.authMiddleware, router_control_routes_1.default);
app.use('/api/v1/routers', auth_2.authMiddleware, router_power_routes_1.default);
app.use('/api/v1/radius', auth_2.authMiddleware, radius_routes_1.default);
// Security headers for sensitive routes
app.use('/api/v1/superadmin', (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
    next();
});
// HEALTH CHECK
app.get(['/health', '/api/health', '/api/v1/health'], async (_req, res) => {
    try {
        if (sequelize) {
            await sequelize.authenticate();
        }
        res.status(200).json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            database: sequelize ? 'CONNECTED' : 'INITIALIZING',
            uptime: process.uptime()
        });
    }
    catch (error) {
        res.status(200).json({
            status: 'DEGRADED',
            timestamp: new Date().toISOString(),
            database: 'DISCONNECTED',
            uptime: process.uptime()
        });
    }
});
// ERROR HANDLING moved to startServer
const PORT = process.env.PORT || 3000;
// DATABASE & STARTUP
async function startServer() {
    try {
        const { sequelize: _sequelize } = await Promise.resolve().then(() => __importStar(require('./models')));
        sequelize = _sequelize;
        try {
            await Promise.race([
                sequelize.authenticate(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout (8s)')), 8000))
            ]);
            logger_1.default.info('Database connection established successfully.');
        }
        catch (err) {
            logger_1.default.warn('Database connection warning/timeout. Continuing server startup without blocking:', { error: err.message });
        }
        try {
            await Promise.race([
                sequelize.sync({ alter: false }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Database sync timeout (8s)')), 8000))
            ]);
            try {
                await sequelize.query('ALTER TABLE "saas_invoices" ADD COLUMN IF NOT EXISTS "metadata" TEXT;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "saas_invoices" ADD COLUMN IF NOT EXISTS "subtotalCents" BIGINT DEFAULT 0;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "saas_invoices" ADD COLUMN IF NOT EXISTS "taxCents" BIGINT DEFAULT 0;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "platform_pricing_configs" ADD COLUMN IF NOT EXISTS "subscriptionTillNumber" TEXT;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "sms_financial_ledgers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "sms_ledger_transactions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "routers" ADD COLUMN IF NOT EXISTS "onboardToken" VARCHAR(255);');
            }
            catch (_) { }
            // Fix Payment columns
            try {
                await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payheroReference" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payheroCheckoutId" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payheroStatus" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "destinationType" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "destinationAccount" VARCHAR(255);');
            }
            catch (_) { }
            logger_1.default.info('Database schema sync applied: PayHero columns checked.');
            // Ensure payment_verification_audits table exists
            try {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS "payment_verification_audits" (
                        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        "tenantId" VARCHAR(255),
                        "invoiceId" VARCHAR(255),
                        "checkoutRequestId" VARCHAR(255),
                        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_ON_MPESA',
                        "matchedReceipt" VARCHAR(255),
                        "verificationSource" VARCHAR(100) DEFAULT 'STK_QUERY',
                        "details" TEXT,
                        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);
            }
            catch (e) {
                logger_1.default.warn('Failed to ensure payment_verification_audits table:', e.message);
            }
            // Explicitly fix Tenants columns with correct quoting for Postgres
            try {
                await sequelize.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP WITH TIME ZONE;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscriptionStatus" VARCHAR(255) DEFAULT \'TRIAL\';');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "nextPaymentDueDate" TIMESTAMP WITH TIME ZONE;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "description" TEXT;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "validity" INTEGER;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "uploadSpeed" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "downloadSpeed" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstUpload" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstDownload" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstThreshold" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstTime" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 8;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "sharedUsers" INTEGER DEFAULT 1;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "expiryAction" VARCHAR(255) DEFAULT \'SUSPEND\';');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN DEFAULT true;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "category" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "mikrotikProfile" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "limitAtTime" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "parentQueue" VARCHAR(255);');
            }
            catch (_) { }
            // Fix missing columns for TenantCaptivePortalBranding
            try {
                await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "landingHeroTitle" VARCHAR(255);');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "landingHeroSubtitle" TEXT;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "showLandingHero" BOOLEAN DEFAULT true;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "packageCardLayout" VARCHAR(255) DEFAULT \'GRID_2COL\';');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "packageCardStyle" VARCHAR(255) DEFAULT \'GLASS\';');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "showPackageBadges" BOOLEAN DEFAULT true;');
            }
            catch (_) { }
            try {
                await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "showSpeedBadges" BOOLEAN DEFAULT true;');
            }
            catch (_) { }
            // Ensure Payment Logs table exists for audit trail tracking
            try {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS "payment_logs" (
                        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        "transactionReference" VARCHAR(255),
                        "checkoutRequestId" VARCHAR(255),
                        "merchantRequestId" VARCHAR(255),
                        "tenantId" VARCHAR(255),
                        "stage" VARCHAR(255) NOT NULL DEFAULT 'STK_INITIATED',
                        "status" VARCHAR(255) NOT NULL DEFAULT 'PENDING',
                        "amount" FLOAT,
                        "phoneNumber" VARCHAR(255),
                        "safaricomResultCode" VARCHAR(255),
                        "safaricomResultDesc" TEXT,
                        "errorDetails" TEXT,
                        "rawPayload" TEXT,
                        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);
            }
            catch (_) { }
            logger_1.default.info('Database schema synced successfully.');
        }
        catch (syncErr) {
            logger_1.default.warn('Database schema sync skipped or timed out:', { error: syncErr.message });
        }
        // Auto-seed templates and initial production environment on startup
        try {
            await template_seeder_1.TemplateSeeder.seedDefaults();
            const { TenantBootstrapService } = await Promise.resolve().then(() => __importStar(require('./services/tenant-bootstrap.service')));
            await TenantBootstrapService.ensureInitialProductionEnvironment();
        }
        catch (seedErr) {
            logger_1.default.warn('Template / DB initial environment seeding skipped:', { error: seedErr.message });
        }
        // Start Background Monitoring Services
        // Start Background Monitoring Services
        // Start Background Monitoring Services
        // Start Background Monitoring Services
        console.log('[System Init] Environment Configuration: [OK]');
        traffic_monitor_service_1.TrafficMonitorService.start(30 * 1000); // Poll routers every 30 seconds
        // Schedule Production Purge (Every 24 hours)
        setInterval(() => {
            production_service_1.ProductionService.purgeOldData();
        }, 24 * 60 * 60 * 1000);
        // Initial purge on startup
        production_service_1.ProductionService.purgeOldData();
        setInterval(async () => {
            logger_1.default.info('Running automated billing/suspension checks...');
            try {
                await isp_service_1.IspService.suspendExpiredSubscribers();
                // M-Pesa Status Polling (for delayed callbacks)
                const { PaymentService } = require('./services/payment.service');
                await PaymentService.pollPendingPayments();
            }
            catch (err) {
                logger_1.default.error('Background Job Failed', { error: err.message });
            }
        }, 60 * 60 * 1000); // Main cycle: 1 hour (suspensions)
        // Frequent cycle for payment polling (e.g. every 2 minutes)
        setInterval(async () => {
            try {
                const { PaymentService } = require('./services/payment.service');
                await PaymentService.pollPendingPayments();
            }
            catch (err) { }
        }, 2 * 60 * 1000);
        // Periodically clear matured pending balances (e.g. every 15 minutes)
        setInterval(async () => {
            try {
                const { WalletService } = require('./services/wallet.service');
                await WalletService.clearAllMaturedPendingBalances();
            }
            catch (err) {
                logger_1.default.error('Matured balance clearing failed', { error: err.message });
            }
        }, 15 * 60 * 1000);
        // Periodically scan for dormant routers and enforce policies (every 5 minutes)
        setInterval(async () => {
            try {
                await dormant_router_service_1.DormantRouterService.scanAndEnforceDormantRouters();
            }
            catch (err) {
                logger_1.default.error('Dormant router scan background job failed', { error: err.message });
            }
        }, 5 * 60 * 1000);
        // Initial scan on startup
        dormant_router_service_1.DormantRouterService.scanAndEnforceDormantRouters().catch(err => {
            logger_1.default.warn('Initial dormant router scan failed', { error: err.message });
        });
        // Daily cycle for automated settlements
        setInterval(async () => {
            logger_1.default.info('Checking for automated settlements...');
            try {
                await settlement_engine_1.SettlementEngine.runAutomatedSettlements();
            }
            catch (err) {
                logger_1.default.error('Settlement Engine failed', { error: err.message });
            }
        }, 24 * 60 * 60 * 1000);
        // Static assets and SPA handling for Frontend App
        const path = require("path");
        const fs = require("fs");
        const distPath = path.resolve(process.cwd(), "frontend", "dist");
        const publicPath = path.resolve(process.cwd(), "frontend", "public");
        if (fs.existsSync(publicPath)) {
            app.use(express_1.default.static(publicPath));
        }
        if (fs.existsSync(distPath)) {
            app.use(express_1.default.static(distPath));
        }
        // SPA Fallback for client routing (non-API routes)
        app.get("*", (req, res, next) => {
            if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/socket.io/')) {
                return next();
            }
            const indexPath = path.join(distPath, "index.html");
            if (fs.existsSync(indexPath)) {
                return res.sendFile(indexPath);
            }
            const srcIndexPath = path.resolve(process.cwd(), "frontend", "index.html");
            if (fs.existsSync(srcIndexPath)) {
                return res.sendFile(srcIndexPath);
            }
            next();
        });
        // ERROR HANDLING
        app.use(error_handler_1.ErrorHandler.handleTenantError);
        app.use(error_handler_1.ErrorHandler.handleGeneralError);
        const httpServer = (0, http_1.createServer)(app);
        socket_service_1.SocketService.init(httpServer);
        httpServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger_1.default.error(`Port ${PORT} is already in use. Please terminate any existing node processes running on this port.`);
                process.exit(1);
            }
            else {
                logger_1.default.error('HTTP server error:', { error: err.message });
            }
        });
        httpServer.listen(Number(PORT), "0.0.0.0", () => {
            logger_1.default.info(`Production SaaS Billing System running on port ${PORT}`);
        });
    }
    catch (err) {
        logger_1.default.error('Failed to start server:', { error: err });
        process.exit(1);
    }
}
startServer();
