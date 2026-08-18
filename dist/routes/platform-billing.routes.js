"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const models_1 = require("../models");
const mpesa_service_1 = require("../services/mpesa.service");
const logger_1 = __importDefault(require("../utils/logger"));
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// Get current billing status for the tenant
router.get('/status', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId)
            return res.json({ showNotification: false });
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        res.json(await tenant.getSubscriptionInfo());
    }
    catch (error) {
        logger_1.default.error('Failed to get billing status', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Initiate payment for platform subscription
router.post('/pay', auth_1.authMiddleware, async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const tenantId = req.user.tenantId;
        if (!phoneNumber)
            return res.status(400).json({ error: 'Phone number is required' });
        if (!tenantId)
            return res.status(400).json({ error: 'Tenant ID not found in session' });
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const info = await tenant.getSubscriptionInfo();
        const payPrice = info.price || 1500;
        const invoiceId = (0, uuid_1.v4)();
        const invoiceNumber = `PLATFORM-${(0, uuid_1.v4)().slice(0, 8)}`;
        const totalCents = Math.round(payPrice * 100);
        // Create SaaSInvoice record so callback processing can automatically find and settle it
        await models_1.SaaSInvoice.create({
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
        const result = await mpesa_service_1.MpesaService.initiateStkPushForSaaSInvoice(invoiceId, tenantId, phoneNumber, payPrice, req);
        // Create local payment record to track it in SaaSSubscriptionPayment
        await models_1.SaaSSubscriptionPayment.create({
            id: (0, uuid_1.v4)(),
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
    }
    catch (error) {
        logger_1.default.error('Failed to initiate platform payment', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
