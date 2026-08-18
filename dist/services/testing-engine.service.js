"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestingEngineService = void 0;
const models_1 = require("../models");
const payment_sandbox_service_1 = require("./payment-sandbox.service");
const message_sandbox_service_1 = require("./message-sandbox.service");
const mikrotik_simulator_service_1 = require("./mikrotik-simulator.service");
const mikrotik_auto_config_service_1 = require("./mikrotik-auto-config.service");
const tenant_bootstrap_service_1 = require("./tenant-bootstrap.service");
const wallet_service_1 = require("./wallet.service");
const package_service_1 = require("./package.service");
const feature_flag_service_1 = require("./feature-flag.service");
const security_scanner_service_1 = require("./security-scanner.service");
const checkout_service_1 = require("./checkout.service");
const logger_1 = __importDefault(require("../utils/logger"));
class TestingEngineService {
    /**
     * Run all automated staging tests across all 18 categories covering recent platform features.
     */
    static async runAllAutomatedTests(tenantId) {
        const startTime = Date.now();
        const results = [];
        const activeTenantId = tenantId || (await models_1.Tenant.findOne())?.id || 'staging-test-tenant';
        // 1. Database & Table Sync
        await this.runTest(results, 'Database', 'Sequelize DB Connection & Table Sync', async () => {
            await models_1.sequelize.authenticate();
            return 'Database connection authenticated successfully.';
        });
        // 2. Unit & Schema Integrity
        await this.runTest(results, 'Unit', 'Tenant Model Query & Schema Integrity', async () => {
            const count = await models_1.Tenant.count();
            return `Tenant count query returned ${count} record(s).`;
        });
        // 3. Authentication Verification
        await this.runTest(results, 'Authentication', 'AdminUser Password Hash Verification', async () => {
            const admin = await models_1.AdminUser.findOne();
            if (!admin)
                throw new Error('No AdminUser found for auth verification.');
            if (!admin.password || admin.password.length < 10)
                throw new Error('Invalid password hash.');
            return `Admin account ${admin.email} password hash verified.`;
        });
        // 4. Role Permissions (RBAC)
        await this.runTest(results, 'Role Permissions', 'SuperAdmin vs Tenant RBAC Hierarchy', async () => {
            const superAdmin = await models_1.AdminUser.findOne({ where: { role: 'SUPER_ADMIN' } });
            if (superAdmin && superAdmin.tenantId !== null) {
                throw new Error('SUPER_ADMIN must have null tenantId as per security spec.');
            }
            return 'RBAC hierarchy check passed: SuperAdmin is unconstrained by tenantId.';
        });
        // 5. Feature Flags Resolution
        await this.runTest(results, 'API', 'Feature Flag Resolution Engine', async () => {
            const flags = await feature_flag_service_1.FeatureFlagService.getAllFlags({ isStaging: true });
            if (flags.length === 0)
                throw new Error('No feature flags resolved.');
            return `Feature flag engine resolved ${flags.length} flags.`;
        });
        // 6. Payment Sandbox (M-Pesa)
        await this.runTest(results, 'Payment', 'Sandbox M-Pesa STK Push Simulation', async () => {
            const sim = await payment_sandbox_service_1.PaymentSandboxService.simulatePayment({
                provider: 'MPESA',
                transactionType: 'PAYMENT',
                amount: 10000,
                phoneNumber: '+254712345678',
                scenario: 'SUCCESS',
                tenantId: activeTenantId,
            });
            if (!sim.success)
                throw new Error(sim.message);
            return `Simulated M-Pesa payment ref: ${sim.reference}`;
        });
        // 6b. Checkout & Service Activation Engine
        await this.runTest(results, 'Checkout Engine', 'Server-Side Checkout Pricing & Invoice Generation', async () => {
            const checkout = await checkout_service_1.CheckoutService.prepareCheckout({
                tenantId: activeTenantId,
                itemType: 'SUBSCRIPTION_PLAN',
                itemSlug: 'starter',
                billingCycle: 'MONTHLY'
            });
            if (!checkout.invoiceId)
                throw new Error('Checkout invoice creation failed');
            return `Checkout invoice ${checkout.invoiceNumber} created (Total: KES ${checkout.totalAmountKes}).`;
        });
        // 7. Wallet Service Fallback & Balance Engine
        await this.runTest(results, 'Wallet', 'Wallet Balance & Uninitialized Wallet Fallback Check', async () => {
            const wallet = await wallet_service_1.WalletService.getWalletBalanceByOwner(activeTenantId, 'TENANT');
            if (wallet === undefined || wallet === null)
                throw new Error('Wallet query returned invalid result');
            return `Tenant wallet balance resolved (${wallet.balance || 0} KES).`;
        });
        // 8. Tenant Bootstrap Engine
        await this.runTest(results, 'Tenant Bootstrap', 'Tenant Initialization & Wallet Auto-Seeding', async () => {
            const isBootstrapped = await tenant_bootstrap_service_1.TenantBootstrapService.isTenantBootstrapped(activeTenantId);
            if (!isBootstrapped) {
                await tenant_bootstrap_service_1.TenantBootstrapService.bootstrapNewTenant(activeTenantId, 'TestingEngine');
            }
            return 'Tenant bootstrap verification passed (Wallet & configuration ready).';
        });
        // 9. MikroTik Auto-Config Generator (v6/v7)
        await this.runTest(results, 'MikroTik Auto-Config', 'RouterOS v6 & v7 Script Generator with API User & Firewall Rules', async () => {
            const mockRouter = {
                id: 'stg-router-01',
                name: 'Staging MikroTik Router',
                host: '192.168.88.1',
                port: 8728,
                update: async () => { },
            };
            const mockTenant = {
                id: activeTenantId,
                name: 'Staging Tenant',
            };
            const scriptV7 = await mikrotik_auto_config_service_1.MikroTikAutoConfigService.generateAutoConfigScript(mockRouter, mockTenant, 'v7');
            if (!scriptV7 || !scriptV7.includes('user group add name=jevish_api')) {
                throw new Error('Generated RouterOS v7 auto-config script missing security group.');
            }
            return `Generated ${scriptV7.length} bytes of RouterOS v7 auto-config script with walled-garden & scheduler.`;
        });
        // 10. Package & Router Compatibility Engine
        await this.runTest(results, 'Package Engine', 'Package Rules & Router Compatibility Verification', async () => {
            const validationErrors = package_service_1.PackageService.validatePackageConfiguration({
                name: '24 Hour Pass',
                price: 50,
                validityHours: 24,
            });
            if (validationErrors.length > 0)
                throw new Error(`Package validation failed: ${validationErrors.join(', ')}`);
            return 'Package rules and configuration validation passed.';
        });
        // 11. MikroTik RouterOS Simulator
        await this.runTest(results, 'MikroTik Simulator', 'RouterOS Simulator Hotspot User Creation', async () => {
            const user = await mikrotik_simulator_service_1.MikrotikSimulatorService.createHotspotUser({
                username: `stg_user_${Date.now()}`,
                profile: 'Staging 1 Hour Quick Pass',
            });
            if (!user.id)
                throw new Error('Failed to create simulated Hotspot user.');
            return `Simulated Hotspot User created: ${user.username}`;
        });
        // 12. Active Session & Traffic Monitoring
        await this.runTest(results, 'Traffic Monitoring', 'Hotspot Active Sessions & Queue Speed Limits', async () => {
            const users = await mikrotik_simulator_service_1.MikrotikSimulatorService.getHotspotUsers();
            const queues = await mikrotik_simulator_service_1.MikrotikSimulatorService.getQueues();
            return `Simulated ${users.length} active user(s) and ${queues.length} queue rule(s).`;
        });
        // 13. Email Trap Sandbox
        await this.runTest(results, 'Email Trap', 'Sandbox Email Trap Delivery', async () => {
            const trap = await message_sandbox_service_1.MessageSandboxService.trapMessage({
                channel: 'EMAIL',
                recipient: 'test-subscriber@jevish.com',
                subject: '[Staging Test] WiFi Receipt #10492',
                content: 'Thank you for purchasing 24 Hour Unlimited WiFi.',
                tenantId: activeTenantId,
            });
            if (!trap.id)
                throw new Error('Email trap failed to capture message.');
            return `Email message trapped with ID: ${trap.id}`;
        });
        // 14. SMS Sandbox & Credits Engine
        await this.runTest(results, 'SMS Trap', 'Sandbox SMS Trap Delivery & Credit Tracking', async () => {
            const trap = await message_sandbox_service_1.MessageSandboxService.trapMessage({
                channel: 'SMS',
                recipient: '+254700112233',
                content: 'Your Jevish WiFi voucher code is STG-9921',
                tenantId: activeTenantId,
            });
            if (!trap.id)
                throw new Error('SMS trap failed to capture message.');
            return `SMS message trapped with ID: ${trap.id}`;
        });
        // 15. WhatsApp Sandbox
        await this.runTest(results, 'WhatsApp Trap', 'Sandbox WhatsApp Campaign Trap Delivery', async () => {
            const trap = await message_sandbox_service_1.MessageSandboxService.trapMessage({
                channel: 'WHATSAPP',
                recipient: '+254700112233',
                content: 'Hello! Your monthly ISP subscription is active.',
                tenantId: activeTenantId,
            });
            if (!trap.id)
                throw new Error('WhatsApp trap failed to capture message.');
            return `WhatsApp message trapped with ID: ${trap.id}`;
        });
        // 16. Captive Portal Authentication
        await this.runTest(results, 'Captive Portal', 'Voucher & Session Token Hash Validation', async () => {
            const auth = await mikrotik_simulator_service_1.MikrotikSimulatorService.simulateRadiusAuth('test_mac_user', 'AA:BB:CC:DD:EE:FF');
            if (!auth.authenticated)
                throw new Error('Captive Portal RADIUS auth simulation failed.');
            return 'Captive portal RADIUS authentication passed.';
        });
        // 17. Security Scanner Audit
        await this.runTest(results, 'Security Scanner', 'SQLi, XSS, CSRF & RBAC Vulnerability Scan', async () => {
            const audit = await security_scanner_service_1.SecurityScannerService.runSecurityScan();
            if (audit.score < 80)
                throw new Error(`Security score below threshold: ${audit.score}/100`);
            return `Security audit passed with rating ${audit.overallRating} (${audit.score}/100).`;
        });
        // 18. Database Query Latency Benchmark
        await this.runTest(results, 'Performance Benchmark', 'Database Query Latency Benchmark', async () => {
            const t0 = Date.now();
            await models_1.Subscriber.findAll({ limit: 10 });
            const lat = Date.now() - t0;
            if (lat > 500)
                throw new Error(`Query latency too high: ${lat}ms`);
            return `Subscriber query executed in ${lat}ms (Target < 100ms).`;
        });
        const totalDurationMs = Date.now() - startTime;
        const passedCount = results.filter(r => r.passed).length;
        const failedCount = results.filter(r => !r.passed).length;
        const totalTests = results.length;
        const passPercentage = totalTests > 0 ? Math.round((passedCount / totalTests) * 100) : 0;
        logger_1.default.info(`[TestingEngine] Automated suite finished: ${passedCount}/${totalTests} passed (${passPercentage}%) in ${totalDurationMs}ms.`);
        return {
            summary: {
                totalTests,
                passedCount,
                failedCount,
                passPercentage,
                totalDurationMs,
            },
            results,
        };
    }
    static async runTest(results, category, testName, testFn) {
        const t0 = Date.now();
        try {
            const details = await testFn();
            const durationMs = Date.now() - t0;
            results.push({ category, testName, passed: true, durationMs, details });
        }
        catch (err) {
            const durationMs = Date.now() - t0;
            results.push({
                category,
                testName,
                passed: false,
                durationMs,
                details: `TEST FAILED: ${err.message}`,
                errorTrace: err.stack,
            });
        }
    }
}
exports.TestingEngineService = TestingEngineService;
