import { sequelize } from './src/models/index';
async function test() {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE column_name = 'tenantId'
    `);
    console.log(results);
  } catch(e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
test();
