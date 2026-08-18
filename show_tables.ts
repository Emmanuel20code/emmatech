
import { sequelize } from './src/models/index';

async function run() {
    try {
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log('Tables in database:', tables);
    } catch (e: any) {
        console.error('Failed to show tables:', e.message);
    }
    process.exit(0);
}

run();
