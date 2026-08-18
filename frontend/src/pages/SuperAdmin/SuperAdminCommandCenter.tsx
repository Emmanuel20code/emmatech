import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LayoutDashboard, DollarSign, Users, Wifi, ShieldAlert, Cpu, Activity,
    TrendingUp, Server, AlertTriangle, CheckCircle2, RefreshCw, Key,
    Lock, ExternalLink, UserCheck, ShieldCheck, Zap, Layers, Sparkles, FileText
} from 'lucide-react';
import JevishLogo from '../../components/Common/JevishLogo';

const SuperAdminCommandCenter: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'overview' | 'bi' | 'tenants' | 'noc' | 'soc' | 'ai'>('overview');
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<any>(null);
    const [biData, setBiData] = useState<any>(null);
    const [nocData, setNocData] = useState<any>(null);
    const [socData, setSocData] = useState<any>(null);
    const [aiInsights, setAiInsights] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [actionMsg, setActionMsg] = useState('');
    const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const [ovRes, biRes, nocRes, socRes, aiRes, tenRes] = await Promise.all([
                axios.get('/api/v1/superadmin/command/overview'),
                axios.get('/api/v1/superadmin/command/bi-analytics'),
                axios.get('/api/v1/superadmin/command/noc'),
                axios.get('/api/v1/superadmin/command/soc'),
                axios.get('/api/v1/superadmin/command/ai-insights'),
                axios.get('/api/v1/superadmin/command/tenants'),
            ]);

            setOverview(ovRes.data);
            setBiData(biRes.data);
            setNocData(nocRes.data);
            setSocData(socRes.data);
            setAiInsights(aiRes.data);
            setTenants(tenRes.data);
        } catch (err: any) {
            console.error('Failed to load SuperAdmin command center data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const handleTenantAction = async (tenantId: string, action: string, payload: any = {}) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`/api/v1/superadmin/command/tenants/${tenantId}/action`, { action, payload }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.redirectUrl) {
                window.open(res.data.redirectUrl, '_blank');
            }

            setActionMsg(res.data.message || 'Action executed successfully');
            setTimeout(() => setActionMsg(''), 4000);
            fetchAllData();
        } catch (err: any) {
            setActionMsg(err.response?.data?.error || 'Failed to execute action');
            setTimeout(() => setActionMsg(''), 4000);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-slate-400">Loading Super Admin Command Center...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 font-sans">
            {/* Header Title Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full text-xs font-bold mb-2">
                        <Zap className="w-3.5 h-3.5" /> Executive Control & Intelligence
                    </div>
                    <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Super Admin Command Center</h1>
                    <p className="text-sm text-[var(--text-secondary)] font-medium mt-1">Real-time financial telemetry, ISP operations, NOC, SOC, and AI-driven growth insights.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchAllData}
                        className="px-4 py-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl font-bold text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 transition-all"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh Telemetry
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {actionMsg && (
                <div className="p-4 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl text-sm font-bold flex items-center justify-between">
                    <span>{actionMsg}</span>
                    <button onClick={() => setActionMsg('')} className="text-xs underline">Dismiss</button>
                </div>
            )}

            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[var(--border-subtle)]">
                {[
                    { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
                    { id: 'bi', label: 'Business Intelligence', icon: TrendingUp },
                    { id: 'tenants', label: 'Tenant 360 Control', icon: Users },
                    { id: 'noc', label: 'NOC System Health', icon: Server },
                    { id: 'soc', label: 'SOC Security Center', icon: ShieldAlert },
                    { id: 'ai', label: 'AI Growth Radar', icon: Sparkles },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all flex-shrink-0 ${activeSection === tab.id
                            ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                            : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── SECTION 1: EXECUTIVE OVERVIEW ─── */}
            {activeSection === 'overview' && overview && (
                <div className="space-y-8">
                    {/* Financial KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Total Revenue</span>
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="text-2xl font-black text-[var(--text-primary)]">KES {overview.financials.totalRevenue.toLocaleString()}</div>
                            <div className="text-xs text-emerald-400 font-semibold">Today: KES {overview.financials.revenueToday.toLocaleString()}</div>
                        </div>

                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Monthly Recurring (MRR)</span>
                                <TrendingUp className="w-4 h-4 text-sky-400" />
                            </div>
                            <div className="text-2xl font-black text-[var(--text-primary)]">KES {overview.financials.mrr.toLocaleString()}</div>
                            <div className="text-xs text-sky-400 font-semibold">ARR Projection: KES {overview.financials.arr.toLocaleString()}</div>
                        </div>

                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Active Tenants</span>
                                <Users className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="text-2xl font-black text-[var(--text-primary)]">{overview.tenants.active} <span className="text-xs text-slate-400 font-normal">/ {overview.tenants.total} Total</span></div>
                            <div className="text-xs text-amber-400 font-semibold">{overview.tenants.suspended} Suspended | {overview.tenants.trial} Trial</div>
                        </div>

                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>System Health Score</span>
                                <Activity className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="text-2xl font-black text-emerald-400">{overview.health.systemHealthScore} <span className="text-xs text-slate-400">/ 100</span></div>
                            <div className="text-xs text-emerald-400 font-semibold">Uptime: {overview.health.uptimePercent}%</div>
                        </div>
                    </div>

                    {/* Infrastructure & Router Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Users className="w-4 h-4 text-sky-400" /> Subscriber Fleet
                            </h3>
                            <div className="space-y-3 font-semibold text-sm">
                                <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                    <span className="text-[var(--text-secondary)]">Total Onboarded</span>
                                    <span className="text-[var(--text-primary)] font-bold">{overview.subscribers.total}</span>
                                </div>
                                <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                    <span className="text-[var(--text-secondary)]">Active Subscribers</span>
                                    <span className="text-emerald-400 font-bold">{overview.subscribers.active}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--text-secondary)]">Online Sessions</span>
                                    <span className="text-sky-400 font-bold">{overview.subscribers.online}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Wifi className="w-4 h-4 text-sky-400" /> MikroTik Router Fleet
                            </h3>
                            <div className="space-y-3 font-semibold text-sm">
                                <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                    <span className="text-[var(--text-secondary)]">Total Registered</span>
                                    <span className="text-[var(--text-primary)] font-bold">{overview.routers.total}</span>
                                </div>
                                <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                    <span className="text-[var(--text-secondary)]">Online & Syncing</span>
                                    <span className="text-emerald-400 font-bold">{overview.routers.online}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--text-secondary)]">Offline Alerts</span>
                                    <span className="text-rose-400 font-bold">{overview.routers.offline}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Server className="w-4 h-4 text-sky-400" /> Platform Services Status
                            </h3>
                            <div className="space-y-2 text-xs font-bold">
                                {[
                                    { name: 'Payment Gateway', status: overview.health.paymentGatewayStatus },
                                    { name: 'SMS & WhatsApp Gateway', status: overview.health.smsGatewayStatus },
                                    { name: 'MikroTik API Engine', status: overview.health.mikroTikStatus },
                                    { name: 'Database & Multi-Tenant Store', status: overview.health.databaseHealth },
                                ].map((srv, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-[var(--bg-surface-elevated)] rounded-xl">
                                        <span className="text-[var(--text-secondary)]">{srv.name}</span>
                                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">{srv.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── SECTION 2: BUSINESS INTELLIGENCE ─── */}
            {activeSection === 'bi' && biData && (
                <div className="space-y-8">
                    {/* Top Paying Tenants Directory */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Top Revenue-Generating ISPs & Tenants</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-[var(--text-secondary)]">
                                <thead className="text-xs uppercase bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold">
                                    <tr>
                                        <th className="p-3 rounded-l-xl">ISP Tenant</th>
                                        <th className="p-3">Subdomain</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Subscribers</th>
                                        <th className="p-3">Routers</th>
                                        <th className="p-3 text-right rounded-r-xl">Total Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {biData.topTenants.map((t: any, i: number) => (
                                        <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]">
                                            <td className="p-3 font-bold text-[var(--text-primary)]">{t.name}</td>
                                            <td className="p-3 font-mono text-xs text-sky-400">{t.subdomain}</td>
                                            <td className="p-3">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="p-3 font-semibold">{t.subscribers}</td>
                                            <td className="p-3 font-semibold">{t.routers}</td>
                                            <td className="p-3 text-right font-black text-emerald-400">KES {t.totalRevenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Revenue Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                            <h3 className="text-base font-bold text-[var(--text-primary)]">Platform Revenue Streams Breakdown</h3>
                            <div className="space-y-3">
                                {biData.revenueBreakdown.map((item: any, idx: number) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                                            <span>{item.category}</span>
                                            <span className="text-[var(--text-primary)]">KES {item.amount.toLocaleString()} ({item.percent}%)</span>
                                        </div>
                                        <div className="w-full bg-[var(--bg-surface-elevated)] h-2 rounded-full overflow-hidden">
                                            <div className="bg-sky-500 h-full" style={{ width: `${item.percent}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                            <h3 className="text-base font-bold text-[var(--text-primary)]">Growth & Revenue Projection</h3>
                            <div className="space-y-3">
                                {biData.forecast.map((f: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-surface-elevated)] rounded-2xl">
                                        <span className="font-bold text-sm text-[var(--text-primary)]">{f.month}</span>
                                        <span className="font-black text-sky-400 text-base">Projected KES {f.projectedRevenue.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── SECTION 3: TENANT 360 CONTROL ─── */}
            {activeSection === 'tenants' && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Registered ISP Workspaces ({tenants.length})</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-[var(--text-secondary)]">
                            <thead className="text-xs uppercase bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold">
                                <tr>
                                    <th className="p-3">Tenant Name</th>
                                    <th className="p-3">Subdomain</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Subscribers</th>
                                    <th className="p-3">Routers</th>
                                    <th className="p-3">Revenue (KES)</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map((t: any) => (
                                    <tr key={t.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]">
                                        <td className="p-3 font-bold text-[var(--text-primary)]">{t.name}</td>
                                        <td className="p-3 font-mono text-xs text-sky-400">{t.subdomain}</td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="p-3 font-semibold">{t.subscribers}</td>
                                        <td className="p-3 font-semibold">{t.routers}</td>
                                        <td className="p-3 font-bold text-emerald-400">KES {t.totalRevenueKES.toLocaleString()}</td>
                                        <td className="p-3 text-right space-x-2">
                                            {t.status === 'ACTIVE' ? (
                                                <button
                                                    onClick={() => handleTenantAction(t.id, 'SUSPEND')}
                                                    className="px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-500 hover:text-white"
                                                >
                                                    Suspend
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleTenantAction(t.id, 'REACTIVATE')}
                                                    className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-white"
                                                >
                                                    Activate
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleTenantAction(t.id, 'IMPERSONATE')}
                                                className="px-2.5 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-500 hover:text-white inline-flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-3 h-3" /> Impersonate
                                            </button>
                                            <button
                                                onClick={() => setTenantToDelete(t.id)}
                                                className="px-2.5 py-1 bg-rose-500/10 text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-500 hover:text-white inline-flex items-center gap-1"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── SECTION 4: NOC SYSTEM HEALTH ─── */}
            {activeSection === 'noc' && nocData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">Node.js Process Telemetry</h3>
                        <div className="space-y-2 text-sm font-semibold text-[var(--text-secondary)]">
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span>Platform / Architecture</span>
                                <span className="text-[var(--text-primary)]">{nocData.system.platform} ({nocData.system.arch})</span>
                            </div>
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span>CPU Cores</span>
                                <span className="text-[var(--text-primary)]">{nocData.system.cpusCount} Cores ({nocData.system.cpuModel})</span>
                            </div>
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span>RAM Heap Used</span>
                                <span className="text-sky-400">{nocData.system.memoryHeapUsedMB} MB / {nocData.system.memoryHeapTotalMB} MB</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Uptime</span>
                                <span className="text-emerald-400">{Math.round(nocData.system.uptimeSeconds / 60)} minutes</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-4">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">Database & Queue Status</h3>
                        <div className="space-y-2 text-sm font-semibold text-[var(--text-secondary)]">
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span>Database Engine</span>
                                <span className="text-[var(--text-primary)] uppercase">{nocData.database.dialect}</span>
                            </div>
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span>Connection Pool</span>
                                <span className="text-emerald-400 font-bold">{nocData.database.poolStatus}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Active / Idle Connections</span>
                                <span className="text-[var(--text-primary)]">{nocData.database.activeConnections} / {nocData.database.idleConnections}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── SECTION 5: SOC SECURITY CENTER ─── */}
            {activeSection === 'soc' && socData && (
                <div className="space-y-6">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Global Security Posture</div>
                            <div className="text-3xl font-black text-emerald-400">{socData.securityScore} / 100</div>
                            <div className="text-xs text-slate-400 mt-1">Zero critical vulnerabilities detected in last audit</div>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                            <div className="px-4 py-2 bg-slate-800 rounded-xl">Failed Logins: <strong>{socData.metrics.failedLogins24h}</strong></div>
                            <div className="px-4 py-2 bg-slate-800 rounded-xl">Rate Limits: <strong>{socData.metrics.rateLimitBreaches24h}</strong></div>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 space-y-4">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">Security Audit Trail Log</h3>
                        <div className="space-y-2 text-xs font-mono text-slate-300">
                            {socData.auditLogs.map((log: any, idx: number) => (
                                <div key={idx} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl flex items-center justify-between border border-[var(--border-subtle)]">
                                    <div>
                                        <strong className="text-sky-400">[{log.action}]</strong> {log.details}
                                    </div>
                                    <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── SECTION 6: AI GROWTH RADAR ─── */}
            {activeSection === 'ai' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aiInsights.map((insight: any, idx: number) => (
                        <div key={idx} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-3xl space-y-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${insight.type === 'WARNING' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {insight.category}
                            </span>
                            <h3 className="text-base font-bold text-[var(--text-primary)]">{insight.title}</h3>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{insight.description}</p>
                        </div>
                    ))}
                </div>
            )}

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
};

export default SuperAdminCommandCenter;
