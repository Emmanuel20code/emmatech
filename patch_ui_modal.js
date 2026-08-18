const fs = require('fs');
const path = 'frontend/src/pages/SuperAdmin/SuperAdminCommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state
content = content.replace(
    "const [actionMsg, setActionMsg] = useState('');",
    "const [actionMsg, setActionMsg] = useState('');\n    const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);"
);

// 2. Change button onClick
const oldButton = `                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to permanently delete this ISP workspace? This cannot be undone.')) {
                                                        handleTenantAction(t.id, 'DELETE');
                                                    }
                                                }}`;
const newButton = `                                            <button
                                                onClick={() => setTenantToDelete(t.id)}`;
content = content.replace(oldButton, newButton);

// 3. Add modal at the end before </div>
const modalHTML = `
            {/* ─── DELETION MODAL ─── */}
            {tenantToDelete && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 max-w-md w-full shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-rose-500">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold">Permanent Deletion</h3>
                        </div>
                        <p className="text-[var(--text-secondary)] mb-6 text-sm leading-relaxed">
                            Are you absolutely sure you want to permanently delete this ISP workspace? This action will destroy all routers, subscribers, payments, and settings. This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setTenantToDelete(null)}
                                className="px-4 py-2 bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] rounded-xl text-sm font-bold hover:bg-[var(--bg-surface-elevated-hover)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleTenantAction(tenantToDelete, 'DELETE');
                                    setTenantToDelete(null);
                                }}
                                className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 transition-colors"
                            >
                                Yes, Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};`;
content = content.replace(/        <\/div>\n    \);\n};/, modalHTML);

fs.writeFileSync(path, content);
