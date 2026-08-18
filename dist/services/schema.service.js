"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
class SchemaService {
    static { this.initializedTenants = new Set(); }
    /**
     * Create a new schema for a tenant and sync tenant-specific models
     */
    static async initTenantSchema(tenantId) {
        const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
        try {
            logger_1.default.info(`Initializing physical isolation for tenant: ${tenantId} as ${schemaName}`);
            // 1. Create the schema
            await models_1.sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
            // 2. Define isolated tables to be physically created in the new schema
            // We copy structure from public schema using exact Sequelize-generated table names
            const isolatedTables = [
                'subscribers',
                'subscriber_groups',
                'packages',
                'routers',
                'payment',
                'sessions',
                'vouchers',
                'wallets',
                'walletTransactions',
                'fraud_logs',
                'sms_logs',
                'campaigns',
                'messageTemplates',
                'campaignLogs',
                'router_incidents',
                'downtime_records',
                'radius_policies',
                'nas',
                'radcheck',
                'radreply',
                'radgroupcheck',
                'radgroupreply',
                'radusergroup',
                'radacct',
                'radpostauth',
                'router_connection_logs',
                'invoices',
                'tenant_documents',
                'tenant_withdrawals',
                'tenant_sms_wallets',
                'sms_transactions',
                'sms_campaign_messages',
                'sms_procurement_tasks',
                'sms_ledger_transactions',
                'sandbox_message_logs',
                'sandbox_payment_logs',
                'ad_campaigns'
            ];
            for (const table of isolatedTables) {
                try {
                    await models_1.sequelize.query(`CREATE TABLE IF NOT EXISTS "${schemaName}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
                }
                catch (tableErr) {
                    // If table doesn't exist in public yet (e.g. not synced), we skip or log
                    logger_1.default.warn(`Could not create isolated table ${table} in ${schemaName}: ${tableErr.message}`);
                }
            }
            logger_1.default.info(`Schema ${schemaName} isolation complete.`);
        }
        catch (error) {
            logger_1.default.error(`Failed to initialize schema for tenant ${tenantId}`, { error: error.message });
            throw error;
        }
    }
    /**
     * Set the search path for a specific tenant context
     */
    static async setSearchPath(tenantId) {
        if (!tenantId) {
            await models_1.sequelize.query('SET search_path TO public');
            return;
        }
        // Self-healing: Ensure all tenant isolated tables exist
        if (!SchemaService.initializedTenants.has(tenantId)) {
            try {
                await SchemaService.initTenantSchema(tenantId);
                SchemaService.initializedTenants.add(tenantId);
            }
            catch (err) {
                logger_1.default.warn(`Self-healing schema initialization failed for tenant ${tenantId}: ${err.message}`);
            }
        }
        const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
        // Verify schema exists first (optional but safer)
        await models_1.sequelize.query(`SET search_path TO "${schemaName}", public`);
    }
}
exports.SchemaService = SchemaService;
