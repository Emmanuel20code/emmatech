"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payhero_service_1 = require("../services/payhero.service");
const auth_1 = require("../middleware/auth");
const tenant_resolver_1 = require("../middleware/tenant-resolver");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// =========================================================================
// 1. PAYHERO WEBHOOK / CALLBACK (Public endpoint for PayHero server)
// =========================================================================
router.post('/payhero-callback', async (req, res) => {
    try {
        const result = await payhero_service_1.PayHeroService.handleCallback(req.body);
        return res.status(200).json({
            status: result.success ? 'success' : 'failed',
            message: result.message,
            paymentId: result.paymentId
        });
    }
    catch (error) {
        logger_1.default.error('PayHero Webhook route error', { error: error.message });
        return res.status(200).json({ status: 'error', message: error.message });
    }
});
// Alias for backwards/alternate webhook URLs
router.post('/callback/payhero', async (req, res) => {
    try {
        const result = await payhero_service_1.PayHeroService.handleCallback(req.body);
        return res.status(200).json({
            status: result.success ? 'success' : 'failed',
            message: result.message
        });
    }
    catch (error) {
        return res.status(200).json({ status: 'error', message: error.message });
    }
});
// =========================================================================
// 2. SUPERADMIN: GET PAYHERO GATEWAY CONFIGURATION & STATS
// =========================================================================
router.get('/superadmin/config', auth_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: SuperAdmin privileges required' });
        }
        const config = await payhero_service_1.PayHeroService.getConfig();
        // Calculate gateway statistics
        const [totalCount, successfulCount, totalVolumeResult] = await Promise.all([
            models_1.Payment.count({ where: { paymentMethod: 'PAYHERO' } }),
            models_1.Payment.count({ where: { paymentMethod: 'PAYHERO', status: 'SUCCESS' } }),
            models_1.Payment.sum('amount', { where: { paymentMethod: 'PAYHERO', status: 'SUCCESS' } })
        ]);
        const recentTransactions = await models_1.Payment.findAll({
            where: { paymentMethod: 'PAYHERO' },
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [{ model: models_1.Tenant, as: 'tenant', attributes: ['name', 'subdomain', 'payoutMethod', 'mpesaTillNumber', 'mpesaPaybillNumber', 'bankAccountNumber'] }]
        });
        return res.json({
            config: {
                accountId: config.accountId ? `${config.accountId.substring(0, 4)}••••••••${config.accountId.slice(-4)}` : '',
                rawAccountId: config.accountId,
                basicAuthToken: config.basicAuthToken ? `${config.basicAuthToken.substring(0, 5)}••••••••` : '',
                rawBasicAuthToken: config.basicAuthToken,
                environment: config.environment,
                callbackUrl: config.callbackUrl,
                isEnabled: config.isEnabled,
                directPayoutEnabled: config.directPayoutEnabled
            },
            stats: {
                totalCount: totalCount || 0,
                successfulCount: successfulCount || 0,
                totalVolume: totalVolumeResult || 0,
                successRate: totalCount > 0 ? Math.round(((successfulCount || 0) / totalCount) * 100) : 100
            },
            recentTransactions
        });
    }
    catch (error) {
        logger_1.default.error('SuperAdmin PayHero Config fetch error', { error: error.message });
        return res.status(500).json({ error: 'Failed to retrieve PayHero gateway configuration' });
    }
});
// =========================================================================
// 3. SUPERADMIN: UPDATE PAYHERO MASTER GATEWAY CONFIGURATION
// =========================================================================
router.put('/superadmin/config', auth_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: SuperAdmin privileges required' });
        }
        const { accountId, basicAuthToken, environment, callbackUrl, isEnabled, directPayoutEnabled } = req.body;
        const updated = await payhero_service_1.PayHeroService.saveConfig({ accountId, basicAuthToken,
            environment,
            callbackUrl,
            isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
            directPayoutEnabled: directPayoutEnabled !== undefined ? Boolean(directPayoutEnabled) : true
        });
        await models_1.AuditLog.create({
            tenantId: req.user?.tenantId || '00000000-0000-0000-0000-000000000000',
            userId: req.user?.id,
            action: 'UPDATE_PAYHERO_MASTER_CONFIG',
            details: `SuperAdmin updated PayHero Gateway config (Env: ${updated.environment}, Account ID: ${updated.accountId}, Direct Payouts: ${updated.directPayoutEnabled})`
        });
        return res.json({
            message: 'PayHero Master Payment Gateway configuration updated successfully',
            config: updated
        });
    }
    catch (error) {
        logger_1.default.error('SuperAdmin PayHero Config update error', { error: error.message });
        return res.status(500).json({ error: error.message || 'Failed to update PayHero configuration' });
    }
});
// =========================================================================
// 4. SUPERADMIN: TEST PAYHERO API CONNECTION
// =========================================================================
router.post('/superadmin/test-connection', auth_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: SuperAdmin privileges required' });
        }
        const { accountId, basicAuthToken } = req.body;
        const currentCfg = await payhero_service_1.PayHeroService.getConfig();
        const keyToUse = accountId || currentCfg.accountId;
        const secretToUse = basicAuthToken !== undefined ? basicAuthToken : currentCfg.basicAuthToken;
        const testResult = await payhero_service_1.PayHeroService.testConnection(keyToUse, secretToUse);
        return res.json(testResult);
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});
// =========================================================================
// 5. TENANT: GET DIRECT PAYOUT SETTINGS (Till, Paybill, Bank, Phone)
// =========================================================================
router.get('/tenant/payout-settings', auth_1.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user?.tenantId;
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant workspace not found' });
        }
        return res.json({
            payoutMethod: tenant.payoutMethod || 'TILL',
            directPayoutEnabled: tenant.directPayoutEnabled ?? true,
            // Till Details
            tillNumber: tenant.mpesaTillNumber || '',
            tillStoreName: tenant.mpesaTillName || tenant.tradingName || tenant.name || '',
            // Paybill Details
            paybillNumber: tenant.mpesaPaybillNumber || '',
            paybillAccount: tenant.mpesaPaybillAccount || 'HOTSPOT',
            // Bank Details
            bankName: tenant.bankName || '',
            bankAccountNumber: tenant.bankAccountNumber || '',
            bankAccountName: tenant.bankAccountName || '',
            bankBranch: tenant.bankBranch || '',
            bankSwiftCode: tenant.bankSwiftCode || '',
            // Phone / Pochi Details
            pochiPhone: tenant.mpesaPochiNumber || tenant.contactPhone || '',
            mpesaWithdrawalName: tenant.mpesaWithdrawalName || '',
            // Summary statement
            gatewayStatus: 'MANAGED_BY_SUPERADMIN (PayHero Gateway active)'
        });
    }
    catch (error) {
        logger_1.default.error('Tenant payout settings fetch error', { error: error.message });
        return res.status(500).json({ error: 'Failed to retrieve payout settings' });
    }
});
// =========================================================================
// 6. TENANT: UPDATE DIRECT PAYOUT DESTINATIONS
// =========================================================================
router.put('/tenant/payout-settings', auth_1.authMiddleware, tenant_resolver_1.TenantResolver.resolveTenant, async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user?.tenantId;
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant workspace not found' });
        }
        const { payoutMethod, directPayoutEnabled, tillNumber, tillStoreName, paybillNumber, paybillAccount, bankName, bankAccountNumber, bankAccountName, bankBranch, bankSwiftCode, pochiPhone, mpesaWithdrawalName } = req.body;
        // Validation for chosen method
        const selectedMethod = payoutMethod || tenant.payoutMethod || 'TILL';
        if (selectedMethod === 'TILL' && tillNumber) {
            const cleanedTill = String(tillNumber).replace(/\D/g, '');
            if (cleanedTill.length < 4 || cleanedTill.length > 10) {
                return res.status(400).json({ error: 'Please enter a valid M-Pesa Buy Goods Till Number (4-10 digits)' });
            }
            tenant.mpesaTillNumber = cleanedTill;
        }
        if (selectedMethod === 'PAYBILL' && paybillNumber) {
            const cleanedPaybill = String(paybillNumber).replace(/\D/g, '');
            if (cleanedPaybill.length < 4 || cleanedPaybill.length > 10) {
                return res.status(400).json({ error: 'Please enter a valid M-Pesa Paybill Number (4-10 digits)' });
            }
            tenant.mpesaPaybillNumber = cleanedPaybill;
        }
        if (selectedMethod === 'BANK' && bankAccountNumber) {
            if (String(bankAccountNumber).trim().length < 5) {
                return res.status(400).json({ error: 'Please enter a valid Bank Account Number' });
            }
        }
        // Update fields
        tenant.payoutMethod = selectedMethod;
        if (directPayoutEnabled !== undefined)
            tenant.directPayoutEnabled = Boolean(directPayoutEnabled);
        if (tillNumber !== undefined)
            tenant.mpesaTillNumber = String(tillNumber).trim();
        if (tillStoreName !== undefined)
            tenant.mpesaTillName = String(tillStoreName).trim();
        if (paybillNumber !== undefined)
            tenant.mpesaPaybillNumber = String(paybillNumber).trim();
        if (paybillAccount !== undefined)
            tenant.mpesaPaybillAccount = String(paybillAccount).trim();
        if (bankName !== undefined)
            tenant.bankName = String(bankName).trim();
        if (bankAccountNumber !== undefined)
            tenant.bankAccountNumber = String(bankAccountNumber).trim();
        if (bankAccountName !== undefined)
            tenant.bankAccountName = String(bankAccountName).trim();
        if (bankBranch !== undefined)
            tenant.bankBranch = String(bankBranch).trim();
        if (bankSwiftCode !== undefined)
            tenant.bankSwiftCode = String(bankSwiftCode).trim();
        if (pochiPhone !== undefined)
            tenant.mpesaPochiNumber = String(pochiPhone).trim();
        if (mpesaWithdrawalName !== undefined)
            tenant.mpesaWithdrawalName = String(mpesaWithdrawalName).trim();
        await tenant.save();
        await models_1.AuditLog.create({
            tenantId,
            userId: req.user?.id,
            action: 'UPDATE_DIRECT_PAYOUT_DESTINATION',
            details: `Updated direct payment destination to ${tenant.payoutMethod} (Account: ${tenant.payoutMethod === 'TILL' ? tenant.mpesaTillNumber : tenant.payoutMethod === 'PAYBILL' ? tenant.mpesaPaybillNumber : tenant.bankAccountNumber})`
        });
        return res.json({
            message: 'Direct payout account details saved successfully. Customer payments will route directly to your account.',
            tenant: {
                payoutMethod: tenant.payoutMethod,
                directPayoutEnabled: tenant.directPayoutEnabled,
                tillNumber: tenant.mpesaTillNumber,
                tillStoreName: tenant.mpesaTillName,
                paybillNumber: tenant.mpesaPaybillNumber,
                paybillAccount: tenant.mpesaPaybillAccount,
                bankName: tenant.bankName,
                bankAccountNumber: tenant.bankAccountNumber,
                bankAccountName: tenant.bankAccountName
            }
        });
    }
    catch (error) {
        logger_1.default.error('Tenant payout settings update error', { error: error.message });
        return res.status(500).json({ error: error.message || 'Failed to update payout settings' });
    }
});
exports.default = router;
