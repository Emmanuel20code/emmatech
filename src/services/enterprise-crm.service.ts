import {
    EnterpriseLead,
    EnterpriseQuote,
    Tenant,
    TenantSubscription,
    SubscriptionPlan,
    SaaSInvoice,
    SaaSInvoiceItem,
    AuditLog,
    SaaSNotification
} from '../models';
import logger from '../utils/logger';
import { sendEmail } from './emailService';
import { Op } from 'sequelize';

export interface CreateLeadParams {
    companyName: string;
    registrationNumber?: string;
    contactPerson: string;
    position?: string;
    phone: string;
    altPhone?: string;
    email: string;
    website?: string;
    country?: string;
    region?: string;
    physicalAddress?: string;
    currentIspSize?: string;
    expectedGrowth?: string;
    subscriberCount?: number;
    activeUserCount?: number;
    routerCount?: number;
    currentBillingPlatform?: string;
    requiredFeatures?: string[];
    expectedLaunchDate?: string;
    monthlyBudget?: string;
    notes?: string;
}

export interface CreateQuoteParams {
    leadId: string;
    monthlyCostKes: number;
    setupFeeKes?: number;
    maxActiveUsers?: number;
    maxRouters?: number;
    smsAllocation?: number;
    whatsappAllocation?: number;
    storageAllocationMB?: number;
    customModules?: string[];
    discountKes?: number;
    taxPercentage?: number;
    contractDurationMonths?: number;
    validityDays?: number;
    termsAndConditions?: string;
}

export class EnterpriseCrmService {
    /**
     * Create a new Enterprise Lead inquiry and notify Super Admin
     */
    public static async createLead(params: CreateLeadParams): Promise<EnterpriseLead> {
        const leadNumber = `ENT-LEAD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;

        const lead = await EnterpriseLead.create({
            leadNumber,
            companyName: params.companyName.trim(),
            registrationNumber: params.registrationNumber || null,
            contactPerson: params.contactPerson.trim(),
            position: params.position || null,
            phone: params.phone.trim(),
            altPhone: params.altPhone || null,
            email: params.email.trim().toLowerCase(),
            website: params.website || null,
            country: params.country || 'Kenya',
            region: params.region || null,
            physicalAddress: params.physicalAddress || null,
            currentIspSize: params.currentIspSize || null,
            expectedGrowth: params.expectedGrowth || null,
            subscriberCount: params.subscriberCount || 0,
            activeUserCount: params.activeUserCount || 0,
            routerCount: params.routerCount || 0,
            currentBillingPlatform: params.currentBillingPlatform || null,
            requiredFeatures: params.requiredFeatures ? JSON.stringify(params.requiredFeatures) : null,
            expectedLaunchDate: params.expectedLaunchDate || null,
            monthlyBudget: params.monthlyBudget || null,
            notes: params.notes || null,
            status: 'NEW'
        });

        logger.info(`[EnterpriseCrmService] New lead created: ${lead.leadNumber} for ${lead.companyName}`);

        // Trigger Super Admin Notifications
        try {
            const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@jevish.site';
            await sendEmail({
                to: adminEmail,
                subject: `🚨 NEW ENTERPRISE LEAD: ${lead.companyName} (${lead.subscriberCount} Subs, ${lead.routerCount} Routers)`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #0284c7;">New Enterprise Quote Request Received</h2>
                        <p><strong>Company:</strong> ${lead.companyName}</p>
                        <p><strong>Contact Person:</strong> ${lead.contactPerson} (${lead.position || 'Executive'})</p>
                        <p><strong>Phone:</strong> ${lead.phone}</p>
                        <p><strong>Email:</strong> ${lead.email}</p>
                        <p><strong>Subscribers:</strong> ${lead.subscriberCount}</p>
                        <p><strong>MikroTik Routers:</strong> ${lead.routerCount}</p>
                        <p><strong>Budget:</strong> ${lead.monthlyBudget || 'Flexible'}</p>
                        <p><strong>Notes:</strong> ${lead.notes || 'None'}</p>
                        <hr/>
                        <p style="font-size: 12px; color: #64748b;">Log in to Super Admin Portal to construct a custom quotation.</p>
                    </div>
                `
            });
        } catch (err: any) {
            logger.warn(`Failed to send Super Admin notification email for Enterprise lead: ${err.message}`);
        }

        return lead;
    }

    /**
     * Get all leads with pipeline stage counts
     */
    public static async getLeads(queryStatus?: string): Promise<{
        leads: EnterpriseLead[];
        pipelineMetrics: Record<string, number>;
        totalLeads: number;
    }> {
        const whereClause: any = {};
        if (queryStatus) {
            whereClause.status = queryStatus;
        }

        const leads = await EnterpriseLead.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            include: [{ model: EnterpriseQuote, required: false }]
        });

        const stages = ['NEW', 'CONTACTED', 'QUALIFICATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'AWAITING_APPROVAL', 'WON', 'LOST', 'ARCHIVED'];
        const pipelineMetrics: Record<string, number> = {};

        for (const stage of stages) {
            pipelineMetrics[stage] = await EnterpriseLead.count({ where: { status: stage } });
        }

        return {
            leads,
            pipelineMetrics,
            totalLeads: leads.length
        };
    }

    /**
     * Update lead pipeline status
     */
    public static async updateLeadStatus(leadId: string, status: any): Promise<EnterpriseLead> {
        const lead = await EnterpriseLead.findByPk(leadId);
        if (!lead) throw new Error('Enterprise Lead not found');

        await lead.update({ status });
        logger.info(`[EnterpriseCrmService] Lead ${lead.leadNumber} transitioned to stage ${status}`);
        return lead;
    }

    /**
     * Generate custom quote for an Enterprise Lead
     */
    public static async createQuote(params: CreateQuoteParams): Promise<EnterpriseQuote> {
        const lead = await EnterpriseLead.findByPk(params.leadId);
        if (!lead) throw new Error('Enterprise Lead not found');

        const quoteNumber = `QT-ENT-${new Date().getFullYear()}-${Math.floor(Math.random() * 8999 + 1000)}`;
        const validityDays = params.validityDays || 30;
        const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

        const quote = await EnterpriseQuote.create({
            quoteNumber,
            leadId: lead.id,
            monthlyCostCents: Math.round(params.monthlyCostKes * 100),
            setupFeeCents: Math.round((params.setupFeeKes || 0) * 100),
            maxActiveUsers: params.maxActiveUsers !== undefined ? params.maxActiveUsers : -1,
            maxRouters: params.maxRouters !== undefined ? params.maxRouters : -1,
            smsAllocation: params.smsAllocation || 10000,
            whatsappAllocation: params.whatsappAllocation || 5000,
            storageAllocationMB: params.storageAllocationMB || 10240,
            customModules: params.customModules ? JSON.stringify(params.customModules) : null,
            discountCents: Math.round((params.discountKes || 0) * 100),
            taxPercentage: params.taxPercentage || 16.0,
            contractDurationMonths: params.contractDurationMonths || 12,
            status: 'SENT',
            validUntil,
            termsAndConditions: params.termsAndConditions || 'Standard Enterprise SLA & 99.9% Uptime Guarantee applied.'
        });

        // Update Lead status to PROPOSAL_SENT
        await lead.update({ status: 'PROPOSAL_SENT' });

        // Notify Lead Contact via Email
        try {
            const quoteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/quote/${quote.id}`;
            await sendEmail({
                to: lead.email,
                subject: `Formal Enterprise Proposal & Custom Quotation #${quote.quoteNumber} - Jevish Pro`,
                html: `
                    <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
                        <h2 style="color: #0284c7;">Jevish Enterprise Proposal Prepared</h2>
                        <p>Dear ${lead.contactPerson},</p>
                        <p>We are pleased to present your tailored Enterprise ISP solution for <strong>${lead.companyName}</strong>.</p>
                        <div style="background-color: white; padding: 16px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Quote Reference:</strong> ${quote.quoteNumber}</p>
                            <p><strong>Monthly Subscription:</strong> KES ${params.monthlyCostKes.toLocaleString()} / month</p>
                            <p><strong>One-Time Setup Fee:</strong> KES ${(params.setupFeeKes || 0).toLocaleString()}</p>
                            <p><strong>Capacity:</strong> ${params.maxActiveUsers === -1 ? 'Unlimited' : params.maxActiveUsers} Subscribers, ${params.maxRouters === -1 ? 'Unlimited' : params.maxRouters} MikroTik Routers</p>
                            <p><strong>Contract Term:</strong> ${quote.contractDurationMonths} Months</p>
                        </div>
                        <p>You can review the detailed specification breakdown and accept the proposal directly below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${quoteUrl}" style="background-color: #0284c7; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Review & Accept Proposal</a>
                        </div>
                        <p style="font-size: 13px; color: #64748b;">This proposal is valid until ${validUntil.toLocaleDateString()}.</p>
                    </div>
                `
            });
        } catch (e: any) {
            logger.warn(`Failed to send Quote email to lead: ${e.message}`);
        }

        return quote;
    }

    /**
     * Get Quote details for public customer proposal page
     */
    public static async getQuoteDetails(quoteId: string): Promise<{
        quote: EnterpriseQuote;
        lead: EnterpriseLead;
        financials: {
            monthlyKes: number;
            setupFeeKes: number;
            discountKes: number;
            subtotalKes: number;
            taxKes: number;
            totalFirstMonthKes: number;
        }
    }> {
        const quote = await EnterpriseQuote.findByPk(quoteId, {
            include: [{ model: EnterpriseLead }]
        });
        if (!quote) throw new Error('Enterprise Quote not found');

        const lead = (quote as any).enterprise_lead || await EnterpriseLead.findByPk(quote.leadId);

        const monthlyKes = Number((quote.monthlyCostCents / 100).toFixed(2));
        const setupFeeKes = Number((quote.setupFeeCents / 100).toFixed(2));
        const discountKes = Number((quote.discountCents / 100).toFixed(2));

        const subtotalKes = Math.max(0, monthlyKes + setupFeeKes - discountKes);
        const taxKes = Number((subtotalKes * (quote.taxPercentage / 100)).toFixed(2));
        const totalFirstMonthKes = Number((subtotalKes + taxKes).toFixed(2));

        return {
            quote,
            lead,
            financials: {
                monthlyKes,
                setupFeeKes,
                discountKes,
                subtotalKes,
                taxKes,
                totalFirstMonthKes
            }
        };
    }

    /**
     * Process customer response to proposal (Accept / Reject / Request Changes)
     */
    public static async respondToQuote(quoteId: string, action: 'ACCEPT' | 'REJECT' | 'REQUEST_CHANGES', customerNotes?: string): Promise<{
        success: boolean;
        message: string;
        redirectUrl?: string;
    }> {
        const quote = await EnterpriseQuote.findByPk(quoteId);
        if (!quote) throw new Error('Quote not found');

        const lead = await EnterpriseLead.findByPk(quote.leadId);
        if (!lead) throw new Error('Lead not found');

        if (action === 'REJECT') {
            await quote.update({ status: 'REJECTED', customerNotes: customerNotes || null });
            await lead.update({ status: 'LOST' });
            return { success: true, message: 'Proposal response recorded. Thank you for your feedback.' };
        }

        if (action === 'REQUEST_CHANGES') {
            await quote.update({ status: 'CHANGES_REQUESTED', customerNotes: customerNotes || null });
            await lead.update({ status: 'NEGOTIATION' });
            return { success: true, message: 'Your change request has been submitted to your Enterprise Account Manager.' };
        }

        // ACCEPTance Flow
        await quote.update({ status: 'ACCEPTED', customerNotes: customerNotes || null });
        await lead.update({ status: 'WON' });

        // Auto-provision Tenant & Activation Invoice
        const activationResult = await this.activateEnterpriseAccount(quote.id);

        return {
            success: true,
            message: 'Proposal accepted! Redirecting to checkout for activation.',
            redirectUrl: `/checkout?invoiceId=${activationResult.invoice.id}`
        };
    }

    /**
     * Enterprise Account & Tenant Provisioning Engine
     */
    public static async activateEnterpriseAccount(quoteId: string): Promise<{
        tenant: Tenant;
        invoice: SaaSInvoice;
        subscription: TenantSubscription;
    }> {
        const quote = await EnterpriseQuote.findByPk(quoteId);
        if (!quote) throw new Error('Quote not found');

        const lead = await EnterpriseLead.findByPk(quote.leadId);
        if (!lead) throw new Error('Lead not found');

        let tenant: Tenant | null = null;
        if (quote.tenantId) {
            tenant = await Tenant.findByPk(quote.tenantId);
        }

        if (!tenant) {
            // Auto-create Tenant account
            const slug = lead.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 899 + 100);
            tenant = await Tenant.create({
                name: lead.companyName,
                slug,
                subdomain: slug,
                businessEmail: lead.email,
                supportEmail: lead.email,
                supportPhone: lead.phone,
                status: 'ACTIVE'
            });
            await quote.update({ tenantId: tenant.id });
        }

        // Get or create Enterprise Subscription Plan model reference
        let entPlan = await SubscriptionPlan.findOne({ where: { slug: 'enterprise' } });
        if (!entPlan) {
            entPlan = await SubscriptionPlan.create({
                name: 'Enterprise ISP',
                slug: 'enterprise',
                description: 'Custom Enterprise ISP Plan',
                monthlyPriceCents: quote.monthlyCostCents,
                yearlyPriceCents: quote.monthlyCostCents * 12,
                maxActiveUsers: quote.maxActiveUsers,
                maxRouters: quote.maxRouters,
                maxStaff: 50,
                maxSMS: quote.smsAllocation,
                maxCampaigns: 50,
                storageLimitMB: quote.storageAllocationMB,
                apiAccess: true,
                marketingFeatures: true,
                analyticsFeatures: true,
                supportLevel: 'DEDICATED',
                isPopular: false,
                isActive: true
            });
        }

        // Create or update TenantSubscription
        const periodDays = quote.contractDurationMonths * 30;
        let sub = await TenantSubscription.findOne({ where: { tenantId: tenant.id } });
        if (sub) {
            await sub.update({
                planId: entPlan.id,
                status: 'ACTIVE',
                billingCycle: 'YEARLY',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)
            });
        } else {
            sub = await TenantSubscription.create({
                tenantId: tenant.id,
                planId: entPlan.id,
                status: 'ACTIVE',
                billingCycle: 'YEARLY',
                startDate: new Date(),
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000)
            });
        }

        // Calculate financials
        const monthlyKes = Number((quote.monthlyCostCents / 100).toFixed(2));
        const setupKes = Number((quote.setupFeeCents / 100).toFixed(2));
        const subtotalKes = Math.max(0, monthlyKes + setupKes - (quote.discountCents / 100));
        const taxCents = Math.round(subtotalKes * 100 * (quote.taxPercentage / 100));
        const totalCents = Math.round(subtotalKes * 100) + taxCents;

        const invoiceNumber = `INV-ENT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;

        const invoice = await SaaSInvoice.create({
            tenantId: tenant.id,
            invoiceNumber,
            billingPeriodStart: new Date(),
            billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            subscriptionAmountCents: quote.monthlyCostCents,
            taxAmountCents: taxCents,
            discountAmountCents: quote.discountCents,
            totalAmountCents: totalCents,
            paymentStatus: 'UNPAID',
            metadata: JSON.stringify({ itemType: 'SUBSCRIPTION_PLAN', itemSlug: 'enterprise', quoteId: quote.id })
        });

        await SaaSInvoiceItem.create({
            invoiceId: invoice.id,
            description: `Enterprise ISP Plan Activation - Quote ${quote.quoteNumber}`,
            quantity: 1,
            unitPriceCents: quote.monthlyCostCents,
            totalPriceCents: quote.monthlyCostCents,
            category: 'SUBSCRIPTION'
        });

        // Audit Log
        await AuditLog.create({
            tenantId: tenant.id,
            actorType: 'SYSTEM',
            actorId: 'ENTERPRISE_CRM',
            action: 'ENTERPRISE_TENANT_PROVISIONED',
            details: `Enterprise tenant ${tenant.name} provisioned under Quote #${quote.quoteNumber}`,
            ipAddress: '127.0.0.1'
        });

        return { tenant, invoice, subscription: sub };
    }

    /**
     * Generate Enterprise Sales Dashboard Analytics
     */
    public static async getCrmAnalytics(): Promise<{
        summary: {
            openQuotes: number;
            wonDeals: number;
            lostDeals: number;
            conversionRate: number;
            totalEnterpriseRevenueKes: number;
            averageDealSizeKes: number;
            totalPipelineValueKes: number;
        };
        leadsByStatus: Record<string, number>;
    }> {
        const totalLeads = await EnterpriseLead.count();
        const wonDeals = await EnterpriseLead.count({ where: { status: 'WON' } });
        const lostDeals = await EnterpriseLead.count({ where: { status: 'LOST' } });
        const openQuotes = await EnterpriseQuote.count({ where: { status: 'SENT' } });

        const conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;

        const acceptedQuotes = await EnterpriseQuote.findAll({ where: { status: 'ACCEPTED' } });
        const totalEnterpriseRevenueCents = acceptedQuotes.reduce((acc, q) => acc + Number(q.monthlyCostCents), 0);
        const totalEnterpriseRevenueKes = Number((totalEnterpriseRevenueCents / 100).toFixed(2));

        const averageDealSizeKes = wonDeals > 0 ? Number((totalEnterpriseRevenueKes / wonDeals).toFixed(2)) : 0;

        const allQuotes = await EnterpriseQuote.findAll();
        const totalPipelineValueCents = allQuotes.reduce((acc, q) => acc + Number(q.monthlyCostCents), 0);
        const totalPipelineValueKes = Number((totalPipelineValueCents / 100).toFixed(2));

        const stages = ['NEW', 'CONTACTED', 'QUALIFICATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'AWAITING_APPROVAL', 'WON', 'LOST', 'ARCHIVED'];
        const leadsByStatus: Record<string, number> = {};
        for (const s of stages) {
            leadsByStatus[s] = await EnterpriseLead.count({ where: { status: s } });
        }

        return {
            summary: {
                openQuotes,
                wonDeals,
                lostDeals,
                conversionRate,
                totalEnterpriseRevenueKes,
                averageDealSizeKes,
                totalPipelineValueKes
            },
            leadsByStatus
        };
    }
}
