const fs = require('fs');
const path = 'src/services/superadmin.service.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    'Tenant, Subscriber, Router as RouterModel, Payment, Wallet,',
    'Tenant, Subscriber, Router as RouterModel, Payment, Wallet, sequelize,'
);

fs.writeFileSync(path, content);
