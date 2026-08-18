import { TestingEngineService, AutomatedSuiteReport } from './testing-engine.service';
import { StagingDbService } from './staging-db.service';
import logger from '../utils/logger';

export interface DeploymentPipelineStatus {
    currentEnvironment: string;
    productionServerIp: string;
    pipelineStage: 'DEVELOPER' | 'DEVELOPMENT' | 'AUTOMATED_TESTS' | 'STAGING' | 'MANUAL_APPROVAL' | 'PRODUCTION';
    isProductionDeployBlocked: boolean;
    lastTestReport: AutomatedSuiteReport | null;
    lastBackupPath: string | null;
    backupsList: Array<{ name: string; path: string; sizeBytes: number; createdAt: Date }>;
    deploymentHistory: Array<{
        stage: string;
        timestamp: string;
        deployedBy: string;
        status: 'SUCCESS' | 'BLOCKED' | 'ROLLED_BACK';
        notes: string;
    }>;
}

export class DeploymentPipelineService {
    private static currentStage: 'DEVELOPER' | 'DEVELOPMENT' | 'AUTOMATED_TESTS' | 'STAGING' | 'MANUAL_APPROVAL' | 'PRODUCTION' = 'STAGING';
    private static lastTestReport: AutomatedSuiteReport | null = null;
    private static lastBackupPath: string | null = null;

    private static history: Array<{
        stage: string;
        timestamp: string;
        deployedBy: string;
        status: 'SUCCESS' | 'BLOCKED' | 'ROLLED_BACK';
        notes: string;
    }> = [
        {
            stage: 'STAGING',
            timestamp: new Date().toISOString(),
            deployedBy: 'System Auto-Deploy',
            status: 'SUCCESS',
            notes: 'Staging environment initialized and ready for automated testing. Target Production IP: 154.154.252.228',
        }
    ];

    /**
     * Get deployment pipeline status.
     */
    static async getPipelineStatus(): Promise<DeploymentPipelineStatus> {
        const backupsList = StagingDbService.listBackups();
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
    static async triggerPipeline(targetStage: 'STAGING' | 'PRODUCTION', deployedBy: string): Promise<{
        success: boolean;
        message: string;
        testReport: AutomatedSuiteReport;
        backupPath: string;
    }> {
        logger.info(`[DeploymentPipeline] Triggering pipeline step to ${targetStage} by ${deployedBy}`);

        // 1. Automatic Pre-Deployment Backup
        const backupPath = await StagingDbService.createBackup();
        this.lastBackupPath = backupPath;

        // 2. Execute Automated Tests
        const testReport = await TestingEngineService.runAllAutomatedTests();
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
    static async rollback(backupFileName: string, rolledBackBy: string): Promise<{ success: boolean; message: string }> {
        await StagingDbService.rollbackToBackup(backupFileName);

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
