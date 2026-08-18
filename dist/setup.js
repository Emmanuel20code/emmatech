"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("./models");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("./utils/logger"));
dotenv_1.default.config();
async function initialSetup() {
    try {
        await models_1.sequelize.authenticate();
        logger_1.default.info('Connected to database for setup.');
        // Force Sync to incorporate new models/fields
        await models_1.sequelize.sync({ alter: true });
        logger_1.default.info('Database schema updated.');
        // 1. Ensure Super Admin exists & reset credentials for recovery/reliability
        const superAdminEmails = [
            'admin@example.com',
            'admin@jevish.site',
            'superadmin@example.com',
            'emmanueloyaro123@gmail.com',
            'emmanueloyaro3@gmail.com'
        ];
        for (const saEmail of superAdminEmails) {
            const superAdminPasswordHash = await bcryptjs_1.default.hash('Jevish2026!', 12);
            const [saUser, created] = await models_1.AdminUser.findOrCreate({
                where: { email: saEmail },
                defaults: {
                    password: superAdminPasswordHash,
                    role: 'SUPER_ADMIN',
                    tenantId: null,
                    commissionRate: 0
                }
            });
            if (!created) {
                // Update/reset existing user to be a functional Super Admin with the known master password
                await saUser.update({
                    password: superAdminPasswordHash,
                    role: 'SUPER_ADMIN',
                    tenantId: null
                });
                logger_1.default.info(`Super Admin password & role verified in setup: ${saEmail}`);
            }
            else {
                logger_1.default.info(`Super Admin created in setup: ${saEmail}`);
            }
        }
        // 1b. Create Platform Owner if not exists
        const ownerEmail = process.env.PLATFORM_OWNER_EMAIL || 'owner@jevish.site';
        const ownerPassword = process.env.PLATFORM_OWNER_PASSWORD || 'JevishOwner2026!';
        const existingOwner = await models_1.AdminUser.findOne({ where: { role: 'PLATFORM_OWNER' } });
        if (!existingOwner) {
            const hashedOwnerPassword = await bcryptjs_1.default.hash(ownerPassword, 12);
            await models_1.AdminUser.create({
                email: ownerEmail,
                password: hashedOwnerPassword,
                role: 'PLATFORM_OWNER',
                tenantId: null,
                commissionRate: 0
            });
            logger_1.default.info('Platform Owner created successfully.');
        }
        // 2. Create Platform Settings (Contact Details)
        const { Tenant, Package, Router: RouterModel, Subscriber, Payment, Voucher, Wallet, PlatformSetting } = require('./models');
        const settings = [
            { key: 'CONTACT_WHATSAPP', value: process.env.CONTACT_WHATSAPP || '+254768926965' },
            { key: 'CONTACT_WHATSAPP_URL', value: process.env.CONTACT_WHATSAPP_URL || 'https://wa.me/254768926965' },
            { key: 'CONTACT_PHONE', value: process.env.CONTACT_PHONE || '+254768926965' },
            { key: 'CONTACT_PHONE_TEL', value: process.env.CONTACT_PHONE_TEL || 'tel:+254768926965' },
            { key: 'CONTACT_EMAIL', value: process.env.CONTACT_EMAIL || 'emmanueloyaro3@gmail.com' },
            { key: 'CONTACT_EMAIL_MAILTO', value: process.env.CONTACT_EMAIL_MAILTO || 'mailto:emmanueloyaro3@gmail.com' },
            { key: 'CONTACT_FACEBOOK_PAGE', value: process.env.CONTACT_FACEBOOK_PAGE || 'Jevish' },
            { key: 'CONTACT_FACEBOOK_URL', value: process.env.CONTACT_FACEBOOK_URL || 'https://www.facebook.com/Jevish' },
            { key: 'CONTACT_SUPPORT_MESSAGE', value: process.env.CONTACT_SUPPORT_MESSAGE || 'Hello Jevish Support, I need help with…' },
            { key: 'GITHUB_REPO', value: '' },
            { key: 'GITHUB_BRANCH', value: 'main' },
            { key: 'GITHUB_TOKEN', value: '' }
        ];
        for (const setting of settings) {
            await PlatformSetting.findOrCreate({
                where: { key: setting.key },
                defaults: { value: setting.value }
            });
        }
        logger_1.default.info('Platform settings initialized.');
        // 3. Create Primary ISP Tenant
        await Tenant.destroy({ where: { subdomain: 'alpha' }, cascade: true });
        await Tenant.destroy({ where: { subdomain: 'demo' }, cascade: true });
        const tenant = await Tenant.create({
            id: 'primary-tenant-id-001',
            name: 'Primary ISP System',
            subdomain: 'primary',
            primaryColor: '#3b82f6',
            status: 'ACTIVE',
            description: 'Primary ISP Production System',
            contactPhone: '0700000000'
        });
        // 3. Create Tenant Admin
        const adminPass = await bcryptjs_1.default.hash('Admin123!', 12);
        await models_1.AdminUser.create({
            email: 'admin@primaryisp.com',
            password: adminPass,
            role: 'TENANT_ADMIN',
            tenantId: tenant.id
        });
        // 4. Routers
        const r1 = await RouterModel.create({ name: 'Node 01 - CBD', host: '197.10.20.1', username: 'api', password: 'password', tenantId: tenant.id });
        await RouterModel.create({ name: 'Node 02 - Westlands', host: '197.10.20.2', username: 'api', password: 'password', tenantId: tenant.id });
        // 5. Packages
        const p1 = await Package.create({ name: '1 Hour Fast', price: 20, durationMinutes: 60, type: 'HOTSPOT', tenantId: tenant.id, isEnabled: true });
        const p2 = await Package.create({ name: '24 Hour Unlimited', price: 100, durationMinutes: 1440, type: 'HOTSPOT', tenantId: tenant.id, isEnabled: true });
        const p3 = await Package.create({ name: 'Home Fiber 20Mbps', price: 3500, durationMinutes: 43200, type: 'ISP', tenantId: tenant.id, isEnabled: true });
        // 6. Subscribers & Wallets
        const sub = await Subscriber.create({
            name: 'Maina Kamau',
            phoneNumber: '0711223344',
            pppoeUsername: 'mainan01',
            pppoePassword: 'pass',
            packageId: p3.id,
            routerId: r1.id,
            expiryDate: new Date(Date.now() + 864000000),
            tenantId: tenant.id
        });
        await Wallet.create({
            ownerId: sub.id,
            ownerType: 'SUBSCRIBER',
            balance: 1500,
            tenantId: tenant.id
        });
        // 7. Payments (History)
        for (let i = 0; i < 20; i++) {
            await Payment.create({
                phoneNumber: `072200000${i}`,
                amount: i % 3 === 0 ? 100 : 20,
                status: 'SUCCESS',
                mpesaReceiptNumber: `RCEIPTPAY${i}${Math.random().toString(36).substring(7).toUpperCase()}`,
                packageId: i % 3 === 0 ? p2.id : p1.id,
                tenantId: tenant.id,
                createdAt: new Date(Date.now() - (i * 3600000 * 3))
            });
        }
        // 8. Vouchers
        for (let i = 0; i < 15; i++) {
            await Voucher.create({
                code: `SBILL-${Math.random().toString(36).substring(7).toUpperCase()}`,
                packageId: p1.id,
                tenantId: tenant.id,
                status: 'AVAILABLE'
            });
        }
        logger_1.default.info('Commercial SaaS "Jevish Alpha" working data initialized.');
        logger_1.default.info('Production system setup complete.');
        process.exit(0);
    }
    catch (err) {
        logger_1.default.error('Setup failed:', { error: err.message });
        process.exit(1);
    }
}
initialSetup();
