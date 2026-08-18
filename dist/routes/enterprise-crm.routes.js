"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enterprise_crm_service_1 = require("../services/enterprise-crm.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// 1. PUBLIC: Submit Enterprise Lead Inquiry Form
router.post('/inquire', async (req, res) => {
    try {
        const { companyName, contactPerson, phone, email } = req.body;
        if (!companyName || !contactPerson || !phone || !email) {
            return res.status(400).json({ error: 'Company Name, Contact Person, Phone, and Email are required fields.' });
        }
        const lead = await enterprise_crm_service_1.EnterpriseCrmService.createLead(req.body);
        res.status(201).json({
            success: true,
            leadId: lead.id,
            leadNumber: lead.leadNumber,
            message: 'Enterprise inquiry submitted successfully. An Enterprise Sales Account Manager will review your requirements and reach out within 2 hours.'
        });
    }
    catch (error) {
        logger_1.default.error('Enterprise lead submission error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// 2. PUBLIC: Customer Proposal / Quotation Detail Page View
router.get('/quote/:quoteId', async (req, res) => {
    try {
        const details = await enterprise_crm_service_1.EnterpriseCrmService.getQuoteDetails(req.params.quoteId);
        res.json(details);
    }
    catch (error) {
        logger_1.default.error('Enterprise quote details error', { error: error.message });
        res.status(404).json({ error: error.message });
    }
});
// 3. PUBLIC: Customer Proposal Response (Accept / Reject / Request Changes)
router.post('/quote/:quoteId/respond', async (req, res) => {
    try {
        const { action, customerNotes } = req.body;
        if (!action || !['ACCEPT', 'REJECT', 'REQUEST_CHANGES'].includes(action)) {
            return res.status(400).json({ error: 'Valid action (ACCEPT, REJECT, REQUEST_CHANGES) is required.' });
        }
        const result = await enterprise_crm_service_1.EnterpriseCrmService.respondToQuote(req.params.quoteId, action, customerNotes);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Enterprise quote response error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// 4. SUPER ADMIN: Get All Leads & CRM Pipeline Metrics
router.get('/superadmin/leads', async (req, res) => {
    try {
        const status = req.query.status;
        const result = await enterprise_crm_service_1.EnterpriseCrmService.getLeads(status);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 5. SUPER ADMIN: Update Lead Pipeline Stage
router.put('/superadmin/leads/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!status)
            return res.status(400).json({ error: 'status is required' });
        const lead = await enterprise_crm_service_1.EnterpriseCrmService.updateLeadStatus(req.params.id, status);
        res.json(lead);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 6. SUPER ADMIN: Create Custom Quotation
router.post('/superadmin/quotes', async (req, res) => {
    try {
        const { leadId, monthlyCostKes } = req.body;
        if (!leadId || monthlyCostKes === undefined) {
            return res.status(400).json({ error: 'leadId and monthlyCostKes are required' });
        }
        const quote = await enterprise_crm_service_1.EnterpriseCrmService.createQuote(req.body);
        res.status(201).json(quote);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 7. SUPER ADMIN: Get Enterprise CRM Executive Analytics & Reports
router.get('/superadmin/analytics', async (_req, res) => {
    try {
        const analytics = await enterprise_crm_service_1.EnterpriseCrmService.getCrmAnalytics();
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
