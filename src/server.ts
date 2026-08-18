import { config } from './config/env';
import express from 'express';
import { ContextService } from './services/context.service';
import { SchemaService } from './services/schema.service';
import { createServer } from 'http';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
let sequelize: any;
import authRoutes from './routes/auth';
import portalRoutes from './routes/portal';
import adminRoutes from './routes/admin';
import agentRoutes from './routes/agent';
import superadminRoutes from './routes/superadmin';
import webhookRoutes from './routes/webhook';
import walletRoutes from './routes/wallet.routes';
import paymentCallbackRoutes from './routes/payment-callback.routes';
import aggregatorCallbackRoutes from './routes/aggregator-callback.routes';
import routerRoutes from './routes/router.routes';
import packageRoutes from './routes/package.routes';
import routerControlRoutes from './routes/router-control.routes';
import routerPowerRoutes from './routes/router-power.routes';
import routerOnboardPublicRoutes from './routes/router-onboard-public.routes';
import radiusRoutes from './routes/radius.routes';
import campaignRoutes from './routes/campaigns';
import smsGatewayRoutes from './routes/sms-gateway.routes';
import smsRoutes from './routes/sms.routes';
import profileRoutes from './routes/profile.routes';
import marketingRoutes from './routes/marketing.routes';
import superAdminSaasRoutes from './routes/superadmin-saas.routes';
import tenantSaasRoutes from './routes/tenant-saas.routes';
import reportsRoutes from './routes/reports.routes';
import refundRoutes from './routes/refund.routes';
import subscriberRoutes from './routes/subscriber.routes';
import deviceBindingRoutes from './routes/device-binding.routes';
import brandingRoutes from './routes/branding.routes';
import ultimateSuperAdminRoutes from './routes/ultimate-superadmin-control.routes';
import intasendWebhookRoutes from './routes/intasend-webhook.routes';
import platformOwnerRoutes from './routes/platform-owner.routes';
import payheroRoutes from './routes/payhero.routes';
import checkoutRoutes from './routes/checkout.routes';
import enterpriseCrmRoutes from './routes/enterprise-crm.routes';
import smsProcurementRoutes from './routes/sms-procurement.routes';
import platformBillingRoutes from './routes/platform-billing.routes';
import subscriptionEnforcementRoutes from './routes/subscription-enforcement.routes';
import { subscriptionEnforcerMiddleware } from './middleware/subscription-enforcer.middleware';
import { DormantRouterService } from './services/dormant-router.service';
import { IspService } from './services/isp.service';
import { SettlementEngine } from './services/settlement-engine';
import { TrafficMonitorService } from './services/traffic-monitor.service';
import { ProductionService } from './services/production.service';
import { SocketService } from './services/socket.service';
import { TemplateSeeder } from './services/template-seeder';
import logger from './utils/logger';
import { TenantResolver } from './middleware/tenant-resolver';
import { ErrorHandler } from './middleware/error-handler';

const app = express();

// Set search path context
app.use((req, res, next) => {
    const tenantIdFromHeader = req.headers['x-tenant-id'] as string;
    
    ContextService.runWithTenant(tenantIdFromHeader || null, async () => {
        try {
            if (tenantIdFromHeader) {
                await SchemaService.setSearchPath(tenantIdFromHeader);
            }
        } catch (e) {}
        next();
    });
});

// Trust proxy (required for Cloudflare / reverse proxy to resolve real client IPs)
app.set('trust proxy', 1);

// SECURITY HARDENING - Configured to permit preview embedding in AI Studio iframe
app.use(helmet({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false,
    referrerPolicy: { policy: 'no-referrer-when-downgrade' }
}));

// CORS Configuration
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'X-Requested-With']
}));

// GLOBAL RATE LIMITING
const getClientIp = (req: any) => {
    try {
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            const ipString = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
            return ipString.split(',')[0].trim();
        }
    } catch (e) {
        // Safe fallback
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100000,
    message: 'Too many requests, please try again later.',
    validate: false,
    keyGenerator: getClientIp,
    skip: (req: any) => {
        const url = req.originalUrl || req.url || '';
        return url.includes('/api/v1/marketing') || url.includes('/marketing');
    }
});
app.use('/api/', globalLimiter);

// STRICT RATE LIMITING (Auth & Payments)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20000,
    message: 'Security threshold reached. Please try again later.',
    validate: false,
    keyGenerator: getClientIp,
});

// SUPER ADMIN RATE LIMITING
const superAdminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50000,
    message: 'Super Admin rate limit reached. Please try again later.',
    validate: false,
    keyGenerator: getClientIp,
});

app.use(bodyParser.json({
    limit: '10kb',
    verify: (req: any, _res, buf) => {
        req.rawBody = buf;
    }
}));
// app.use(express.static('public', { index: false }));

// REQUEST LOGGING
app.use((req, _res, next) => {
    if (req.url.startsWith('/src/') || req.url.startsWith('/@') || req.url.startsWith('/node_modules/') || req.url.includes('favicon')) {
        return next();
    }
    logger.info(`${req.method} ${req.url}`, { ip: req.ip });
    next();
});

import { authMiddleware } from './middleware/auth';

// ROUTES
app.use('/api/v1/auth', strictLimiter, authRoutes);
app.use('/api/v1/platform-billing', authMiddleware, TenantResolver.resolveTenant, platformBillingRoutes);

app.use('/api/v1/portal', portalRoutes); // Public portal handle its own resolution
app.use('/api/v1/portal/:tenantId/pay', strictLimiter, portalRoutes);
app.use('/api/v1/branding', brandingRoutes);

// Authenticated Routes with Tenant Resolution
app.use('/api/v1/admin/profile', authMiddleware, TenantResolver.resolveTenant, profileRoutes);
app.use('/api/v1/admin', authMiddleware, TenantResolver.resolveTenant, adminRoutes);
app.use('/api/v1/agent', authMiddleware, TenantResolver.resolveTenant, agentRoutes);
app.use('/api/v1/wallet', authMiddleware, TenantResolver.resolveTenant, walletRoutes);
app.use('/api/v1/campaigns', authMiddleware, TenantResolver.resolveTenant, campaignRoutes);

app.use('/api/v1/marketing', authMiddleware, TenantResolver.resolveTenant, marketingRoutes);
app.use('/api/v1/superadmin', authMiddleware, superAdminLimiter, superadminRoutes);
app.use('/api/v1/superadmin/ultimate', authMiddleware, superAdminLimiter, ultimateSuperAdminRoutes);
app.use('/api/v1/superadmin/saas', authMiddleware, superAdminLimiter, superAdminSaasRoutes);
app.use('/api/v1/superadmin/sms', authMiddleware, superAdminLimiter, smsGatewayRoutes);
app.use('/api/v1/superadmin/sms-procurement', authMiddleware, superAdminLimiter, smsProcurementRoutes);
app.use('/api/v1/platform-owner', platformOwnerRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/enterprise', enterpriseCrmRoutes);
app.use('/api/v1/subscription', subscriptionEnforcementRoutes);
app.use('/api/v1/tenant/saas', authMiddleware, TenantResolver.resolveTenant, subscriptionEnforcerMiddleware, tenantSaasRoutes);
app.use('/api/v1/sms', authMiddleware, TenantResolver.resolveTenant, subscriptionEnforcerMiddleware, smsRoutes);
app.use('/api/v1/admin/reports', authMiddleware, TenantResolver.resolveTenant, subscriptionEnforcerMiddleware, reportsRoutes);
app.use('/api/v1/admin/refunds', authMiddleware, TenantResolver.resolveTenant, subscriptionEnforcerMiddleware, refundRoutes);
app.use('/api/v1/admin/subscribers', authMiddleware, TenantResolver.resolveTenant, subscriptionEnforcerMiddleware, subscriberRoutes);
app.use('/api/v1/subscribers', authMiddleware, TenantResolver.resolveTenant, subscriptionEnforcerMiddleware, subscriberRoutes);
app.use('/api/v1/admin/device-bindings', authMiddleware, TenantResolver.resolveTenant, subscriptionEnforcerMiddleware, deviceBindingRoutes);

// WEBHOOK RATE LIMITING (Prevent webhook flooding)
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: 'Webhook rate limit exceeded',
    validate: false,
});
app.use('/api/v1/payments', payheroRoutes);
app.use('/api/v1/payhero', payheroRoutes);
app.use('/api/v1/webhooks/saas', webhookLimiter, intasendWebhookRoutes);
app.use('/api/v1/webhooks', webhookLimiter, webhookRoutes);
app.use('/api/v1/aggregator', aggregatorCallbackRoutes);
app.use('/api/v1/payments/callback', paymentCallbackRoutes);
app.use('/api/v1/payment-callback', paymentCallbackRoutes);
app.use('/api/v1/routers/onboard', routerOnboardPublicRoutes);
app.use('/api/v1/routers', authMiddleware, routerRoutes);
app.use('/api/v1/packages', authMiddleware, packageRoutes);
app.use('/api/v1/routers', authMiddleware, routerControlRoutes);
app.use('/api/v1/routers', authMiddleware, routerPowerRoutes);
app.use('/api/v1/radius', authMiddleware, radiusRoutes);

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
    } catch (error) {
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
        const { sequelize: _sequelize } = await import('./models');
        sequelize = _sequelize;
        try {
            await Promise.race([
                sequelize.authenticate(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout (8s)')), 8000))
            ]);
            logger.info('Database connection established successfully.');
        } catch (err) {
            logger.warn('Database connection warning/timeout. Continuing server startup without blocking:', { error: (err as Error).message });
        }

        try {
            await Promise.race([
                sequelize.sync({ alter: false }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Database sync timeout (8s)')), 8000))
            ]);
            try { await sequelize.query('ALTER TABLE "saas_invoices" ADD COLUMN IF NOT EXISTS "metadata" TEXT;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "saas_invoices" ADD COLUMN IF NOT EXISTS "subtotalCents" BIGINT DEFAULT 0;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "saas_invoices" ADD COLUMN IF NOT EXISTS "taxCents" BIGINT DEFAULT 0;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "platform_pricing_configs" ADD COLUMN IF NOT EXISTS "subscriptionTillNumber" TEXT;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "sms_financial_ledgers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "sms_ledger_transactions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "routers" ADD COLUMN IF NOT EXISTS "onboardToken" VARCHAR(255);'); } catch (_) {}
            
            // Fix Payment columns
            try { await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payheroReference" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payheroCheckoutId" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payheroStatus" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "destinationType" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "destinationAccount" VARCHAR(255);'); } catch (_) {}
            
            logger.info('Database schema sync applied: PayHero columns checked.');
            
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
            } catch (e) {
                logger.warn('Failed to ensure payment_verification_audits table:', (e as Error).message);
            }
            
            // Explicitly fix Tenants columns with correct quoting for Postgres
            try { await sequelize.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP WITH TIME ZONE;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscriptionStatus" VARCHAR(255) DEFAULT \'TRIAL\';'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "nextPaymentDueDate" TIMESTAMP WITH TIME ZONE;'); } catch (_) {}
            
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "description" TEXT;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "validity" INTEGER;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "uploadSpeed" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "downloadSpeed" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstUpload" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstDownload" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstThreshold" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "burstTime" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 8;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "sharedUsers" INTEGER DEFAULT 1;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "expiryAction" VARCHAR(255) DEFAULT \'SUSPEND\';'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN DEFAULT true;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "category" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "mikrotikProfile" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "limitAtTime" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "parentQueue" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query(`ALTER TYPE enum_packages_type ADD VALUE IF NOT EXISTS 'PPPOE';`); } catch (_) {}
            try { await sequelize.query(`ALTER TYPE enum_packages_type ADD VALUE IF NOT EXISTS 'PPPoE';`); } catch (_) {}
            try { await sequelize.query(`ALTER TYPE enum_packages_type ADD VALUE IF NOT EXISTS 'VOUCHER';`); } catch (_) {}
            
            // Fix missing columns for TenantCaptivePortalBranding
            try { await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "landingHeroTitle" VARCHAR(255);'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "landingHeroSubtitle" TEXT;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "showLandingHero" BOOLEAN DEFAULT true;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "packageCardLayout" VARCHAR(255) DEFAULT \'GRID_2COL\';'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "packageCardStyle" VARCHAR(255) DEFAULT \'GLASS\';'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "showPackageBadges" BOOLEAN DEFAULT true;'); } catch (_) {}
            try { await sequelize.query('ALTER TABLE "tenant_captive_portal_brandings" ADD COLUMN IF NOT EXISTS "showSpeedBadges" BOOLEAN DEFAULT true;'); } catch (_) {}

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
            } catch (_) {}

            logger.info('Database schema synced successfully.');
        } catch (syncErr) {
            logger.warn('Database schema sync skipped or timed out:', { error: (syncErr as Error).message });
        }

        // Auto-seed templates and initial production environment on startup
        try {
            await TemplateSeeder.seedDefaults();
            const { TenantBootstrapService } = await import('./services/tenant-bootstrap.service');
            await TenantBootstrapService.ensureInitialProductionEnvironment();
        } catch (seedErr) {
            logger.warn('Template / DB initial environment seeding skipped:', { error: (seedErr as Error).message });
        }

        // Start Background Monitoring Services
        // Start Background Monitoring Services
        // Start Background Monitoring Services
        // Start Background Monitoring Services
        console.log('[System Init] Environment Configuration: [OK]');

        TrafficMonitorService.start(30 * 1000); // Poll routers every 30 seconds

        // Schedule Production Purge (Every 24 hours)
        setInterval(() => {
            ProductionService.purgeOldData();
        }, 24 * 60 * 60 * 1000);

        // Initial purge on startup
        ProductionService.purgeOldData();

        setInterval(async () => {
            logger.info('Running automated billing/suspension checks...');
            try {
                await IspService.suspendExpiredSubscribers();

                // M-Pesa Status Polling (for delayed callbacks)
                const { PaymentService } = require('./services/payment.service');
                await PaymentService.pollPendingPayments();

            } catch (err) {
                logger.error('Background Job Failed', { error: (err as Error).message });
            }
        }, 60 * 60 * 1000); // Main cycle: 1 hour (suspensions)

        // Frequent cycle for payment polling (e.g. every 2 minutes)
        setInterval(async () => {
            try {
                const { PaymentService } = require('./services/payment.service');
                await PaymentService.pollPendingPayments();
            } catch (err) { }
        }, 2 * 60 * 1000);

        // Periodically clear matured pending balances (e.g. every 15 minutes)
        setInterval(async () => {
            try {
                const { WalletService } = require('./services/wallet.service');
                await WalletService.clearAllMaturedPendingBalances();
            } catch (err) {
                logger.error('Matured balance clearing failed', { error: (err as Error).message });
            }
        }, 15 * 60 * 1000);

        // Periodically scan for dormant routers and enforce policies (every 5 minutes)
        setInterval(async () => {
            try {
                await DormantRouterService.scanAndEnforceDormantRouters();
            } catch (err) {
                logger.error('Dormant router scan background job failed', { error: (err as Error).message });
            }
        }, 5 * 60 * 1000);

        // Initial scan on startup
        DormantRouterService.scanAndEnforceDormantRouters().catch(err => {
            logger.warn('Initial dormant router scan failed', { error: err.message });
        });

        // Daily cycle for automated settlements
        setInterval(async () => {
            logger.info('Checking for automated settlements...');
            try {
                await SettlementEngine.runAutomatedSettlements();
            } catch (err) {
                logger.error('Settlement Engine failed', { error: (err as Error).message });
            }
        }, 24 * 60 * 60 * 1000);

        // Static assets and SPA handling for Frontend App
        const path = require("path");
        const fs = require("fs");
        const distPath = path.resolve(process.cwd(), "frontend", "dist");
        const publicPath = path.resolve(process.cwd(), "frontend", "public");

        if (fs.existsSync(publicPath)) {
            app.use(express.static(publicPath));
        }
        if (fs.existsSync(distPath)) {
            app.use(express.static(distPath));
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
        app.use(ErrorHandler.handleTenantError);
        app.use(ErrorHandler.handleGeneralError);

        const httpServer = createServer(app);
        SocketService.init(httpServer);

        httpServer.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use. Please terminate any existing node processes running on this port.`);
                process.exit(1);
            } else {
                logger.error('HTTP server error:', { error: err.message });
            }
        });

        httpServer.listen(Number(PORT), "0.0.0.0", () => {
            logger.info(`Production SaaS Billing System running on port ${PORT}`);
        });
    } catch (err) {
        logger.error('Failed to start server:', { error: err });
        process.exit(1);
    }
}

startServer();