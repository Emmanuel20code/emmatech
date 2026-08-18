import { sequelize } from '../models';
import logger from '../utils/logger';

export class SchemaService {
    private static initializedTenants = new Set<string>();

    /**
     * Create a new schema for a tenant and sync tenant-specific models
     */
    static async initTenantSchema(tenantId: string): Promise<void> {
        const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
        try {
            logger.info(`Initializing physical isolation for tenant: ${tenantId} as ${schemaName}`);
            
            // 1. Create the schema
            await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
            
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
                    await sequelize.query(`CREATE TABLE IF NOT EXISTS "${schemaName}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
                } catch (tableErr: any) {
                    // If table doesn't exist in public yet (e.g. not synced), we skip or log
                    logger.warn(`Could not create isolated table ${table} in ${schemaName}: ${tableErr.message}`);
                }
            }
            
            logger.info(`Schema ${schemaName} isolation complete.`);
        } catch (error) {
            logger.error(`Failed to initialize schema for tenant ${tenantId}`, { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Set the search path for a specific tenant context
     */
    static async setSearchPath(tenantId: string | null): Promise<void> {
        if (!tenantId) {
            await sequelize.query('SET search_path TO public');
            return;
        }

        // Self-healing: Ensure all tenant isolated tables exist
        if (!SchemaService.initializedTenants.has(tenantId)) {
            try {
                await SchemaService.initTenantSchema(tenantId);
                SchemaService.initializedTenants.add(tenantId);
            } catch (err: any) {
                logger.warn(`Self-healing schema initialization failed for tenant ${tenantId}: ${err.message}`);
            }
        }

        const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
        // Verify schema exists first (optional but safer)
        await sequelize.query(`SET search_path TO "${schemaName}", public`);
    }
}

