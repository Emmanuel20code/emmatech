"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("./models");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function seed() {
    await models_1.sequelize.sync({ force: true });
    // 1. Create Super Admin
    const superAdminPassword = await bcryptjs_1.default.hash('admin123', 10);
    await models_1.AdminUser.create({
        email: 'superadmin@example.com',
        password: superAdminPassword,
        role: 'SUPER_ADMIN'
    });
    // 2. Create Primary Tenant
    const primaryTenant = await models_1.Tenant.create({
        name: 'Primary ISP System',
        subdomain: 'primary',
        status: 'ACTIVE',
        mpesaShortcode: '174379',
        mpesaPasskey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
    });
    // 3. Create Tenant Admin
    const tenantAdminPassword = await bcryptjs_1.default.hash('tenant123', 10);
    await models_1.AdminUser.create({
        email: 'admin@primaryisp.com',
        password: tenantAdminPassword,
        role: 'TENANT_ADMIN',
        tenantId: primaryTenant.id
    });
    // 4. Create Primary Router
    await models_1.Router.create({
        name: 'Main Hotspot',
        host: '192.168.88.1',
        port: 8728,
        username: 'admin',
        password: '',
        tenantId: primaryTenant.id
    });
    // 5. Create Primary Agent
    const agentPassword = await bcryptjs_1.default.hash('agent123', 10);
    await models_1.AdminUser.create({
        email: 'agent@primaryisp.com',
        password: agentPassword,
        role: 'AGENT',
        tenantId: primaryTenant.id,
        commissionRate: 0.1 // 10% Commission
    });
    // 6. Create Hotspot Packages for Tenant
    await models_1.Package.bulkCreate([
        { name: '1 Hour', price: 10, durationMinutes: 60, tenantId: primaryTenant.id, type: 'HOTSPOT' },
        { name: '24 Hours', price: 50, durationMinutes: 1440, tenantId: primaryTenant.id, type: 'HOTSPOT' },
        { name: '1 Week', price: 250, durationMinutes: 10080, tenantId: primaryTenant.id, type: 'HOTSPOT' }
    ]);
    // 7. Create Vouchers for Agent to sell
    const hotspotPkg = await models_1.Package.findOne({ where: { tenantId: primaryTenant.id, type: 'HOTSPOT' } });
    if (hotspotPkg) {
        const vouchers = [];
        for (let i = 0; i < 10; i++) {
            vouchers.push({
                code: Math.random().toString(36).substring(2, 8).toUpperCase(),
                packageId: hotspotPkg.id,
                tenantId: primaryTenant.id,
                status: 'AVAILABLE'
            });
        }
        await models_1.Voucher.bulkCreate(vouchers);
    }
    // 8. Initialize wallets
    await models_1.Wallet.create({
        ownerId: primaryTenant.id,
        ownerType: 'TENANT',
        balance: 0,
        frozenBalance: 0,
        pendingBalance: 0,
        settledBalance: 0,
        currency: 'KES',
        tenantId: primaryTenant.id
    });
    await models_1.PlatformWallet.create({
        balance: 0,
        pendingBalance: 0,
        currency: 'KES'
    });
    // 9. Set up platform fees
    await models_1.PlatformFee.create({
        feeType: 'TRANSACTION',
        feeValue: 10, // 10%
        isPercentage: true,
        minAmount: 0,
        maxAmount: 100,
        isActive: true,
        description: 'Standard transaction fee'
    });
    // 10. Default WhatsApp Templates
    await models_1.MessageTemplate.bulkCreate([
        {
            name: 'Welcome Message',
            content: 'Hello {name}, welcome to Hotspot! We hope you enjoy our services.',
            channel: 'WHATSAPP',
            status: 'APPROVED',
            tenantId: primaryTenant.id
        },
        {
            name: 'Payment Reminder',
            content: 'Hi {name}, your hotspot subscription is about to expire. Top up now to stay connected!',
            channel: 'WHATSAPP',
            status: 'APPROVED',
            tenantId: primaryTenant.id
        },
        {
            name: 'Promotion Alert',
            content: 'Special Weekend Offer! Get 24 Hours for only KES 40. Buy now at the dashboard.',
            channel: 'WHATSAPP',
            status: 'APPROVED',
            tenantId: primaryTenant.id
        }
    ]);
    console.log('SaaS Database seeded with Super Admin, Primary Tenant, Agent, Vouchers, Wallet System, and WhatsApp Templates!');
    process.exit(0);
}
seed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
