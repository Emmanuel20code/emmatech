"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sms_procurement_service_1 = require("../services/sms-procurement.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// 1. GET Super Admin SMS Financial Overview Summary
router.get('/summary', async (_req, res) => {
    try {
        const summary = await sms_procurement_service_1.SmsProcurementService.getFinancialSummary();
        res.json(summary);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch SMS procurement summary', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// 2. POST Super Admin Manual / Automated Retry of Failed Procurement Task
router.post('/tasks/:id/retry', async (req, res) => {
    try {
        const result = await sms_procurement_service_1.SmsProcurementService.retryProcurement(req.params.id);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to retry procurement task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
