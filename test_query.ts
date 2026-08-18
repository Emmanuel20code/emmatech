
import { sequelize } from './src/models/index';

async function run() {
    try {
        const result = await sequelize.query('SELECT "payheroReference" FROM "payment" LIMIT 1;');
        console.log('Successfully queried payheroReference:', result);
    } catch (e: any) {
        console.error('Failed to query payheroReference:', e.message);
    }
    process.exit(0);
}

run();
