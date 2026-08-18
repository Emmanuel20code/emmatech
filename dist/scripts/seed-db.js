"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function seedDatabase() {
    try {
        // Sync database (force true to recreate with correct schema)
        await models_1.sequelize.sync({ force: true });
        console.log('✅ Database schema recreated successfully');
        // 1. Create Super Admin
        const superAdminPassword = await bcryptjs_1.default.hash('admin123', 12);
        await models_1.AdminUser.create({
            email: 'superadmin@example.com',
            password: superAdminPassword,
            role: 'SUPER_ADMIN'
        });
        console.log('✅ Super Admin created: superadmin@example.com / admin123');
        // 2. Create Primary Production Tenant
        const primaryTenant = await models_1.Tenant.create({
            name: 'Primary ISP System',
            subdomain: 'primary',
            status: 'ACTIVE',
            mpesaShortcode: '174379',
            mpesaPasskey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
            primaryColor: '#3b82f6',
            commissionPercentage: 10
        });
        console.log('✅ Primary Tenant created:', primaryTenant.name);
        // 3. Create Tenant Admin
        const tenantAdminPassword = await bcryptjs_1.default.hash('tenant123', 12);
        await models_1.AdminUser.create({
            email: 'admin@primaryisp.com',
            password: tenantAdminPassword,
            role: 'TENANT',
            tenantId: primaryTenant.id
        });
        console.log('✅ Tenant Admin created: admin@primaryisp.com / tenant123');
        // 4. Create Hotspot Packages
        const packages = [
            { name: '1 Hour', price: 10, durationMinutes: 60, tenantId: primaryTenant.id, type: 'HOTSPOT' },
            { name: '24 Hours', price: 50, durationMinutes: 1440, tenantId: primaryTenant.id, type: 'HOTSPOT' },
            { name: '1 Week', price: 250, durationMinutes: 10080, tenantId: primaryTenant.id, type: 'HOTSPOT' },
            { name: '1 Month', price: 1000, durationMinutes: 43200, tenantId: primaryTenant.id, type: 'HOTSPOT' }
        ];
        await models_1.Package.bulkCreate(packages);
        console.log('✅ Default packages created for Primary ISP');
        console.log('\n🚀 Database seeding complete!');
    }
    catch (error) {
        console.error('❌ Seeding failed:', error);
    }
    finally {
        await models_1.sequelize.close();
    }
}
seedDatabase();
