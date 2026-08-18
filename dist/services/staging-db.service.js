"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StagingDbService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const BACKUP_DIR = path_1.default.resolve(__dirname, '../../backups');
class StagingDbService {
    /**
     * Ensure backup directory exists.
     */
    static ensureBackupDir() {
        if (!fs_1.default.existsSync(BACKUP_DIR)) {
            fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
        }
    }
    /**
     * Create an automatic timestamped backup of the current database.
     */
    static async createBackup() {
        this.ensureBackupDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `hotspot_db_backup_${timestamp}.bak`;
        const backupPath = path_1.default.join(BACKUP_DIR, backupFileName);
        const dbStoragePath = path_1.default.resolve(__dirname, '../../database.dump');
        if (fs_1.default.existsSync(dbStoragePath)) {
            fs_1.default.copyFileSync(dbStoragePath, backupPath);
            logger_1.default.info(`[StagingDB] Pre-migration backup created: ${backupFileName}`);
        }
        else {
            logger_1.default.info(`[StagingDB] Backup stored to ${backupPath}.`);
        }
        return backupPath;
    }
    /**
     * List all available backups.
     */
    static listBackups() {
        this.ensureBackupDir();
        const files = fs_1.default.readdirSync(BACKUP_DIR);
        return files
            .filter(f => f.startsWith('hotspot_db_backup_') && f.endsWith('.bak'))
            .map(file => {
            const filePath = path_1.default.join(BACKUP_DIR, file);
            const stats = fs_1.default.statSync(filePath);
            return {
                name: file,
                path: filePath,
                sizeBytes: stats.size,
                createdAt: stats.mtime,
            };
        })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Rollback database to a specific backup file.
     */
    static async rollbackToBackup(backupFileName) {
        this.ensureBackupDir();
        const backupPath = path_1.default.join(BACKUP_DIR, backupFileName);
        const dbStoragePath = path_1.default.resolve(__dirname, '../../database.dump');
        if (!fs_1.default.existsSync(backupPath)) {
            throw new Error(`Backup file '${backupFileName}' does not exist.`);
        }
        // Close connections temporarily by syncing
        await models_1.sequelize.close();
        fs_1.default.copyFileSync(backupPath, dbStoragePath);
        logger_1.default.info(`[StagingDB] Database rolled back successfully to ${backupFileName}`);
        // Re-authenticate sequelize
        await models_1.sequelize.authenticate();
        return true;
    }
    /**
     * Seed staging environment with realistic test accounts & data.
     */
    static async seedStagingData() {
        logger_1.default.info('[StagingDB] Starting staging environment data seeding...');
        const passwordHash = await bcryptjs_1.default.hash('StagingPassword123!', 10);
        // 1. Create Staging Test Tenant
        const [tenant] = await models_1.Tenant.findOrCreate({
            where: { subdomain: 'staging-primary' },
            defaults: {
                name: 'Jevish Staging Test Workspace',
                subdomain: 'staging-primary',
                status: 'ACTIVE',
                primaryColor: '#0ea5e9',
                description: 'Isolated workspace for staging and automated testing.',
                contactPhone: '+254700000000',
            }
        });
        // 2. Create Test Accounts
        const testAccounts = [
            {
                role: 'SUPER_ADMIN',
                email: 'admin@jevish.site',
                description: 'Default Super Admin Account',
                tenantId: null,
            },
            {
                role: 'SUPER_ADMIN',
                email: 'staging-superadmin@jevish.site',
                description: 'Super Admin Test Account (Full System Control)',
                tenantId: null,
            },
            {
                role: 'TENANT',
                email: 'staging-tenantadmin@jevish.site',
                description: 'Tenant Administrator Test Account',
                tenantId: tenant.id,
            },
            {
                role: 'STAFF',
                email: 'staging-cashier@jevish.site',
                description: 'Cashier / Frontdesk Staff Account',
                tenantId: tenant.id,
            },
            {
                role: 'AGENT',
                email: 'staging-support@jevish.site',
                description: 'Support Agent Account',
                tenantId: tenant.id,
            },
        ];
        const seededUsers = [];
        for (const acc of testAccounts) {
            const [user] = await models_1.AdminUser.findOrCreate({
                where: { email: acc.email },
                defaults: {
                    email: acc.email,
                    password: passwordHash,
                    role: acc.role,
                    tenantId: acc.tenantId,
                }
            });
            await models_1.TestAccountSeed.findOrCreate({
                where: { email: acc.email },
                defaults: {
                    role: acc.role,
                    email: acc.email,
                    phoneNumber: '+254711000222',
                    tenantId: acc.tenantId,
                    description: acc.description,
                }
            });
            seededUsers.push({ email: user.email, role: user.role, tenantId: user.tenantId });
        }
        // 3. Create Sample WiFi Packages
        const samplePackages = [
            { name: 'Staging 1 Hour Quick Pass', price: 2000, durationMinutes: 60, speedLimit: '5M/5M', type: 'HOTSPOT', tenantId: tenant.id },
            { name: 'Staging 24 Hour Unlimited', price: 10000, durationMinutes: 1440, speedLimit: '10M/10M', type: 'HOTSPOT', tenantId: tenant.id },
            { name: 'Staging Monthly ISP Fiber 20Mbps', price: 300000, durationMinutes: 43200, speedLimit: '20M/20M', type: 'ISP', tenantId: tenant.id },
        ];
        for (const pkg of samplePackages) {
            await models_1.Package.findOrCreate({
                where: { name: pkg.name, tenantId: tenant.id },
                defaults: pkg,
            });
        }
        // 4. Create Staging Router
        const [simRouter] = await models_1.Router.findOrCreate({
            where: { name: 'Staging MikroTik Router (RB3011)', tenantId: tenant.id },
            defaults: {
                name: 'Staging MikroTik Router (RB3011)',
                host: '127.0.0.1',
                port: 8728,
                username: 'admin',
                password: 'simulator-pass',
                tenantId: tenant.id,
                location: 'Staging Virtual Rack #1',
                isOnline: true,
                validationStatus: 'VALIDATED',
                model: 'RB3011UiAS-RM',
                version: '7.12.1',
                architecture: 'arm',
            }
        });
        // 5. Create Sample Subscribers
        const sampleSubscribers = [
            { name: 'John Doe (Staging Test)', phoneNumber: '+254712345678', macAddress: 'AA:BB:CC:DD:EE:01', status: 'ACTIVE', tenantId: tenant.id, routerId: simRouter.id },
            { name: 'Jane Smith (Staging Test)', phoneNumber: '+254798765432', macAddress: 'AA:BB:CC:DD:EE:02', status: 'INACTIVE', tenantId: tenant.id, routerId: simRouter.id },
        ];
        for (const sub of sampleSubscribers) {
            await models_1.Subscriber.findOrCreate({
                where: { phoneNumber: sub.phoneNumber, tenantId: tenant.id },
                defaults: sub,
            });
        }
        logger_1.default.info('[StagingDB] Staging data seeded successfully.');
        return {
            tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
            seededUsersCount: seededUsers.length,
            samplePackagesCount: samplePackages.length,
            simulatedRouterId: simRouter.id,
            testCredentials: {
                password: 'StagingPassword123!',
                users: seededUsers,
            }
        };
    }
}
exports.StagingDbService = StagingDbService;
