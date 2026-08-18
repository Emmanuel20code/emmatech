import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { sequelize, AdminUser, Tenant, Subscriber, Package, Router, TestAccountSeed } from '../models';
import logger from '../utils/logger';

const BACKUP_DIR = path.resolve(__dirname, '../../backups');

export class StagingDbService {
    /**
     * Ensure backup directory exists.
     */
    private static ensureBackupDir(): void {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
    }

    /**
     * Create an automatic timestamped backup of the current database.
     */
    static async createBackup(): Promise<string> {
        this.ensureBackupDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `hotspot_db_backup_${timestamp}.bak`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        const dbStoragePath = path.resolve(__dirname, '../../database.dump');
        if (fs.existsSync(dbStoragePath)) {
            fs.copyFileSync(dbStoragePath, backupPath);
            logger.info(`[StagingDB] Pre-migration backup created: ${backupFileName}`);
        } else {
            logger.info(`[StagingDB] Backup stored to ${backupPath}.`);
        }

        return backupPath;
    }

    /**
     * List all available backups.
     */
    static listBackups(): Array<{ name: string; path: string; sizeBytes: number; createdAt: Date }> {
        this.ensureBackupDir();
        const files = fs.readdirSync(BACKUP_DIR);
        return files
            .filter(f => f.startsWith('hotspot_db_backup_') && f.endsWith('.bak'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
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
    static async rollbackToBackup(backupFileName: string): Promise<boolean> {
        this.ensureBackupDir();
        const backupPath = path.join(BACKUP_DIR, backupFileName);
        const dbStoragePath = path.resolve(__dirname, '../../database.dump');

        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup file '${backupFileName}' does not exist.`);
        }

        // Close connections temporarily by syncing
        await sequelize.close();

        fs.copyFileSync(backupPath, dbStoragePath);
        logger.info(`[StagingDB] Database rolled back successfully to ${backupFileName}`);

        // Re-authenticate sequelize
        await sequelize.authenticate();
        return true;
    }

    /**
     * Seed staging environment with realistic test accounts & data.
     */
    static async seedStagingData(): Promise<object> {
        logger.info('[StagingDB] Starting staging environment data seeding...');

        const passwordHash = await bcrypt.hash('StagingPassword123!', 10);

        // 1. Create Staging Test Tenant
        const [tenant] = await Tenant.findOrCreate({
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
                role: 'SUPER_ADMIN' as const,
                email: 'admin@jevish.site',
                description: 'Default Super Admin Account',
                tenantId: null,
            },
            {
                role: 'SUPER_ADMIN' as const,
                email: 'staging-superadmin@jevish.site',
                description: 'Super Admin Test Account (Full System Control)',
                tenantId: null,
            },
            {
                role: 'TENANT' as const,
                email: 'staging-tenantadmin@jevish.site',
                description: 'Tenant Administrator Test Account',
                tenantId: tenant.id,
            },
            {
                role: 'STAFF' as const,
                email: 'staging-cashier@jevish.site',
                description: 'Cashier / Frontdesk Staff Account',
                tenantId: tenant.id,
            },
            {
                role: 'AGENT' as const,
                email: 'staging-support@jevish.site',
                description: 'Support Agent Account',
                tenantId: tenant.id,
            },
        ];

        const seededUsers = [];
        for (const acc of testAccounts) {
            const [user] = await AdminUser.findOrCreate({
                where: { email: acc.email },
                defaults: {
                    email: acc.email,
                    password: passwordHash,
                    role: acc.role,
                    tenantId: acc.tenantId,
                }
            });

            await TestAccountSeed.findOrCreate({
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
            { name: 'Staging 1 Hour Quick Pass', price: 2000, durationMinutes: 60, speedLimit: '5M/5M', type: 'HOTSPOT' as const, tenantId: tenant.id },
            { name: 'Staging 24 Hour Unlimited', price: 10000, durationMinutes: 1440, speedLimit: '10M/10M', type: 'HOTSPOT' as const, tenantId: tenant.id },
            { name: 'Staging Monthly ISP Fiber 20Mbps', price: 300000, durationMinutes: 43200, speedLimit: '20M/20M', type: 'ISP' as const, tenantId: tenant.id },
        ];

        for (const pkg of samplePackages) {
            await Package.findOrCreate({
                where: { name: pkg.name, tenantId: tenant.id },
                defaults: pkg,
            });
        }

        // 4. Create Staging Router
        const [simRouter] = await Router.findOrCreate({
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
            { name: 'John Doe (Staging Test)', phoneNumber: '+254712345678', macAddress: 'AA:BB:CC:DD:EE:01', status: 'ACTIVE' as const, tenantId: tenant.id, routerId: simRouter.id },
            { name: 'Jane Smith (Staging Test)', phoneNumber: '+254798765432', macAddress: 'AA:BB:CC:DD:EE:02', status: 'INACTIVE' as const, tenantId: tenant.id, routerId: simRouter.id },
        ];

        for (const sub of sampleSubscribers) {
            await Subscriber.findOrCreate({
                where: { phoneNumber: sub.phoneNumber, tenantId: tenant.id },
                defaults: sub,
            });
        }

        logger.info('[StagingDB] Staging data seeded successfully.');

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
