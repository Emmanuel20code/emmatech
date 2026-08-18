import React, { useState } from 'react';
import axios from 'axios';
import {
    Zap,
    Download,
    RefreshCcw,
    Play,
    CheckCircle2,
    ShieldAlert
} from 'lucide-react';

const QuickActionsTab: React.FC = () => {
    const [executing, setExecuting] = useState<string | null>(null);
    const [actionResult, setActionResult] = useState<string | null>(null);

    const handleRunQuickAction = async (actionType: string) => {
        if (!confirm(`Are you sure you want to trigger platform quick action: ${actionType}?`)) {
            return;
        }

        try {
            setExecuting(actionType);
            setActionResult(null);
            const response = await axios.post('/api/v1/platform-owner/quick-actions', {
                actionType
            });
            setActionResult(response.data.message || 'Action completed successfully.');
        } catch (error: any) {
            alert(`Quick Action failed: ${error.response?.data?.error || error.message}`);
        } finally {
            setExecuting(null);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)]">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Zap className="text-amber-500" size={24} /> One-Click Administrative Action Center
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Execute high-priority system maintenance, mass router backups, and platform-wide state cleanup.
                </p>
            </div>

            {/* Quick Actions Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mass Router Backup */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4 flex flex-col justify-between shadow-lg">
                    <div>
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-3">
                            <Download size={22} />
                        </div>
                        <h4 className="font-bold text-base text-[var(--text-primary)]">Platform-Wide Mass Router Backup</h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                            Trigger backup creation on every online MikroTik router across all tenants simultaneously.
                        </p>
                    </div>

                    <button
                        onClick={() => handleRunQuickAction('BACKUP_ALL_ROUTERS')}
                        disabled={executing === 'BACKUP_ALL_ROUTERS'}
                        className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={14} /> {executing === 'BACKUP_ALL_ROUTERS' ? 'Executing Mass Backup...' : 'Trigger Mass Router Backup'}
                    </button>
                </div>

                {/* Clear Stale Active Sessions */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4 flex flex-col justify-between shadow-lg">
                    <div>
                        <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl w-fit mb-3">
                            <RefreshCcw size={22} />
                        </div>
                        <h4 className="font-bold text-base text-[var(--text-primary)]">Purge Expired Active Sessions</h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                            Scan and expire stale active customer sessions whose expiry time has passed across all tenants.
                        </p>
                    </div>

                    <button
                        onClick={() => handleRunQuickAction('CLEAR_ACTIVE_STALE_SESSIONS')}
                        disabled={executing === 'CLEAR_ACTIVE_STALE_SESSIONS'}
                        className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={14} /> {executing === 'CLEAR_ACTIVE_STALE_SESSIONS' ? 'Purging Stale Sessions...' : 'Purge Expired Sessions'}
                    </button>
                </div>
            </div>

            {/* Action Output Display */}
            {actionResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 size={20} className="shrink-0" />
                    <p className="text-xs font-mono font-bold">{actionResult}</p>
                </div>
            )}
        </div>
    );
};

export default QuickActionsTab;
