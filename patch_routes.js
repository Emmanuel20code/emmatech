const fs = require('fs');
const path = 'src/routes/tenant-saas.routes.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
    'if (!unpaidInvoice && (info.isTrial || info.isExpired)) {',
    'if (!unpaidInvoice && (info.isTrial || info.isExpired || info.daysRemaining <= 0 || ["SUSPENDED", "OVERDUE", "EXPIRED"].includes(info.status))) {'
);
fs.writeFileSync(path, content);
