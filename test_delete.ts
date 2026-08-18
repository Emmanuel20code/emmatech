import { Tenant } from './src/models/index.js';
import { sequelize } from './src/config/database.js';

async function run() {
  await sequelize.authenticate();
  console.log("Connected");
  const tenant = await Tenant.findOne();
  if(tenant) {
    console.log("Found tenant:", tenant.id);
  }
  process.exit(0);
}
run();
