"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const saas_billing_service_1 = require("../services/saas-billing.service");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// 1. Super Admin SaaS Dashboard Metrics
router.get('/dashboard', async (req, res) => {
    try {
        const metrics = await saas_billing_service_1.SaaSBillingService.getSuperAdminMetrics();
        res.json(metrics);
    }
    catch (error) {
        logger_1.default.error('Super Admin SaaS dashboard error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// 2. Get Global Pricing Configuration
router.get('/pricing-config', async (req, res) => {
    try {
        const config = await saas_billing_service_1.SaaSBillingService.getPricingConfig();
        res.json(config);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 3. Update Global Pricing Configuration
router.put('/pricing-config', async (req, res) => {
    try {
        const updated = await saas_billing_service_1.SaaSBillingService.updatePricingConfig(req.body);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 4. Subscription Plans Management
router.get('/plans', async (req, res) => {
    try {
        const plans = await saas_billing_service_1.SaaSBillingService.seedSubscriptionPlans();
        res.json(plans);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/plans', async (req, res) => {
    try {
        const plan = await models_1.SubscriptionPlan.create(req.body);
        res.status(201).json(plan);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/plans/:id', async (req, res) => {
    try {
        const plan = await models_1.SubscriptionPlan.findByPk(req.params.id);
        if (!plan)
            return res.status(404).json({ error: 'Plan not found' });
        await plan.update(req.body);
        res.json(plan);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 5. Invoices & Billing Run Trigger
router.get('/invoices', async (req, res) => {
    try {
        const invoices = await models_1.SaaSInvoice.findAll({
            include: [models_1.Tenant],
            order: [['createdAt', 'DESC']]
        });
        res.json(invoices);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/trigger-billing-run', async (req, res) => {
    try {
        const tenants = await models_1.Tenant.findAll({ where: { status: 'ACTIVE' } });
        const results = [];
        for (const tenant of tenants) {
            try {
                const inv = await saas_billing_service_1.SaaSBillingService.generateInvoice(tenant.id);
                results.push({ tenantId: tenant.id, invoiceNumber: inv.invoiceNumber });
            }
            catch (err) {
                logger_1.default.error(`Billing run error for tenant ${tenant.id}`, { error: err.message });
            }
        }
        res.json({ success: true, count: results.length, details: results });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 6. Grace Period & Overdue Evaluator Trigger
router.post('/evaluate-grace-periods', async (req, res) => {
    try {
        const result = await saas_billing_service_1.SaaSBillingService.evaluateGracePeriods();
        res.json({ success: true, result });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 7. SaaSSubscriptionPayment List Endpoint
router.get('/subscription-payments', async (req, res) => {
    try {
        const payments = await models_1.SaaSSubscriptionPayment.findAll({
            include: [{ model: models_1.Tenant, attributes: ['name', 'subdomain'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json(payments);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
