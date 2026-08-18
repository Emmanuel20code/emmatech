import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Search, Zap, RefreshCw, Activity, ShieldCheck, Download,
    ExternalLink, Eye, ChevronRight, CheckCircle2, AlertTriangle,
    Layers, Cpu, Server, Lock, UserCheck, FileText, Phone, Mail, Building
} from 'lucide-react';

const UltimateSuperAdminCenter: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [liveStream, setLiveStream] = useState<any[]>([]);
    const [inspectedTenant, setInspectedTenant] = useState<any | null>(null);
    const [tenantModalOpen, setTenantModalOpen] = useState(false);
    const [actionMsg, setActionMsg] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Live Activity Stream
    const fetchLiveStream = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get('/api/v1/superadmin/ultimate/activity-stream');
            setLiveStream(res.data);
        } catch (err: any) {
            console.error('Failed to fetch activity stream', err);
        }
    };

    useEffect(() => {
        fetchLiveStream();
        const interval = setInterval(fetchLiveStream, 5000); // 10s auto-refresh
        return () => clearInterval(interval);
    }, []);

    // Global Search Trigger
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`/api/v1/superadmin/ultimate/search?q=${encodeURIComponent(searchQuery)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSearchResults(res.data);
            } catch (err) {
                console.error('Global search error', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // One-Click Action Executor
    const handleOneClickAction = async (actionType: string, targetId?: string, payload: any = {}) => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/v1/superadmin/ultimate/action', { actionType, targetId, payload }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setActionMsg(res.data.message || 'Action executed successfully');
            setTimeout(() => setActionMsg(''), 4000);
            fetchLiveStream();
        } catch (err: any) {
            setActionMsg(err.response?.data?.error || 'Action execution failed');
            setTimeout(() => setActionMsg(''), 4000);
        } finally {
            setActionLoading(false);
        }
    };

    // Open Tenant 360 Drawer
    const handleInspectTenant = async (tenantId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/api/v1/superadmin/ultimate/tenant-360/${tenantId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInspectedTenant(res.data);
            setTenantModalOpen(true);
        } catch (err: any) {
            setActionMsg(err.response?.data?.error || 'Failed to inspect tenant');
            setTimeout(() => setActionMsg(''), 4000);
        }
    };

    // Report CSV Exporter
    const handleExportReport = (reportType: string) => {
        const token = localStorage.getItem('token');
        window.open(`/api/v1/superadmin/ultimate/reports/export?type=${reportType}&format=csv&token=${token}`, '_blank');
    };

    return (
        <div className="space-y-8 font-sans">
            {/* Header Banner with Global Search */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full text-xs font-bold mb-2">
                            <ShieldCheck className="w-4 h-4" /> Supreme Command & Control
                        </div>
                        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Ultimate Super Admin Control Center</h1>
                        <p className="text-sm text-[var(--text-secondary)] font-medium mt-1">Platform-wide visibility, one-click execution, tenant 360 inspection, live activity feed, and automated NOC/SOC control.</p>
                    </div>
                </div>

                {/* Global Search Bar */}
                <div className="relative">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search any Tenant, Subscriber, Phone, Email, M-Pesa Receipt, Router Host, or Invoice..."
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl py-4 pl-14 pr-12 text-[var(--text-primary)] text-sm font-semibold focus:outline-none focus:border-sky-500 transition-all shadow-inner"
                        />
                        {isSearching && (
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-2xl z-50 space-y-2 max-h-96 overflow-y-auto">
                            <div className="text-xs font-bold text-slate-400 uppercase px-2 pb-2 border-b border-[var(--border-subtle)]">
                                Search Results ({searchResults.length})
                            </div>
                            {searchResults.map((res: any, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        if (res.category === 'TENANT') handleInspectTenant(res.id);
                                        setSearchQuery('');
                                    }}
                                    className="p-3 bg-[var(--bg-surface-elevated)] hover:bg-sky-500/10 rounded-xl cursor-pointer flex items-center justify-between border border-[var(--border-subtle)] transition-all group"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 text-[10px] font-black rounded">{res.category}</span>
                                            <span className="font-bold text-sm text-[var(--text-primary)]">{res.title}</span>
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary)] mt-1">{res.subtitle}</div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Notification Banner */}
            {actionMsg && (
                <div className="p-4 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl text-sm font-bold flex items-center justify-between">
                    <span>{actionMsg}</span>
                    <button onClick={() => setActionMsg('')} className="text-xs underline">Dismiss</button>
                </div>
            )}

            {/* One-Click Quick Actions Matrix */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-sky-400" /> One-Click Management Action Matrix
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <button
                        disabled={actionLoading}
                        onClick={() => handleOneClickAction('RUN_DIAGNOSTICS')}
                        className="p-3.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/10 text-left font-bold text-xs text-[var(--text-primary)] transition-all space-y-1"
                    >
                        <Activity className="w-4 h-4 text-sky-400" />
                        <div>Run System Diagnostics</div>
                    </button>

                    <button
                        disabled={actionLoading}
                        onClick={() => handleOneClickAction('CLEAR_SYSTEM_CACHE')}
                        className="p-3.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/10 text-left font-bold text-xs text-[var(--text-primary)] transition-all space-y-1"
                    >
                        <RefreshCw className="w-4 h-4 text-amber-400" />
                        <div>Clear App Cache</div>
                    </button>

                    <button
                        disabled={actionLoading}
                        onClick={() => handleOneClickAction('RETRY_FAILED_WEBHOOKS')}
                        className="p-3.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/10 text-left font-bold text-xs text-[var(--text-primary)] transition-all space-y-1"
                    >
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <div>Reprocess Webhooks</div>
                    </button>

                    <button
                        onClick={() => handleExportReport('revenue')}
                        className="p-3.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/10 text-left font-bold text-xs text-[var(--text-primary)] transition-all space-y-1"
                    >
                        <Download className="w-4 h-4 text-indigo-400" />
                        <div>Export Revenue CSV</div>
                    </button>

                    <button
                        onClick={() => handleExportReport('subscribers')}
                        className="p-3.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/10 text-left font-bold text-xs text-[var(--text-primary)] transition-all space-y-1"
                    >
                        <Download className="w-4 h-4 text-purple-400" />
                        <div>Export Subscribers CSV</div>
                    </button>
                </div>
            </div>

            {/* Live Real-Time Activity Feed Ticker */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400 animate-pulse" /> Live Activity Stream (Auto-Refreshing)
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">Last 30 Events</span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 text-xs font-mono">
                    {liveStream.map((item: any, i: number) => (
                        <div key={i} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl flex items-center justify-between border border-[var(--border-subtle)]">
                            <div>
                                <span className="text-sky-400 font-bold">[{item.action}]</span> {item.details}
                            </div>
                            <span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tenant 360 Deep Inspection Drawer Modal */}
            {tenantModalOpen && inspectedTenant && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                            <div>
                                <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 text-[10px] font-black rounded uppercase">TENANT 360 PROFILE</span>
                                <h2 className="text-2xl font-black text-[var(--text-primary)] mt-1">{inspectedTenant.businessInfo.name}</h2>
                                <p className="text-xs text-sky-400 font-mono">{inspectedTenant.businessInfo.subdomain}.jevish.site</p>
                            </div>
                            <button onClick={() => setTenantModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold text-xs">Close</button>
                        </div>

                        {/* Financials & Overview Grid */}
                        <div className="grid grid-cols-3 gap-4 font-semibold text-center">
                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl">
                                <div className="text-xs text-slate-400">Total Revenue</div>
                                <div className="text-lg font-black text-emerald-400">KES {inspectedTenant.financials.totalRevenueKES.toLocaleString()}</div>
                            </div>
                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl">
                                <div className="text-xs text-slate-400">Wallet Balance</div>
                                <div className="text-lg font-black text-sky-400">KES {inspectedTenant.financials.walletBalanceKES.toLocaleString()}</div>
                            </div>
                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl">
                                <div className="text-xs text-slate-400">Active Subscribers</div>
                                <div className="text-lg font-black text-indigo-400">{inspectedTenant.subscriberStats.active} / {inspectedTenant.subscriberStats.total}</div>
                            </div>
                        </div>

                        {/* Business & Owner Info */}
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[var(--text-secondary)]">
                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl space-y-1">
                                <div className="text-[var(--text-primary)] font-bold mb-2">Business Details</div>
                                <div>Phone: <strong className="text-[var(--text-primary)]">{inspectedTenant.businessInfo.contactPhone || 'N/A'}</strong></div>
                                <div>Status: <strong className="text-emerald-400">{inspectedTenant.businessInfo.status}</strong></div>
                                <div>Created: <strong className="text-[var(--text-primary)]">{new Date(inspectedTenant.businessInfo.createdAt).toLocaleDateString()}</strong></div>
                            </div>
                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl space-y-1">
                                <div className="text-[var(--text-primary)] font-bold mb-2">Owner Account</div>
                                <div>Email: <strong className="text-[var(--text-primary)]">{inspectedTenant.ownerInfo?.email || 'N/A'}</strong></div>
                                <div>Name: <strong className="text-[var(--text-primary)]">{inspectedTenant.ownerInfo?.name || 'Tenant Owner'}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UltimateSuperAdminCenter;
