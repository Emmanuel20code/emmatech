import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Tenant, Payment, SaaSSubscriptionPayment, SaaSInvoice, TenantSubscription, SubscriptionPlan } from '../models';
import { MpesaService } from '../services/mpesa.service';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get current billing status for the tenant
router.get('/status', authMiddleware, async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) return res.json({ showNotification: false });

        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        res.json(await tenant.getSubscriptionInfo());
    } catch (error: any) {
        logger.error('Failed to get billing status', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initiate payment for platform subscription
router.post('/pay', authMiddleware, async (req: any, res: Response) => {
    try {
        const { phoneNumber } = req.body;
        const tenantId = req.user.tenantId;

        if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' });
        if (!tenantId) return res.status(400).json({ error: 'Tenant ID not found in session' });

        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const info = await tenant.getSubscriptionInfo();
        const payPrice = info.price || 1500;

        const invoiceId = uuidv4();
        const invoiceNumber = `PLATFORM-${uuidv4().slice(0, 8)}`;
        const totalCents = Math.round(payPrice * 100);

        // Create SaaSInvoice record so callback processing can automatically find and settle it
        await SaaSInvoice.create({
            id: invoiceId,
            tenantId,
            invoiceNumber,
            totalAmountCents: totalCents,
            subtotalCents: totalCents,
            taxCents: 0,
            currency: 'KES',
            status: 'ISSUED',
            paymentStatus: 'UNPAID',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            metadata: JSON.stringify({ itemType: 'SUBSCRIPTION_PLAN', itemSlug: 'unlimited', billingCycle: 'MONTHLY' })
        });
        
        // Initiate STK Push with dynamic current request URL
        const result = await MpesaService.initiateStkPushForSaaSInvoice(
            invoiceId,
            tenantId,
            phoneNumber,
            payPrice,
            req
        );

        // Create local payment record to track it in SaaSSubscriptionPayment
        await SaaSSubscriptionPayment.create({
            id: uuidv4(),
            tenantId: tenantId,
            invoiceId: invoiceId,
            amount: payPrice,
            currency: 'KES',
            status: 'PENDING',
            phoneNumber: phoneNumber,
            checkoutRequestId: result.CheckoutRequestID,
            merchantRequestId: result.MerchantRequestID,
            rawCallback: JSON.stringify({ invoiceId, type: 'PLATFORM_SUBSCRIPTION' })
        });

        res.json({
            message: 'Live M-Pesa STK Push initiated. Please check your phone.',
            checkoutRequestId: result.CheckoutRequestID,
            merchantRequestId: result.MerchantRequestID
        });
    } catch (error: any) {
        logger.error('Failed to initiate platform payment', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
