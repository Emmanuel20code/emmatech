import { Router } from 'express';
import { UltimateSuperAdminControlService } from '../services/ultimate-superadmin-control.service';
import logger from '../utils/logger';

const router = Router();

// Global Platform Search
router.get('/search', async (req: any, res) => {
    try {
        const query = (req.query.q as string) || '';
        const results = await UltimateSuperAdminControlService.globalSearch(query);
        res.json(results);
    } catch (error: any) {
        logger.error('Error in global search', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Tenant 360 Deep Inspection
router.get('/tenant-360/:id', async (req: any, res) => {
    try {
        const data = await UltimateSuperAdminControlService.getTenant360Inspection(req.params.id);
        res.json(data);
    } catch (error: any) {
        logger.error('Error in tenant 360 inspection', { error: error.message });
        res.status(404).json({ error: error.message });
    }
});

// Live Real-Time Activity Feed
router.get('/activity-stream', async (_req, res) => {
    try {
        const stream = await UltimateSuperAdminControlService.getLiveActivityStream();
        res.json(stream);
    } catch (error: any) {
        logger.error('Error fetching activity stream', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// One-Click Actions (Diagnostics, Clear Cache, Retry Webhooks, Restart Router, Approve Refund)
router.post('/action', async (req: any, res) => {
    try {
        const { actionType, targetId, payload } = req.body;
        const result = await UltimateSuperAdminControlService.executeOneClickAction(
            actionType,
            targetId,
            payload || {},
            req.user?.id || 'SUPER_ADMIN'
        );
        res.json(result);
    } catch (error: any) {
        logger.error('Error executing one-click action', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

// Unified Report Exporter
router.get('/reports/export', async (req: any, res) => {
    try {
        const reportType = (req.query.type as string) || 'revenue';
        const data = await UltimateSuperAdminControlService.getUnifiedReportData(reportType);

        if (req.query.format === 'csv') {
            if (data.length === 0) return res.send('No data available');
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => Object.values(row).join(','));
            const csv = [headers, ...rows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report.csv`);
            return res.send(csv);
        }

        res.json(data);
    } catch (error: any) {
        logger.error('Error exporting report', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
