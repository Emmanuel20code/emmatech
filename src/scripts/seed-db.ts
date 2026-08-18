import { sequelize, AdminUser, Tenant, Package } from '../models';
import bcrypt from 'bcryptjs';

async function seedDatabase() {
    try {
        // Sync database (force true to recreate with correct schema)
        await sequelize.sync({ force: true });
        console.log('✅ Database schema recreated successfully');

        // 1. Create Super Admin
        const superAdminPassword = await bcrypt.hash('admin123', 12);
        await AdminUser.create({
            email: 'superadmin@example.com',
            password: superAdminPassword,
            role: 'SUPER_ADMIN'
        });
        console.log('✅ Super Admin created: superadmin@example.com / admin123');

        // 2. Create Primary Production Tenant
        const primaryTenant = await Tenant.create({
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
        const tenantAdminPassword = await bcrypt.hash('tenant123', 12);
        await AdminUser.create({
            email: 'admin@primaryisp.com',
            password: tenantAdminPassword,
            role: 'TENANT',
            tenantId: primaryTenant.id
        });
        console.log('✅ Tenant Admin created: admin@primaryisp.com / tenant123');

        // 4. Create Hotspot Packages
        const packages = [
            { name: '1 Hour', price: 10, durationMinutes: 60, tenantId: primaryTenant.id, type: 'HOTSPOT' as const },
            { name: '24 Hours', price: 50, durationMinutes: 1440, tenantId: primaryTenant.id, type: 'HOTSPOT' as const },
            { name: '1 Week', price: 250, durationMinutes: 10080, tenantId: primaryTenant.id, type: 'HOTSPOT' as const },
            { name: '1 Month', price: 1000, durationMinutes: 43200, tenantId: primaryTenant.id, type: 'HOTSPOT' as const }
        ];

        await Package.bulkCreate(packages);
        console.log('✅ Default packages created for Primary ISP');

        console.log('\n🚀 Database seeding complete!');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await sequelize.close();
    }
}

seedDatabase();
