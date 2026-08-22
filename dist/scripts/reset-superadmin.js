"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function resetSuperAdmin() {
    try {
        await models_1.sequelize.authenticate();
        console.log('Database connected.');
        // Delete all existing super admins and platform owners
        const deletedCount = await models_1.AdminUser.destroy({
            where: {
                role: ['SUPER_ADMIN', 'PLATFORM_OWNER']
            }
        });
        console.log(`Deleted ${deletedCount} old super admin / platform owner account(s).`);
        // Create new super admin
        const newEmail = 'emmatechwifi@gmail.com';
        const newPassword = 'Emmatech2026!';
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
        const newSuperAdmin = await models_1.AdminUser.create({
            email: newEmail,
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            tenantId: null,
            commissionRate: 0
        });
        console.log('----------------------------------------');
        console.log('✨ NEW SUPER ADMIN CREATED SUCCESSFULLY ✨');
        console.log(`Email:    ${newEmail}`);
        console.log(`Password: ${newPassword}`);
        console.log(`Role:     SUPER_ADMIN`);
        console.log('----------------------------------------');
        process.exit(0);
    }
    catch (err) {
        console.error('Failed to reset Super Admin:', err);
        process.exit(1);
    }
}
resetSuperAdmin();
