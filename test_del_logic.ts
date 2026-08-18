import { sequelize, Tenant } from './src/models/index';
async function test() {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query('SET LOCAL session_replication_role = replica;', { transaction });
    const [results] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE column_name = 'tenantId'
        AND table_schema = 'public'
    `, { transaction });

    console.log(`Found ${results.length} tables with tenantId.`);

    for (const row of results) {
      try {
          await sequelize.query(`DELETE FROM "${row.table_name}" WHERE "tenantId" = :id`, {
              replacements: { id: '00000000-0000-0000-0000-000000000000' },
              transaction
          });
      } catch(e) {
        console.error(`Failed on ${row.table_name}:`, e.message);
      }
    }
    
    await transaction.rollback();
    console.log("Success testing logic");
  } catch(e) {
    console.error("Error:", e.message);
    await transaction.rollback();
  }
  process.exit(0);
}
test();
