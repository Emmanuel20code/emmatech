import {
    SaaSInvoice,
    SaaSInvoiceItem,
    TenantSubscription,
    SubscriptionPlan,
    SmsPackage,
    TenantSmsWallet,
    SmsTransaction,
    Campaign,
    Wallet,
    WalletTransaction,
    AuditLog,
    Tenant
} from '../models';
import logger from '../utils/logger';
import { sendEmail } from './emailService';
import { SmsProcurementService } from './sms-procurement.service';
import { MpesaService } from './mpesa.service';
import { SaaSBillingService } from './saas-billing.service';
import { SubscriptionAutomationService } from './subscription-automation.service';

export interface CheckoutPrepareParams {
    tenantId: string;
    itemType: 'SUBSCRIPTION_PLAN' | 'SMS_CREDITS' | 'ADVERTISING_CAMPAIGN' | 'EXTRA_ROUTERS' | 'EXTRA_STORAGE' | 'PREMIUM_FEATURE' | 'WALLET_TOPUP';
    itemId?: string;
    itemSlug?: string;
    quantity?: number;
    billingCycle?: 'MONTHLY' | 'YEARLY';
    couponCode?: string;
    customAmountCents?: number;
}

export interface CheckoutResult {
    invoiceId: string;
    invoiceNumber: string;
    itemType: string;
    itemName: string;
    itemDescription: string;
    quantity: number;
    billingCycle: 'MONTHLY' | 'YEARLY';
    unitPriceCents: number;
    subtotalCents: number;
    taxCents: number;
    discountCents: number;
    totalAmountCents: number;
    totalAmountKes: number;
    paymentStatus: string;
    tenantId: string;
}

export class CheckoutService {
    /**
     * Prepares a checkout invoice with server-side validated pricing
     */
    public static async prepareCheckout(params: CheckoutPrepareParams): Promise<CheckoutResult> {
        const { tenantId, itemType, itemId, itemSlug, quantity = 1, billingCycle = 'MONTHLY', couponCode, customAmountCents } = params;

        let validTenantId = tenantId;
        if (!validTenantId || typeof validTenantId !== 'string' || !validTenantId.includes('-')) {
            const firstTenant = await Tenant.findOne({ order: [['createdAt', 'ASC']] });
            if (firstTenant) {
                validTenantId = firstTenant.id;
            } else {
                validTenantId = '00000000-0000-0000-0000-000000000001';
            }
        }

        let itemName = 'Jevish Service';
        let itemDescription = 'Jevish Platform Feature';
        let unitPriceCents = 0;
        let category: 'SUBSCRIPTION' | 'USAGE' | 'SMS' | 'ADVERTISING' | 'ADDON' = 'ADDON';

        if (itemType === 'SUBSCRIPTION_PLAN') {
            category = 'SUBSCRIPTION';
            let plan: SubscriptionPlan | null = null;
            if (itemId) {
                plan = await SubscriptionPlan.findByPk(itemId);
            } else if (itemSlug) {
                plan = await SubscriptionPlan.findOne({ where: { slug: itemSlug } });
            }

            if (!plan) {
                const config = await SaaSBillingService.getPricingConfig();
                if (itemSlug === 'unlimited') {
                    itemName = 'Unlimited Plan';
                    itemDescription = 'Unlimited Subscribers, Unlimited Routers, Full Features';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 : Number(config.baseSubscriptionPriceCents);
                } else if (itemSlug === 'starter') {
                    itemName = 'Unlimited Plan';
                    itemDescription = 'Unlimited Subscribers, Unlimited Routers, Full Features';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 : Number(config.baseSubscriptionPriceCents);
                } else if (itemSlug === 'growth') {
                    itemName = 'Growth ISP Plan';
                    itemDescription = 'Up to 1,000 Active Subscribers, 5 Router Syncs, Marketing Suite';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 * 2 : Number(config.baseSubscriptionPriceCents) * 2;
                } else if (itemSlug === 'professional' || itemSlug === 'pro') {
                    itemName = 'Professional ISP Plan';
                    itemDescription = 'Up to 5,000 Active Subscribers, 25 Router Syncs';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 * 4 : Number(config.baseSubscriptionPriceCents) * 4;
                } else {
                    itemName = 'Unlimited Plan';
                    itemDescription = 'Unlimited Subscribers, Unlimited Routers, Full Features';
                    unitPriceCents = billingCycle === 'YEARLY' ? Number(config.baseSubscriptionPriceCents) * 12 : Number(config.baseSubscriptionPriceCents);
                }
            } else {
                itemName = `${plan.name} Plan`;
                itemDescription = plan.description || 'Jevish Subscription Plan';
                unitPriceCents = billingCycle === 'YEARLY' ? Number(plan.yearlyPriceCents) : Number(plan.monthlyPriceCents);
            }
        } else if (itemType === 'SMS_CREDITS') {
            category = 'SMS';
            let pkg: SmsPackage | null = null;
            if (itemId) {
                pkg = await SmsPackage.findByPk(itemId);
            }

            if (pkg) {
                itemName = pkg.name || `${pkg.smsCount} SMS Credits Pack`;
                itemDescription = `${pkg.smsCount} SMS credits for subscriber alerts and marketing`;
                unitPriceCents = Number(pkg.sellingPrice);
            } else {
                const count = quantity > 0 ? quantity : 1000;
                itemName = `${count.toLocaleString()} SMS Credits Pack`;
                itemDescription = `Package of ${count.toLocaleString()} bulk SMS credits`;
                unitPriceCents = Math.round(count * 80); // 80 cents per SMS = KSh 0.80
            }
        } else if (itemType === 'ADVERTISING_CAMPAIGN') {
            category = 'ADVERTISING';
            let campaign: Campaign | null = null;
            if (itemId) {
                campaign = await Campaign.findByPk(itemId);
            }

            if (campaign) {
                itemName = `Campaign Activation: ${campaign.name}`;
                itemDescription = `Targeted Captive Portal Ad Campaign (${campaign.totalRecipients} Target Recipients)`;
                unitPriceCents = customAmountCents || 250000; // KSh 2,500
            } else {
                itemName = 'Captive Portal Ad Credits';
                itemDescription = '10,000 Targeted Impression Views';
                unitPriceCents = customAmountCents || 250000; // KSh 2,500
            }
        } else if (itemType === 'EXTRA_ROUTERS') {
            category = 'ADDON';
            itemName = `Additional MikroTik Router Add-on (${quantity} Router${quantity > 1 ? 's' : ''})`;
            itemDescription = 'Expanded MikroTik router capacity slot';
            unitPriceCents = 100000 * quantity; // KSh 1,000 per router/mo
        } else if (itemType === 'EXTRA_STORAGE') {
            category = 'ADDON';
            itemName = `Extra Storage Pack (${quantity} GB)`;
            itemDescription = 'Additional database & backup cloud storage';
            unitPriceCents = 50000 * quantity; // KSh 500 per GB
        } else if (itemType === 'WALLET_TOPUP') {
            category = 'USAGE';
            itemName = 'Jevish Tenant Wallet Top-Up';
            itemDescription = 'Prepaid account credit for automated billing';
            unitPriceCents = customAmountCents && customAmountCents >= 10000 ? customAmountCents : 100000; // Default KSh 1,000
        } else {
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
            } else if (cleanCoupon === 'SURFBILL20' || cleanCoupon === 'WELCOME20') {
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
        const invoice = await SaaSInvoice.create({
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
        await SaaSInvoiceItem.create({
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
    public static async payWithWallet(tenantId: string, invoiceId: string): Promise<{ success: boolean; message: string }> {
        const invoice = await SaaSInvoice.findOne({ where: { id: invoiceId, tenantId } });
        if (!invoice) throw new Error('Invoice not found');

        if (invoice.paymentStatus === 'PAID') {
            return { success: true, message: 'Invoice is already paid.' };
        }

        const requiredCents = Number(invoice.totalAmountCents);

        // Fetch tenant wallet
        let wallet = await Wallet.findOne({ where: { tenantId } });
        if (!wallet) {
            wallet = await Wallet.create({ tenantId, balance: 0, settled: 0, pending: 0, frozen: 0 });
        }

        const availableBalanceCents = Math.round(wallet.balance * 100);
        if (availableBalanceCents < requiredCents) {
            throw new Error(`Insufficient wallet balance. Available: KES ${(availableBalanceCents / 100).toFixed(2)}, Required: KES ${(requiredCents / 100).toFixed(2)}`);
        }

        // Deduct from wallet
        const newBalanceKes = Number(((availableBalanceCents - requiredCents) / 100).toFixed(2));
        await wallet.update({ balance: newBalanceKes });

        // Record debit transaction
        await WalletTransaction.create({
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
    public static async payWithStk(tenantId: string, invoiceId: string, phoneNumber: string, req?: any): Promise<{ success: boolean; checkoutRequestId: string; message: string }> {
        const invoice = await SaaSInvoice.findOne({ where: { id: invoiceId, tenantId } });
        if (!invoice) throw new Error('Invoice not found');

        if (invoice.paymentStatus === 'PAID') {
            return { success: true, checkoutRequestId: 'ALREADY_PAID', message: 'Invoice is already paid.' };
        }

        const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
        const amountKes = Math.ceil(Number(invoice.totalAmountCents) / 100);

        const mpesaResult = await MpesaService.initiateStkPushForSaaSInvoice(invoiceId, tenantId, formattedPhone, amountKes, req);
        const checkoutRequestId = mpesaResult.CheckoutRequestID;
        const customMessage = mpesaResult.CustomerMessage || `STK Push prompt sent to ${formattedPhone}. Please enter your M-Pesa PIN on your phone to complete payment.`;

        const metadata = invoice.metadata ? JSON.parse(invoice.metadata) : {};
        metadata.lastStkPhone = formattedPhone;
        metadata.checkoutRequestId = checkoutRequestId;
        await invoice.update({
            metadata: JSON.stringify(metadata)
        });

        logger.info(`[CheckoutService] Live STK Push initiated for Invoice ${invoice.invoiceNumber} on phone ${formattedPhone} for KES ${amountKes}`);

        return {
            success: true,
            checkoutRequestId,
            message: customMessage
        };
    }

    /**
     * Core Activation Handler: Activates subscription/SMS/ads/add-ons upon successful payment
     */
    public static async processPaymentSuccess(invoiceId: string, transactionRef: string, paymentMethod: string): Promise<void> {
        const invoice = await SaaSInvoice.findByPk(invoiceId);
        if (!invoice) {
            logger.error(`[CheckoutService] Cannot process payment for missing invoice ${invoiceId}`);
            return;
        }

        if (invoice.paymentStatus === 'PAID') {
            logger.info(`[CheckoutService] Invoice ${invoice.invoiceNumber} already marked PAID. Skipping duplicate activation.`);
            return;
        }

        const tenantId = invoice.tenantId;
        const metadata = invoice.metadata ? JSON.parse(invoice.metadata) : {};
        const { itemType = 'SUBSCRIPTION_PLAN', itemId, itemSlug, quantity = 1, billingCycle = 'MONTHLY' } = metadata;

        logger.info(`[CheckoutService] Processing automated activation for Tenant ${tenantId}, ItemType ${itemType}`);

        if (itemType === 'SUBSCRIPTION_PLAN' || itemType === 'SUBSCRIPTION') {
            await SubscriptionAutomationService.processTenantSubscriptionPayment({
                tenantId,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amountCents: invoice.totalAmountCents,
                paymentMethod: (paymentMethod as any) || 'MPESA_STK',
                transactionReference: transactionRef,
                planId: itemId,
                billingCycle
            });
        } else {
            // Mark Invoice Paid for other item types
            await invoice.update({
                paymentStatus: 'PAID',
                paidAt: new Date(),
                paymentMethod
            });

            if (itemType === 'SMS_CREDITS') {
                let creditsToAdd = 1000;
                if (itemId) {
                    const pkg = await SmsPackage.findByPk(itemId);
                    if (pkg) creditsToAdd = pkg.smsCount;
                } else if (quantity) {
                    creditsToAdd = quantity;
                }

                // Execute Automated SMS Procurement Engine with Margin Protection
                await SmsProcurementService.processTenantSmsPurchase({
                    tenantId,
                    invoiceId: invoice.id,
                    packageId: itemId || null,
                    smsCount: creditsToAdd,
                    amountPaidCents: invoice.totalAmountCents,
                    paymentMethod: paymentMethod === 'WALLET' ? 'WALLET' : 'MPESA',
                    transactionRef
                });
            } else if (itemType === 'ADVERTISING_CAMPAIGN') {
                if (itemId) {
                    await Campaign.update({ status: 'COMPLETED' }, { where: { id: itemId, tenantId } });
                }
            } else if (itemType === 'WALLET_TOPUP') {
                const amountKes = Number((Number(invoice.totalAmountCents) / 100).toFixed(2));
                let wallet = await Wallet.findOne({ where: { tenantId } });
                if (!wallet) {
                    wallet = await Wallet.create({ tenantId, balance: 0, settled: 0, pending: 0, frozen: 0 });
                }
                const newBalance = Number((wallet.balance + amountKes).toFixed(2));
                await wallet.update({ balance: newBalance });

                await WalletTransaction.create({
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
        await AuditLog.create({
            tenantId,
            userId: null,
            action: 'PAYMENT_ACTIVATION_COMPLETED',
            details: `Processed payment and activated ${itemType} for Invoice #${invoice.invoiceNumber}`,
            ipAddress: '127.0.0.1'
        });

        // 4. Send Confirmation Notification Email
        try {
            const tenant = await Tenant.findByPk(tenantId);
            const targetEmail = tenant?.businessEmail || tenant?.supportEmail;
            if (targetEmail) {
                await sendEmail({
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
        } catch (e: any) {
            logger.warn(`Failed to send activation email notification: ${e.message}`);
        }
    }
}
