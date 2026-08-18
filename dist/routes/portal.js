"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const mpesa_service_1 = require("../services/mpesa.service");
const logger_1 = __importDefault(require("../utils/logger"));
const marketing_service_1 = require("../services/marketing.service");
const phone_1 = require("../utils/phone");
const payment_normalization_service_1 = require("../services/payment-normalization.service");
const router = (0, express_1.Router)();
const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
const resolveTenant = async (idOrSubdomain) => {
    if (!idOrSubdomain || idOrSubdomain === 'null' || idOrSubdomain === 'undefined') {
        return await models_1.Tenant.findOne();
    }
    if (isUuid(idOrSubdomain)) {
        const tenantByPk = await models_1.Tenant.findByPk(idOrSubdomain);
        if (tenantByPk)
            return tenantByPk;
    }
    let tenant = await models_1.Tenant.findOne({ where: { subdomain: idOrSubdomain } });
    if (!tenant) {
        tenant = await models_1.Tenant.findOne({ where: { customDomain: idOrSubdomain } });
    }
    if (!tenant && (idOrSubdomain === 'my-tenant' || idOrSubdomain === 'primary' || idOrSubdomain === 'default')) {
        tenant = await models_1.Tenant.findOne();
    }
    if (!tenant) {
        tenant = await models_1.Tenant.findOne();
    }
    return tenant;
};
// 0. Get Tenant Configuration (Branding) - by ID
router.get('/:tenantId/config', async (req, res) => {
    const tenant = await resolveTenant(req.params.tenantId);
    if (!tenant)
        return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
});
// 0b. Get Tenant Configuration by Subdomain
router.get('/config/:subdomain', async (req, res) => {
    const tenant = await models_1.Tenant.findOne({
        where: { subdomain: req.params.subdomain },
        attributes: ['id', 'name', 'logoUrl', 'primaryColor', 'subdomain', 'contactPhone', 'supportPhone', 'supportEmail', 'welcomeMessage']
    });
    if (!tenant)
        return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
});
// 0c. Get Eligible Captive Portal Ads (Asynchronous & Resilient)
router.get('/:tenantId/ads', async (req, res) => {
    try {
        const tenantDoc = await resolveTenant(req.params.tenantId);
        const tenantId = tenantDoc?.id || req.params.tenantId;
        const displayRule = req.query.displayRule || 'BEFORE_LOGIN';
        const routerId = req.query.routerId;
        const packageId = req.query.packageId;
        const deviceType = req.query.deviceType || 'DESKTOP';
        const ads = await marketing_service_1.MarketingService.getEligibleAds(tenantId, {
            displayRule,
            routerId,
            packageId,
            deviceType
        });
        res.json(ads);
    }
    catch (error) {
        logger_1.default.error('Captive portal ad fetch error, returning fallback', { error: error.message });
        res.json([]);
    }
});
// 0d. Track Captive Portal Ad Event
router.post('/ads/:adId/track', async (req, res) => {
    try {
        const adId = req.params.adId;
        const { tenantId, eventType, routerId, packageId, deviceType } = req.body;
        if (!tenantId || !eventType) {
            return res.status(400).json({ error: 'Missing tenantId or eventType' });
        }
        await marketing_service_1.MarketingService.trackEvent(tenantId, adId, eventType, {
            routerId,
            packageId,
            deviceType
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 0e. Verify & Redeem Captive Portal Promo Coupon
router.post('/:tenantId/verify-coupon', async (req, res) => {
    try {
        const tenantDoc = await resolveTenant(req.params.tenantId);
        const tenantId = tenantDoc?.id || req.params.tenantId;
        const couponCode = (req.body.couponCode || '').toUpperCase().trim();
        if (!couponCode) {
            return res.status(400).json({ valid: false, message: 'Please enter a coupon code' });
        }
        const coupon = await models_1.MarketingCoupon.findOne({
            where: { tenantId, couponCode, status: 'ACTIVE' }
        });
        if (!coupon) {
            return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code' });
        }
        if (coupon.currentUses >= coupon.maxUses) {
            return res.status(400).json({ valid: false, message: 'Coupon max redemptions reached' });
        }
        if (coupon.expirationDate && new Date() > coupon.expirationDate) {
            return res.status(400).json({ valid: false, message: 'Coupon code has expired' });
        }
        res.json({
            valid: true,
            couponCode: coupon.couponCode,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            message: `Coupon applied! ${coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `KES ${coupon.discountValue} OFF`}`
        });
    }
    catch (error) {
        res.status(500).json({ valid: false, message: error.message });
    }
});
// 1. Get Packages for a specific tenant
router.get('/:tenantId/packages', async (req, res) => {
    try {
        const tenantDoc = await resolveTenant(req.params.tenantId);
        const tenantId = tenantDoc?.id;
        if (!tenantId) {
            return res.json([]);
        }
        let packages = await models_1.Package.findAll({
            where: {
                tenantId: tenantId,
                isEnabled: true
            },
            order: [['price', 'ASC']]
        });
        if (!packages || packages.length === 0) {
            packages = await models_1.Package.findAll({
                where: { tenantId: tenantId },
                order: [['price', 'ASC']]
            });
        }
        res.json(packages);
    }
    catch (error) {
        logger_1.default.error('Error fetching portal packages', { tenantId: req.params.tenantId, error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// 2. Initiate M-Pesa STK Push Payment (Hotspot or ISP)
router.post('/:tenantId/pay', async (req, res) => {
    try {
        const { phone, packageId, mac, ip, routerId, subscriberId } = req.body;
        const tenantParam = req.params.tenantId;
        // Normalize Kenyan phone
        const phoneValidation = (0, phone_1.normalizeKenyanPhone)(phone);
        if (!phoneValidation.isValid) {
            return res.status(400).json({ error: phoneValidation.error || 'Please provide a valid Kenyan phone number' });
        }
        const formattedPhone = phoneValidation.formatted;
        if (!packageId) {
            return res.status(400).json({ error: 'Please select an internet package' });
        }
        const tenant = await resolveTenant(tenantParam);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant portal not found' });
        }
        const actualTenantId = tenant.id;
        // Rate limiting check
        const windowStart = Date.now() - (60 * 1000);
        const recentCount = await models_1.Payment.count({
            where: {
                phoneNumber: formattedPhone,
                createdAt: { [require('sequelize').Op.gt]: new Date(windowStart) }
            }
        });
        if (recentCount >= 6) {
            return res.status(429).json({ error: 'Too many payment requests. Please wait a moment before trying again.' });
        }
        const pkg = await models_1.Package.findByPk(packageId);
        if (!pkg || pkg.tenantId !== actualTenantId) {
            return res.status(403).json({ error: 'Selected package is not available for this network' });
        }
        let validRouterId = routerId;
        if (validRouterId === 'unknown' || !validRouterId) {
            const firstRouter = await models_1.Router.findOne({ where: { tenantId: actualTenantId } });
            validRouterId = firstRouter?.id || undefined;
        }
        // Create Pending Payment record
        const payment = await models_1.Payment.create({
            phoneNumber: formattedPhone,
            amount: pkg.price,
            packageId: pkg.id,
            status: 'PENDING',
            macAddress: mac || '00:00:00:00:00:00',
            ipAddress: ip || '127.0.0.1',
            tenantId: actualTenantId,
            routerId: validRouterId,
            subscriberId: subscriberId,
            paymentMethod: 'MPESA_STK'
        });
        try {
            logger_1.default.info('[Portal Pay] Initiating STK push', {
                tenantId: actualTenantId,
                phone: formattedPhone,
                amount: pkg.price,
                package: pkg.name
            });
            const paymentResult = await mpesa_service_1.MpesaService.initiateStkPush(formattedPhone, Number(pkg.price), actualTenantId, subscriberId || 'guest', String(pkg.id));
            const checkoutId = paymentResult.checkoutRequestId || paymentResult.CheckoutRequestID || `STK-${Date.now()}`;
            await payment.update({ checkoutRequestId: checkoutId });
            return res.json({
                success: true,
                paymentId: payment.id,
                checkoutRequestId: checkoutId,
                phoneNumber: phoneValidation.display,
                amount: pkg.price,
                packageName: pkg.name,
                message: paymentResult.CustomerMessage || paymentResult.ResponseDescription || 'STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.',
                destinationAccount: paymentResult.destinationAccount,
                destinationType: paymentResult.destinationType
            });
        }
        catch (stkErr) {
            logger_1.default.error('[Portal Pay] STK Push initiation failed', { error: stkErr.message });
            await payment.update({ status: 'FAILED', failureReason: stkErr.message });
            return res.status(500).json({
                error: stkErr.message || 'Could not initiate STK Push prompt. Please verify your phone number and try again.'
            });
        }
    }
    catch (e) {
        logger_1.default.error('[Portal Pay] Unexpected error', { error: e.message });
        return res.status(500).json({ error: 'Internal server error processing payment' });
    }
});
// 3. Verify M-Pesa Receipt Code Manually (Instant Fulfillment Fallback)
router.post('/:tenantId/verify-receipt', async (req, res) => {
    try {
        const { receiptCode, packageId, phone, mac, ip, routerId } = req.body;
        const tenantParam = req.params.tenantId;
        const code = (receiptCode || '').trim().toUpperCase();
        if (!code || code.length < 6) {
            return res.status(400).json({ success: false, error: 'Please enter a valid M-Pesa transaction code (e.g., SDF94819KL)' });
        }
        const tenant = await resolveTenant(tenantParam);
        if (!tenant)
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        const actualTenantId = tenant.id;
        // Check if this receipt was already claimed
        const existingPayment = await models_1.Payment.findOne({
            where: { mpesaReceiptNumber: code, status: 'SUCCESS' }
        });
        if (existingPayment) {
            return res.json({
                success: true,
                paymentId: existingPayment.id,
                status: 'SUCCESS',
                message: 'Receipt verified! Connecting to Wi-Fi...'
            });
        }
        // Normalize payment and fulfill
        const phoneValidation = (0, phone_1.normalizeKenyanPhone)(phone);
        const pkg = await models_1.Package.findByPk(packageId) || await models_1.Package.findOne({ where: { tenantId: actualTenantId } });
        const normalizedPayment = {
            transactionReference: code,
            amount: pkg ? Number(pkg.price) : 10,
            phoneNumber: phoneValidation.isValid ? phoneValidation.formatted : '254700000000',
            paymentChannel: 'MPESA_PAYBILL',
            paymentMethod: 'RECEIPT_VERIFIED',
            rawPayload: { receiptCode: code, verifiedAt: new Date() },
            tenantId: actualTenantId
        };
        const processed = await payment_normalization_service_1.PaymentNormalizationService.processPayment(normalizedPayment);
        if (mac && routerId) {
            await processed.update({ macAddress: mac, ipAddress: ip, routerId, packageId: pkg?.id });
        }
        return res.json({
            success: true,
            paymentId: processed.id,
            status: 'SUCCESS',
            message: 'Payment verified successfully! Access granted.'
        });
    }
    catch (err) {
        logger_1.default.error('[Portal] Verify receipt failed', { error: err.message });
        return res.status(500).json({ success: false, error: err.message || 'Could not verify receipt code' });
    }
});
// 4. Redeem Voucher Code
router.post('/:tenantId/redeem-voucher', async (req, res) => {
    try {
        const { voucherCode } = req.body;
        const tenantParam = req.params.tenantId;
        const code = (voucherCode || '').trim().toUpperCase();
        if (!code) {
            return res.status(400).json({ success: false, message: 'Please enter a voucher code' });
        }
        const tenant = await resolveTenant(tenantParam);
        const tenantId = tenant?.id;
        const voucher = await models_1.Voucher.findOne({
            where: {
                code,
                ...(tenantId ? { tenantId } : {})
            }
        });
        if (!voucher) {
            return res.status(404).json({ success: false, message: 'Voucher code not found' });
        }
        if (voucher.status === 'USED' || voucher.usedAt) {
            return res.status(400).json({ success: false, message: 'This voucher has already been used' });
        }
        if (voucher.status === 'EXPIRED') {
            return res.status(400).json({ success: false, message: 'This voucher has expired' });
        }
        // Mark voucher used
        await voucher.update({
            status: 'USED',
            usedAt: new Date()
        });
        res.json({
            success: true,
            message: 'Voucher authenticated successfully!',
            redirectUrl: 'https://www.google.com'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// 5. Payment Status (Polling endpoint)
router.get('/payment-status/:id', async (req, res) => {
    try {
        const payment = await models_1.Payment.findByPk(req.params.id, {
            include: [
                {
                    model: models_1.Session,
                    attributes: ['mikrotikUsername', 'mikrotikPassword']
                },
                {
                    model: models_1.Package,
                    attributes: ['id', 'name', 'price', 'durationMinutes', 'validity', 'speedLimit']
                }
            ]
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment record not found' });
        }
        const result = {
            paymentId: payment.id,
            status: payment.status, // 'PENDING' | 'SUCCESS' | 'FAILED'
            mpesaReceiptNumber: payment.mpesaReceiptNumber,
            amount: payment.amount,
            failureReason: payment.failureReason || null,
            package: payment.package || null
        };
        if (payment.status === 'SUCCESS') {
            if (payment.session) {
                result.credentials = {
                    username: payment.session.mikrotikUsername,
                    password: payment.session.mikrotikPassword
                };
            }
            result.message = 'Payment confirmed! Connecting you to the internet...';
        }
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('[Portal] Payment status polling error', { paymentId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to fetch payment status' });
    }
});
// 6. SaaS Health Check
router.get('/health', (_req, res) => {
    res.json({ status: 'UP', service: 'Jevish Portal', timestamp: new Date() });
});
// 7. Public Platform Settings (Contacts)
router.get('/public/settings', async (_req, res) => {
    try {
        const settings = await models_1.PlatformSetting.findAll({
            where: {
                key: [
                    'CONTACT_WHATSAPP', 'CONTACT_WHATSAPP_URL',
                    'CONTACT_PHONE', 'CONTACT_PHONE_TEL',
                    'CONTACT_EMAIL', 'CONTACT_EMAIL_MAILTO',
                    'CONTACT_FACEBOOK_PAGE', 'CONTACT_FACEBOOK_URL',
                    'CONTACT_SUPPORT_MESSAGE'
                ]
            }
        }).catch(() => []);
        res.json(settings);
    }
    catch (e) {
        res.json([]);
    }
});
exports.default = router;
