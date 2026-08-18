"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const emailService_1 = require("./emailService");
const sms_procurement_service_1 = require("./sms-procurement.service");
const mpesa_service_1 = require("./mpesa.service");
const saas_billing_service_1 = require("./saas-billing.service");
const subscription_automation_service_1 = require("./subscription-automation.service");
class CheckoutService {
    /**
     * Prepares a checkout invoice with server-side validated pricing
     */
    static async prepareCheckout(params) {
        const { tenantId, itemType, itemId, itemSlug, quantity = 1, billingCycle = 'MONTHLY', couponCode, customAmountCents } = params;
        let validTenantId = tenantId;
        if (!validTenantId || typeof validTenantId !== 'string' || !validTenantId.includes('-')) {
            const firstTenant = await models_1.Tenant.findOne({ order: [['createdAt', 'ASC']] });
            if (firstTenant) {
                validTenantId = firstTenant.id;
            }
            else {
                validTenantId = '00000000-0000-0000-0000-000000000001';
            }
        }
        let itemName = 'Jevish Service';
        let itemDescription = 'Jevish Platform Feature';
        let unitPriceCents = 0;
        let category = 'ADDON';
        if (itemType === 'SUBSCRIPTION_PLAN') {
            category = 'SUBSCRIPTION';
            let plan = null;
            if (itemId) {
                plan = await models_1.SubscriptionPlan.findByPk(itemId);
            }
            else if (itemSlug) {
                plan = await models_1.SubscriptionPlan.findOne({ where: { slug: itemSlug } });
            }
            if (!plan) {
                const config = await saas_billing_service_1.SaaSBillingService.getPricingConfig();
                if (itemSlug === 'unlimited') {
                    itemName = 'Unlimited Plan';
                    itemDescription = 'Unlimited Subscribers, Unlimited Routers, Full Features';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 : Number(config.baseSubscriptionPriceCents);
                }
                else if (itemSlug === 'starter') {
                    itemName = 'Unlimited Plan';
                    itemDescription = 'Unlimited Subscribers, Unlimited Routers, Full Features';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 : Number(config.baseSubscriptionPriceCents);
                }
                else if (itemSlug === 'growth') {
                    itemName = 'Growth ISP Plan';
                    itemDescription = 'Up to 1,000 Active Subscribers, 5 Router Syncs, Marketing Suite';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 * 2 : Number(config.baseSubscriptionPriceCents) * 2;
                }
                else if (itemSlug === 'professional' || itemSlug === 'pro') {
                    itemName = 'Professional ISP Plan';
                    itemDescription = 'Up to 5,000 Active Subscribers, 25 Router Syncs';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 * 4 : Number(config.baseSubscriptionPriceCents) * 4;
                }
                else {
                    itemName = 'Unlimited Plan';
                    itemDescription = 'Unlimited Subscribers, Unlimited Routers, Full Features';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 : Number(config.baseSubscriptionPriceCents);
                }
            }
            else {
                itemName = `${plan.name} Plan`;
                itemDescription = plan.description || 'Jevish Subscription Plan';
                unitPriceCents = billingCycle === 'YEARLY' ? Number(plan.yearlyPriceCents) : Number(plan.monthlyPriceCents);
            }
        }
        else if (itemType === 'SMS_CREDITS') {
            category = 'SMS';
            let pkg = null;
            if (itemId) {
                pkg = await models_1.SmsPackage.findByPk(itemId);
            }
            if (pkg) {
                itemName = pkg.name || `${pkg.smsCount} SMS Credits Pack`;
                itemDescription = `${pkg.smsCount} SMS credits for subscriber alerts and marketing`;
                unitPriceCents = Number(pkg.sellingPrice);
            }
            else {
                const count = quantity > 0 ? quantity : 1000;
                itemName = `${count.toLocaleString()} SMS Credits Pack`;
                itemDescription = `Package of ${count.toLocaleString()} bulk SMS credits`;
                unitPriceCents = Math.round(count * 80); // 80 cents per SMS = KSh 0.80
            }
        }
        else if (itemType === 'ADVERTISING_CAMPAIGN') {
            category = 'ADVERTISING';
            let campaign = null;
            if (itemId) {
                campaign = await models_1.Campaign.findByPk(itemId);
            }
            if (campaign) {
                itemName = `Campaign Activation: ${campaign.name}`;
                itemDescription = `Targeted Captive Portal Ad Campaign (${campaign.totalRecipients} Target Recipients)`;
                unitPriceCents = customAmountCents || 250000; // KSh 2,500
            }
            else {
                itemName = 'Captive Portal Ad Credits';
                itemDescription = '10,000 Targeted Impression Views';
                unitPriceCents = customAmountCents || 250000; // KSh 2,500
            }
        }
        else if (itemType === 'EXTRA_ROUTERS') {
            category = 'ADDON';
            itemName = `Additional MikroTik Router Add-on (${quantity} Router${quantity > 1 ? 's' : ''})`;
            itemDescription = 'Expanded MikroTik router capacity slot';
            unitPriceCents = 100000 * quantity; // KSh 1,000 per router/mo
        }
        else if (itemType === 'EXTRA_STORAGE') {
            category = 'ADDON';
            itemName = `Extra Storage Pack (${quantity} GB)`;
            itemDescription = 'Additional database & backup cloud storage';
            unitPriceCents = 50000 * quantity; // KSh 500 per GB
        }
        else if (itemType === 'WALLET_TOPUP') {
            category = 'USAGE';
            itemName = 'Jevish Tenant Wallet Top-Up';
            itemDescription = 'Prepaid account credit for automated billing';
            unitPriceCents = customAmountCents && customAmountCents >= 10000 ? customAmountCents : 100000; // Default KSh 1,000
        }
        else {
            category = 'ADDON';
            itemName = 'Jevish Premium Add-on Feature';
            itemDescription = 'Advanced ISP module activation';
            unitPriceCents = customAmountCents || 150000;
        }
        const subtotalCents = unitPriceCents * quantity;
        // Coupon calculation
        let discountCents = 0;
        if (couponCode) {
            const cleanCoupon = couponCode.trim().toUpperCase();
            if (cleanCoupon === 'SURFBILL10' || cleanCoupon === 'SAVE10') {
                discountCents = Math.round(subtotalCents * 0.10); // 10% discount
            }
            else if (cleanCoupon === 'SURFBILL20' || cleanCoupon === 'WELCOME20') {
                discountCents = Math.round(subtotalCents * 0.20); // 20% discount
            }
        }
        const taxableAmount = Math.max(0, subtotalCents - discountCents);
        const taxCents = 0; // VAT tax removed
        const totalAmountCents = taxableAmount + taxCents;
        const periodStart = new Date();
        const periodEnd = new Date(periodStart.getTime() + (billingCycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000);
        const dueDate = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;
        // Create SaaSInvoice
        const invoice = await models_1.SaaSInvoice.create({
            tenantId: validTenantId,
            invoiceNumber,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            dueDate,
            subscriptionAmountCents: subtotalCents,
            taxAmountCents: taxCents,
            discountAmountCents: discountCents,
            totalAmountCents,
            paymentStatus: 'UNPAID',
            metadata: JSON.stringify({ itemType, itemId, itemSlug, quantity, billingCycle, couponCode })
        });
        // Create SaaSInvoiceItem
        await models_1.SaaSInvoiceItem.create({
            invoiceId: invoice.id,
            description: itemName,
            quantity,
            unitPriceCents,
            totalPriceCents: subtotalCents,
            category
        });
        return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            itemType,
            itemName,
            itemDescription,
            quantity,
            billingCycle,
            unitPriceCents,
            subtotalCents,
            taxCents,
            discountCents,
            totalAmountCents,
            totalAmountKes: Number((totalAmountCents / 100).toFixed(2)),
            paymentStatus: invoice.paymentStatus,
            tenantId: validTenantId
        };
    }
    /**
     * Pays invoice via Tenant Wallet balance instantly
     */
    static async payWithWallet(tenantId, invoiceId) {
        const invoice = await models_1.SaaSInvoice.findOne({ where: { id: invoiceId, tenantId } });
        if (!invoice)
            throw new Error('Invoice not found');
        if (invoice.paymentStatus === 'PAID') {
            return { success: true, message: 'Invoice is already paid.' };
        }
        const requiredCents = Number(invoice.totalAmountCents);
        // Fetch tenant wallet
        let wallet = await models_1.Wallet.findOne({ where: { tenantId } });
        if (!wallet) {
            wallet = await models_1.Wallet.create({ tenantId, balance: 0, settled: 0, pending: 0, frozen: 0 });
        }
        const availableBalanceCents = Math.round(wallet.balance * 100);
        if (availableBalanceCents < requiredCents) {
            throw new Error(`Insufficient wallet balance. Available: KES ${(availableBalanceCents / 100).toFixed(2)}, Required: KES ${(requiredCents / 100).toFixed(2)}`);
        }
        // Deduct from wallet
        const newBalanceKes = Number(((availableBalanceCents - requiredCents) / 100).toFixed(2));
        await wallet.update({ balance: newBalanceKes });
        // Record debit transaction
        await models_1.WalletTransaction.create({
            walletId: wallet.id,
            tenantId,
            transactionType: 'DEBIT',
            amount: Number((requiredCents / 100).toFixed(2)),
            balanceAfter: newBalanceKes,
            description: `Payment for Invoice #${invoice.invoiceNumber}`
        });
        // Trigger service activation
        await this.processPaymentSuccess(invoice.id, `WALLET-TX-${Date.now()}`, 'WALLET');
        return { success: true, message: 'Payment completed successfully via Wallet balance.' };
    }
    /**
     * Triggers live STK Push payment for an invoice
     */
    static async payWithStk(tenantId, invoiceId, phoneNumber, req) {
        const invoice = await models_1.SaaSInvoice.findOne({ where: { id: invoiceId, tenantId } });
        if (!invoice)
            throw new Error('Invoice not found');
        if (invoice.paymentStatus === 'PAID') {
            return { success: true, checkoutRequestId: 'ALREADY_PAID', message: 'Invoice is already paid.' };
        }
        const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
        const amountKes = Math.ceil(Number(invoice.totalAmountCents) / 100);
        const mpesaResult = await mpesa_service_1.MpesaService.initiateStkPushForSaaSInvoice(invoiceId, tenantId, formattedPhone, amountKes, req);
        const checkoutRequestId = mpesaResult.CheckoutRequestID;
        const customMessage = mpesaResult.CustomerMessage || `STK Push prompt sent to ${formattedPhone}. Please enter your M-Pesa PIN on your phone to complete payment.`;
        const metadata = invoice.metadata ? JSON.parse(invoice.metadata) : {};
        metadata.lastStkPhone = formattedPhone;
        metadata.checkoutRequestId = checkoutRequestId;
        await invoice.update({
            metadata: JSON.stringify(metadata)
        });
        logger_1.default.info(`[CheckoutService] Live STK Push initiated for Invoice ${invoice.invoiceNumber} on phone ${formattedPhone} for KES ${amountKes}`);
        return {
            success: true,
            checkoutRequestId,
            message: customMessage
        };
    }
    /**
     * Core Activation Handler: Activates subscription/SMS/ads/add-ons upon successful payment
     */
    static async processPaymentSuccess(invoiceId, transactionRef, paymentMethod) {
        const invoice = await models_1.SaaSInvoice.findByPk(invoiceId);
        if (!invoice) {
            logger_1.default.error(`[CheckoutService] Cannot process payment for missing invoice ${invoiceId}`);
            return;
        }
        if (invoice.paymentStatus === 'PAID') {
            logger_1.default.info(`[CheckoutService] Invoice ${invoice.invoiceNumber} already marked PAID. Skipping duplicate activation.`);
            return;
        }
        const tenantId = invoice.tenantId;
        const metadata = invoice.metadata ? JSON.parse(invoice.metadata) : {};
        const { itemType = 'SUBSCRIPTION_PLAN', itemId, itemSlug, quantity = 1, billingCycle = 'MONTHLY' } = metadata;
        logger_1.default.info(`[CheckoutService] Processing automated activation for Tenant ${tenantId}, ItemType ${itemType}`);
        if (itemType === 'SUBSCRIPTION_PLAN' || itemType === 'SUBSCRIPTION') {
            await subscription_automation_service_1.SubscriptionAutomationService.processTenantSubscriptionPayment({
                tenantId,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amountCents: invoice.totalAmountCents,
                paymentMethod: paymentMethod || 'MPESA_STK',
                transactionReference: transactionRef,
                planId: itemId,
                billingCycle
            });
        }
        else {
            // Mark Invoice Paid for other item types
            await invoice.update({
                paymentStatus: 'PAID',
                paidAt: new Date(),
                paymentMethod
            });
            if (itemType === 'SMS_CREDITS') {
                let creditsToAdd = 1000;
                if (itemId) {
                    const pkg = await models_1.SmsPackage.findByPk(itemId);
                    if (pkg)
                        creditsToAdd = pkg.smsCount;
                }
                else if (quantity) {
                    creditsToAdd = quantity;
                }
                // Execute Automated SMS Procurement Engine with Margin Protection
                await sms_procurement_service_1.SmsProcurementService.processTenantSmsPurchase({
                    tenantId,
                    invoiceId: invoice.id,
                    packageId: itemId || null,
                    smsCount: creditsToAdd,
                    amountPaidCents: invoice.totalAmountCents,
                    paymentMethod: paymentMethod === 'WALLET' ? 'WALLET' : 'MPESA',
                    transactionRef
                });
            }
            else if (itemType === 'ADVERTISING_CAMPAIGN') {
                if (itemId) {
                    await models_1.Campaign.update({ status: 'COMPLETED' }, { where: { id: itemId, tenantId } });
                }
            }
            else if (itemType === 'WALLET_TOPUP') {
                const amountKes = Number((Number(invoice.totalAmountCents) / 100).toFixed(2));
                let wallet = await models_1.Wallet.findOne({ where: { tenantId } });
                if (!wallet) {
                    wallet = await models_1.Wallet.create({ tenantId, balance: 0, settled: 0, pending: 0, frozen: 0 });
                }
                const newBalance = Number((wallet.balance + amountKes).toFixed(2));
                await wallet.update({ balance: newBalance });
                await models_1.WalletTransaction.create({
                    walletId: wallet.id,
                    tenantId,
                    transactionType: 'CREDIT',
                    amount: amountKes,
                    balanceAfter: newBalance,
                    description: `Wallet Top-Up via Invoice #${invoice.invoiceNumber}`
                });
            }
        }
        // 3. Create Audit Log
        await models_1.AuditLog.create({
            tenantId,
            userId: null,
            action: 'PAYMENT_ACTIVATION_COMPLETED',
            details: `Processed payment and activated ${itemType} for Invoice #${invoice.invoiceNumber}`,
            ipAddress: '127.0.0.1'
        });
        // 4. Send Confirmation Notification Email
        try {
            const tenant = await models_1.Tenant.findByPk(tenantId);
            const targetEmail = tenant?.businessEmail || tenant?.supportEmail;
            if (targetEmail) {
                await (0, emailService_1.sendEmail)({
                    to: targetEmail,
                    subject: `Payment Confirmation & Invoice Paid - #${invoice.invoiceNumber}`,
                    html: `<div style="font-family: sans-serif; padding: 20px;">
                        <h2>Payment Received</h2>
                        <p>Your payment for Invoice #${invoice.invoiceNumber} (KES ${(Number(invoice.totalAmountCents) / 100).toFixed(2)}) was successfully processed.</p>
                        <p>Your <strong>${itemType}</strong> feature is now active.</p>
                        <p>Thank you,<br/>Jevish Pro Team</p>
                    </div>`
                });
            }
        }
        catch (e) {
            logger_1.default.warn(`Failed to send activation email notification: ${e.message}`);
        }
    }
}
exports.CheckoutService = CheckoutService;
