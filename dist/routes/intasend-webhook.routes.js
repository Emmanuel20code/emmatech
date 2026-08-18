"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const saas_billing_service_1 = require("../services/saas-billing.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Public IntaSend Payment Webhook Endpoint (Idempotent & Secured)
router.post('/intasend', async (req, res) => {
    try {
        const payload = req.body;
        logger_1.default.info('Received IntaSend webhook payload', { payload });
        if (!payload) {
            return res.status(400).json({ error: 'Invalid or empty webhook payload' });
        }
        const invoiceIdOrNumber = payload.invoice_number || payload.api_ref || payload.checkout_id;
        if (!invoiceIdOrNumber && !payload.tracking_id) {
            return res.status(400).json({ error: 'Missing invoice reference or tracking_id in payload' });
        }
        const result = await saas_billing_service_1.SaaSBillingService.processIntaSendWebhook(payload);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('IntaSend webhook processing error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
