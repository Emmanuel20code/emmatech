const fs = require('fs');
const path = 'src/services/superadmin.service.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `            case 'DELETE':
                const transaction = await sequelize.transaction();
                try {
                    await sequelize.query('SET LOCAL session_replication_role = replica;', { transaction });
                    
                    const [results] = await sequelize.query(\`
                        SELECT table_name 
                        FROM information_schema.columns 
                        WHERE column_name = 'tenantId' 
                          AND table_schema = 'public'
                    \`, { transaction });

                    for (const row of results) {
                        try {
                            await sequelize.query(\`DELETE FROM "\${row.table_name}" WHERE "tenantId" = :id\`, { 
                                replacements: { id: tenant.id },
                                transaction 
                            });
                        } catch (e) {
                            // ignore errors for specific tables, like views
                        }
                    }
                    
                    await tenant.destroy({ transaction });
                    await sequelize.query('SET LOCAL session_replication_role = DEFAULT;', { transaction });
                    await transaction.commit();
                    
                    await AuditService.log('TENANT_DELETED', \`Tenant \${tenant.name} deleted by SuperAdmin\`, 'SYSTEM', superAdminId);
                    return { message: \`Tenant \${tenant.name} permanently deleted successfully\` };
                } catch (e) {
                    await transaction.rollback();
                    throw e;
                }`;

content = content.replace(/case 'DELETE':[\s\S]*?throw e;\n                }/, replacement);
fs.writeFileSync(path, content);
