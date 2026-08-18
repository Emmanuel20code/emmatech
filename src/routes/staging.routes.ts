import { Router } from 'express';
import { authorize } from '../middleware/auth';
import { HealthMonitorService } from '../services/health-monitor.service';
import { FeatureFlagService } from '../services/feature-flag.service';
import { TestingEngineService } from '../services/testing-engine.service';
import { MessageSandboxService } from '../services/message-sandbox.service';
import { PaymentSandboxService } from '../services/payment-sandbox.service';
import { MikrotikSimulatorService } from '../services/mikrotik-simulator.service';
import { SecurityScannerService } from '../services/security-scanner.service';
import { PerformanceAnalyzerService } from '../services/performance-analyzer.service';
import { ErrorTrackerService } from '../services/error-tracker.service';
import { StagingDbService } from '../services/staging-db.service';
import { DeploymentPipelineService } from '../services/deployment-pipeline.service';

const router = Router();

// Production Safety Guard: Block staging tools in production
router.use((_req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Staging environment tools are disabled in Production for data safety.' });
    }
    next();
});

// Require SUPER_ADMIN or TENANT (including TENANT_ADMIN) authorization
router.use(authorize(['SUPER_ADMIN', 'TENANT', 'TENANT_ADMIN']));

// 1. HEALTH & METRICS
router.get('/health', async (_req, res) => {
    try {
        const report = await HealthMonitorService.getFullHealthReport();
        res.json(report);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 2. FEATURE FLAGS
router.get('/feature-flags', async (req: any, res) => {
    try {
        const flags = await FeatureFlagService.getAllFlags({ isStaging: true, userId: req.user?.id });
        res.json(flags);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/feature-flags/:key', async (req, res) => {
    try {
        const flag = await FeatureFlagService.updateFlag(req.params.key, req.body);
        res.json(flag);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// 3. AUTOMATED TESTING SUITE
router.post('/run-tests', async (req: any, res) => {
    try {
        const report = await TestingEngineService.runAllAutomatedTests(req.user?.tenantId);
        res.json(report);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 4. MESSAGE SANDBOX (EMAIL, SMS, WHATSAPP)
router.get('/sandboxes/messages', async (req, res) => {
    try {
        const channel = req.query.channel as any;
        const messages = await MessageSandboxService.getCapturedMessages(channel);
        res.json(messages);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/sandboxes/messages', async (req, res) => {
    try {
        const channel = req.query.channel as any;
        const count = await MessageSandboxService.clearTrapLogs(channel);
        res.json({ success: true, clearedCount: count });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 5. PAYMENT SANDBOX
router.get('/sandboxes/payments', async (req: any, res) => {
    try {
        const logs = await PaymentSandboxService.getSandboxPaymentLogs(req.user?.tenantId);
        res.json(logs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/sandboxes/payments/simulate', async (req: any, res) => {
    try {
        const result = await PaymentSandboxService.simulatePayment({
            provider: req.body.provider || 'MPESA',
            transactionType: req.body.transactionType || 'PAYMENT',
            amount: req.body.amount || 10000,
            phoneNumber: req.body.phoneNumber,
            scenario: req.body.scenario || 'SUCCESS',
            tenantId: req.user?.tenantId || 'staging-test-tenant',
            metadata: req.body.metadata,
        });
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// 6. MIKROTIK ROUTER SIMULATOR
router.get('/mikrotik-simulator/ping', async (req, res) => {
    try {
        const ping = await MikrotikSimulatorService.pingRouter(req.query.host as string || '127.0.0.1', Number(req.query.port) || 8728);
        res.json(ping);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/mikrotik-simulator/hotspot-users', async (_req, res) => {
    try {
        const users = await MikrotikSimulatorService.getHotspotUsers();
        res.json(users);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/mikrotik-simulator/hotspot-users', async (req, res) => {
    try {
        const user = await MikrotikSimulatorService.createHotspotUser(req.body);
        res.status(201).json(user);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.get('/mikrotik-simulator/queues', async (_req, res) => {
    try {
        const queues = await MikrotikSimulatorService.getQueues();
        res.json(queues);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 7. SECURITY SCANNER
router.get('/security-audit', async (_req, res) => {
    try {
        const report = await SecurityScannerService.runSecurityScan();
        res.json(report);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 8. PERFORMANCE BENCHMARK
router.get('/performance', async (_req, res) => {
    try {
        const report = await PerformanceAnalyzerService.runBenchmark();
        res.json(report);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 9. ERROR TRACKER
router.get('/errors', async (req, res) => {
    try {
        const logs = await ErrorTrackerService.getErrorLogs({
            source: req.query.source as string,
            severity: req.query.severity as string,
        });
        res.json(logs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/errors', async (_req, res) => {
    try {
        const count = await ErrorTrackerService.clearErrorLogs();
        res.json({ success: true, clearedCount: count });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 10. STAGING DATABASE SEED & ROLLBACK
router.post('/db/seed', async (_req, res) => {
    try {
        const result = await StagingDbService.seedStagingData();
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/db/backups', async (_req, res) => {
    try {
        const backups = StagingDbService.listBackups();
        res.json(backups);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 11. DEPLOYMENT PIPELINE CONTROL
router.get('/deploy/status', async (_req, res) => {
    try {
        const status = await DeploymentPipelineService.getPipelineStatus();
        res.json(status);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/deploy/trigger', async (req: any, res) => {
    try {
        const target = req.body.targetStage || 'STAGING';
        const result = await DeploymentPipelineService.triggerPipeline(target, req.user?.email || 'SuperAdmin');
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/deploy/rollback', async (req: any, res) => {
    try {
        const backupFileName = req.body.backupFileName;
        if (!backupFileName) return res.status(400).json({ error: 'backupFileName is required' });

        const result = await DeploymentPipelineService.rollback(backupFileName, req.user?.email || 'SuperAdmin');
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
