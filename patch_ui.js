const fs = require('fs');
const path = 'frontend/src/pages/SuperAdmin/SuperAdminCommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `                                                <button
                                                    onClick={() => handleTenantAction(t.id, 'IMPERSONATE')}
                                                    className="px-2.5 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-500 hover:text-white inline-flex items-center gap-1"
                                                >
                                                    <ExternalLink className="w-3 h-3" /> Impersonate
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('Are you sure you want to permanently delete this ISP workspace? This cannot be undone.')) {
                                                            handleTenantAction(t.id, 'DELETE');
                                                        }
                                                    }}
                                                    className="px-2.5 py-1 bg-rose-500/10 text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-500 hover:text-white inline-flex items-center gap-1"
                                                >
                                                    Delete
                                                </button>`;

content = content.replace(/<button[\s\S]*?IMPERSONATE[\s\S]*?<\/button>/, replacement);
fs.writeFileSync(path, content);
