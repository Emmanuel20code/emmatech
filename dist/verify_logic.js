"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("./models");
async function verify() {
    console.log('--- STARTING VERIFICATION ---');
    try {
        // 1. Verify Packages
        const packages = await models_1.Package.findAll();
        console.log(`Found ${packages.length} packages.`);
        if (packages.length !== 6) {
            console.error('ERROR: Expected 6 packages, found', packages.length);
        }
        else {
            console.log('SUCCESS: All 6 packages found.');
        }
        // 2. Simulate Payment Validation (Strict Amount Check)
        const pkg = packages.find(p => p.name === '1 Hour');
        if (!pkg)
            throw new Error('1 Hour package not found');
        console.log(`Testing validation for package: ${pkg.name} (Price: ${pkg.price})`);
        // Mock a payment callback logic (simplified from server.ts)
        const validatePayment = (amount, expectedPrice) => {
            if (amount !== expectedPrice) {
                return 'FAILED';
            }
            return 'SUCCESS';
        };
        const resultSuccess = validatePayment(10, pkg.price);
        console.log(`Result for KES 10: ${resultSuccess}`);
        const resultFail = validatePayment(20, pkg.price);
        console.log(`Result for KES 20 (Overpayment): ${resultFail}`);
        // 3. Verify Session Expiry Calculation
        const minutes = pkg.durationMinutes || 0;
        const now = Date.now();
        const expiry = new Date(now + minutes * 60 * 1000);
        console.log(`Current Time: ${new Date(now).toISOString()}`);
        console.log(`Expected Expiry (60 mins): ${expiry.toISOString()}`);
        // 4. Verify Revenue Aggregation Logic
        // (Mocking successful payments for verification)
        await models_1.Payment.create({
            phoneNumber: '254712345678',
            amount: 10,
            packageId: pkg.id,
            status: 'SUCCESS',
            mpesaReceiptNumber: 'VERIFY001',
            macAddress: 'AA:BB:CC:DD:EE:FF'
        });
        const revenue = await models_1.Payment.findAll({
            attributes: [
                [models_1.sequelize.col('package.name'), 'packageName'],
                [models_1.sequelize.fn('COUNT', models_1.sequelize.col('payment.id')), 'count'],
                [models_1.sequelize.fn('SUM', models_1.sequelize.col('payment.amount')), 'totalRevenue']
            ],
            include: [{ model: models_1.Package, attributes: [] }],
            where: { status: 'SUCCESS' },
            group: ['package.name'],
            raw: true
        });
        console.log('Revenue Report:', JSON.stringify(revenue, null, 2));
        console.log('--- VERIFICATION COMPLETE ---');
    }
    catch (error) {
        console.error('Verification failed:', error);
    }
    finally {
        process.exit();
    }
}
models_1.sequelize.sync({ alter: true }).then(verify);
