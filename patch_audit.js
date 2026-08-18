const fs = require('fs');
const path = 'src/services/superadmin.service.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
    /await AuditService.log\('TENANT_DELETED', `Tenant \$\{tenant\.name\} deleted by SuperAdmin`, 'SYSTEM', superAdminId\);/g,
    "await AuditService.log('TENANT_DELETED', `Tenant ${tenant.name} deleted by SuperAdmin`, undefined, superAdminId);"
);
fs.writeFileSync(path, content);
