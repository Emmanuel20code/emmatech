import { Router } from 'express';
import { SaaSBillingService } from '../services/saas-billing.service';
import { SaaSInvoice, TenantSubscription, SubscriptionPlan, SaaSInvoiceItem, Tenant, SaaSSubscriptionPayment } from '../models';
import { MpesaService } from '../services/mpesa.service';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const getTenantId = (req: any): string => {
    return req.tenantId || req.user?.tenantId || req.headers['x-tenant-id'];
};

// 1. Tenant Subscription & Billing Overview
router.get('/subscription', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);

        // Return a lifetime premium free pass billing overview for Super Admin / Platform Owner
        if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'PLATFORM_OWNER') {
            return res.json({
                tenantName: 'Super Admin Workspace',
                status: 'ACTIVE',
                planName: 'Super Admin Unlimited Plan',
                billingCycle: 'LIFETIME',
                currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10), // 10 years
                amountDue: 0,
                unpaidInvoiceId: null,
                activeUsers: { activeCount: 0, costPerUser: 0, totalUserCost: 0, baseCost: 0 },
                invoices: []
            });
        }

        const overview = await SaaSBillingService.getTenantBillingOverview(tenantId);
        res.json(overview);
    } catch (error: any) {
        logger.error('Tenant subscription overview error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 1b. Fast subscription check for dashboard banners
router.get('/subscription-check', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);
        if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'PLATFORM_OWNER') {
            return res.json({
                status: 'ACTIVE',
                daysRemaining: 3650,
                amountDue: 0,
                unpaidInvoiceId: null
            });
        }

        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const info = await tenant.getSubscriptionInfo();
        
        // Find latest unpaid SaaS invoice, or dynamically generate one for the subscription fee if they are in trial/expired phases
        let unpaidInvoice = await SaaSInvoice.findOne({
            where: { tenantId, paymentStatus: 'UNPAID' },
            order: [['createdAt', 'DESC']]
        });

        if (!unpaidInvoice && (info.isTrial || info.isExpired || info.daysRemaining <= 0 || ["SUSPENDED", "OVERDUE", "EXPIRED"].includes(info.status))) {
            const invoiceUuid = uuidv4();
            const invoiceNumber = `PLATFORM-${uuidv4().slice(0, 8)}`;
            const now = new Date();
            const nextDue = new Date();
            nextDue.setDate(now.getDate() + 30);
            
            unpaidInvoice = await SaaSInvoice.create({
                id: invoiceUuid,
                tenantId: tenantId,
                invoiceNumber: invoiceNumber,
                billingPeriodStart: now,
                billingPeriodEnd: nextDue,
                dueDate: now,
                totalAmountCents: (info.price || 1500) * 100,
                paymentStatus: 'UNPAID'
            });
        }

        // Map backend ENUM to frontend expected string
        let status = info.status === 'GRACE' ? 'GRACE_PERIOD' : info.status;
        if (status === 'PAID') status = 'ACTIVE';

        res.json({
            status: status,
            daysRemaining: info.daysRemaining,
            amountDue: info.price,
            unpaidInvoiceId: unpaidInvoice ? unpaidInvoice.id : null
        });
    } catch (error: any) {
        logger.error('Subscription check error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 2. Active User Billing Breakdown
router.get('/active-users', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);
        const active = await SaaSBillingService.calculateActiveUsers(tenantId);
        res.json(active);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Invoice History
router.get('/invoices', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);
        const invoices = await SaaSInvoice.findAll({
            where: { tenantId },
            include: [SaaSInvoiceItem],
            order: [['createdAt', 'DESC']]
        });
        res.json(invoices);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Download Invoice HTML/PDF Data
router.get('/invoices/:id/pdf', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);
        const invoice = await SaaSInvoice.findOne({
            where: { id: req.params.id, tenantId },
            include: [SaaSInvoiceItem]
        });

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const items = (invoice as any).SaaSInvoiceItem || [];

        // Clean HTML invoice document structure
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Invoice ${invoice.invoiceNumber}</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; }
                .header { display: flex; justify-content: space-between; border-b: 2px solid #e2e8f0; padding-bottom: 20px; }
                .brand { font-size: 24px; font-weight: bold; color: #0284c7; }
                .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                .paid { background: #dcfce7; color: #15803d; }
                .unpaid { background: #fef3c7; color: #b45309; }
                table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                th { text-align: left; background: #f8fafc; padding: 12px; font-size: 11px; text-transform: uppercase; }
                td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                .total-row { font-size: 16px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="brand">Jevish WiFi Billing System</div>
                    <div style="font-size: 12px; color: #64748b;">SaaS Subscription & Usage Invoice</div>
                </div>
                <div>
                    <span class="badge ${invoice.paymentStatus === 'PAID' ? 'paid' : 'unpaid'}">${invoice.paymentStatus}</span>
                </div>
            </div>
            <div style="margin-top: 20px; display: flex; justify-content: space-between; font-size: 13px;">
                <div>
                    <strong>Invoice To:</strong><br />
                    Tenant ID: ${tenantId}<br />
                    Invoice #: ${invoice.invoiceNumber}
                </div>
                <div style="text-align: right;">
                    <strong>Billing Period:</strong> ${new Date(invoice.billingPeriodStart).toLocaleDateString()} - ${new Date(invoice.billingPeriodEnd).toLocaleDateString()}<br />
                    <strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Qty</th>
                        <th>Unit Price (KES)</th>
                        <th>Total (KES)</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item: any) => `
                        <tr>
                            <td>${item.description}</td>
                            <td>${item.category}</td>
                            <td>${item.quantity}</td>
                            <td>${(Number(item.unitPriceCents) / 100).toFixed(2)}</td>
                            <td>${(Number(item.totalPriceCents) / 100).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="4" style="text-align: right;">Total Amount Due:</td>
                        <td>KES ${(Number(invoice.totalAmountCents) / 100).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `;

        res.json({
            invoiceNumber: invoice.invoiceNumber,
            htmlContent: html,
            pdfDataUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Initiate IntaSend Payment for Invoice
router.post('/invoices/:id/pay-intasend', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);
        const invoice = await SaaSInvoice.findOne({ where: { id: req.params.id, tenantId } });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const checkoutUrl = invoice.intasendCheckoutUrl || `https://payment.intasend.com/pay/${invoice.invoiceNumber}`;
        res.json({
            success: true,
            checkoutUrl,
            invoiceNumber: invoice.invoiceNumber,
            amount: Number(invoice.totalAmountCents) / 100
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 5b. Initiate Safaricom M-Pesa STK Push Payment for Invoice
router.post('/invoices/:id/pay-mpesa', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required for M-Pesa payment' });

        const invoice = await SaaSInvoice.findOne({ where: { id: req.params.id, tenantId } });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        if (invoice.paymentStatus === 'PAID') {
            return res.status(400).json({ error: 'Invoice is already paid' });
        }

        const amountKes = Math.round(Number(invoice.totalAmountCents) / 100);

        const result = await MpesaService.initiateStkPushForSaaSInvoice(
            invoice.id,
            tenantId,
            phoneNumber,
            amountKes,
            req
        );

        res.json({
            success: true,
            checkoutRequestId: result.CheckoutRequestID,
            message: result.CustomerMessage || `M-Pesa STK push initiated to ${phoneNumber}. Please enter your M-Pesa PIN on your phone to complete payment of KES ${amountKes}.`,
            amount: amountKes,
            invoiceNumber: invoice.invoiceNumber,
            status: 'PENDING'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to initiate M-Pesa payment' });
    }
});


// 6. Plan Upgrade / Change
router.post('/plans/upgrade', async (req: any, res: any) => {
    try {
        const tenantId = getTenantId(req);
        const { planId, billingCycle } = req.body;

        const plan = await SubscriptionPlan.findByPk(planId);
        if (!plan) return res.status(404).json({ error: 'Subscription plan not found' });

        let sub = await TenantSubscription.findOne({ where: { tenantId } });
        if (sub) {
            await sub.update({
                planId: plan.id,
                billingCycle: billingCycle || 'MONTHLY'
            });
        } else {
            sub = await TenantSubscription.create({
                tenantId,
                planId: plan.id,
                status: 'ACTIVE',
                billingCycle: billingCycle || 'MONTHLY',
                startDate: new Date(),
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }

        // Generate immediate invoice for upgrade
        const newInvoice = await SaaSBillingService.generateInvoice(tenantId);
        res.json({ success: true, plan, subscription: sub, invoice: newInvoice });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
