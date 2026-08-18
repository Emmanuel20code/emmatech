"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaaSBillingService = void 0;
const models_1 = require("../models");
const subscription_automation_service_1 = require("./subscription-automation.service");
const logger_1 = __importDefault(require("../utils/logger"));
const sequelize_1 = require("sequelize");
class SaaSBillingService {
    // ─────────────────────────────────────────────────────────────
    // 1. GLOBAL PRICING & PLAN SEEDING
    // ─────────────────────────────────────────────────────────────
    static async getPricingConfig() {
        let config = await models_1.PlatformPricingConfig.findOne();
        if (!config) {
            config = await models_1.PlatformPricingConfig.create({
                baseSubscriptionPriceCents: 150000, // KSh 1,500 default
                includedActiveUsers: 100,
                extraActiveUserPriceCents: 1500, // KSh 15 per extra user
                adMonthlyFeeCents: 500000, // KSh 5,000
                adCampaignFeeCents: 100000, // KSh 1,000
                adVideoFeeCents: 200000, // KSh 2,000
                adBannerFeeCents: 50000, // KSh 500
                adStorageFeeCents: 50000, // KSh 500
                smsPriceCents: 200, // KSh 2.00
                emailPriceCents: 50, // KSh 0.50
                whatsappPriceCents: 300, // KSh 3.00
                extraRouterPriceCents: 100000, // KSh 1,000
                vatPercentage: 0.0,
                gracePeriodDays: 7,
                trialPeriodDays: 14,
                latePaymentFeeCents: 50000 // KSh 500
            });
        }
        return config;
    }
    static async updatePricingConfig(updates) {
        const config = await this.getPricingConfig();
        await config.update(updates);
        if (updates.baseSubscriptionPriceCents !== undefined) {
            const basePrice = Number(updates.baseSubscriptionPriceCents);
            const unlimited = await models_1.SubscriptionPlan.findOne({ where: { slug: 'unlimited' } });
            if (unlimited) {
                await unlimited.update({
                    monthlyPriceCents: basePrice,
                    yearlyPriceCents: basePrice * 12
                });
            }
        }
        return config;
    }
    static async seedSubscriptionPlans() {
        const config = await this.getPricingConfig();
        const basePrice = Number(config.baseSubscriptionPriceCents) || 150000;
        const count = await models_1.SubscriptionPlan.count();
        if (count === 0) {
            await models_1.SubscriptionPlan.bulkCreate([
                {
                    name: 'Unlimited',
                    slug: 'unlimited',
                    description: 'Unlimited access to all features',
                    monthlyPriceCents: basePrice, // KSh 1500 default or whatever is in pricing config
                    yearlyPriceCents: basePrice * 12,
                    maxActiveUsers: -1, // Unlimited
                    maxRouters: -1,
                    maxStaff: -1,
                    maxSMS: -1,
                    maxWhatsapp: -1,
                    maxCampaigns: -1,
                    maxAdvertisements: -1,
                    maxBranches: -1,
                    maxIntegrations: -1,
                    storageLimitMB: -1,
                    apiAccess: true,
                    marketingFeatures: true,
                    analyticsFeatures: true,
                    whiteLabelFeatures: true,
                    multiBranchFeatures: true,
                    customIntegrations: true,
                    supportLevel: 'DEDICATED',
                    isPopular: true,
                    isActive: true
                }
            ]);
        }
        else {
            const hasUnlimited = await models_1.SubscriptionPlan.findOne({ where: { slug: 'unlimited' } });
            if (!hasUnlimited) {
                await models_1.SubscriptionPlan.create({
                    name: 'Unlimited',
                    slug: 'unlimited',
                    description: 'Unlimited access to all features',
                    monthlyPriceCents: basePrice,
                    yearlyPriceCents: basePrice * 12,
                    maxActiveUsers: -1,
                    maxRouters: -1,
                    maxStaff: -1,
                    maxSMS: -1,
                    maxWhatsapp: -1,
                    maxCampaigns: -1,
                    maxAdvertisements: -1,
                    maxBranches: -1,
                    maxIntegrations: -1,
                    storageLimitMB: -1,
                    apiAccess: true,
                    marketingFeatures: true,
                    analyticsFeatures: true,
                    whiteLabelFeatures: true,
                    multiBranchFeatures: true,
                    customIntegrations: true,
                    supportLevel: 'DEDICATED',
                    isPopular: true,
                    isActive: true
                });
            }
            else {
                // Keep unlimited plan's price in sync with baseSubscriptionPriceCents
                await hasUnlimited.update({
                    monthlyPriceCents: basePrice,
                    yearlyPriceCents: basePrice * 12
                });
            }
        }
        return models_1.SubscriptionPlan.findAll({ where: { isActive: true } });
    }
    // ─────────────────────────────────────────────────────────────
    // 2. ACTIVE USER BILLING ENGINE
    // ─────────────────────────────────────────────────────────────
    static async calculateActiveUsers(tenantId) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOf30Days = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        // Today Active Unique Subscribers
        const todayCount = await models_1.Subscriber.count({
            where: {
                tenantId,
                status: 'ACTIVE'
            }
        });
        // Monthly Active Subscribers (Last 30 Days)
        const monthlyCount = await models_1.Subscriber.count({
            where: {
                tenantId,
                status: 'ACTIVE'
            }
        });
        // Cycle Active Subscribers (Current Month)
        const cycleCount = await models_1.Subscriber.count({
            where: {
                tenantId,
                status: 'ACTIVE'
            }
        });
        // Total Historical Subscribers
        const historicalCount = await models_1.Subscriber.count({ where: { tenantId } });
        return {
            todayActive: todayCount,
            monthlyActive: monthlyCount,
            cycleActive: cycleCount,
            historicalActive: historicalCount
        };
    }
    // ─────────────────────────────────────────────────────────────
    // 3. AUTOMATIC INVOICE GENERATION ENGINE
    // ─────────────────────────────────────────────────────────────
    static async generateInvoice(tenantId, customPeriodStart, customPeriodEnd) {
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant) {
            throw new Error(`Tenant with ID ${tenantId} not found.`);
        }
        const config = await this.getPricingConfig();
        // Get tenant subscription or create default
        let sub = await models_1.TenantSubscription.findOne({ where: { tenantId } });
        if (!sub) {
            let planToUse = await models_1.SubscriptionPlan.findOne({ where: { slug: 'unlimited' } })
                || await models_1.SubscriptionPlan.findOne({ where: { isActive: true } })
                || await models_1.SubscriptionPlan.findOne();
            if (!planToUse) {
                const plans = await this.seedSubscriptionPlans();
                planToUse = plans[0];
            }
            sub = await models_1.TenantSubscription.create({
                tenantId,
                planId: planToUse.id,
                status: 'ACTIVE',
                billingCycle: 'MONTHLY',
                startDate: new Date(),
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }
        const plan = await models_1.SubscriptionPlan.findByPk(sub.planId);
        const planPriceCents = Number(plan?.monthlyPriceCents || config.baseSubscriptionPriceCents);
        const periodStart = customPeriodStart || sub.currentPeriodStart || new Date();
        const periodEnd = customPeriodEnd || sub.currentPeriodEnd || new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        const dueDate = new Date(periodEnd.getTime() + config.gracePeriodDays * 24 * 60 * 60 * 1000);
        // Compute Active User Overage
        const activeUsers = await this.calculateActiveUsers(tenantId);
        const includedUsers = config.includedActiveUsers;
        const extraUsers = Math.max(0, activeUsers.cycleActive - includedUsers);
        const usageAmountCents = extraUsers * Number(config.extraActiveUserPriceCents);
        // Compute Advertisement Fees
        const activeAdCampaigns = await models_1.AdCampaign.count({ where: { tenantId, status: 'RUNNING' } });
        const hasAdModule = await models_1.TenantAddonModule.findOne({ where: { tenantId, moduleName: 'ADVERTISING', status: 'ACTIVE' } });
        let adAmountCents = 0;
        if (activeAdCampaigns > 0 || hasAdModule) {
            adAmountCents = Number(config.adMonthlyFeeCents) + (activeAdCampaigns * Number(config.adCampaignFeeCents));
        }
        // Add-on Module Fees
        const addons = await models_1.TenantAddonModule.findAll({ where: { tenantId, status: 'ACTIVE' } });
        const addonAmountCents = addons.reduce((acc, curr) => acc + Number(curr.monthlyPriceCents || 0), 0);
        // Subtotal before tax
        const subtotalCents = planPriceCents + usageAmountCents + adAmountCents + addonAmountCents;
        const taxAmountCents = Math.round(subtotalCents * (config.vatPercentage / 100));
        const totalAmountCents = subtotalCents + taxAmountCents;
        // Generate Invoice Number (e.g. INV-2026-00042)
        const count = await models_1.SaaSInvoice.count();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        // Create Invoice Record
        const invoice = await models_1.SaaSInvoice.create({
            tenantId,
            invoiceNumber,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            dueDate,
            subscriptionAmountCents: planPriceCents,
            usageAmountCents,
            adAmountCents,
            smsAmountCents: 0,
            emailAmountCents: 0,
            whatsappAmountCents: 0,
            extraRoutersAmountCents: 0,
            addonAmountCents,
            taxAmountCents,
            discountAmountCents: 0,
            lateFeeCents: 0,
            totalAmountCents,
            paymentStatus: 'UNPAID',
            intasendCheckoutUrl: `https://payment.intasend.com/pay/${invoiceNumber}`
        });
        // Itemized Line Items
        await models_1.SaaSInvoiceItem.bulkCreate([
            {
                invoiceId: invoice.id,
                description: `Base Monthly Subscription (${plan?.name || 'Starter Plan'})`,
                category: 'SUBSCRIPTION',
                quantity: 1,
                unitPriceCents: planPriceCents,
                totalPriceCents: planPriceCents
            },
            ...(extraUsers > 0 ? [{
                    invoiceId: invoice.id,
                    description: `Active User Usage Overage (${extraUsers} extra subscribers @ KES ${(Number(config.extraActiveUserPriceCents) / 100).toFixed(2)})`,
                    category: 'USAGE',
                    quantity: extraUsers,
                    unitPriceCents: Number(config.extraActiveUserPriceCents),
                    totalPriceCents: usageAmountCents
                }] : []),
            ...(adAmountCents > 0 ? [{
                    invoiceId: invoice.id,
                    description: `Captive Portal Advertising Fee (${activeAdCampaigns} active campaigns)`,
                    category: 'ADVERTISING',
                    quantity: 1,
                    unitPriceCents: adAmountCents,
                    totalPriceCents: adAmountCents
                }] : []),
            ...(taxAmountCents > 0 ? [{
                    invoiceId: invoice.id,
                    description: `Value Added Tax (VAT ${config.vatPercentage}%)`,
                    category: 'TAX',
                    quantity: 1,
                    unitPriceCents: taxAmountCents,
                    totalPriceCents: taxAmountCents
                }] : [])
        ]);
        // Audit Trail & Notification
        await models_1.SaaSNotification.create({
            tenantId,
            type: 'INVOICE_CREATED',
            title: `Invoice ${invoiceNumber} Generated`,
            message: `Your monthly subscription invoice of KES ${(totalAmountCents / 100).toLocaleString()} is ready.`
        });
        logger_1.default.info(`Generated SaaS invoice ${invoiceNumber} for tenant ${tenantId}`, { totalAmountCents });
        return invoice;
    }
    // ─────────────────────────────────────────────────────────────
    // 4. INTASEND PAYMENT & WEBHOOK ENGINE (IDEMPOTENT)
    // ─────────────────────────────────────────────────────────────
    static async processIntaSendWebhook(payload) {
        const { invoice_number, tracking_id, state, amount } = payload;
        const ref = tracking_id || payload.checkout_id || `INTASEND-${Date.now()}`;
        // Idempotency check: prevent duplicate payment processing
        const existingPayment = await models_1.SaaSPayment.findOne({ where: { transactionReference: ref } });
        if (existingPayment) {
            return { success: true, invoiceId: existingPayment.invoiceId, message: 'Payment already processed (idempotent).' };
        }
        const invoice = await models_1.SaaSInvoice.findOne({ where: { invoiceNumber: invoice_number } });
        if (!invoice) {
            return { success: false, message: `Invoice ${invoice_number} not found.` };
        }
        if (state === 'COMPLETE' || state === 'SUCCESSFUL') {
            await subscription_automation_service_1.SubscriptionAutomationService.processTenantSubscriptionPayment({
                tenantId: invoice.tenantId,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amountCents: invoice.totalAmountCents,
                paymentMethod: 'INTASEND',
                transactionReference: ref,
                rawPayload: payload
            });
            return { success: true, invoiceId: invoice.id, message: 'Payment processed successfully.' };
        }
        return { success: false, message: `Payment state ${state} not actionable.` };
    }
    // ─────────────────────────────────────────────────────────────
    // 5. GRACE PERIOD & AUTOMATED SUSPENSION STATE MACHINE
    // ─────────────────────────────────────────────────────────────
    static async evaluateGracePeriods() {
        const now = new Date();
        const config = await this.getPricingConfig();
        // 1. Transition ACTIVE -> GRACE_PERIOD if period ended
        const overdueSubs = await models_1.TenantSubscription.findAll({
            where: {
                status: 'ACTIVE',
                currentPeriodEnd: { [sequelize_1.Op.lt]: now }
            }
        });
        let graceCount = 0;
        for (const sub of overdueSubs) {
            const graceEnd = new Date(sub.currentPeriodEnd.getTime() + config.gracePeriodDays * 24 * 60 * 60 * 1000);
            await sub.update({
                status: 'GRACE_PERIOD',
                gracePeriodEndDate: graceEnd
            });
            await models_1.SaaSNotification.create({
                tenantId: sub.tenantId,
                type: 'GRACE_PERIOD_ENDING',
                title: 'Subscription Overdue - Grace Period Active',
                message: `Your subscription is overdue. Please settle your invoice within ${config.gracePeriodDays} days to avoid service interruption.`
            });
            graceCount++;
        }
        // 2. Transition GRACE_PERIOD -> SUSPENDED if grace period expired
        const expiredGraceSubs = await models_1.TenantSubscription.findAll({
            where: {
                status: 'GRACE_PERIOD',
                gracePeriodEndDate: { [sequelize_1.Op.lt]: now }
            }
        });
        let suspendedCount = 0;
        for (const sub of expiredGraceSubs) {
            await sub.update({ status: 'SUSPENDED' });
            // Update Tenant Status
            const tenant = await models_1.Tenant.findByPk(sub.tenantId);
            if (tenant) {
                await tenant.update({ status: 'SUSPENDED' });
            }
            await models_1.SaaSNotification.create({
                tenantId: sub.tenantId,
                type: 'SUBSCRIPTION_SUSPENDED',
                title: 'Account Suspended',
                message: 'Your account has been suspended due to overdue unpaid invoices. Data remains intact; pay invoice to resume.'
            });
            suspendedCount++;
        }
        return { gracePeriodCount: graceCount, suspendedCount };
    }
    // ─────────────────────────────────────────────────────────────
    // 6. DASHBOARDS & FINANCIAL REPORTING
    // ─────────────────────────────────────────────────────────────
    static async getSuperAdminMetrics() {
        const config = await this.getPricingConfig();
        const activeTenants = await models_1.TenantSubscription.count({ where: { status: 'ACTIVE' } });
        const trialTenants = await models_1.TenantSubscription.count({ where: { status: 'TRIAL' } });
        const graceTenants = await models_1.TenantSubscription.count({ where: { status: 'GRACE_PERIOD' } });
        const suspendedTenants = await models_1.TenantSubscription.count({ where: { status: 'SUSPENDED' } });
        const invoices = await models_1.SaaSInvoice.findAll();
        const paidInvoices = invoices.filter(i => i.paymentStatus === 'PAID');
        const unpaidInvoices = invoices.filter(i => i.paymentStatus === 'UNPAID' || i.paymentStatus === 'OVERDUE');
        const totalCollectedCents = paidInvoices.reduce((acc, curr) => acc + Number(curr.totalAmountCents || 0), 0);
        const totalOutstandingCents = unpaidInvoices.reduce((acc, curr) => acc + Number(curr.totalAmountCents || 0), 0);
        // MRR & ARR
        const mrrCents = activeTenants * Number(config.baseSubscriptionPriceCents);
        const arrCents = mrrCents * 12;
        return {
            mrr: mrrCents / 100,
            arr: arrCents / 100,
            activeTenants,
            trialTenants,
            graceTenants,
            suspendedTenants,
            collectedRevenue: totalCollectedCents / 100,
            outstandingRevenue: totalOutstandingCents / 100,
            baseSubscriptionPrice: Number(config.baseSubscriptionPriceCents) / 100,
            pricingConfig: config
        };
    }
    static async getTenantBillingOverview(tenantId) {
        const tenant = await models_1.Tenant.findByPk(tenantId);
        let sub = await models_1.TenantSubscription.findOne({ where: { tenantId }, include: [models_1.SubscriptionPlan] });
        if (!sub) {
            await this.generateInvoice(tenantId);
            sub = await models_1.TenantSubscription.findOne({ where: { tenantId }, include: [models_1.SubscriptionPlan] });
        }
        const activeUsers = await this.calculateActiveUsers(tenantId);
        const invoices = await models_1.SaaSInvoice.findAll({ where: { tenantId }, order: [['createdAt', 'DESC']] });
        const unpaidInvoice = invoices.find(i => i.paymentStatus === 'UNPAID' || i.paymentStatus === 'OVERDUE');
        return {
            tenantName: tenant?.name,
            status: sub?.status || 'ACTIVE',
            planName: sub?.SubscriptionPlan?.name || 'Starter Plan',
            billingCycle: sub?.billingCycle || 'MONTHLY',
            currentPeriodEnd: sub?.currentPeriodEnd,
            amountDue: unpaidInvoice ? Number(unpaidInvoice.totalAmountCents) / 100 : 0,
            unpaidInvoiceId: unpaidInvoice?.id,
            activeUsers,
            invoices: invoices.map(i => ({
                id: i.id,
                invoiceNumber: i.invoiceNumber,
                periodStart: i.billingPeriodStart,
                periodEnd: i.billingPeriodEnd,
                dueDate: i.dueDate,
                totalAmount: Number(i.totalAmountCents) / 100,
                status: i.paymentStatus,
                intasendUrl: i.intasendCheckoutUrl
            }))
        };
    }
}
exports.SaaSBillingService = SaaSBillingService;
