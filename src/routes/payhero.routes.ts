import { Router, Request, Response } from 'express';
import { PayHeroService } from '../services/payhero.service';
import { authMiddleware } from '../middleware/auth';
import { TenantResolver } from '../middleware/tenant-resolver';
import { Tenant, Payment, AuditLog } from '../models';
import logger from '../utils/logger';

const router = Router();

// =========================================================================
// 1. PAYHERO WEBHOOK / CALLBACK (Public endpoint for PayHero server)
// =========================================================================
router.post('/payhero-callback', async (req: Request, res: Response) => {
    try {
        const result = await PayHeroService.handleCallback(req.body);
        return res.status(200).json({
            status: result.success ? 'success' : 'failed',
            message: result.message,
            paymentId: result.paymentId
        });
    } catch (error: any) {
        logger.error('PayHero Webhook route error', { error: error.message });
        return res.status(200).json({ status: 'error', message: error.message });
    }
});

// Alias for backwards/alternate webhook URLs
router.post('/callback/payhero', async (req: Request, res: Response) => {
    try {
        const result = await PayHeroService.handleCallback(req.body);
        return res.status(200).json({
            status: result.success ? 'success' : 'failed',
            message: result.message
        });
    } catch (error: any) {
        return res.status(200).json({ status: 'error', message: error.message });
    }
});

// =========================================================================
// 2. SUPERADMIN: GET PAYHERO GATEWAY CONFIGURATION & STATS
// =========================================================================
router.get('/superadmin/config', authMiddleware, async (req: any, res: Response) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: SuperAdmin privileges required' });
        }

        const config = await PayHeroService.getConfig();

        // Calculate gateway statistics
        const [totalCount, successfulCount, totalVolumeResult] = await Promise.all([
            Payment.count({ where: { paymentMethod: 'PAYHERO' } }),
            Payment.count({ where: { paymentMethod: 'PAYHERO', status: 'SUCCESS' } }),
            Payment.sum('amount', { where: { paymentMethod: 'PAYHERO', status: 'SUCCESS' } })
        ]);

        const recentTransactions = await Payment.findAll({
            where: { paymentMethod: 'PAYHERO' },
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [{ model: Tenant, as: 'tenant', attributes: ['name', 'subdomain', 'payoutMethod', 'mpesaTillNumber', 'mpesaPaybillNumber', 'bankAccountNumber'] }]
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
    } catch (error: any) {
        logger.error('SuperAdmin PayHero Config fetch error', { error: error.message });
        return res.status(500).json({ error: 'Failed to retrieve PayHero gateway configuration' });
    }
});

// =========================================================================
// 3. SUPERADMIN: UPDATE PAYHERO MASTER GATEWAY CONFIGURATION
// =========================================================================
router.put('/superadmin/config', authMiddleware, async (req: any, res: Response) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: SuperAdmin privileges required' });
        }

        const { accountId, basicAuthToken,
            environment,
            callbackUrl,
            isEnabled,
            directPayoutEnabled
        } = req.body;

        const updated = await PayHeroService.saveConfig({ accountId, basicAuthToken,
            environment,
            callbackUrl,
            isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
            directPayoutEnabled: directPayoutEnabled !== undefined ? Boolean(directPayoutEnabled) : true
        });

        await AuditLog.create({
            tenantId: req.user?.tenantId || '00000000-0000-0000-0000-000000000000',
            userId: req.user?.id,
            action: 'UPDATE_PAYHERO_MASTER_CONFIG',
            details: `SuperAdmin updated PayHero Gateway config (Env: ${updated.environment}, Account ID: ${updated.accountId}, Direct Payouts: ${updated.directPayoutEnabled})`
        });

        return res.json({
            message: 'PayHero Master Payment Gateway configuration updated successfully',
            config: updated
        });
    } catch (error: any) {
        logger.error('SuperAdmin PayHero Config update error', { error: error.message });
        return res.status(500).json({ error: error.message || 'Failed to update PayHero configuration' });
    }
});

// =========================================================================
// 4. SUPERADMIN: TEST PAYHERO API CONNECTION
// =========================================================================
router.post('/superadmin/test-connection', authMiddleware, async (req: any, res: Response) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: SuperAdmin privileges required' });
        }

        const { accountId, basicAuthToken } = req.body;
        const currentCfg = await PayHeroService.getConfig();

        const keyToUse = accountId || currentCfg.accountId;
        const secretToUse = basicAuthToken !== undefined ? basicAuthToken : currentCfg.basicAuthToken;
        const testResult = await PayHeroService.testConnection(keyToUse, secretToUse);
        return res.json(testResult);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// =========================================================================
// 5. TENANT: GET DIRECT PAYOUT SETTINGS (Till, Paybill, Bank, Phone)
// =========================================================================
router.get('/tenant/payout-settings', authMiddleware, TenantResolver.resolveTenant, async (req: any, res: Response) => {
    try {
        const tenantId = req.tenantId || req.user?.tenantId;
        const tenant = await Tenant.findByPk(tenantId);
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
    } catch (error: any) {
        logger.error('Tenant payout settings fetch error', { error: error.message });
        return res.status(500).json({ error: 'Failed to retrieve payout settings' });
    }
});

// =========================================================================
// 6. TENANT: UPDATE DIRECT PAYOUT DESTINATIONS
// =========================================================================
router.put('/tenant/payout-settings', authMiddleware, TenantResolver.resolveTenant, async (req: any, res: Response) => {
    try {
        const tenantId = req.tenantId || req.user?.tenantId;
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant workspace not found' });
        }

        const {
            payoutMethod,
            directPayoutEnabled,
            tillNumber,
            tillStoreName,
            paybillNumber,
            paybillAccount,
            bankName,
            bankAccountNumber,
            bankAccountName,
            bankBranch,
            bankSwiftCode,
            pochiPhone,
            mpesaWithdrawalName
        } = req.body;

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
        if (directPayoutEnabled !== undefined) tenant.directPayoutEnabled = Boolean(directPayoutEnabled);
        if (tillNumber !== undefined) tenant.mpesaTillNumber = String(tillNumber).trim();
        if (tillStoreName !== undefined) tenant.mpesaTillName = String(tillStoreName).trim();
        if (paybillNumber !== undefined) tenant.mpesaPaybillNumber = String(paybillNumber).trim();
        if (paybillAccount !== undefined) tenant.mpesaPaybillAccount = String(paybillAccount).trim();
        if (bankName !== undefined) tenant.bankName = String(bankName).trim();
        if (bankAccountNumber !== undefined) tenant.bankAccountNumber = String(bankAccountNumber).trim();
        if (bankAccountName !== undefined) tenant.bankAccountName = String(bankAccountName).trim();
        if (bankBranch !== undefined) tenant.bankBranch = String(bankBranch).trim();
        if (bankSwiftCode !== undefined) tenant.bankSwiftCode = String(bankSwiftCode).trim();
        if (pochiPhone !== undefined) tenant.mpesaPochiNumber = String(pochiPhone).trim();
        if (mpesaWithdrawalName !== undefined) tenant.mpesaWithdrawalName = String(mpesaWithdrawalName).trim();

        await tenant.save();

        await AuditLog.create({
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
    } catch (error: any) {
        logger.error('Tenant payout settings update error', { error: error.message });
        return res.status(500).json({ error: error.message || 'Failed to update payout settings' });
    }
});

export default router;
