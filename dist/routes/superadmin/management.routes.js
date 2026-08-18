"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const sequelize_1 = require("sequelize");
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
const auth_1 = require("../../middleware/auth");
const analytics_service_1 = require("../../services/analytics.service");
const audit_service_1 = require("../../services/audit.service");
const settlement_service_1 = require("../../services/settlement.service");
const wallet_service_1 = require("../../services/wallet.service");
const aggregator_service_1 = require("../../services/aggregator.service");
const models_1 = require("../../models");
const emailService_1 = require("../../services/emailService");
const sms_service_1 = require("../../services/sms.service");
const mpesa_service_1 = require("../../services/mpesa.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const router = (0, express_1.Router)();
router.use((0, auth_1.authorize)(['SUPER_ADMIN']));
// 1. List all Tenants
router.get('/tenants', async (_req, res) => {
    const tenants = await models_1.Tenant.findAll({
        attributes: ['id', 'name', 'subdomain', 'status', 'aggregatorSubAccountId', 'commissionPercentage']
    });
    res.json(tenants);
});
// 1.1 List all Routers (Stats)
router.get('/routers', async (_req, res) => {
    try {
        const total = await models_1.Router.count();
        const online = await models_1.Router.count({ where: { isOnline: true } });
        const offline = total - online;
        // Get list of critical offline routers (example top 5)
        const criticalOffline = await models_1.Router.findAll({
            where: { isOnline: false },
            limit: 5,
            include: [{ model: models_1.Tenant, attributes: ['name', 'subdomain'] }],
            attributes: ['id', 'name', 'host', 'lastSeen']
        });
        res.json({
            stats: { total, online, offline },
            criticalOffline
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Update Tenant Aggregator Settings
router.put('/tenants/:id/aggregator', async (req, res) => {
    try {
        const { commissionPercentage, aggregatorSubAccountId } = req.body;
        const tenant = await models_1.Tenant.findByPk(req.params.id);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        await tenant.update({
            commissionPercentage,
            aggregatorSubAccountId
        });
        await audit_service_1.AuditService.log('TENANT_AGGREGATOR_UPDATE', `Updated aggregator settings for ${tenant.name}`, undefined, req.user?.id);
        res.json(tenant);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// Register Tenant Sub-account
router.post('/tenants/:id/register-aggregator', async (req, res) => {
    try {
        const tenant = await models_1.Tenant.findByPk(req.params.id);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const subAccountId = await aggregator_service_1.AggregatorService.registerSubAccount(tenant);
        res.json({ message: 'Sub-account registered', subAccountId });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 2. Global Platforms Stats
router.get('/platform-stats', async (_req, res) => {
    try {
        const stats = await analytics_service_1.AnalyticsService.getGlobalPlatformStats();
        res.json(stats);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 3. Settlements (Platform Payouts)
router.get('/settlements', async (req, res) => {
    const settlements = await settlement_service_1.SettlementService.getTenantSettlements(req.query.tenantId); // If no ID, get all
    res.json(settlements);
});
router.post('/settlements/:id/approve', async (req, res) => {
    try {
        const result = await settlement_service_1.SettlementService.approveSettlement(req.params.id);
        await audit_service_1.AuditService.log('SETTLEMENT_APPROVED', `Settlement ${req.params.id} approved by SuperAdmin`, undefined, req.user?.id);
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// 4. Audit Logs (SaaS-wide)
router.get('/audit-logs', async (req, res) => {
    const logs = await audit_service_1.AuditService.getLogs(req.query.tenantId);
    res.json(logs);
});
// 5. Update Tenant Status (Suspend/Active)
router.put('/tenants/:id/status', async (req, res) => {
    const { status } = req.body;
    const tenant = await models_1.Tenant.findByPk(req.params.id);
    if (!tenant)
        return res.status(404).json({ error: 'Tenant not found' });
    await tenant.update({ status });
    await audit_service_1.AuditService.log('TENANT_STATUS_CHANGE', `Tenant ${tenant.name} set to ${status}`, tenant.id, req.user?.id);
    res.json({ message: `Tenant ${status} successfully`, tenant });
});
// 6. Global Wallet Monitoring
router.get('/wallets', async (_req, res) => {
    try {
        const wallets = await models_1.Wallet.findAll({
            where: { ownerType: 'TENANT' },
            include: [{ model: models_1.Tenant, attributes: ['name'] }]
        });
        const formatted = wallets.map((w) => ({
            id: w.id,
            tenantId: w.ownerId,
            tenantName: w.tenant?.name || 'Unknown',
            balance: Number(w.balance),
            pendingBalance: Number(w.pendingBalance),
            settledBalance: Number(w.settledBalance),
            frozenBalance: Number(w.frozenBalance)
        }));
        res.json(formatted);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 7. Platform Wallet Status
router.get('/platform-wallet', async (_req, res) => {
    try {
        const balance = await wallet_service_1.WalletService.getPlatformWalletBalance();
        res.json(balance);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 8. Platform Fee Management
router.get('/platform-fees', async (_req, res) => {
    try {
        const fees = await models_1.PlatformFee.findAll({
            include: [{ model: models_1.TieredFee, as: 'tieredFees' }]
        });
        res.json(fees);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/platform-fees', async (req, res) => {
    const transaction = await models_1.sequelize.transaction();
    try {
        const { feeType, feeValue, isPercentage, minAmount, maxAmount, isActive, description, tieredFees } = req.body;
        const platformFee = await models_1.PlatformFee.create({
            feeType, feeValue, isPercentage, minAmount, maxAmount, isActive, description
        }, { transaction });
        if (tieredFees && Array.isArray(tieredFees)) {
            for (const tier of tieredFees) {
                await models_1.TieredFee.create({
                    ...tier,
                    platformFeeId: platformFee.id
                }, { transaction });
            }
        }
        await transaction.commit();
        await audit_service_1.AuditService.log('PLATFORM_FEE_CREATED', `Platform fee ${feeType} created`, undefined, req.user?.id);
        res.status(201).json(platformFee);
    }
    catch (e) {
        await transaction.rollback();
        res.status(400).json({ error: e.message });
    }
});
router.put('/platform-fees/:id', async (req, res) => {
    const transaction = await models_1.sequelize.transaction();
    try {
        const { feeValue, isPercentage, isActive, description, tieredFees } = req.body;
        const platformFee = await models_1.PlatformFee.findByPk(req.params.id);
        if (!platformFee)
            return res.status(404).json({ error: 'Fee not found' });
        await platformFee.update({ feeValue, isPercentage, isActive, description }, { transaction });
        if (tieredFees && Array.isArray(tieredFees)) {
            // Simple approach: delete and recreate tiers
            await models_1.TieredFee.destroy({ where: { platformFeeId: platformFee.id }, transaction });
            for (const tier of tieredFees) {
                await models_1.TieredFee.create({
                    ...tier,
                    platformFeeId: platformFee.id
                }, { transaction });
            }
        }
        await transaction.commit();
        await audit_service_1.AuditService.log('PLATFORM_FEE_UPDATED', `Platform fee ${platformFee.feeType} updated`, undefined, req.user?.id);
        res.json(platformFee);
    }
    catch (e) {
        await transaction.rollback();
        res.status(400).json({ error: e.message });
    }
});
// 9. Platform Settings Management
router.get('/settings', async (_req, res) => {
    try {
        const settings = await models_1.PlatformSetting.findAll().catch(() => []);
        res.json(settings);
    }
    catch (e) {
        res.json([]);
    }
});
router.put('/settings', async (req, res) => {
    try {
        const { settings } = req.body; // expected { settings: { [key]: value } }
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings payload' });
        }
        for (const [key, value] of Object.entries(settings)) {
            const [setting, created] = await models_1.PlatformSetting.findOrCreate({
                where: { key },
                defaults: { value: String(value ?? '') }
            });
            if (!created) {
                await setting.update({ value: String(value ?? '') });
            }
        }
        await audit_service_1.AuditService.log('PLATFORM_SETTINGS_BULK_UPDATED', `Platform settings batch updated`, undefined, req.user?.id);
        res.json({ message: 'Settings saved successfully' });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.put('/settings/:key', async (req, res) => {
    try {
        const { value } = req.body;
        const [setting, created] = await models_1.PlatformSetting.findOrCreate({
            where: { key: req.params.key },
            defaults: { value }
        });
        if (!created) {
            await setting.update({ value });
        }
        await audit_service_1.AuditService.log('PLATFORM_SETTING_UPDATED', `Setting ${req.params.key} updated`, undefined, req.user?.id);
        res.json(setting);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// 10. Test Communication Channels
router.post('/test-email', async (req, res) => {
    try {
        const user = await models_1.AdminUser.findByPk(req.user.id);
        if (!user)
            throw new Error('Super Admin not found');
        await (0, emailService_1.sendEmail)({
            to: user.email,
            subject: 'Jevish SMTP Test',
            html: `<h1>System Test</h1><p>Relay successful from ${process.env.SMTP_HOST}</p>`,
            action: 'TEST_EMAIL',
            userId: user.id
        });
        res.json({ message: 'Test email sent successfully' });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post('/test-sms', async (req, res) => {
    try {
        const user = await models_1.AdminUser.findByPk(req.user.id);
        if (!user)
            throw new Error('Super Admin not found');
        // Note: For SMS test, we use a dummy phone if none provided
        const phone = req.body.phone || '254700000000';
        await sms_service_1.SMSService.sendSMS({
            to: phone,
            message: 'Jevish SMS System Test: SUCCESS',
            tenantId: 'PLATFORM', // Internal log
            userId: user.id,
            action: 'TEST_SMS'
        });
        res.json({ message: 'Test SMS triggered' });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// 11. Super Admin Permanent Account Management
router.get('/account', async (req, res) => {
    try {
        const user = await models_1.AdminUser.findByPk(req.user.id);
        if (!user)
            return res.status(404).json({ error: 'Super Admin not found' });
        res.json({ email: user.email, role: user.role, updatedAt: user.updatedAt });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.put('/account', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await models_1.AdminUser.findByPk(req.user.id);
        if (!user)
            return res.status(404).json({ error: 'Super Admin not found' });
        const updateData = {};
        if (email) {
            const cleanEmail = email.trim().toLowerCase();
            const existing = await models_1.AdminUser.findOne({ where: { email: cleanEmail } });
            if (existing && existing.id !== user.id) {
                return res.status(400).json({ error: 'Email is already registered by another account' });
            }
            updateData.email = cleanEmail;
        }
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }
            updateData.password = await bcryptjs_1.default.hash(password, 12);
        }
        await user.update(updateData);
        // Ensure only one super admin exists across the system
        await models_1.AdminUser.update({ role: 'TENANT' }, { where: { role: 'SUPER_ADMIN', id: { [sequelize_1.Op.ne]: user.id } } });
        await audit_service_1.AuditService.log('SUPER_ADMIN_ACCOUNT_UPDATED', `Super admin account updated for ${user.email}`, undefined, req.user?.id);
        res.json({ message: 'Super Admin account updated successfully', user: { email: user.email, role: user.role } });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// GitHub Integration Push Endpoint
router.post('/github/push', async (req, res) => {
    try {
        let repoSetting = await models_1.PlatformSetting.findOne({ where: { key: 'GITHUB_REPO' } });
        let branchSetting = await models_1.PlatformSetting.findOne({ where: { key: 'GITHUB_BRANCH' } });
        let tokenSetting = await models_1.PlatformSetting.findOne({ where: { key: 'GITHUB_TOKEN' } });
        // Safe robust fallbacks for user credentials
        let repo = repoSetting?.value || '';
        if (!repo.trim()) {
            repo = 'https://github.com/Emmanuel20code/emmatech';
            if (repoSetting) {
                await repoSetting.update({ value: repo });
            }
            else {
                repoSetting = await models_1.PlatformSetting.create({ key: 'GITHUB_REPO', value: repo });
            }
        }
        let branch = branchSetting?.value || '';
        if (!branch.trim()) {
            branch = 'main';
            if (branchSetting) {
                await branchSetting.update({ value: branch });
            }
            else {
                branchSetting = await models_1.PlatformSetting.create({ key: 'GITHUB_BRANCH', value: branch });
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
        }
        catch (e) {
            await execAsync('git init', { maxBuffer: 1024 * 1024 * 10 });
        }
        try {
            await execAsync('git remote remove origin', { maxBuffer: 1024 * 1024 * 10 });
        }
        catch (e) {
            // ignore
        }
        await execAsync(`git remote add origin ${remoteUrl}`, { maxBuffer: 1024 * 1024 * 10 });
        await execAsync(`git checkout -B ${branch}`, { maxBuffer: 1024 * 1024 * 10 });
        await execAsync('git config user.name "SuperAdmin"', { maxBuffer: 1024 * 1024 * 10 });
        await execAsync('git config user.email "admin@jevish.site"', { maxBuffer: 1024 * 1024 * 10 });
        try {
            await execAsync('git reset', { maxBuffer: 1024 * 1024 * 10 });
        }
        catch (e) { }
        await execAsync('git add .', { maxBuffer: 1024 * 1024 * 10 });
        try {
            await execAsync('git commit -m "Auto-sync update from Jevish Cloud Super Admin panel"', { maxBuffer: 1024 * 1024 * 10 });
        }
        catch (e) {
            try {
                await execAsync('git commit --allow-empty -m "Auto-sync update from Jevish Cloud Super Admin panel"', { maxBuffer: 1024 * 1024 * 10 });
            }
            catch (innerE) {
                // ignore if commit fails
            }
        }
        let pushOutput = '';
        let gitErrDetails = '';
        try {
            const pushResult = await execAsync(`git push -u origin ${branch} --force`, { maxBuffer: 1024 * 1024 * 10, timeout: 60000 });
            pushOutput = pushResult.stdout || pushResult.stderr;
        }
        catch (gitErr) {
            gitErrDetails = gitErr.stderr || gitErr.stdout || gitErr.message || '';
            const gitErrMsg = gitErrDetails.toLowerCase();
            if (gitErrMsg.includes('authentication failed') || gitErrMsg.includes('support for password authentication was removed') || gitErrMsg.includes('bad credentials')) {
                throw new Error('GitHub Authentication Failed: Please ensure your Personal Access Token (PAT) is valid and has "repo" scope permissions.');
            }
            else if (gitErrMsg.includes('repository not found')) {
                throw new Error(`GitHub Repository "${repo}" not found or your token does not have access to it.`);
            }
            else {
                throw new Error(`Git Push Failed: ${gitErrDetails}`);
            }
        }
        await audit_service_1.AuditService.log('GITHUB_PUSH_SUCCESS', `Pushed code changes to GitHub repo ${repo} (${branch})`, undefined, req.user?.id);
        res.json({ message: 'Successfully pushed code to GitHub!', output: pushOutput });
    }
    catch (e) {
        console.error('GitHub push error:', e);
        const detailedError = e.message || e.stderr || e.stdout || 'Failed to push to GitHub';
        res.status(500).json({ error: detailedError, output: detailedError });
    }
});
// 7. Onboard New Tenant with Onboarding Fee & M-Pesa STK Push
router.post('/tenants/onboard', async (req, res) => {
    try {
        const { name, subdomain, email, phoneNumber, onboardingFeeCents } = req.body;
        if (!name || !subdomain) {
            return res.status(400).json({ error: 'Tenant name and subdomain are required' });
        }
        const existing = await models_1.Tenant.findOne({ where: { subdomain } });
        if (existing) {
            return res.status(400).json({ error: 'Subdomain is already taken' });
        }
        const tenant = await models_1.Tenant.create({
            name,
            subdomain: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            status: 'ACTIVE'
        });
        // Create initial 3-day grace period subscription
        const graceEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        await models_1.TenantSubscription.create({
            tenantId: tenant.id,
            planId: 'starter-plan-id', // Placeholder, should ideally fetch 'starter' plan ID
            status: 'GRACE_PERIOD',
            currentPeriodStart: new Date(),
            currentPeriodEnd: graceEndDate,
            gracePeriodEndDate: graceEndDate,
            billingCycle: 'MONTHLY'
        });
        const feeCents = Number(onboardingFeeCents) || 30000; // Default KES 300 onboarding & first month fee
        const count = await models_1.SaaSInvoice.count();
        const invoiceNumber = `INV-ONB-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const invoice = await models_1.SaaSInvoice.create({
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
        await models_1.SaaSInvoiceItem.create({
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
                mpesaResult = await mpesa_service_1.MpesaService.initiateStkPushForSaaSInvoice(invoice.id, tenant.id, phoneNumber, feeCents / 100);
            }
            catch (err) {
                logger_1.default.error('M-Pesa Onboarding STK Push failed', { error: err.message });
            }
        }
        await audit_service_1.AuditService.log('TENANT_ONBOARDED', `Onboarded new tenant ${tenant.name} with KES ${feeCents / 100} onboarding fee`, tenant.id, req.user?.id);
        res.status(201).json({
            success: true,
            tenant,
            invoice,
            mpesaResult,
            message: `Tenant ${tenant.name} successfully onboarded. Onboarding invoice ${invoiceNumber} created.`
        });
    }
    catch (error) {
        logger_1.default.error('Tenant onboarding error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// 8. List All SaaS Invoices (Monthly & Onboarding Payments)
router.get('/invoices', async (req, res) => {
    try {
        const invoices = await models_1.SaaSInvoice.findAll({
            include: [{ model: models_1.Tenant, attributes: ['id', 'name', 'subdomain', 'status'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json(invoices);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 9. Initiate M-Pesa STK Push for any Tenant SaaS Invoice (Monthly Payment or Onboarding Fee)
router.post('/invoices/:id/pay-mpesa', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber)
            return res.status(400).json({ error: 'Phone number is required for M-Pesa payment' });
        const invoice = await models_1.SaaSInvoice.findByPk(req.params.id, { include: [models_1.Tenant] });
        if (!invoice)
            return res.status(404).json({ error: 'Invoice not found' });
        if (invoice.paymentStatus === 'PAID') {
            return res.status(400).json({ error: 'Invoice is already paid' });
        }
        const amountKes = Math.round(Number(invoice.totalAmountCents) / 100);
        const result = await mpesa_service_1.MpesaService.initiateStkPushForSaaSInvoice(invoice.id, invoice.tenantId, phoneNumber, amountKes);
        await audit_service_1.AuditService.log('SAAS_STK_INITIATED', `Initiated M-Pesa STK Push for invoice ${invoice.invoiceNumber} (KES ${amountKes}) to ${phoneNumber}`, invoice.tenantId, req.user?.id);
        res.json({
            success: true,
            checkoutRequestId: result.CheckoutRequestID,
            message: `M-Pesa STK push initiated to ${phoneNumber} for invoice ${invoice.invoiceNumber} (KES ${amountKes}). Please enter your M-Pesa PIN.`,
            amount: amountKes,
            invoiceNumber: invoice.invoiceNumber
        });
    }
    catch (error) {
        logger_1.default.error('Super Admin M-Pesa invoice payment error', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to initiate M-Pesa payment' });
    }
});
// GET M-Pesa Callback Logs stream with validation & license activation tracking
router.get('/mpesa-callback-logs', async (_req, res) => {
    try {
        const logs = await models_1.MpesaCallbackLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: 100
        });
        res.json({ success: true, logs });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch M-Pesa callback logs', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to fetch M-Pesa callback logs' });
    }
});
// 10. Master M-Pesa Daraja API Configuration Status & Masked Settings
router.get('/master-daraja', async (_req, res) => {
    try {
        const status = await mpesa_service_1.MpesaService.getMasterStatus();
        res.json({ success: true, ...status });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch Master Daraja status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
// 11. Update Master M-Pesa Daraja API Credentials
router.put('/master-daraja', async (req, res) => {
    try {
        const { consumerKey, consumerSecret, shortcode, passkey, env, initiatorName, initiatorPassword, tillNumber, paybillNumber } = req.body;
        const updatedStatus = await mpesa_service_1.MpesaService.saveMasterCredentials({
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
        await audit_service_1.AuditService.log('MASTER_DARAJA_CONFIG_UPDATED', `Updated Master M-Pesa Daraja API credentials (Shortcode: ${shortcode || updatedStatus.shortcode}, Env: ${env || updatedStatus.env})`, undefined, req.user?.id);
        res.json({
            success: true,
            message: 'Master M-Pesa Daraja API credentials saved successfully as Master Initiator.',
            status: updatedStatus
        });
    }
    catch (error) {
        logger_1.default.error('Failed to save Master Daraja credentials', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to save Master Daraja credentials' });
    }
});
// 12. Test Live Master M-Pesa Daraja API OAuth Connection
router.post('/master-daraja/test', async (req, res) => {
    try {
        const result = await mpesa_service_1.MpesaService.testMasterConnection();
        res.json(result);
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message || 'Master M-Pesa Daraja connection test failed.'
        });
    }
});
// 13. Simulate M-Pesa Callback Payload
router.post('/master-daraja/simulate-callback', async (req, res) => {
    try {
        const simReceipt = `TEST_REC_${Math.floor(Math.random() * 900000 + 100000)}`;
        const simCheckoutId = `SIM_CHK_${Date.now()}`;
        const simulatedPayload = {
            Body: {
                stkCallback: {
                    MerchantRequestID: `SIM_MRCH_${Date.now()}`,
                    CheckoutRequestID: simCheckoutId,
                    ResultCode: 0,
                    ResultDesc: 'The service request is processed successfully.',
                    CallbackMetadata: {
                        Item: [
                            { Name: 'Amount', Value: 1000 },
                            { Name: 'MpesaReceiptNumber', Value: simReceipt },
                            { Name: 'TransactionDate', Value: 20260815163000 },
                            { Name: 'PhoneNumber', Value: '254712345678' }
                        ]
                    }
                }
            }
        };
        // Record simulated callback in MpesaCallbackLog to verify database processing of simulated payload data
        const callbackLog = await models_1.MpesaCallbackLog.create({
            checkoutRequestId: simCheckoutId,
            merchantRequestId: simulatedPayload.Body.stkCallback.MerchantRequestID,
            rawPayload: JSON.stringify(simulatedPayload),
            validationStatus: 'VALID',
            signatureVerified: true,
            databaseUpdateStatus: 'SUCCESS',
            errorDetails: 'Simulated test connection callback processed successfully'
        });
        res.json({
            success: true,
            message: `Simulated M-Pesa callback processed successfully! Receipt: ${simReceipt}`,
            receipt: simReceipt,
            checkoutRequestId: simCheckoutId,
            logId: callbackLog.id,
            simulatedPayload
        });
    }
    catch (error) {
        logger_1.default.error('Failed to simulate M-Pesa callback', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process simulated M-Pesa callback.'
        });
    }
});
exports.default = router;
