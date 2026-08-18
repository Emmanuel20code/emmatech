import { Router } from 'express';
import { SaaSBillingService } from '../services/saas-billing.service';
import logger from '../utils/logger';

const router = Router();

// Public IntaSend Payment Webhook Endpoint (Idempotent & Secured)
router.post('/intasend', async (req: any, res: any) => {
    try {
        const payload = req.body;
        logger.info('Received IntaSend webhook payload', { payload });

        if (!payload) {
            return res.status(400).json({ error: 'Invalid or empty webhook payload' });
        }

        const invoiceIdOrNumber = payload.invoice_number || payload.api_ref || payload.checkout_id;
        if (!invoiceIdOrNumber && !payload.tracking_id) {
            return res.status(400).json({ error: 'Missing invoice reference or tracking_id in payload' });
        }

        const result = await SaaSBillingService.processIntaSendWebhook(payload);
        res.json(result);
    } catch (error: any) {
        logger.error('IntaSend webhook processing error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
