"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentPipelineService = void 0;
const testing_engine_service_1 = require("./testing-engine.service");
const staging_db_service_1 = require("./staging-db.service");
const logger_1 = __importDefault(require("../utils/logger"));
class DeploymentPipelineService {
    static { this.currentStage = 'STAGING'; }
    static { this.lastTestReport = null; }
    static { this.lastBackupPath = null; }
    static { this.history = [
        {
            stage: 'STAGING',
            timestamp: new Date().toISOString(),
            deployedBy: 'System Auto-Deploy',
            status: 'SUCCESS',
            notes: 'Staging environment initialized and ready for automated testing. Target Production IP: 154.154.252.228',
        }
    ]; }
    /**
     * Get deployment pipeline status.
     */
    static async getPipelineStatus() {
        const backupsList = staging_db_service_1.StagingDbService.listBackups();
        const isBlocked = this.lastTestReport ? this.lastTestReport.summary.failedCount > 0 : false;
        return {
            currentEnvironment: process.env.NODE_ENV || 'staging',
            productionServerIp: '154.154.252.228',
            pipelineStage: this.currentStage,
            isProductionDeployBlocked: isBlocked,
            lastTestReport: this.lastTestReport,
            lastBackupPath: this.lastBackupPath,
            backupsList,
            deploymentHistory: this.history,
        };
    }
    /**
     * Trigger deployment pipeline.
     */
    static async triggerPipeline(targetStage, deployedBy) {
        logger_1.default.info(`[DeploymentPipeline] Triggering pipeline step to ${targetStage} by ${deployedBy}`);
        // 1. Automatic Pre-Deployment Backup
        const backupPath = await staging_db_service_1.StagingDbService.createBackup();
        this.lastBackupPath = backupPath;
        // 2. Execute Automated Tests
        const testReport = await testing_engine_service_1.TestingEngineService.runAllAutomatedTests();
        this.lastTestReport = testReport;
        // 3. Check for Blocked Production Deployment
        if (targetStage === 'PRODUCTION' && testReport.summary.failedCount > 0) {
            this.history.unshift({
                stage: 'PRODUCTION',
                timestamp: new Date().toISOString(),
                deployedBy,
                status: 'BLOCKED',
                notes: `Production deployment BLOCKED: ${testReport.summary.failedCount} test(s) failed.`,
            });
            throw new Error(`DEPLOYMENT_BLOCKED: Cannot deploy to Production while ${testReport.summary.failedCount} test(s) are failing.`);
        }
        // 4. Update Pipeline Stage
        this.currentStage = targetStage === 'PRODUCTION' ? 'PRODUCTION' : 'STAGING';
        this.history.unshift({
            stage: targetStage,
            timestamp: new Date().toISOString(),
            deployedBy,
            status: 'SUCCESS',
            notes: `Successfully deployed to ${targetStage}. All ${testReport.summary.passedCount} tests passed.`,
        });
        return {
            success: true,
            message: `Deployment to ${targetStage} completed successfully. Pre-deployment backup created at ${backupPath}`,
            testReport,
            backupPath,
        };
    }
    /**
     * One-click rollback database to last backup.
     */
    static async rollback(backupFileName, rolledBackBy) {
        await staging_db_service_1.StagingDbService.rollbackToBackup(backupFileName);
        this.history.unshift({
            stage: 'ROLLBACK',
            timestamp: new Date().toISOString(),
            deployedBy: rolledBackBy,
            status: 'ROLLED_BACK',
            notes: `System rolled back database to ${backupFileName}`,
        });
        return {
            success: true,
            message: `Database successfully rolled back to ${backupFileName}`,
        };
    }
}
exports.DeploymentPipelineService = DeploymentPipelineService;
