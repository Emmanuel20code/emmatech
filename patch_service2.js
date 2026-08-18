const fs = require('fs');
const path = 'src/services/superadmin.service.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `            case 'RESET_PASSWORD':
                const newPassword = payload.newPassword || 'JevishTemp123!';
                const hashed = await bcrypt.hash(newPassword, 10);
                const tenantAdmin = await AdminUser.findOne({ where: { tenantId: tenant.id } });
                if (tenantAdmin) {
                    await tenantAdmin.update({ password: hashed });
                }
                await AuditService.log('TENANT_PASSWORD_RESET', \`SuperAdmin reset password for tenant \${tenant.name}\`, tenant.id, superAdminId);
                return { message: \`Password reset to: \${newPassword}\` };

            case 'DELETE':
                try {
                    // Try to execute a cascading raw SQL delete or manual table cleanup
                    await sequelize.query('SET session_replication_role = replica;');
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
                            await sequelize.query(\`DELETE FROM "\${tbl}" WHERE "tenantId" = :id\`, { replacements: { id: tenant.id } });
                        } catch (e) {
                            try {
                                await sequelize.query(\`DELETE FROM \${tbl} WHERE "tenantId" = :id\`, { replacements: { id: tenant.id } });
                            } catch (e2) {}
                        }
                    }
                    await tenant.destroy();
                    await sequelize.query('SET session_replication_role = DEFAULT;');
                    await AuditService.log('TENANT_DELETED', \`Tenant \${tenant.name} deleted by SuperAdmin\`, 'SYSTEM', superAdminId);
                    return { message: \`Tenant \${tenant.name} permanently deleted successfully\` };
                } catch (e) {
                    await sequelize.query('SET session_replication_role = DEFAULT;');
                    throw e;
                }`;

content = content.replace(/case 'RESET_PASSWORD':[\s\S]*?return { message: `Password reset to: \${newPassword}` };/, replacement);
fs.writeFileSync(path, content);
