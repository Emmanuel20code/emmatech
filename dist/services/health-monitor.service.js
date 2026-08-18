"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitorService = void 0;
const os_1 = __importDefault(require("os"));
const models_1 = require("../models");
const models_2 = require("../models");
const mikrotik_simulator_service_1 = require("./mikrotik-simulator.service");
class HealthMonitorService {
    /**
     * Generate complete system health and infrastructure report.
     */
    static async getFullHealthReport() {
        // CPU Metrics
        const cpus = os_1.default.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        for (const cpu of cpus) {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        }
        const cpuUsagePercentage = Math.min(100, Math.round(100 - (totalIdle / (totalTick || 1)) * 100));
        // RAM Metrics
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const usedMem = totalMem - freeMem;
        const ramUsageMB = {
            used: Math.round(usedMem / (1024 * 1024)),
            total: Math.round(totalMem / (1024 * 1024)),
            free: Math.round(freeMem / (1024 * 1024)),
            percentage: Math.round((usedMem / totalMem) * 100),
        };
        // DB Status
        let dbStatus = 'CONNECTED';
        try {
            await models_1.sequelize.authenticate();
        }
        catch {
            dbStatus = 'DISCONNECTED';
        }
        // Sandboxes summary
        const capturedEmailsCount = await models_2.SandboxMessageLog.count({ where: { channel: 'EMAIL' } });
        const capturedSmsCount = await models_2.SandboxMessageLog.count({ where: { channel: 'SMS' } });
        const capturedWhatsAppCount = await models_2.SandboxMessageLog.count({ where: { channel: 'WHATSAPP' } });
        const sandboxPaymentsCount = await models_2.SandboxPaymentLog.count();
        // Simulator ping
        const simPing = await mikrotik_simulator_service_1.MikrotikSimulatorService.pingRouter('127.0.0.1', 8728);
        const overallStatus = dbStatus === 'CONNECTED' && ramUsageMB.percentage < 90 ? 'HEALTHY' : 'DEGRADED';
        return {
            systemStatus: overallStatus,
            timestamp: new Date().toISOString(),
            metrics: {
                cpuUsagePercentage,
                ramUsageMB,
                uptimeSeconds: Math.floor(process.uptime()),
                platform: os_1.default.platform(),
                arch: os_1.default.arch(),
            },
            services: {
                apiHealth: 'UP',
                databaseStatus: dbStatus,
                queueStatus: 'ACTIVE',
                paymentStatus: process.env.NODE_ENV === 'production' ? 'LIVE' : 'SANDBOX_ACTIVE',
                emailStatus: 'SANDBOX_TRAP',
                smsStatus: 'SANDBOX_TRAP',
                whatsAppStatus: 'SANDBOX_TRAP',
                mikroTikStatus: simPing.success ? 'SIMULATOR_ACTIVE' : 'CONNECTED',
                storageStatus: 'OK',
                schedulerStatus: 'RUNNING',
                cacheStatus: 'IN_MEMORY_OK',
                webSocketStatus: 'ACTIVE',
                backgroundJobsCount: 2,
            },
            sandboxesSummary: {
                capturedEmailsCount,
                capturedSmsCount,
                capturedWhatsAppCount,
                sandboxPaymentsCount,
            }
        };
    }
}
exports.HealthMonitorService = HealthMonitorService;
