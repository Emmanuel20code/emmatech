import { Router } from 'express';
import { CheckoutService } from '../services/checkout.service';
import { SaaSBillingService } from '../services/saas-billing.service';
import { SaaSInvoice, Tenant, SaaSSubscriptionPayment, Payment, PaymentLog, MpesaCallbackLog, PaymentVerificationAudit } from '../models';
import { MpesaService } from '../services/mpesa.service';
import logger from '../utils/logger';

const router = Router();

// 0. Public Plans & Pricing Configuration
router.get('/plans', async (req: any, res: any) => {
    try {
        const plans = await SaaSBillingService.seedSubscriptionPlans();
        res.json(plans);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/pricing-config', async (req: any, res: any) => {
    try {
        const config = await SaaSBillingService.getPricingConfig();
        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

const getTenantId = async (req: any): Promise<string> => {
    let id = req.tenantId || req.user?.tenantId || req.headers['x-tenant-id'];
    if (!id || typeof id !== 'string' || !id.includes('-')) {
        const firstTenant = await Tenant.findOne({ order: [['createdAt', 'ASC']] });
        if (firstTenant) {
            return firstTenant.id;
        }
        return '00000000-0000-0000-0000-000000000001';
    }
    return id;
};

// 1. Prepare Checkout Intent / Create Pending Invoice
router.post('/prepare', async (req: any, res: any) => {
    try {
        const tenantId = await getTenantId(req);
        const { itemType, itemId, itemSlug, quantity, billingCycle, couponCode, customAmountCents } = req.body;

        if (!itemType) {
            return res.status(400).json({ error: 'itemType is required' });
        }

        const checkout = await CheckoutService.prepareCheckout({
            tenantId,
            itemType,
            itemId,
            itemSlug,
            quantity: Number(quantity) || 1,
            billingCycle: billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
            couponCode,
            customAmountCents: customAmountCents ? Number(customAmountCents) : undefined
        });

        res.json(checkout);
    } catch (error: any) {
        logger.error('Checkout prepare error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 2. Validate Coupon Code
router.post('/validate-coupon', (req: any, res: any) => {
    const { couponCode } = req.body;
    if (!couponCode) return res.status(400).json({ error: 'Coupon code is required' });

    const code = couponCode.trim().toUpperCase();
    if (code === 'SURFBILL10' || code === 'SAVE10') {
        return res.json({ valid: true, discountPercent: 10, code, message: '10% discount applied!' });
    } else if (code === 'SURFBILL20' || code === 'WELCOME20') {
        return res.json({ valid: true, discountPercent: 20, code, message: '20% welcome discount applied!' });
    } else {
        return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code.' });
    }
});

// 3. Initiate M-Pesa STK Push Payment
router.post('/pay-stk', async (req: any, res: any) => {
    try {
        const tenantId = await getTenantId(req);
        const { invoiceId, phoneNumber } = req.body;

        if (!invoiceId || !phoneNumber) {
            return res.status(400).json({ error: 'invoiceId and phoneNumber are required' });
        }

        const result = await CheckoutService.payWithStk(tenantId, invoiceId, phoneNumber, req);
        res.json(result);
    } catch (error: any) {
        logger.error('STK Push checkout error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 4. Pay via Tenant Wallet Balance
router.post('/pay-wallet', async (req: any, res: any) => {
    try {
        const tenantId = await getTenantId(req);
        const { invoiceId } = req.body;

        if (!invoiceId) {
            return res.status(400).json({ error: 'invoiceId is required' });
        }

        const result = await CheckoutService.payWithWallet(tenantId, invoiceId);
        res.json(result);
    } catch (error: any) {
        logger.error('Wallet checkout error', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

// 5. Poll Payment & Activation Status
router.get('/status/:invoiceId', async (req: any, res: any) => {
    try {
        const tenantId = await getTenantId(req);
        let invoice = await SaaSInvoice.findOne({
            where: { id: req.params.invoiceId, tenantId }
        });

        if (!invoice) {
            invoice = await SaaSInvoice.findOne({ where: { id: req.params.invoiceId } });
        }

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        res.json({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentStatus: invoice.paymentStatus,
            paidAt: invoice.paidAt,
            paymentMethod: invoice.paymentMethod,
            totalAmountKes: Number(invoice.totalAmountCents) / 100
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Direct Verification of Payment with M-Pesa STK Status Check & Historical Reconciliation
router.post('/verify', async (req: any, res: any) => {
    try {
        const tenantId = await getTenantId(req);
        const { invoiceId, transactionRef } = req.body;

        let invoice = await SaaSInvoice.findOne({
            where: { id: invoiceId, tenantId }
        });

        if (!invoice) {
            invoice = await SaaSInvoice.findOne({ where: { id: invoiceId } });
        }

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        if (invoice.paymentStatus === 'PAID') {
            try {
                await PaymentVerificationAudit.create({
                    tenantId: invoice.tenantId,
                    invoiceId: invoice.id,
                    status: 'ALREADY_PAID',
                    verificationSource: 'INVOICE_ALREADY_PAID',
                    details: 'Invoice was already marked as PAID.'
                });
            } catch (_) {}
            return res.json({ success: true, paymentStatus: 'PAID', message: 'Invoice is already paid and subscription active.' });
        }

        let checkoutRequestId: string | null = null;
        const metadata = invoice.metadata ? JSON.parse(invoice.metadata) : {};
        checkoutRequestId = metadata.checkoutRequestId || null;

        // 1. Check SaaSSubscriptionPayment history (even if paid 10 minutes or hours ago)
        let subPayment = await SaaSSubscriptionPayment.findOne({
            where: { invoiceId: invoice.id },
            order: [['createdAt', 'DESC']]
        });

        if (!subPayment && checkoutRequestId) {
            subPayment = await SaaSSubscriptionPayment.findOne({
                where: { checkoutRequestId },
                order: [['createdAt', 'DESC']]
            });
        }

        if (subPayment) {
            checkoutRequestId = checkoutRequestId || subPayment.checkoutRequestId;
            if (subPayment.status === 'SUCCESS' || (subPayment.rawCallback && subPayment.rawCallback.includes('ResultCode":0'))) {
                await CheckoutService.processPaymentSuccess(invoice.id, subPayment.mpesaReceiptNumber || transactionRef || `REF-${Date.now()}`, 'STK_PUSH');
                try {
                    await PaymentVerificationAudit.create({
                        tenantId: invoice.tenantId,
                        invoiceId: invoice.id,
                        checkoutRequestId,
                        status: 'ALREADY_PAID',
                        matchedReceipt: subPayment.mpesaReceiptNumber,
                        verificationSource: 'SAAS_SUBSCRIPTION_PAYMENT_HISTORICAL',
                        details: 'Found successful historical subscription payment record.'
                    });
                } catch (_) {}
                return res.json({ success: true, paymentStatus: 'PAID', message: 'Payment verified from past records and service activated successfully.' });
            }
        }

        // 2. Check general Payment or PaymentLog history
        const historicalPayment = await Payment.findOne({
            where: { tenantId: invoice.tenantId, status: 'SUCCESS' },
            order: [['createdAt', 'DESC']]
        });
        if (historicalPayment && Number(historicalPayment.amount) * 100 >= Number(invoice.totalAmountCents)) {
            const receipt = historicalPayment.mpesaReceiptNumber || transactionRef || `REF-${Date.now()}`;
            await CheckoutService.processPaymentSuccess(invoice.id, receipt, 'STK_PUSH');
            try {
                await PaymentVerificationAudit.create({
                    tenantId: invoice.tenantId,
                    invoiceId: invoice.id,
                    checkoutRequestId,
                    status: 'ALREADY_PAID',
                    matchedReceipt: receipt,
                    verificationSource: 'GENERAL_PAYMENT_HISTORICAL',
                    details: 'Matched successful payment log from tenant history.'
                });
            } catch (_) {}
            return res.json({ success: true, paymentStatus: 'PAID', message: 'Historical payment verified and service activated successfully.' });
        }

        // 3. Check MpesaCallbackLog for any background webhook that arrived earlier
        if (checkoutRequestId) {
            const callbackLog = await MpesaCallbackLog.findOne({
                where: { checkoutRequestId },
                order: [['createdAt', 'DESC']]
            });
            if (callbackLog && callbackLog.rawPayload && (callbackLog.rawPayload.includes('"ResultCode":0') || callbackLog.rawPayload.includes('"ResultCode": 0'))) {
                const receipt = transactionRef || `MPESA-CB-${Date.now()}`;
                await CheckoutService.processPaymentSuccess(invoice.id, receipt, 'STK_PUSH');
                try {
                    await PaymentVerificationAudit.create({
                        tenantId: invoice.tenantId,
                        invoiceId: invoice.id,
                        checkoutRequestId,
                        status: 'VERIFIED_SUCCESS',
                        matchedReceipt: receipt,
                        verificationSource: 'MPESA_CALLBACK_LOG_RECONCILIATION',
                        details: 'Matched successful M-Pesa callback log received earlier.'
                    });
                } catch (_) {}
                return res.json({ success: true, paymentStatus: 'PAID', message: 'Payment confirmed via background callback log and service activated.' });
            }

            // 4. Query Safaricom live STK Status Query API
            const statusResult = await MpesaService.checkTransactionStatus(checkoutRequestId, tenantId);
            logger.info('[Checkout Verify] Safaricom STK Query Result', { invoiceId, checkoutRequestId, statusResult });

            if (statusResult && (String(statusResult.ResultCode) === '0' || statusResult.ResultCode === 0)) {
                const receipt = statusResult.CallbackMetadata?.Item?.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value || transactionRef || `MPESA-${Date.now()}`;
                await CheckoutService.processPaymentSuccess(invoice.id, receipt, 'STK_PUSH');
                try {
                    await PaymentVerificationAudit.create({
                        tenantId: invoice.tenantId,
                        invoiceId: invoice.id,
                        checkoutRequestId,
                        status: 'VERIFIED_SUCCESS',
                        matchedReceipt: receipt,
                        verificationSource: 'SAFARICOM_LIVE_STK_QUERY',
                        details: 'Confirmed successfully via Safaricom live STK query API.'
                    });
                } catch (_) {}
                return res.json({ success: true, paymentStatus: 'PAID', message: 'Payment confirmed via M-Pesa and service activated successfully.' });
            }
        }

        try {
            await PaymentVerificationAudit.create({
                tenantId: invoice.tenantId,
                invoiceId: invoice.id,
                checkoutRequestId,
                status: 'PENDING_ON_MPESA',
                verificationSource: 'STK_QUERY_PENDING',
                details: 'Payment not yet completed or confirmed on M-Pesa.'
            });
        } catch (_) {}

        return res.status(400).json({
            success: false,
            error: 'Payment has not been completed on M-Pesa yet. Please check your phone for the M-Pesa prompt, enter your PIN, and try verifying again after confirmation.'
        });
    } catch (error: any) {
        logger.error('[Checkout Verify] Error', { error: error.message });
        res.status(500).json({ error: error.message || 'Payment verification failed' });
    }
});

export default router;
