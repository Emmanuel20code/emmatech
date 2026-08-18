const fs = require('fs');
const path = 'frontend/src/pages/TenantPortal.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/disableClose=\{isBlocked\}/g, 'disableClose={!!isBlocked}');
fs.writeFileSync(path, content);
