
import { sequelize } from './src/models/index';

async function run() {
    try {
        console.log('Starting sync...');
        await sequelize.sync({ alter: true });
        console.log('Sync completed successfully.');
    } catch (e: any) {
        console.error('Sync failed:', e.message);
    }
    process.exit(0);
}

run();
