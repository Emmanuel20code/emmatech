"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const health_monitor_service_1 = require("../services/health-monitor.service");
const feature_flag_service_1 = require("../services/feature-flag.service");
const testing_engine_service_1 = require("../services/testing-engine.service");
const message_sandbox_service_1 = require("../services/message-sandbox.service");
const payment_sandbox_service_1 = require("../services/payment-sandbox.service");
const mikrotik_simulator_service_1 = require("../services/mikrotik-simulator.service");
const security_scanner_service_1 = require("../services/security-scanner.service");
const performance_analyzer_service_1 = require("../services/performance-analyzer.service");
const error_tracker_service_1 = require("../services/error-tracker.service");
const staging_db_service_1 = require("../services/staging-db.service");
const deployment_pipeline_service_1 = require("../services/deployment-pipeline.service");
const router = (0, express_1.Router)();
// Production Safety Guard: Block staging tools in production
router.use((_req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Staging environment tools are disabled in Production for data safety.' });
    }
    next();
});
// Require SUPER_ADMIN or TENANT (including TENANT_ADMIN) authorization
router.use((0, auth_1.authorize)(['SUPER_ADMIN', 'TENANT', 'TENANT_ADMIN']));
// 1. HEALTH & METRICS
router.get('/health', async (_req, res) => {
    try {
        const report = await health_monitor_service_1.HealthMonitorService.getFullHealthReport();
        res.json(report);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 2. FEATURE FLAGS
router.get('/feature-flags', async (req, res) => {
    try {
        const flags = await feature_flag_service_1.FeatureFlagService.getAllFlags({ isStaging: true, userId: req.user?.id });
        res.json(flags);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.put('/feature-flags/:key', async (req, res) => {
    try {
        const flag = await feature_flag_service_1.FeatureFlagService.updateFlag(req.params.key, req.body);
        res.json(flag);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// 3. AUTOMATED TESTING SUITE
router.post('/run-tests', async (req, res) => {
    try {
        const report = await testing_engine_service_1.TestingEngineService.runAllAutomatedTests(req.user?.tenantId);
        res.json(report);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 4. MESSAGE SANDBOX (EMAIL, SMS, WHATSAPP)
router.get('/sandboxes/messages', async (req, res) => {
    try {
        const channel = req.query.channel;
        const messages = await message_sandbox_service_1.MessageSandboxService.getCapturedMessages(channel);
        res.json(messages);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/sandboxes/messages', async (req, res) => {
    try {
        const channel = req.query.channel;
        const count = await message_sandbox_service_1.MessageSandboxService.clearTrapLogs(channel);
        res.json({ success: true, clearedCount: count });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 5. PAYMENT SANDBOX
router.get('/sandboxes/payments', async (req, res) => {
    try {
        const logs = await payment_sandbox_service_1.PaymentSandboxService.getSandboxPaymentLogs(req.user?.tenantId);
        res.json(logs);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/sandboxes/payments/simulate', async (req, res) => {
    try {
        const result = await payment_sandbox_service_1.PaymentSandboxService.simulatePayment({
            provider: req.body.provider || 'MPESA',
            transactionType: req.body.transactionType || 'PAYMENT',
            amount: req.body.amount || 10000,
            phoneNumber: req.body.phoneNumber,
            scenario: req.body.scenario || 'SUCCESS',
            tenantId: req.user?.tenantId || 'staging-test-tenant',
            metadata: req.body.metadata,
        });
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// 6. MIKROTIK ROUTER SIMULATOR
router.get('/mikrotik-simulator/ping', async (req, res) => {
    try {
        const ping = await mikrotik_simulator_service_1.MikrotikSimulatorService.pingRouter(req.query.host || '127.0.0.1', Number(req.query.port) || 8728);
        res.json(ping);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/mikrotik-simulator/hotspot-users', async (_req, res) => {
    try {
        const users = await mikrotik_simulator_service_1.MikrotikSimulatorService.getHotspotUsers();
        res.json(users);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/mikrotik-simulator/hotspot-users', async (req, res) => {
    try {
        const user = await mikrotik_simulator_service_1.MikrotikSimulatorService.createHotspotUser(req.body);
        res.status(201).json(user);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.get('/mikrotik-simulator/queues', async (_req, res) => {
    try {
        const queues = await mikrotik_simulator_service_1.MikrotikSimulatorService.getQueues();
        res.json(queues);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 7. SECURITY SCANNER
router.get('/security-audit', async (_req, res) => {
    try {
        const report = await security_scanner_service_1.SecurityScannerService.runSecurityScan();
        res.json(report);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 8. PERFORMANCE BENCHMARK
router.get('/performance', async (_req, res) => {
    try {
        const report = await performance_analyzer_service_1.PerformanceAnalyzerService.runBenchmark();
        res.json(report);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 9. ERROR TRACKER
router.get('/errors', async (req, res) => {
    try {
        const logs = await error_tracker_service_1.ErrorTrackerService.getErrorLogs({
            source: req.query.source,
            severity: req.query.severity,
        });
        res.json(logs);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/errors', async (_req, res) => {
    try {
        const count = await error_tracker_service_1.ErrorTrackerService.clearErrorLogs();
        res.json({ success: true, clearedCount: count });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 10. STAGING DATABASE SEED & ROLLBACK
router.post('/db/seed', async (_req, res) => {
    try {
        const result = await staging_db_service_1.StagingDbService.seedStagingData();
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/db/backups', async (_req, res) => {
    try {
        const backups = staging_db_service_1.StagingDbService.listBackups();
        res.json(backups);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 11. DEPLOYMENT PIPELINE CONTROL
router.get('/deploy/status', async (_req, res) => {
    try {
        const status = await deployment_pipeline_service_1.DeploymentPipelineService.getPipelineStatus();
        res.json(status);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/deploy/trigger', async (req, res) => {
    try {
        const target = req.body.targetStage || 'STAGING';
        const result = await deployment_pipeline_service_1.DeploymentPipelineService.triggerPipeline(target, req.user?.email || 'SuperAdmin');
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post('/deploy/rollback', async (req, res) => {
    try {
        const backupFileName = req.body.backupFileName;
        if (!backupFileName)
            return res.status(400).json({ error: 'backupFileName is required' });
        const result = await deployment_pipeline_service_1.DeploymentPipelineService.rollback(backupFileName, req.user?.email || 'SuperAdmin');
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
