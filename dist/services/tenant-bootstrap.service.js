"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantBootstrapService = void 0;
const models_1 = require("../models");
const wallet_service_1 = require("./wallet.service");
const models_2 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const audit_service_1 = require("./audit.service");
class TenantBootstrapService {
    /**
     * Initialize a new tenant with essential platform data (Wallet only)
     * No routers or packages are auto-created.
     */
    static async bootstrapNewTenant(tenantId, createdBy) {
        const transaction = await models_2.sequelize.transaction();
        try {
            // 1. Initialize tenant wallet (Mandatory for receiving payments)
            await wallet_service_1.WalletService.initializeTenantWallet(tenantId, transaction);
            // 2. Create 3-day trial subscription
            const starterPlan = await models_1.SubscriptionPlan.findOne({ where: { slug: 'unlimited' } })
                || await models_1.SubscriptionPlan.findOne({ where: { slug: 'starter' } })
                || await models_1.SubscriptionPlan.findOne({ transaction });
            const now = new Date();
            const trialEndDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days grace/trial period
            await models_1.TenantSubscription.create({
                tenantId,
                planId: starterPlan?.id,
                status: 'FREE_TRIAL',
                billingCycle: 'MONTHLY',
                startDate: now,
                currentPeriodStart: now,
                currentPeriodEnd: trialEndDate,
                trialEndDate,
                gracePeriodEndDate: null,
                autoRenew: false
            }, { transaction });
            // 3. Log the bootstrap action
            await audit_service_1.AuditService.log('TENANT_BOOTSTRAPPED', `Tenant ${tenantId} initialized. Wallet and 3-day trial subscription created.`, tenantId, createdBy);
            await transaction.commit();
            logger_1.default.info(`Tenant bootstrap completed for ${tenantId}.`, {
                tenantId,
                walletInitialized: true,
                subscriptionInitialized: true
            });
        }
        catch (error) {
            if (transaction)
                await transaction.rollback();
            logger_1.default.error('Failed to bootstrap tenant', {
                error: error instanceof Error ? error.message : String(error),
                tenantId
            });
            throw new Error('Tenant bootstrap failed');
        }
    }
    /**
     * Check if a tenant has been initialized (has a wallet)
     */
    static async isTenantBootstrapped(tenantId) {
        try {
            // Check if wallet exists
            const walletExists = await models_1.Wallet.findOne({
                where: { ownerId: tenantId, ownerType: 'TENANT' }
            });
            return !!walletExists;
        }
        catch (error) {
            logger_1.default.error('Failed to check tenant bootstrap status', {
                error: error instanceof Error ? error.message : String(error),
                tenantId
            });
            return false;
        }
    }
    /**
     * Ensure tenant is bootstrapped (idempotent)
     */
    /**
     * Ensure tenant is bootstrapped (idempotent)
     */
    static async ensureTenantBootstrapped(tenantId, createdBy) {
        const isBootstrapped = await this.isTenantBootstrapped(tenantId);
        if (!isBootstrapped) {
            await this.bootstrapNewTenant(tenantId, createdBy);
        }
    }
    /**
     * Ensure default production tenant, admin user, and packages exist on database startup, and purge all demo data.
     */
    static async ensureInitialProductionEnvironment() {
        try {
            const { Tenant, AdminUser } = require('../models');
            const bcrypt = require('bcryptjs');
            const { config } = require('../config/env');
            // 1. Ensure at least one active tenant exists for system operation
            let activeTenant = await Tenant.findOne({ where: { status: 'ACTIVE' } });
            if (!activeTenant) {
                activeTenant = await Tenant.create({
                    name: 'Primary ISP System',
                    subdomain: 'primary',
                    status: 'ACTIVE',
                    primaryColor: '#3b82f6',
                    commissionPercentage: 10
                });
                logger_1.default.info(`Initialized default primary tenant ${activeTenant.id}`);
            }
            // 2. Ensure Super Admin exists from environment variables
            const saEmail = config.auth.superAdminEmail || 'admin@example.com';
            const saPassword = config.auth.superAdminPassword || 'admin123';
            const superAdminPasswordHash = await bcrypt.hash(saPassword, 12);
            const [saUser, created] = await AdminUser.findOrCreate({
                where: { email: saEmail.toLowerCase() },
                defaults: {
                    password: superAdminPasswordHash,
                    role: 'SUPER_ADMIN',
                    tenantId: null,
                    commissionRate: 0
                }
            });
            if (!created) {
                await saUser.update({
                    password: superAdminPasswordHash,
                    role: 'SUPER_ADMIN',
                    tenantId: null
                });
                logger_1.default.info(`Super Admin password & role verified for: ${saEmail}`);
            }
            else {
                logger_1.default.info(`Super Admin created: ${saEmail}`);
            }
        }
        catch (error) {
            logger_1.default.error('Production environment bootstrap failed:', { error: error.message });
        }
    }
}
exports.TenantBootstrapService = TenantBootstrapService;
