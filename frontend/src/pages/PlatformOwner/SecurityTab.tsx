import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ShieldCheck,
    ShieldAlert,
    AlertCircle,
    Activity,
    WifiOff,
    Lock
} from 'lucide-react';

const SecurityTab: React.FC = () => {
    const [events, setEvents] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchSecurityEvents = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const response = await axios.get('/api/v1/platform-owner/security-events');
            setEvents(response.data);
        } catch (error: any) {
            console.error('Failed to load security events:', error);
            setErrorMsg(error.response?.data?.error || 'Failed to load security events.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecurityEvents();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-rose-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-medium">Retrieving Platform Audit & Security Log Stream...</p>
                </div>
            </div>
        );
    }

    if (errorMsg || !events) {
        return (
            <div className="p-8 text-center bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] space-y-4">
                <p className="text-rose-500 font-bold text-sm">{errorMsg || 'Unable to load security events.'}</p>
                <button
                    onClick={fetchSecurityEvents}
                    className="px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    const { auditLogs, failedRouterLogs, fraudLogs } = events;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)]">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <ShieldCheck className="text-rose-500" size={24} /> Platform Security & Audit Event Stream
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Immutable security audit trail, failed authentications, router connection disconnects, and fraud logs.
                </p>
            </div>

            {/* Grid for Router Failures & Fraud Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Failed Router Events */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <WifiOff size={18} className="text-rose-400" /> Recent Router Connection Failures
                    </h4>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {failedRouterLogs && failedRouterLogs.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)] py-4 text-center">No router connection errors logged.</p>
                        ) : (
                            failedRouterLogs?.map((log: any) => (
                                <div key={log.id} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs space-y-1">
                                    <div className="flex items-center justify-between font-bold text-rose-300">
                                        <span>Router: {log.router?.name || 'Unknown'}</span>
                                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-[var(--text-secondary)] font-mono">{log.details}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Fraud Logs */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <ShieldAlert size={18} className="text-amber-400" /> Fraud Detection & Violation Alerts
                    </h4>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {fraudLogs && fraudLogs.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)] py-4 text-center">No active fraud violations detected.</p>
                        ) : (
                            fraudLogs?.map((f: any) => (
                                <div key={f.id} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1">
                                    <div className="flex items-center justify-between font-bold text-amber-300">
                                        <span>Violation: {f.violationType || 'Security Alert'}</span>
                                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">Session ID: {f.sessionId?.substring(0, 8)}</span>
                                    </div>
                                    <p className="text-[var(--text-secondary)] font-mono">{f.details}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
                <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <Lock size={18} className="text-sky-400" /> Platform Security Audit Trail
                </h4>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] uppercase text-[10px] font-black tracking-wider border-b border-[var(--border-subtle)]">
                            <tr>
                                <th className="py-3 px-4">Timestamp</th>
                                <th className="py-3 px-4">Action</th>
                                <th className="py-3 px-6">Details</th>
                                <th className="py-3 px-4 text-right">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {auditLogs && auditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-[var(--text-secondary)]">No audit logs recorded yet.</td>
                                </tr>
                            ) : (
                                auditLogs?.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-[var(--bg-surface-elevated)]/50 font-mono">
                                        <td className="py-3 px-4 text-[var(--text-secondary)]">{new Date(log.createdAt).toLocaleString()}</td>
                                        <td className="py-3 px-4 font-bold text-sky-400">{log.action}</td>
                                        <td className="py-3 px-6 text-[var(--text-primary)] font-sans">{log.details}</td>
                                        <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{log.ipAddress || 'System'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SecurityTab;
