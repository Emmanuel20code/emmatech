import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    Clock,
    Zap,
    Shield,
    CheckCircle2,
    Play,
    Bell,
    Save,
    Activity
} from 'lucide-react';

interface PolicyData {
    id?: string;
    dormantThresholdMinutes: number;
    actionOnDormant: 'ALERT_ONLY' | 'SUSPEND_ROUTER' | 'DISABLE_SYNC' | 'RECONNECT_ATTEMPT';
    notifyTenantAdmin: boolean;
    notifyPlatformOwner: boolean;
    autoActionEnabled: boolean;
    lastExecutionAt: string | null;
    lastExecutionSummary: string | null;
}

const DormantAutomationTab: React.FC = () => {
    const [policy, setPolicy] = useState<PolicyData>({
        dormantThresholdMinutes: 30,
        actionOnDormant: 'ALERT_ONLY',
        notifyTenantAdmin: true,
        notifyPlatformOwner: true,
        autoActionEnabled: true,
        lastExecutionAt: null,
        lastExecutionSummary: null
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [runningCheck, setRunningCheck] = useState(false);
    const [scanResult, setScanResult] = useState<any | null>(null);

    const fetchPolicy = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }
            setLoading(true);
            const response = await axios.get('/api/v1/platform-owner/routers/dormant-policy');
            if (response.data) {
                setPolicy(response.data);
            }
        } catch (error: any) {
            console.error('Failed to load dormant policy:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicy();
    }, []);

    const handleSavePolicy = async () => {
        try {
            setSaving(true);
            const response = await axios.put('/api/v1/platform-owner/routers/dormant-policy', policy);
            setPolicy(response.data);
            alert('Dormant Router Policy updated successfully!');
        } catch (error: any) {
            alert(`Failed to save policy: ${error.response?.data?.error || error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleRunManualCheck = async () => {
        try {
            setRunningCheck(true);
            const response = await axios.post('/api/v1/platform-owner/routers/run-dormant-check');
            setScanResult(response.data);
            fetchPolicy();
        } catch (error: any) {
            alert(`Failed to run dormant check: ${error.response?.data?.error || error.message}`);
        } finally {
            setRunningCheck(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-medium">Loading Dormant Policy Engine...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Header Card */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" size={24} /> Automated Dormant Router Policy
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Automatically detect inactive MikroTik routers across all tenants and apply configurable policies.
                    </p>
                </div>

                <button
                    onClick={handleRunManualCheck}
                    disabled={runningCheck}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                    <Play size={16} /> {runningCheck ? 'Scanning Fleet...' : 'Run Real-time Scan Now'}
                </button>
            </div>

            {/* Config Form Card */}
            <div className="bg-[var(--bg-surface)] p-8 rounded-2xl border border-[var(--border-subtle)] space-y-8 shadow-xl">
                <div className="space-y-6">
                    {/* Auto Enforcement Toggle */}
                    <div className="flex items-center justify-between p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)]">
                        <div>
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">Automated Policy Enforcement</h4>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Automatically check and take action every 5 minutes in background.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policy.autoActionEnabled}
                                onChange={(e) => setPolicy({ ...policy, autoActionEnabled: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-[var(--border-subtle)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>

                    {/* Dormant Inactivity Threshold */}
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                            <Clock size={16} className="text-amber-400" /> Inactivity Threshold (Minutes)
                        </label>
                        <p className="text-xs text-[var(--text-secondary)]">
                            Router is marked dormant if no heartbeat / status ping received for longer than this duration.
                        </p>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                min="5"
                                max="1440"
                                value={policy.dormantThresholdMinutes}
                                onChange={(e) => setPolicy({ ...policy, dormantThresholdMinutes: parseInt(e.target.value) || 30 })}
                                className="w-32 px-4 py-2.5 bg-[var(--bg-surface-elevated)] text-sm text-[var(--text-primary)] font-mono font-bold border border-[var(--border-subtle)] rounded-xl focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">minutes</span>
                        </div>
                    </div>

                    {/* Action to Apply */}
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                            <Zap size={16} className="text-amber-400" /> Action on Dormant Detection
                        </label>
                        <p className="text-xs text-[var(--text-secondary)]">
                            Select the automated action triggered when a router passes the dormant threshold.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <label className={`p-4 rounded-xl border cursor-pointer transition-all ${policy.actionOnDormant === 'ALERT_ONLY'
                                    ? 'bg-amber-500/10 border-amber-500 text-[var(--text-primary)] font-bold'
                                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="dormantAction"
                                        value="ALERT_ONLY"
                                        checked={policy.actionOnDormant === 'ALERT_ONLY'}
                                        onChange={() => setPolicy({ ...policy, actionOnDormant: 'ALERT_ONLY' })}
                                        className="text-amber-500 focus:ring-amber-500"
                                    />
                                    <span>Log Alert Only</span>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 font-normal">Create security event and log entry without altering router state.</p>
                            </label>

                            <label className={`p-4 rounded-xl border cursor-pointer transition-all ${policy.actionOnDormant === 'RECONNECT_ATTEMPT'
                                    ? 'bg-amber-500/10 border-amber-500 text-[var(--text-primary)] font-bold'
                                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="dormantAction"
                                        value="RECONNECT_ATTEMPT"
                                        checked={policy.actionOnDormant === 'RECONNECT_ATTEMPT'}
                                        onChange={() => setPolicy({ ...policy, actionOnDormant: 'RECONNECT_ATTEMPT' })}
                                        className="text-amber-500 focus:ring-amber-500"
                                    />
                                    <span>Auto-Reconnect Attempt</span>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 font-normal">Attempt API ping/reconnect and refresh status if online.</p>
                            </label>

                            <label className={`p-4 rounded-xl border cursor-pointer transition-all ${policy.actionOnDormant === 'SUSPEND_ROUTER'
                                    ? 'bg-amber-500/10 border-amber-500 text-[var(--text-primary)] font-bold'
                                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="dormantAction"
                                        value="SUSPEND_ROUTER"
                                        checked={policy.actionOnDormant === 'SUSPEND_ROUTER'}
                                        onChange={() => setPolicy({ ...policy, actionOnDormant: 'SUSPEND_ROUTER' })}
                                        className="text-amber-500 focus:ring-amber-500"
                                    />
                                    <span>Suspend Router & Expire Sessions</span>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 font-normal">Mark router offline and terminate active subscriber sessions.</p>
                            </label>

                            <label className={`p-4 rounded-xl border cursor-pointer transition-all ${policy.actionOnDormant === 'DISABLE_SYNC'
                                    ? 'bg-amber-500/10 border-amber-500 text-[var(--text-primary)] font-bold'
                                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="dormantAction"
                                        value="DISABLE_SYNC"
                                        checked={policy.actionOnDormant === 'DISABLE_SYNC'}
                                        onChange={() => setPolicy({ ...policy, actionOnDormant: 'DISABLE_SYNC' })}
                                        className="text-amber-500 focus:ring-amber-500"
                                    />
                                    <span>Disable Auto-Sync</span>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 font-normal">Halt automated background syncs until manually cleared.</p>
                            </label>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                        <label className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                            <Bell size={16} className="text-amber-400" /> Notifications & Alerts
                        </label>

                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={policy.notifyPlatformOwner}
                                    onChange={(e) => setPolicy({ ...policy, notifyPlatformOwner: e.target.checked })}
                                    className="rounded text-amber-500 focus:ring-amber-500"
                                />
                                <span className="text-xs font-semibold text-[var(--text-primary)]">Log Security Audit Event for Platform Owner</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={policy.notifyTenantAdmin}
                                    onChange={(e) => setPolicy({ ...policy, notifyTenantAdmin: e.target.checked })}
                                    className="rounded text-amber-500 focus:ring-amber-500"
                                />
                                <span className="text-xs font-semibold text-[var(--text-primary)]">Notify Tenant Admins on Router Dormancy</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="text-xs text-[var(--text-secondary)] font-mono">
                        Last Execution: {policy.lastExecutionAt ? new Date(policy.lastExecutionAt).toLocaleString() : 'Never'}
                    </div>

                    <button
                        onClick={handleSavePolicy}
                        disabled={saving}
                        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg"
                    >
                        <Save size={16} /> {saving ? 'Saving Policy...' : 'Save Policy Configuration'}
                    </button>
                </div>
            </div>

            {/* Scan Results Display */}
            {scanResult && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-amber-500/30 space-y-4">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400" /> Real-time Scan Result Summary
                    </h4>
                    <p className="text-xs font-mono text-[var(--text-secondary)]">{scanResult.summary}</p>
                    {scanResult.actionsLog && scanResult.actionsLog.length > 0 && (
                        <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl text-xs font-mono space-y-1 text-amber-300">
                            {scanResult.actionsLog.map((log: string, idx: number) => (
                                <div key={idx}>• {log}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DormantAutomationTab;
