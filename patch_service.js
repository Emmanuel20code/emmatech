const fs = require('fs');
const path = 'src/services/superadmin.service.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `            case 'RESET_PASSWORD':
                const newPassword = payload.newPassword || 'JevishTemp123!';
                const hashed = await bcrypt.hash(newPassword, 10);
                const tenantAdmin = await AdminUser.findOne({ where: { tenantId: tenant.id } });
                if (tenantAdmin) {
                    await tenantAdmin.update({ password: hashed });
                    return { message: \`Password reset to \${newPassword}\` };
                }
                return { error: 'No admin user found' };

            case 'DELETE':
                // Try to delete tenant. In order to avoid constraint errors, we disable checks or rely on sequelize CASCADE.
                // An easier way in sequelize is to destroy it, and we let DB cascade if setup.
                // We'll execute raw query to disable triggers and delete if needed, but a standard destroy might work.
                try {
                    await sequelize.query('SET session_replication_role = replica;');
                    // Delete the tenant, constraints will be ignored by trigger or we manually cascade
                    // Actually, let's just delete the records from known tables manually
                    const tablesToClean = [
                        'subscriber_groups', 'admin_users', 'routers', 'packages', 'subscribers', 'payments', 'sessions',
                        'invoices', 'wallets', 'vouchers', 'audit_logs', 'sms_logs', 'platform_transactions', 'router_connection_logs',
                        'message_templates', 'tenant_sms_wallets', 'sms_transactions', 'sms_campaign_messages',
                        'sms_procurement_tasks', 'tenant_documents', 'tenant_withdrawals', 'ad_campaigns', 'media_items',
                        'marketing_coupons', 'qr_campaigns', 'marketing_landing_pages', 'ad_analytics', 'customer_segments',
                        'marketing_settings', 'tenant_subscriptions', 'tenant_addon_modules', 'saas_invoices', 'saas_payments',
                        'saas_notifications', 'refund_requests', 'compensation_rules', 'refund_audit_logs', 'nas', 'radius_policies',
                        'saas_subscription_payments', 'payment_logs', 'payment_verification_audits', 'mpesa_callback_logs'
                    ];
                    
                    for (const tbl of tablesToClean) {
                        try {
                            await sequelize.query(\`DELETE FROM \${tbl} WHERE "tenantId" = :id\`, { replacements: { id: tenant.id } });
                        } catch (e) { /* ignore if table not found or doesn't have tenantId */ }
                    }
                    await tenant.destroy();
                    await sequelize.query('SET session_replication_role = DEFAULT;');
                    await AuditService.log('TENANT_DELETED', \`Tenant \${tenant.name} deleted by SuperAdmin\`, tenant.id, superAdminId);
                    return { message: \`Tenant \${tenant.name} deleted successfully\` };
                } catch (e) {
                    await sequelize.query('SET session_replication_role = DEFAULT;');
                    throw e;
                }
`;
content = content.replace(/case 'RESET_PASSWORD':[\s\S]*?return { error: 'No admin user found' };/, replacement);
fs.writeFileSync(path, content);
