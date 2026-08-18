import { Router } from 'express';
import { SaaSBillingService } from '../services/saas-billing.service';
import { SubscriptionPlan, SaaSInvoice, Tenant, SaaSSubscriptionPayment } from '../models';
import logger from '../utils/logger';

const router = Router();

// 1. Super Admin SaaS Dashboard Metrics
router.get('/dashboard', async (req: any, res: any) => {
    try {
        const metrics = await SaaSBillingService.getSuperAdminMetrics();
        res.json(metrics);
    } catch (error: any) {
        logger.error('Super Admin SaaS dashboard error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 2. Get Global Pricing Configuration
router.get('/pricing-config', async (req: any, res: any) => {
    try {
        const config = await SaaSBillingService.getPricingConfig();
        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Update Global Pricing Configuration
router.put('/pricing-config', async (req: any, res: any) => {
    try {
        const updated = await SaaSBillingService.updatePricingConfig(req.body);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Subscription Plans Management
router.get('/plans', async (req: any, res: any) => {
    try {
        const plans = await SaaSBillingService.seedSubscriptionPlans();
        res.json(plans);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/plans', async (req: any, res: any) => {
    try {
        const plan = await SubscriptionPlan.create(req.body);
        res.status(201).json(plan);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/plans/:id', async (req: any, res: any) => {
    try {
        const plan = await SubscriptionPlan.findByPk(req.params.id);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        await plan.update(req.body);
        res.json(plan);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Invoices & Billing Run Trigger
router.get('/invoices', async (req: any, res: any) => {
    try {
        const invoices = await SaaSInvoice.findAll({
            include: [Tenant],
            order: [['createdAt', 'DESC']]
        });
        res.json(invoices);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/trigger-billing-run', async (req: any, res: any) => {
    try {
        const tenants = await Tenant.findAll({ where: { status: 'ACTIVE' } });
        const results = [];
        for (const tenant of tenants) {
            try {
                const inv = await SaaSBillingService.generateInvoice(tenant.id);
                results.push({ tenantId: tenant.id, invoiceNumber: inv.invoiceNumber });
            } catch (err: any) {
                logger.error(`Billing run error for tenant ${tenant.id}`, { error: err.message });
            }
        }
        res.json({ success: true, count: results.length, details: results });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Grace Period & Overdue Evaluator Trigger
router.post('/evaluate-grace-periods', async (req: any, res: any) => {
    try {
        const result = await SaaSBillingService.evaluateGracePeriods();
        res.json({ success: true, result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 7. SaaSSubscriptionPayment List Endpoint
router.get('/subscription-payments', async (req: any, res: any) => {
    try {
        const payments = await SaaSSubscriptionPayment.findAll({
            include: [{ model: Tenant, attributes: ['name', 'subdomain'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json(payments);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
