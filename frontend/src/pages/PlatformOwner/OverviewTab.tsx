import React from 'react';
import {
    Building2,
    Users,
    Wifi,
    DollarSign,
    TrendingUp,
    ShieldCheck,
    MessageSquare,
    Zap,
    AlertTriangle,
    Activity
} from 'lucide-react';

interface OverviewTabProps {
    data: any;
    loading: boolean;
    onTabSwitch: (tab: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ data, loading, onTabSwitch }) => {
    if (loading || !data) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-medium">Loading Platform Statistics...</p>
                </div>
            </div>
        );
    }

    const { tenants, subscribers, routers, financials, sessions, sms } = data;

    return (
        <div className="space-y-8">
            {/* Top KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Gross Revenue Card */}
                <div className="bg-gradient-to-br from-emerald-500/10 via-[var(--bg-surface)] to-[var(--bg-surface-elevated)] p-6 rounded-2xl border border-emerald-500/20 shadow-lg relative overflow-hidden group">
                    <div className="absolute right-3 top-3 p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <DollarSign size={24} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Total Gross Revenue</p>
                    <h3 className="text-3xl font-black text-[var(--text-primary)] mt-2">
                        KES {financials?.totalGrossRevenue?.toLocaleString() || '0'}
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-[var(--border-subtle)]">
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <TrendingUp size={14} /> Platform Fee:
                        </span>
                        <span className="font-extrabold text-[var(--text-primary)]">
                            KES {financials?.totalPlatformCommission?.toLocaleString() || '0'}
                        </span>
                    </div>
                </div>

                {/* Tenants Card */}
                <div className="bg-gradient-to-br from-sky-500/10 via-[var(--bg-surface)] to-[var(--bg-surface-elevated)] p-6 rounded-2xl border border-sky-500/20 shadow-lg relative overflow-hidden">
                    <div className="absolute right-3 top-3 p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                        <Building2 size={24} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Active Tenants</p>
                    <h3 className="text-3xl font-black text-[var(--text-primary)] mt-2">
                        {tenants?.active || 0} <span className="text-xs font-normal text-[var(--text-secondary)]">/ {tenants?.total || 0} Total</span>
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-[var(--border-subtle)]">
                        <span className="text-[var(--text-secondary)] font-medium">Suspended:</span>
                        <span className={`font-bold ${tenants?.suspended > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {tenants?.suspended || 0}
                        </span>
                    </div>
                </div>

                {/* Subscribers Card */}
                <div className="bg-gradient-to-br from-indigo-500/10 via-[var(--bg-surface)] to-[var(--bg-surface-elevated)] p-6 rounded-2xl border border-indigo-500/20 shadow-lg relative overflow-hidden">
                    <div className="absolute right-3 top-3 p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                        <Users size={24} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Total Subscribers</p>
                    <h3 className="text-3xl font-black text-[var(--text-primary)] mt-2">
                        {subscribers?.total?.toLocaleString() || 0}
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-[var(--border-subtle)]">
                        <span className="text-indigo-400 font-bold">Active Subscribers:</span>
                        <span className="font-extrabold text-[var(--text-primary)]">{subscribers?.active || 0}</span>
                    </div>
                </div>

                {/* MikroTik Routers Health */}
                <div className="bg-gradient-to-br from-amber-500/10 via-[var(--bg-surface)] to-[var(--bg-surface-elevated)] p-6 rounded-2xl border border-amber-500/20 shadow-lg relative overflow-hidden">
                    <div className="absolute right-3 top-3 p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                        <Wifi size={24} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">MikroTik Health</p>
                    <h3 className="text-3xl font-black text-[var(--text-primary)] mt-2">
                        {routers?.healthPercentage || 100}% <span className="text-xs font-medium text-emerald-400 font-bold">Online</span>
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-[var(--border-subtle)]">
                        <span className="text-[var(--text-secondary)] font-medium">Online / Offline:</span>
                        <span className="font-extrabold text-[var(--text-primary)]">{routers?.online || 0} / {routers?.offline || 0}</span>
                    </div>
                </div>
            </div>

            {/* Quick Overview Operational Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Sessions & System Load */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Activity size={18} className="text-amber-400" /> Live Network Activity
                        </h4>
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold">
                            Live Stream
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                            <div>
                                <p className="text-xs text-[var(--text-secondary)] font-medium">Active Customer Sessions</p>
                                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{sessions?.activeSessions || 0}</p>
                            </div>
                            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                                <Zap size={20} />
                            </div>
                        </div>

                        <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                            <div>
                                <p className="text-xs text-[var(--text-secondary)] font-medium">Platform SMS Delivered</p>
                                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{sms?.totalSent?.toLocaleString() || 0}</p>
                            </div>
                            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                                <MessageSquare size={20} />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => onTabSwitch('routers')}
                        className="w-full py-2.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-amber-500/20"
                    >
                        Manage MikroTik Routers →
                    </button>
                </div>

                {/* Platform Owner Quick Actions & Governance */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-6 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <ShieldCheck size={18} className="text-sky-400" /> Platform Owner Governance
                        </h4>
                        <span className="text-xs text-[var(--text-secondary)] font-mono">Supreme Control Mode</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => onTabSwitch('tenants')}
                            className="p-4 bg-[var(--bg-surface-elevated)] hover:bg-sky-500/10 hover:border-sky-500/30 border border-[var(--border-subtle)] rounded-xl text-left transition-all group"
                        >
                            <Building2 size={20} className="text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
                            <h5 className="font-bold text-sm text-[var(--text-primary)]">Manage Tenants</h5>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">View revenue, subscriber counts & suspend/activate tenants.</p>
                        </button>

                        <button
                            onClick={() => onTabSwitch('dormant')}
                            className="p-4 bg-[var(--bg-surface-elevated)] hover:bg-amber-500/10 hover:border-amber-500/30 border border-[var(--border-subtle)] rounded-xl text-left transition-all group"
                        >
                            <AlertTriangle size={20} className="text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                            <h5 className="font-bold text-sm text-[var(--text-primary)]">Dormant Router Rules</h5>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Configure threshold timeout & automated actions.</p>
                        </button>

                        <button
                            onClick={() => onTabSwitch('analytics')}
                            className="p-4 bg-[var(--bg-surface-elevated)] hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-[var(--border-subtle)] rounded-xl text-left transition-all group"
                        >
                            <TrendingUp size={20} className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                            <h5 className="font-bold text-sm text-[var(--text-primary)]">Revenue Analytics</h5>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Platform commission trends & transaction channels.</p>
                        </button>

                        <button
                            onClick={() => onTabSwitch('security')}
                            className="p-4 bg-[var(--bg-surface-elevated)] hover:bg-rose-500/10 hover:border-rose-500/30 border border-[var(--border-subtle)] rounded-xl text-left transition-all group"
                        >
                            <ShieldCheck size={20} className="text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
                            <h5 className="font-bold text-sm text-[var(--text-primary)]">Security Audit Trail</h5>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Real-time system events, IP blocks & audit trail.</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
