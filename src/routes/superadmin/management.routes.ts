import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);
import { authMiddleware, authorize } from '../../middleware/auth';
import { AnalyticsService } from '../../services/analytics.service';
import { AuditService } from '../../services/audit.service';
import { SettlementService } from '../../services/settlement.service';
import { WalletService } from '../../services/wallet.service';
import { AggregatorService } from '../../services/aggregator.service';
import { PlatformSetting, Tenant, Wallet, PlatformFee, TieredFee, sequelize, Router as RouterModel, AdminUser, SaaSInvoice, SaaSInvoiceItem, TenantSubscription, MpesaCallbackLog } from '../../models';
import { sendEmail } from '../../services/emailService';
import { SMSService } from '../../services/sms.service';
import { MpesaService } from '../../services/mpesa.service';
import logger from '../../utils/logger';

const router = Router();
router.use(authorize(['SUPER_ADMIN']));

// 1. List all Tenants
router.get('/tenants', async (_req, res) => {
    const tenants = await Tenant.findAll({
        attributes: ['id', 'name', 'subdomain', 'status', 'aggregatorSubAccountId', 'commissionPercentage']
    });
    res.json(tenants);
});

// 1.1 List all Routers (Stats)
router.get('/routers', async (_req, res) => {
    try {
        const total = await RouterModel.count();
        const online = await RouterModel.count({ where: { isOnline: true } });
        const offline = total - online;

        // Get list of critical offline routers (example top 5)
        const criticalOffline = await RouterModel.findAll({
            where: { isOnline: false },
            limit: 5,
            include: [{ model: Tenant, attributes: ['name', 'subdomain'] }],
            attributes: ['id', 'name', 'host', 'lastSeen']
        });

        res.json({
            stats: { total, online, offline },
            criticalOffline
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Update Tenant Aggregator Settings
router.put('/tenants/:id/aggregator', async (req: any, res) => {
    try {
        const { commissionPercentage, aggregatorSubAccountId } = req.body;
        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        await tenant.update({
            commissionPercentage,
            aggregatorSubAccountId
        });

        await AuditService.log('TENANT_AGGREGATOR_UPDATE', `Updated aggregator settings for ${tenant.name}`, undefined, req.user?.id);
        res.json(tenant);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Register Tenant Sub-account
router.post('/tenants/:id/register-aggregator', async (req: any, res) => {
    try {
        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const subAccountId = await AggregatorService.registerSubAccount(tenant);
        res.json({ message: 'Sub-account registered', subAccountId });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Global Platforms Stats
router.get('/platform-stats', async (_req, res) => {
    try {
        const stats = await AnalyticsService.getGlobalPlatformStats();
        res.json(stats);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Settlements (Platform Payouts)
router.get('/settlements', async (req, res) => {
    const settlements = await SettlementService.getTenantSettlements(req.query.tenantId as string); // If no ID, get all
    res.json(settlements);
});

router.post('/settlements/:id/approve', async (req: any, res) => {
    try {
        const result = await SettlementService.approveSettlement(req.params.id);
        await AuditService.log('SETTLEMENT_APPROVED', `Settlement ${req.params.id} approved by SuperAdmin`, undefined, req.user?.id);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// 4. Audit Logs (SaaS-wide)
router.get('/audit-logs', async (req, res) => {
    const logs = await AuditService.getLogs(req.query.tenantId as string);
    res.json(logs);
});

// 5. Update Tenant Status (Suspend/Active)
router.put('/tenants/:id/status', async (req: any, res) => {
    const { status } = req.body;
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    await tenant.update({ status });
    await AuditService.log('TENANT_STATUS_CHANGE', `Tenant ${tenant.name} set to ${status}`, tenant.id, req.user?.id);
    res.json({ message: `Tenant ${status} successfully`, tenant });
});

// 6. Global Wallet Monitoring
router.get('/wallets', async (_req, res) => {
    try {
        const wallets = await Wallet.findAll({
            where: { ownerType: 'TENANT' },
            include: [{ model: Tenant, attributes: ['name'] }]
        });

        const formatted = wallets.map((w: any) => ({
            id: w.id,
            tenantId: w.ownerId,
            tenantName: w.tenant?.name || 'Unknown',
            balance: Number(w.balance),
            pendingBalance: Number(w.pendingBalance),
            settledBalance: Number(w.settledBalance),
            frozenBalance: Number(w.frozenBalance)
        }));

        res.json(formatted);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 7. Platform Wallet Status
router.get('/platform-wallet', async (_req, res) => {
    try {
        const balance = await WalletService.getPlatformWalletBalance();
        res.json(balance);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 8. Platform Fee Management
router.get('/platform-fees', async (_req, res) => {
    try {
        const fees = await PlatformFee.findAll({
            include: [{ model: TieredFee, as: 'tieredFees' }]
        });
        res.json(fees);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/platform-fees', async (req: any, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { feeType, feeValue, isPercentage, minAmount, maxAmount, isActive, description, tieredFees } = req.body;

        const platformFee = await PlatformFee.create({
            feeType, feeValue, isPercentage, minAmount, maxAmount, isActive, description
        }, { transaction });

        if (tieredFees && Array.isArray(tieredFees)) {
            for (const tier of tieredFees) {
                await TieredFee.create({
                    ...tier,
                    platformFeeId: platformFee.id
                }, { transaction });
            }
        }

        await transaction.commit();
        await AuditService.log('PLATFORM_FEE_CREATED', `Platform fee ${feeType} created`, undefined, req.user?.id);
        res.status(201).json(platformFee);
    } catch (e: any) {
        await transaction.rollback();
        res.status(400).json({ error: e.message });
    }
});

router.put('/platform-fees/:id', async (req: any, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { feeValue, isPercentage, isActive, description, tieredFees } = req.body;
        const platformFee = await PlatformFee.findByPk(req.params.id);
        if (!platformFee) return res.status(404).json({ error: 'Fee not found' });

        await platformFee.update({ feeValue, isPercentage, isActive, description }, { transaction });

        if (tieredFees && Array.isArray(tieredFees)) {
            // Simple approach: delete and recreate tiers
            await TieredFee.destroy({ where: { platformFeeId: platformFee.id }, transaction });
            for (const tier of tieredFees) {
                await TieredFee.create({
                    ...tier,
                    platformFeeId: platformFee.id
                }, { transaction });
            }
        }

        await transaction.commit();
        await AuditService.log('PLATFORM_FEE_UPDATED', `Platform fee ${platformFee.feeType} updated`, undefined, req.user?.id);
        res.json(platformFee);
    } catch (e: any) {
        await transaction.rollback();
        res.status(400).json({ error: e.message });
    }
});

// 9. Platform Settings Management
router.get('/settings', async (_req, res) => {
    try {
        const settings = await PlatformSetting.findAll().catch(() => []);
        res.json(settings);
    } catch (e: any) {
        res.json([]);
    }
});

router.put('/settings', async (req: any, res) => {
    try {
        const { settings } = req.body; // expected { settings: { [key]: value } }
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings payload' });
        }

        for (const [key, value] of Object.entries(settings)) {
            const [setting, created] = await PlatformSetting.findOrCreate({
                where: { key },
                defaults: { value: String(value ?? '') }
            });

            if (!created) {
                await setting.update({ value: String(value ?? '') });
            }
        }

        await AuditService.log('PLATFORM_SETTINGS_BULK_UPDATED', `Platform settings batch updated`, undefined, req.user?.id);
        res.json({ message: 'Settings saved successfully' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.put('/settings/:key', async (req: any, res) => {
    try {
        const { value } = req.body;
        const [setting, created] = await PlatformSetting.findOrCreate({
            where: { key: req.params.key },
            defaults: { value }
        });

        if (!created) {
            await setting.update({ value });
        }

        await AuditService.log('PLATFORM_SETTING_UPDATED', `Setting ${req.params.key} updated`, undefined, req.user?.id);
        res.json(setting);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// 10. Test Communication Channels
router.post('/test-email', async (req: any, res) => {
    try {
        const user = await AdminUser.findByPk(req.user.id);
        if (!user) throw new Error('Super Admin not found');

        await sendEmail({
            to: user.email,
            subject: 'Jevish SMTP Test',
            html: `<h1>System Test</h1><p>Relay successful from ${process.env.SMTP_HOST}</p>`,
            action: 'TEST_EMAIL',
            userId: user.id
        });

        res.json({ message: 'Test email sent successfully' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/test-sms', async (req: any, res) => {
    try {
        const user = await AdminUser.findByPk(req.user.id);
        if (!user) throw new Error('Super Admin not found');

        // Note: For SMS test, we use a dummy phone if none provided
        const phone = req.body.phone || '254700000000';

        await SMSService.sendSMS({
            to: phone,
            message: 'Jevish SMS System Test: SUCCESS',
            tenantId: 'PLATFORM', // Internal log
            userId: user.id,
            action: 'TEST_SMS'
        });

        res.json({ message: 'Test SMS triggered' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// 11. Super Admin Permanent Account Management
router.get('/account', async (req: any, res) => {
    try {
        const user = await AdminUser.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'Super Admin not found' });
        res.json({ email: user.email, role: user.role, updatedAt: (user as any).updatedAt });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/account', async (req: any, res) => {
    try {
        const { email, password } = req.body;
        const user = await AdminUser.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'Super Admin not found' });

        const updateData: any = {};
        if (email) {
            const cleanEmail = email.trim().toLowerCase();
            const existing = await AdminUser.findOne({ where: { email: cleanEmail } });
            if (existing && existing.id !== user.id) {
                return res.status(400).json({ error: 'Email is already registered by another account' });
            }
            updateData.email = cleanEmail;
        }

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }
            updateData.password = await bcrypt.hash(password, 12);
        }

        await user.update(updateData);

        // Ensure only one super admin exists across the system
        await AdminUser.update({ role: 'TENANT' }, { where: { role: 'SUPER_ADMIN', id: { [Op.ne]: user.id } } });

        await AuditService.log('SUPER_ADMIN_ACCOUNT_UPDATED', `Super admin account updated for ${user.email}`, undefined, req.user?.id);
        res.json({ message: 'Super Admin account updated successfully', user: { email: user.email, role: user.role } });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// GitHub Integration Push Endpoint
router.post('/github/push', async (req: any, res) => {
    try {
        let repoSetting = await PlatformSetting.findOne({ where: { key: 'GITHUB_REPO' } });
        let branchSetting = await PlatformSetting.findOne({ where: { key: 'GITHUB_BRANCH' } });
        let tokenSetting = await PlatformSetting.findOne({ where: { key: 'GITHUB_TOKEN' } });

        // Safe robust fallbacks for user credentials
        let repo = repoSetting?.value || '';
        if (!repo.trim()) {
            repo = 'https://github.com/Emmanuel20code/emmatech';
            if (repoSetting) {
                await repoSetting.update({ value: repo });
            } else {
                repoSetting = await PlatformSetting.create({ key: 'GITHUB_REPO', value: repo });
            }
        }

        let branch = branchSetting?.value || '';
        if (!branch.trim()) {
            branch = 'main';
            if (branchSetting) {
                await branchSetting.update({ value: branch });
            } else {
                branchSetting = await PlatformSetting.create({ key: 'GITHUB_BRANCH', value: branch });
            }
        }

        let token = tokenSetting?.value || '';
        if (!token.trim()) {
            return res.status(400).json({ error: 'GitHub Personal Access Token is required. Please save it in Platform Settings first.' });
        }

        // Normalize repository to format: owner/repo
        repo = repo.trim();
        repo = repo.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
        repo = repo.replace(/^\/+|\/+$/g, '');
        if (repo.toLowerCase().endsWith('.git')) {
            repo = repo.slice(0, -4);
        }

        if (!repo || !token) {
            return res.status(400).json({ error: 'GitHub repository and Personal Access Token are required in Platform Settings.' });
        }

        const remoteUrl = `https://${token}@github.com/${repo}.git`;

        try {
            await execAsync('git status', { maxBuffer: 1024 * 1024 * 10 });
        } catch (e) {
            await execAsync('git init', { maxBuffer: 1024 * 1024 * 10 });
        }

        try {
            await execAsync('git remote remove origin', { maxBuffer: 1024 * 1024 * 10 });
        } catch (e) {
            // ignore
        }

        await execAsync(`git remote add origin ${remoteUrl}`, { maxBuffer: 1024 * 1024 * 10 });
        await execAsync(`git checkout -B ${branch}`, { maxBuffer: 1024 * 1024 * 10 });
        await execAsync('git config user.name "SuperAdmin"', { maxBuffer: 1024 * 1024 * 10 });
        await execAsync('git config user.email "admin@jevish.site"', { maxBuffer: 1024 * 1024 * 10 });

        try {
            await execAsync('git reset', { maxBuffer: 1024 * 1024 * 10 });
        } catch (e) {}

        await execAsync('git add .', { maxBuffer: 1024 * 1024 * 10 });

        try {
            await execAsync('git commit -m "Auto-sync update from Jevish Cloud Super Admin panel"', { maxBuffer: 1024 * 1024 * 10 });
        } catch (e) {
            try {
                await execAsync('git commit --allow-empty -m "Auto-sync update from Jevish Cloud Super Admin panel"', { maxBuffer: 1024 * 1024 * 10 });
            } catch (innerE) {
                // ignore if commit fails
            }
        }

        let pushOutput = '';
        let gitErrDetails = '';
        try {
            const pushResult = await execAsync(`git push -u origin ${branch} --force`, { maxBuffer: 1024 * 1024 * 10, timeout: 60000 });
            pushOutput = pushResult.stdout || pushResult.stderr;
        } catch (gitErr: any) {
            gitErrDetails = gitErr.stderr || gitErr.stdout || gitErr.message || '';
            const gitErrMsg = gitErrDetails.toLowerCase();
            if (gitErrMsg.includes('authentication failed') || gitErrMsg.includes('support for password authentication was removed') || gitErrMsg.includes('bad credentials')) {
                throw new Error('GitHub Authentication Failed: Please ensure your Personal Access Token (PAT) is valid and has "repo" scope permissions.');
            } else if (gitErrMsg.includes('repository not found')) {
                throw new Error(`GitHub Repository "${repo}" not found or your token does not have access to it.`);
            } else {
                throw new Error(`Git Push Failed: ${gitErrDetails}`);
            }
        }

        await AuditService.log('GITHUB_PUSH_SUCCESS', `Pushed code changes to GitHub repo ${repo} (${branch})`, undefined, req.user?.id);
        res.json({ message: 'Successfully pushed code to GitHub!', output: pushOutput });
    } catch (e: any) {
        console.error('GitHub push error:', e);
        const detailedError = e.message || e.stderr || e.stdout || 'Failed to push to GitHub';
        res.status(500).json({ error: detailedError, output: detailedError });
    }
});

// 7. Onboard New Tenant with Onboarding Fee & M-Pesa STK Push
router.post('/tenants/onboard', async (req: any, res: any) => {
    try {
        const { name, subdomain, email, phoneNumber, onboardingFeeCents } = req.body;
        if (!name || !subdomain) {
            return res.status(400).json({ error: 'Tenant name and subdomain are required' });
        }

        const existing = await Tenant.findOne({ where: { subdomain } });
        if (existing) {
            return res.status(400).json({ error: 'Subdomain is already taken' });
        }

        const tenant = await Tenant.create({
            name,
            subdomain: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            status: 'ACTIVE'
        });

        // Create initial 3-day grace period subscription
        const graceEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        await TenantSubscription.create({
            tenantId: tenant.id,
            planId: 'starter-plan-id', // Placeholder, should ideally fetch 'starter' plan ID
            status: 'GRACE_PERIOD',
            currentPeriodStart: new Date(),
            currentPeriodEnd: graceEndDate,
            gracePeriodEndDate: graceEndDate,
            billingCycle: 'MONTHLY'
        });

        const feeCents = Number(onboardingFeeCents) || 30000; // Default KES 300 onboarding & first month fee
        const count = await SaaSInvoice.count();
        const invoiceNumber = `INV-ONB-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

        const invoice = await SaaSInvoice.create({
            tenantId: tenant.id,
            invoiceNumber,
            billingPeriodStart: new Date(),
            billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for first month
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            subscriptionAmountCents: feeCents,
            totalAmountCents: feeCents,
            paymentStatus: 'UNPAID',
            intasendCheckoutUrl: `https://payment.intasend.com/pay/${invoiceNumber}`
        });

        await SaaSInvoiceItem.create({
            invoiceId: invoice.id,
            description: `New Tenant Onboarding & First Month Subscription (${tenant.name})`,
            category: 'SUBSCRIPTION',
            quantity: 1,
            unitPriceCents: feeCents,
            totalPriceCents: feeCents
        });

        let mpesaResult = null;
        if (phoneNumber) {
            try {
                mpesaResult = await MpesaService.initiateStkPushForSaaSInvoice(
                    invoice.id,
                    tenant.id,
                    phoneNumber,
                    feeCents / 100
                );
            } catch (err: any) {
                logger.error('M-Pesa Onboarding STK Push failed', { error: err.message });
            }
        }

        await AuditService.log('TENANT_ONBOARDED', `Onboarded new tenant ${tenant.name} with KES ${feeCents / 100} onboarding fee`, tenant.id, req.user?.id);

        res.status(201).json({
            success: true,
            tenant,
            invoice,
            mpesaResult,
            message: `Tenant ${tenant.name} successfully onboarded. Onboarding invoice ${invoiceNumber} created.`
        });
    } catch (error: any) {
        logger.error('Tenant onboarding error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 8. List All SaaS Invoices (Monthly & Onboarding Payments)
router.get('/invoices', async (req: any, res: any) => {
    try {
        const invoices = await SaaSInvoice.findAll({
            include: [{ model: Tenant, attributes: ['id', 'name', 'subdomain', 'status'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json(invoices);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 9. Initiate M-Pesa STK Push for any Tenant SaaS Invoice (Monthly Payment or Onboarding Fee)
router.post('/invoices/:id/pay-mpesa', async (req: any, res: any) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required for M-Pesa payment' });

        const invoice = await SaaSInvoice.findByPk(req.params.id, { include: [Tenant] });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        if (invoice.paymentStatus === 'PAID') {
            return res.status(400).json({ error: 'Invoice is already paid' });
        }

        const amountKes = Math.round(Number(invoice.totalAmountCents) / 100);

        const result = await MpesaService.initiateStkPushForSaaSInvoice(
            invoice.id,
            invoice.tenantId,
            phoneNumber,
            amountKes
        );

        await AuditService.log('SAAS_STK_INITIATED', `Initiated M-Pesa STK Push for invoice ${invoice.invoiceNumber} (KES ${amountKes}) to ${phoneNumber}`, invoice.tenantId, req.user?.id);

        res.json({
            success: true,
            checkoutRequestId: result.CheckoutRequestID,
            message: `M-Pesa STK push initiated to ${phoneNumber} for invoice ${invoice.invoiceNumber} (KES ${amountKes}). Please enter your M-Pesa PIN.`,
            amount: amountKes,
            invoiceNumber: invoice.invoiceNumber
        });
    } catch (error: any) {
        logger.error('Super Admin M-Pesa invoice payment error', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to initiate M-Pesa payment' });
    }
});

// GET M-Pesa Callback Logs stream with validation & license activation tracking
router.get('/mpesa-callback-logs', async (_req: any, res: any) => {
    try {
        const logs = await MpesaCallbackLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: 100
        });
        res.json({ success: true, logs });
    } catch (error: any) {
        logger.error('Failed to fetch M-Pesa callback logs', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to fetch M-Pesa callback logs' });
    }
});

// 10. Master M-Pesa Daraja API Configuration Status & Masked Settings
router.get('/master-daraja', async (_req: any, res: any) => {
    try {
        const status = await MpesaService.getMasterStatus();
        res.json({ success: true, ...status });
    } catch (error: any) {
        logger.error('Failed to fetch Master Daraja status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// 11. Update Master M-Pesa Daraja API Credentials
router.put('/master-daraja', async (req: any, res: any) => {
    try {
        const {
            consumerKey,
            consumerSecret,
            shortcode,
            passkey,
            env,
            initiatorName,
            initiatorPassword,
            tillNumber,
            paybillNumber
        } = req.body;

        const updatedStatus = await MpesaService.saveMasterCredentials({
            consumerKey,
            consumerSecret,
            shortcode,
            passkey,
            env,
            initiatorName,
            initiatorPassword,
            tillNumber,
            paybillNumber
        });

        await AuditService.log(
            'MASTER_DARAJA_CONFIG_UPDATED',
            `Updated Master M-Pesa Daraja API credentials (Shortcode: ${shortcode || updatedStatus.shortcode}, Env: ${env || updatedStatus.env})`,
            undefined,
            req.user?.id
        );

        res.json({
            success: true,
            message: 'Master M-Pesa Daraja API credentials saved successfully as Master Initiator.',
            status: updatedStatus
        });
    } catch (error: any) {
        logger.error('Failed to save Master Daraja credentials', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to save Master Daraja credentials' });
    }
});

// 12. Test Live Master M-Pesa Daraja API OAuth Connection
router.post('/master-daraja/test', async (req: any, res: any) => {
    try {
        const result = await MpesaService.testMasterConnection();
        res.json(result);
    } catch (error: any) {
        res.status(400).json({
            success: false,
            error: error.message || 'Master M-Pesa Daraja connection test failed.'
        });
    }
});

// 13. Live Production M-Pesa Callback Status Endpoint
router.post('/master-daraja/simulate-callback', async (req: any, res: any) => {
    res.status(400).json({
        success: false,
        error: 'Simulation mode is disabled. Live production mode active. Please use real M-Pesa / PayHero live callbacks.'
    });
});

export default router;
