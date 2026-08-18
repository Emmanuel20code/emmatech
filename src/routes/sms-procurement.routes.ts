import { Router } from 'express';
import { SmsProcurementService } from '../services/sms-procurement.service';
import logger from '../utils/logger';

const router = Router();

// 1. GET Super Admin SMS Financial Overview Summary
router.get('/summary', async (_req: any, res: any) => {
    try {
        const summary = await SmsProcurementService.getFinancialSummary();
        res.json(summary);
    } catch (error: any) {
        logger.error('Failed to fetch SMS procurement summary', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 2. POST Super Admin Manual / Automated Retry of Failed Procurement Task
router.post('/tasks/:id/retry', async (req: any, res: any) => {
    try {
        const result = await SmsProcurementService.retryProcurement(req.params.id);
        res.json(result);
    } catch (error: any) {
        logger.error('Failed to retry procurement task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
