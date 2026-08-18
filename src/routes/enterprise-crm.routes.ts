import { Router } from 'express';
import { EnterpriseCrmService } from '../services/enterprise-crm.service';
import logger from '../utils/logger';

const router = Router();

// 1. PUBLIC: Submit Enterprise Lead Inquiry Form
router.post('/inquire', async (req: any, res: any) => {
    try {
        const { companyName, contactPerson, phone, email } = req.body;
        if (!companyName || !contactPerson || !phone || !email) {
            return res.status(400).json({ error: 'Company Name, Contact Person, Phone, and Email are required fields.' });
        }

        const lead = await EnterpriseCrmService.createLead(req.body);
        res.status(201).json({
            success: true,
            leadId: lead.id,
            leadNumber: lead.leadNumber,
            message: 'Enterprise inquiry submitted successfully. An Enterprise Sales Account Manager will review your requirements and reach out within 2 hours.'
        });
    } catch (error: any) {
        logger.error('Enterprise lead submission error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 2. PUBLIC: Customer Proposal / Quotation Detail Page View
router.get('/quote/:quoteId', async (req: any, res: any) => {
    try {
        const details = await EnterpriseCrmService.getQuoteDetails(req.params.quoteId);
        res.json(details);
    } catch (error: any) {
        logger.error('Enterprise quote details error', { error: error.message });
        res.status(404).json({ error: error.message });
    }
});

// 3. PUBLIC: Customer Proposal Response (Accept / Reject / Request Changes)
router.post('/quote/:quoteId/respond', async (req: any, res: any) => {
    try {
        const { action, customerNotes } = req.body;
        if (!action || !['ACCEPT', 'REJECT', 'REQUEST_CHANGES'].includes(action)) {
            return res.status(400).json({ error: 'Valid action (ACCEPT, REJECT, REQUEST_CHANGES) is required.' });
        }

        const result = await EnterpriseCrmService.respondToQuote(req.params.quoteId, action, customerNotes);
        res.json(result);
    } catch (error: any) {
        logger.error('Enterprise quote response error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 4. SUPER ADMIN: Get All Leads & CRM Pipeline Metrics
router.get('/superadmin/leads', async (req: any, res: any) => {
    try {
        const status = req.query.status as string;
        const result = await EnterpriseCrmService.getLeads(status);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 5. SUPER ADMIN: Update Lead Pipeline Stage
router.put('/superadmin/leads/:id/status', async (req: any, res: any) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'status is required' });

        const lead = await EnterpriseCrmService.updateLeadStatus(req.params.id, status);
        res.json(lead);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 6. SUPER ADMIN: Create Custom Quotation
router.post('/superadmin/quotes', async (req: any, res: any) => {
    try {
        const { leadId, monthlyCostKes } = req.body;
        if (!leadId || monthlyCostKes === undefined) {
            return res.status(400).json({ error: 'leadId and monthlyCostKes are required' });
        }

        const quote = await EnterpriseCrmService.createQuote(req.body);
        res.status(201).json(quote);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 7. SUPER ADMIN: Get Enterprise CRM Executive Analytics & Reports
router.get('/superadmin/analytics', async (_req: any, res: any) => {
    try {
        const analytics = await EnterpriseCrmService.getCrmAnalytics();
        res.json(analytics);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
