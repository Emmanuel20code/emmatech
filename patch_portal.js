const fs = require('fs');
const path = 'frontend/src/pages/TenantPortal.tsx';
let content = fs.readFileSync(path, 'utf8');

const isBlockedLogic = `
    const isBlocked = subStatus && (
        ['EXPIRED', 'SUSPENDED', 'OVERDUE'].includes(subStatus.status) ||
        (['TRIAL', 'FREE_TRIAL'].includes(subStatus.status) && subStatus.daysRemaining <= 0) ||
        (['ACTIVE', 'PAID'].includes(subStatus.status) && subStatus.daysRemaining <= 0)
    );
`;

content = content.replace('const [lastUpdated, setLastUpdated] = useState(new Date());', 'const [lastUpdated, setLastUpdated] = useState(new Date());\n' + isBlockedLogic);

// Replace the checkout modal logic
const oldModal = `{showCheckout && subStatus?.unpaidInvoiceId && (
                <CheckoutModal
                    invoiceId={subStatus.unpaidInvoiceId}
                    amount={subStatus.amountDue}
                    onClose={() => setShowCheckout(false)}
                    onSuccess={() => { setShowCheckout(false); load(true); }}
                />
            )}`;

const newModal = `{(showCheckout || isBlocked) && subStatus?.unpaidInvoiceId && (
                <CheckoutModal
                    invoiceId={subStatus.unpaidInvoiceId}
                    amount={subStatus.amountDue}
                    disableClose={isBlocked}
                    onClose={!isBlocked ? () => setShowCheckout(false) : undefined}
                    onSuccess={() => { setShowCheckout(false); load(true); }}
                />
            )}`;

content = content.replace(oldModal, newModal);

// Modify the timer text
const oldBadge = `{subStatus.status === 'TRIAL' || subStatus.status === 'FREE_TRIAL' ? \`\${subStatus.daysRemaining} Days Left\` : subStatus.status}`;
const newBadge = `{\`\${subStatus.daysRemaining} Days to Renewal (\${subStatus.status})\`}`;

content = content.replace(oldBadge, newBadge);

// Blur the dashboard if blocked
const oldDashboardClass = 'className="space-y-6 pb-12 text-slate-100 bg-[#0b0f19] min-h-screen p-1 sm:p-4 rounded-3xl"';
const newDashboardClass = 'className={`space-y-6 pb-12 text-slate-100 bg-[#0b0f19] min-h-screen p-1 sm:p-4 rounded-3xl ${isBlocked ? "opacity-20 pointer-events-none blur-sm select-none" : ""}` }';

content = content.replace(oldDashboardClass, newDashboardClass);

fs.writeFileSync(path, content);
