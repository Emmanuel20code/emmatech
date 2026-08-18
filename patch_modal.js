const fs = require('fs');
const path = 'frontend/src/pages/TenantPortal.tsx';
let content = fs.readFileSync(path, 'utf8');

const returnStart = `    return (
        <div className={\`space-y-6 pb-12 text-slate-100 bg-[#0b0f19] min-h-screen p-1 sm:p-4 rounded-3xl \${isBlocked ? "opacity-20 pointer-events-none blur-sm select-none" : ""}\` }>`;

const newReturnStart = `    return (
        <>
        <div className={\`space-y-6 pb-12 text-slate-100 bg-[#0b0f19] min-h-screen p-1 sm:p-4 rounded-3xl \${isBlocked ? "opacity-20 pointer-events-none blur-sm select-none" : ""}\` }>`;

content = content.replace(returnStart, newReturnStart);

const modalHtml = `            {(showCheckout || isBlocked) && subStatus?.unpaidInvoiceId && (
                <CheckoutModal
                    invoiceId={subStatus.unpaidInvoiceId}
                    amount={subStatus.amountDue}
                    disableClose={isBlocked}
                    onClose={!isBlocked ? () => setShowCheckout(false) : undefined}
                    onSuccess={() => { setShowCheckout(false); load(true); }}
                />
            )}`;

content = content.replace(modalHtml, '');

const endDiv = `        </div>
    );
};`;

const newEndDiv = `        </div>
            {(showCheckout || isBlocked) && subStatus?.unpaidInvoiceId && (
                <CheckoutModal
                    invoiceId={subStatus.unpaidInvoiceId}
                    amount={subStatus.amountDue}
                    disableClose={isBlocked}
                    onClose={!isBlocked ? () => setShowCheckout(false) : undefined}
                    onSuccess={() => { setShowCheckout(false); load(true); }}
                />
            )}
        </>
    );
};`;

content = content.replace(endDiv, newEndDiv);
fs.writeFileSync(path, content);
