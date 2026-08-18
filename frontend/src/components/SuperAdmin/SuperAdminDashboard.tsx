import { useState, useEffect, useCallback } from 'react';
import { Globe, Building2, TrendingUp, CheckCircle2, Clock, Activity, type LucideIcon, Plus, PhoneCall } from 'lucide-react';
import TenantModal from '../Modals/TenantModal';
import axios from 'axios';

interface DashboardStats {
    totalRevenue: number;
    activeTenants: number;
    totalTenants: number;
    totalPayments: number;
    trialTenants?: number;
    suspendedTenants?: number;
}

interface Tenant {
    id: string;
    name: string;
    subdomain: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
}

interface AuditLog {
    action: string;
    details: string;
    ipAddress: string;
    createdAt: string;
}

interface Wallet {
    id: string;
    tenantName: string;
    balance: string | number;
    pendingBalance: string | number;
    settledBalance: string | number;
}

interface PlatformFee {
    id: string;
    feeType: string;
    description: string;
    feeValue: number;
    isPercentage: boolean;
}

interface SaaSInvoice {
    id: string;
    invoiceNumber: string;
    totalAmountCents: number;
    paymentStatus: string;
    createdAt: string;
    tenant?: {
        name: string;
        subdomain: string;
    };
}

interface MpesaCallbackLogItem {
    id: string;
    checkoutRequestId: string | null;
    merchantRequestId: string | null;
    rawPayload: string;
    validationStatus: 'VALID' | 'INVALID_PAYLOAD' | 'IP_UNAUTHORIZED' | 'INVALID_SIGNATURE';
    validationErrors: string | null;
    signatureVerified: boolean;
    tenantId: string | null;
    databaseUpdateStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING';
    errorDetails: string | null;
    createdAt: string;
}

interface SaaSSubscriptionPayment {
    id: string;
    tenantId: string;
    invoiceId: string | null;
    amount: number;
    currency: string;
    status: string;
    phoneNumber: string;
    mpesaReceiptNumber: string | null;
    checkoutRequestId?: string | null;
    createdAt: string;
    completedAt: string | null;
    tenant?: {
        name: string;
        subdomain: string;
    };
}

interface RouterStat {
    id: string;
    name: string;
    host: string;
    lastSeen: string | null;
}

interface RouterStatsResponse {
    stats: {
        total: number;
        online: number;
        offline: number;
    };
    criticalOffline: RouterStat[];
}

interface StatCardProps {
    label: string;
    value: string | number;
    sub: string;
    icon: LucideIcon;
    color: 'indigo' | 'sky' | 'emerald' | 'orange';
    delay: number;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon: Icon, color, delay }) => (
    <div className="group relative" style={{ animationDelay: `${delay}s` }}>
        <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/20 to-transparent rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
        <div className="relative bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-[2rem] shadow-xl hover:-translate-y-1 transition-all duration-500">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-${color}-500/10 text-${color}-500 group-hover:scale-110 transition-transform`}>
                    <Icon size={24} strokeWidth={2} />
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg bg-${color}-500/10 text-${color}-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Live
                </span>
            </div>
            <h3 className="text-3xl font-black text-[var(--text-primary)] tracking-tight mb-1">
                {typeof value === 'number' && label.includes('Revenue') ? `KES ${value.toLocaleString()}` : value}
            </h3>
            <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">{sub}</p>
        </div>
    </div>
);

const SuperAdminDashboard = () => {
    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [platformFees, setPlatformFees] = useState<PlatformFee[]>([]);
    const [invoices, setInvoices] = useState<SaaSInvoice[]>([]);
    const [subscriptionPayments, setSubscriptionPayments] = useState<SaaSSubscriptionPayment[]>([]);
    const [routerStats, setRouterStats] = useState<RouterStatsResponse | null>(null);
    const [callbackLogs, setCallbackLogs] = useState<MpesaCallbackLogItem[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No auth token found');

            const config = { headers: { Authorization: `Bearer ${token}` } };

            const fetchSafe = async <T,>(url: string): Promise<T | null> => {
                try {
                    const res = await axios.get<T>(url, config);
                    return res.data;
                } catch (e: unknown) {
                    console.error(`Failed to fetch ${url}`, e);
                    return null;
                }
            };

            const [statsData, tenantsData, logsData, walletsData, feesData, routersData, invoicesData, paymentsData, cbLogsData] = await Promise.all([
                fetchSafe<DashboardStats>('/api/v1/superadmin/platform-stats'),
                fetchSafe<Tenant[]>('/api/v1/superadmin/tenants'),
                fetchSafe<AuditLog[]>('/api/v1/superadmin/audit-logs'),
                fetchSafe<Wallet[]>('/api/v1/superadmin/wallets'),
                fetchSafe<PlatformFee[]>('/api/v1/superadmin/platform-fees'),
                fetchSafe<RouterStatsResponse>('/api/v1/superadmin/routers'),
                fetchSafe<SaaSInvoice[]>('/api/v1/superadmin/invoices'),
                fetchSafe<SaaSSubscriptionPayment[]>('/api/v1/superadmin/saas/subscription-payments'),
                fetchSafe<{ success: boolean; logs: MpesaCallbackLogItem[] }>('/api/v1/superadmin/mpesa-callback-logs')
            ]);

            if (!statsData) setError('Failed to load critical platform stats. Backend may be unreachable.');

            setStats(statsData || { totalRevenue: 0, activeTenants: 0, totalTenants: 0, totalPayments: 0, trialTenants: 0, suspendedTenants: 0 });
            setTenants(Array.isArray(tenantsData) ? tenantsData : []);
            setAuditLogs(Array.isArray(logsData) ? logsData : []);
            setWallets(walletsData || []);
            setPlatformFees(feesData || []);
            setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
            setSubscriptionPayments(Array.isArray(paymentsData) ? paymentsData : []);
            setRouterStats(routersData || { stats: { total: 0, online: 0, offline: 0 }, criticalOffline: [] });
            setCallbackLogs(cbLogsData?.logs || []);

        } catch (error: unknown) {
            console.error('Failed to fetch SuperAdmin data', error);
            const errorMessage = error instanceof Error ? error.message : 'Fatal dashboard error';
            setError(errorMessage);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleTenantStatus = async (id: string, currentStatus: string) => {
        try {
            const token = localStorage.getItem('token');
            const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
            await axios.put(`/api/v1/superadmin/tenants/${id}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTenants(tenants.map(t => t.id === id ? { ...t, status: newStatus } : t));
        } catch (e: unknown) {
            console.error('Failed to update tenant status', e);
            alert('Failed to update tenant status');
        }
    };

    const handlePayMpesa = async (invoiceId: string) => {
        const phone = prompt("Enter M-Pesa phone number for STK Push (e.g. 0712345678):");
        if (!phone) return;
        try {
            const token = localStorage.getItem('token');
            interface PayResponse {
                message?: string;
            }
            const res = await axios.post<PayResponse>(`/api/v1/superadmin/invoices/${invoiceId}/pay-mpesa`, { phoneNumber: phone }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message || 'M-Pesa STK push initiated successfully.');
            fetchData();
        } catch (err: unknown) {
            let msg = 'Failed to initiate M-Pesa payment';
            if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object' && 'error' in err.response.data) {
                msg = String((err.response.data as { error: unknown }).error);
            } else if (err instanceof Error) {
                msg = err.message;
            }
            alert(msg);
        }
    };

    if (error) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-red-500">
                <div className="text-2xl font-black">System Error</div>
                <p className="font-bold">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (!stats) return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4 transition-colors duration-300">
            <div className="w-16 h-16 border-4 border-[var(--border-subtle)] border-t-sky-500 rounded-full animate-spin"></div>
            <p className="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest">Hydrating Platform Engine...</p>
        </div>
    );

    return (
        <div className="space-y-12 animate-fade-in pb-10">
            {/* Hero Section */}
            <div className="relative">
                <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight mb-2">
                    Platform <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-500">Command Center</span>
                </h1>
                <p className="text-[var(--text-secondary)] font-medium">Global Infrastructure Oversight & M-Pesa SaaS Billing</p>
                <div className="absolute top-0 right-0 flex items-center gap-3">
                    <button
                        onClick={() => setIsTenantModalOpen(true)}
                        className="p-3 bg-sky-500 hover:bg-sky-400 text-white rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-1"
                    >
                        <Plus size={16} strokeWidth={3} />
                        Register Tenant & Collect Onboarding Fee
                    </button>
                    <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] backdrop-blur-xl rounded-2xl flex items-center gap-3">
                        <div className="relative">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute top-0 right-0 opacity-75"></div>
                            <div className="w-3 h-3 bg-emerald-500 rounded-full relative z-10"></div>
                        </div>
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">System Operational</span>
                    </div>
                </div>
            </div>

            <TenantModal
                isOpen={isTenantModalOpen}
                onClose={() => setIsTenantModalOpen(false)}
                onSuccess={() => fetchData()}
            />

            {/* Global Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="SaaS Subscription Revenue" value={stats.totalRevenue} sub="Platform Gross Ledger" icon={TrendingUp} color="indigo" delay={0} />
                <StatCard label="Active Tenants" value={stats.activeTenants} sub={`Out of ${stats.totalTenants} Total`} icon={Building2} color="sky" delay={0.1} />
                <StatCard label="Trial Tenants" value={stats.trialTenants || 0} sub="3-Day Trial Phase" icon={Clock} color="emerald" delay={0.2} />
                <StatCard label="Suspended Tenants" value={stats.suspendedTenants || 0} sub="Expired Subscriptions" icon={Activity} color="orange" delay={0.3} />
            </div>

            {/* M-Pesa SaaS Billing & Invoices Section */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-[2rem] shadow-xl space-y-8">
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                                <PhoneCall className="text-emerald-500" />
                                Tenant SaaS & Onboarding M-Pesa Billing
                            </h3>
                            <p className="text-xs text-[var(--text-muted)] mt-1">Manage onboarding fees and monthly subscription payments via M-Pesa STK Push</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-black">
                            {invoices.length} Invoices Tracked
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--bg-surface-elevated)]">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Invoice & Tenant</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Amount</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Status & Date</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                                {invoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-6 text-center text-xs font-bold text-[var(--text-muted)]">
                                            No SaaS or onboarding invoices found yet.
                                        </td>
                                    </tr>
                                ) : (
                                    invoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-[var(--text-primary)] text-sm">{inv.invoiceNumber}</p>
                                                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">{inv.tenant?.name || 'Platform'}</p>
                                            </td>
                                            <td className="px-4 py-4 font-black text-sky-500">KES {(Number(inv.totalAmountCents) / 100).toLocaleString()}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`status-pill w-fit ${
                                                        inv.paymentStatus === 'PAID' ? 'pill-success' : 'pill-warning'
                                                    }`}>
                                                        {inv.paymentStatus}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-[var(--text-muted)]">{new Date(inv.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {inv.paymentStatus !== 'PAID' ? (
                                                    <button
                                                        onClick={() => handlePayMpesa(inv.id)}
                                                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        Pay
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-bold text-emerald-500">Settled</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-8">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                                <CheckCircle2 className="text-indigo-500" />
                                Platform Subscription Payment Ledger
                            </h3>
                            <p className="text-xs text-[var(--text-muted)] mt-1">Real-time verification log of isolated monthly SaaS subscription payments</p>
                        </div>
                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full text-xs font-black">
                            {subscriptionPayments.length} Payments Logged
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--bg-surface-elevated)]">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Tenant Name</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Mpesa Details</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Amount</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Status</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase text-right">Completed Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                                {subscriptionPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-xs font-bold text-[var(--text-muted)]">
                                            No SaaS subscription payments received yet.
                                        </td>
                                    </tr>
                                ) : (
                                    subscriptionPayments.map((p) => (
                                        <tr key={p.id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-[var(--text-primary)] text-sm">{p.tenant?.name || 'Platform Tenant'}</p>
                                                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">@{p.tenant?.subdomain || 'tenant'}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-[var(--text-primary)] text-xs">{p.phoneNumber}</p>
                                                <p className="text-[10px] font-mono text-[var(--text-muted)]">{p.mpesaReceiptNumber || p.checkoutRequestId || 'N/A'}</p>
                                            </td>
                                            <td className="px-4 py-4 font-black text-emerald-500">KES {p.amount.toLocaleString()}</td>
                                            <td className="px-4 py-4">
                                                <span className={`status-pill ${
                                                    p.status === 'SUCCESS' ? 'pill-success' : p.status === 'PENDING' ? 'pill-warning' : 'pill-danger'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right text-xs font-bold text-[var(--text-muted)]">
                                                {p.completedAt ? new Date(p.completedAt).toLocaleString() : new Date(p.createdAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Map / Audit */}
                <div className="lg:col-span-2 bg-[#0f172a] rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col h-[500px] border border-white/5 shadow-2xl">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] -mr-32 -mt-32 animate-pulse-slow"></div>
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-sky-500/10 rounded-full blur-[100px] -ml-20 -mb-20 animate-float-delayed"></div>

                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <div>
                            <h3 className="font-bold text-xl flex items-center gap-2">
                                <Activity className="text-sky-400" />
                                Live Network Activity
                            </h3>
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-[0.2em]">Real-time Event Stream</p>
                        </div>
                        <button className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold uppercase tracking-widest transition-colors">
                            Filter Stream
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 relative z-10 scrollbar-thin scrollbar-thumb-sky-500/20">
                        {auditLogs.map((log, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group cursor-default">
                                <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-300 group-hover:bg-sky-500/20 group-hover:text-sky-300 transition-colors">
                                    <Clock size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                                        <span className="text-sky-400 font-bold mr-2">[{log.action || 'EVENT'}]</span>
                                        {log.details || 'No details available'}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded border border-white/5">
                                            {log.ipAddress || '0.0.0.0'}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tenant Quick List */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[2.5rem] p-8 shadow-xl flex flex-col h-[500px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-[var(--text-primary)] text-lg uppercase tracking-tight">Active Tenants</h3>
                        <div className="px-3 py-1 bg-sky-500/10 text-sky-500 rounded-full text-xs font-black">
                            {tenants.filter(t => t.status === 'ACTIVE').length} ONLINE
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {tenants.map((t) => (
                            <div key={t.id} className="group p-5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-200">
                                        {(t.name || 'T').substring(0, 1)}
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${t.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                </div>
                                <h4 className="font-bold text-[var(--text-primary)] leading-tight mb-1">{t.name || 'Unnamed Tenant'}</h4>
                                <p className="text-xs text-[var(--text-muted)] font-medium mb-4">@{t.subdomain || 'unknown'}.jevish.site</p>

                                <button
                                    onClick={() => toggleTenantStatus(t.id, t.status)}
                                    className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${t.status === 'ACTIVE'
                                        ? 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500'
                                        : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                        }`}
                                >
                                    {t.status === 'ACTIVE' ? 'Suspend Access' : 'Activate Now'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Global Wallet & Fee Management */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-[2rem] shadow-xl">
                    <h3 className="text-xl font-black text-[var(--text-primary)] mb-6 uppercase tracking-tight">Global Tenant Wallets</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--bg-surface-elevated)]">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Tenant Wallet</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase text-right">Balances</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                                {wallets.map((w) => (
                                    <tr key={w.id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                        <td className="px-4 py-4 font-bold text-[var(--text-primary)] text-sm">{w.tenantName}</td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex flex-col gap-0.5">
                                                <p className="font-black text-emerald-500 text-sm">KES {Number(w.balance).toLocaleString()}</p>
                                                <div className="flex justify-end gap-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                                                    <span>P: {Number(w.pendingBalance).toLocaleString()}</span>
                                                    <span>S: {Number(w.settledBalance).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-[2rem] shadow-xl">
                    <h3 className="text-xl font-black text-[var(--text-primary)] mb-6 uppercase tracking-tight">Platform Fee Control</h3>
                    <div className="space-y-4">
                        {platformFees.map((fee) => (
                            <div key={fee.id} className="p-4 rounded-3xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-black text-[var(--text-muted)] uppercase">{fee.feeType}</p>
                                    <p className="font-bold text-[var(--text-primary)]">{fee.description}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-sky-500">{fee.feeValue}{fee.isPercentage ? '%' : ' KES'}</p>
                                    <button className="text-[10px] font-black text-sky-500/60 uppercase hover:text-sky-500 mt-1 transition-colors">Configure</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Real-Time M-Pesa Callback Stream & Validation Monitor */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-[2rem] shadow-xl mt-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">M-Pesa Callback Stream & Validation Monitor</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time tracking of payload validation, signature verification, and database license activation status.</p>
                    </div>
                    <button 
                        onClick={fetchData}
                        className="px-4 py-2 bg-sky-500/10 text-sky-500 font-black text-xs rounded-xl hover:bg-sky-500/20 transition-colors uppercase tracking-wider"
                    >
                        Refresh Stream
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--bg-surface-elevated)]">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Timestamp / ID</th>
                                <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Validation Status</th>
                                <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Signature</th>
                                <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">License DB Status</th>
                                <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase">Errors / Missing Fields</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {callbackLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold">
                                        No M-Pesa callback logs recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                callbackLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                        <td className="px-4 py-4">
                                            <p className="text-xs font-bold text-[var(--text-primary)]">{new Date(log.createdAt).toLocaleString()}</p>
                                            <p className="text-[10px] font-mono text-[var(--text-muted)]">{log.checkoutRequestId || 'No Checkout ID'}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                log.validationStatus === 'VALID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                            }`}>
                                                {log.validationStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                log.signatureVerified ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'
                                            }`}>
                                                {log.signatureVerified ? 'Verified' : 'Unverified'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                log.databaseUpdateStatus === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' :
                                                log.databaseUpdateStatus === 'FAILED' ? 'bg-rose-500/10 text-rose-500' :
                                                'bg-amber-500/10 text-amber-500'
                                            }`}>
                                                {log.databaseUpdateStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {log.validationErrors ? (
                                                <span className="text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded block max-w-xs truncate" title={log.validationErrors}>
                                                    {log.validationErrors}
                                                </span>
                                            ) : log.errorDetails ? (
                                                <span className="text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded block max-w-xs truncate" title={log.errorDetails}>
                                                    {log.errorDetails}
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-[var(--text-muted)]">None</span>
                                            )}
                                        </td>
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

export default SuperAdminDashboard;
