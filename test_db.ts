import { sequelize } from './src/models/index';
async function test() {
  try {
    await sequelize.query('SET session_replication_role = replica;');
    console.log("Success setting replica");
  } catch(e) {
    console.error("Error setting replica:", e.message);
  }
  process.exit(0);
}
test();
