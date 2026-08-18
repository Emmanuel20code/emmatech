import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import {
    Users, Wifi, CheckCircle, Wallet,
    RefreshCw, BarChart3, Server, Eye, EyeOff,
    ShoppingBag, User, GitBranch, Radio,
    ChevronRight, Headphones, Clock, Layers, CreditCard, Shield
} from 'lucide-react';
import { CheckoutModal } from '../components/Modals/CheckoutModal';
import RouterModal from '../components/Modals/RouterModal';
import { RecentTransactionsTable, Transaction } from '../components/Admin/RecentTransactionsTable';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface SubscriptionStatus {
    status: 'GRACE_PERIOD' | 'GRACE' | 'SUSPENDED' | 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TRIAL' | 'FREE_TRIAL';
    daysRemaining: number;
    amountDue: number;
    unpaidInvoiceId: string | null;
}

interface DashboardStats {
    tenantName: string;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    revenueYear: number;
    totalSubscribers: number;
    activeSubscribers: number;
    expiredSubscribers: number;
    onlineUsers: number;
    offlineUsers: number;
    totalRouters: number;
    connectedRouters: number;
    disconnectedRouters: number;
    successPayments: number;
    failedPayments: number;
    pendingPayments: number;
    activeCampaigns: number;
    pendingWithdrawals: number;
    networkHealth: number;
}

interface RouterItem {
    id: string;
    name: string;
    ipAddress?: string;
    status?: 'ONLINE' | 'OFFLINE';
    onlineCount?: number;
    activeCount?: number;
    expiredCount?: number;
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────

const fmtCurrency = (amount: number) => {
    const k = Math.round(Number(amount) || 0);
    return k.toLocaleString('en-US');
};

// ─── REUSABLE KPI METRIC CARD ───────────────────────────────────────────────

interface MetricCardProps {
    value: string | number;
    label: string;
    bgClass: string;
    icon: React.ReactNode;
    hideValue?: boolean;
    onHideToggle?: () => void;
    showHideBtn?: boolean;
    linkText: string;
    onLinkClick: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
    value,
    label,
    bgClass,
    icon,
    hideValue,
    onHideToggle,
    showHideBtn,
    linkText,
    onLinkClick
}) => (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-lg border border-white/5 ${bgClass} flex flex-col justify-between min-h-[145px] transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px] group`}>
        {/* Background Decorative Icon */}
        <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-white group-hover:scale-110 transition-transform duration-300 pointer-events-none">
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-24 h-24' }) : icon}
        </div>

        <div>
            {/* Header / Value Block */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-white tracking-tight">
                            {hideValue ? 'Ksh. ••••' : value}
                        </span>
                        {showHideBtn && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onHideToggle?.();
                                }}
                                className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                {hideValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                    <div className="text-[10px] font-black uppercase text-white/70 tracking-wider mt-1.5">
                        {label}
                    </div>
                </div>
            </div>
        </div>

        {/* Action Link Footer */}
        <button
            onClick={onLinkClick}
            className="mt-6 text-xs font-bold text-white/80 hover:text-white flex items-center gap-1 group/btn w-fit cursor-pointer transition-colors"
        >
            {linkText}
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
        </button>
    </div>
);

// ─── MAIN TENANT DASHBOARD ──────────────────────────────────────────────────

const TenantPortal: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showRouterModal, setShowRouterModal] = useState(false);
    const [routers, setRouters] = useState<RouterItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedRouter, setSelectedRouter] = useState<string>('ALL');
    const [hideIncome, setHideIncome] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshingUsers, setRefreshingUsers] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const isBlocked = subStatus && (
        ['EXPIRED', 'SUSPENDED', 'OVERDUE'].includes(subStatus.status) ||
        (['TRIAL', 'FREE_TRIAL'].includes(subStatus.status) && subStatus.daysRemaining <= 0) ||
        (['ACTIVE', 'PAID'].includes(subStatus.status) && subStatus.daysRemaining <= 0)
    );


    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const [summaryRes, routersRes, subRes, txRes] = await Promise.allSettled([
                axios.get<DashboardStats>('/api/v1/admin/dashboard-summary'),
                axios.get<RouterItem[]>('/api/v1/admin/routers'),
                axios.get<SubscriptionStatus>('/api/v1/tenant/saas/subscription-check'),
                axios.get<Transaction[]>('/api/v1/admin/recent-transactions')
            ]);

            if (summaryRes.status === 'fulfilled') setStats(summaryRes.value.data);
            if (routersRes.status === 'fulfilled' && Array.isArray(routersRes.value.data)) {
                setRouters(routersRes.value.data);
            }
            if (subRes.status === 'fulfilled') setSubStatus(subRes.value.data);
            if (txRes.status === 'fulfilled' && Array.isArray(txRes.value.data)) {
                setTransactions(txRes.value.data);
            }
            setLastUpdated(new Date());
        } catch (e) {
            console.error('[Dashboard] Load failed:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        const fetchData = async () => {
            if (active) await load();
        };
        fetchData();

        let newSocket: Socket | null = null;
        if (user?.tenantId) {
            newSocket = io(window.location.origin, {
                query: { tenantId: user.tenantId },
                transports: ['websocket', 'polling']
            });

            newSocket.on('connect', () => {
                console.log('[Socket] Connected to realtime dashboard updates');
            });

            const updateHandler = () => {
                console.log('[Socket] Received real-time update event');
                load(true);
            };

            newSocket.on('PAYMENT_SUCCESS', updateHandler);
            newSocket.on('PAYMENT_FAILED', updateHandler);
            newSocket.on('ROUTER_STATUS', updateHandler);
            newSocket.on('LIVE_SESSIONS_UPDATE', updateHandler);
            newSocket.on('SUBSCRIPTION_ACTIVATED', updateHandler);
            newSocket.on('SUBSCRIBER_RENEWED', updateHandler);
            newSocket.on('INVOICE_PAID', updateHandler);
        }

        return () => {
            active = false;
            if (newSocket) newSocket.disconnect();
        };
    }, [load, user?.tenantId]);

    const handleRefreshOnlineUsers = async () => {
        setRefreshingUsers(true);
        await load(true);
        setTimeout(() => {
            setRefreshingUsers(false);
            setToastMsg('Online users and router metrics refreshed!');
            setTimeout(() => setToastMsg(null), 3000);
        }, 800);
    };

    if (loading) return (
        <div className="min-h-[60vh] flex items-center justify-center bg-[#0b0f19]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Loading router data & dashboard analytics...</p>
            </div>
        </div>
    );

    // Real database metrics without mock fallbacks
    const realStats = stats || {
        tenantName: 'Administrator',
        revenueToday: 0,
        revenueMonth: 0,
        totalSubscribers: 0,
        activeSubscribers: 0,
        expiredSubscribers: 0,
        onlineUsers: 0,
        networkHealth: 100
    };

    const displayRouters = routers;

    // Standardize values from database
    const incomeTodayVal = fmtCurrency(realStats.revenueToday);
    const incomeMonthVal = fmtCurrency(realStats.revenueMonth);
    const activeExpiredVal = `${realStats.activeSubscribers}/${realStats.expiredSubscribers}`;
    const totalUsersVal = realStats.totalSubscribers;

    const selectedRouterObj = displayRouters.find(r => r.id === selectedRouter);
    const hotspotOnline = selectedRouterObj ? (selectedRouterObj.onlineCount || 0) : realStats.onlineUsers;
    const pppoeOnline = 0;
    const staticOnline = 0;
    const totalOnline = hotspotOnline + pppoeOnline + staticOnline;

    return (
        <>
        <div className={`space-y-6 pb-12 text-slate-100 bg-[#0b0f19] min-h-screen p-1 sm:p-4 rounded-3xl ${isBlocked ? "opacity-20 pointer-events-none blur-sm select-none" : ""}` }>
            {/* Modern Subscription & Billing Card */}
            {subStatus && (
                <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shadow-inner">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-white">
                                    {subStatus.status === 'TRIAL' || subStatus.status === 'FREE_TRIAL' ? 'Free Trial Active' : subStatus.status === 'EXPIRED' ? 'Subscription Expired' : 'Active Subscription'}
                                </h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    subStatus.status === 'ACTIVE' || subStatus.status === 'PAID'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                    {`${subStatus.daysRemaining} Days to Renewal (${subStatus.status})`}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {subStatus.status === 'TRIAL' || subStatus.status === 'FREE_TRIAL'
                                    ? `Your workspace is currently on trial. Upgrade anytime to unlock continuous unlimited billing.`
                                    : `Subscription active & fully operational. Next billing amount: KES ${subStatus.amountDue.toLocaleString()}`
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCheckout(true)}
                            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-2xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                        >
                            <CreditCard className="w-4 h-4" /> Pay / Renew Plan
                        </button>
                    </div>
                </div>
            )}




            <RouterModal
                isOpen={showRouterModal}
                onClose={() => setShowRouterModal(false)}
                onSuccess={() => { setShowRouterModal(false); load(true); }}
            />

            {/* Notification Toast */}
            {toastMsg && (
                <div className="fixed top-5 right-5 z-50 bg-emerald-500 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl animate-bounce flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {toastMsg}
                </div>
            )}

            {/* Title / Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
                    <p className="text-xs text-slate-400 mt-1">
                        System Sync Monitor • Active • Last Sync: {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => load(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-bold transition-all disabled:opacity-60 cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Sync System
                    </button>
                </div>
            </div>

            {/* ─── ROUTER VIEW CONTAINER (Dark ISP Dashboard Theme) ─── */}
            <div className="bg-[#101626] rounded-2xl p-6 border border-slate-800/80 shadow-2xl space-y-6">
                
                {/* Router View Header Bar */}
                <div className="bg-[#141b2f] rounded-xl p-4 border border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                            <Server className="w-5 h-5" />
                        </div>
                        <h2 className="text-base font-bold text-white tracking-tight">Router View</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/tenant/branding')}
                            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
                        >
                            <Eye className="w-3.5 h-3.5" /> Captive Portal & Customizer
                        </button>
                        <button
                            onClick={() => navigate('/tenant/payout-settings')}
                            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
                        >
                            <CreditCard className="w-3.5 h-3.5" /> Direct Payout Settings
                        </button>
                        <button
                            onClick={() => setShowRouterModal(true)}
                            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-sky-500/20 flex items-center gap-2 cursor-pointer"
                        >
                            <Wifi className="w-3.5 h-3.5" /> Connect MikroTik Router
                        </button>
                        <select
                            value={selectedRouter}
                            onChange={(e) => setSelectedRouter(e.target.value)}
                            className="bg-[#18233c] text-slate-100 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700/80 focus:outline-none focus:border-sky-500 cursor-pointer"
                        >
                            <option value="ALL">All Routers - System Wide</option>
                            {displayRouters.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Router Badges Horizontal Row */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {displayRouters.map(r => (
                        <div
                            key={r.id}
                            onClick={() => setSelectedRouter(r.id)}
                            className={`bg-[#141b2f]/60 border ${selectedRouter === r.id ? 'border-sky-500 bg-[#162137]' : 'border-slate-800/80 hover:border-slate-700/80'} rounded-xl p-4 min-w-[210px] cursor-pointer transition-all duration-200`}
                        >
                            <p className="text-sm font-bold text-sky-400 mb-2 truncate">{r.name}</p>
                            <div className="flex items-center gap-4 text-xs font-semibold">
                                <span className="text-emerald-400 flex items-center gap-1.5" title="Online Count">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {r.onlineCount}
                                </span>
                                <span className="text-sky-400 flex items-center gap-1" title="Active/Binding Count">
                                    ✓ {r.activeCount}
                                </span>
                                <span className="text-rose-400 flex items-center gap-1" title="Offline/Expired Count">
                                    ✕ {r.expiredCount}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ─── 8 MAIN KPI CARDS GRID (Aesthetic Colored Backgrounds) ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* 1. INCOME TODAY */}
                    <MetricCard
                        bgClass="bg-[#243049]" // Dark Navy Slate
                        icon={<ShoppingBag />}
                        label="INCOME TODAY"
                        value={`Ksh. ${incomeTodayVal}`}
                        showHideBtn={true}
                        hideValue={hideIncome}
                        onHideToggle={() => setHideIncome(!hideIncome)}
                        linkText="View Reports"
                        onLinkClick={() => navigate('/tenant/reports')}
                    />

                    {/* 2. INCOME THIS MONTH */}
                    <MetricCard
                        bgClass="bg-[#183a2d]" // Deep Forest Green
                        icon={<BarChart3 />}
                        label="INCOME THIS MONTH"
                        value={`Ksh. ${incomeMonthVal}`}
                        showHideBtn={true}
                        hideValue={hideIncome}
                        onHideToggle={() => setHideIncome(!hideIncome)}
                        linkText="View Reports"
                        onLinkClick={() => navigate('/tenant/reports')}
                    />

                    {/* 3. ACTIVE/EXPIRED */}
                    <MetricCard
                        bgClass="bg-[#4a3a24]" // Golden/Amber Brown
                        icon={<User />}
                        label="ACTIVE/EXPIRED"
                        value={activeExpiredVal}
                        linkText="View All"
                        onLinkClick={() => navigate('/tenant/subscribers')}
                    />

                    {/* 4. TOTAL USERS */}
                    <MetricCard
                        bgClass="bg-[#4a2428]" // Terracotta / Crimson Red
                        icon={<Users />}
                        label="TOTAL USERS"
                        value={totalUsersVal}
                        linkText="View All"
                        onLinkClick={() => navigate('/tenant/subscribers')}
                    />

                    {/* 5. HOTSPOT ONLINE USERS */}
                    <MetricCard
                        bgClass="bg-[#1b3a3e]" // Deep Cyan/Teal
                        icon={<Wifi />}
                        label="HOTSPOT ONLINE USERS"
                        value={hotspotOnline}
                        linkText="View All"
                        onLinkClick={() => navigate('/tenant/sessions')}
                    />

                    {/* 6. PPPOE ONLINE USERS */}
                    <MetricCard
                        bgClass="bg-[#2e244a]" // Royal Purple Indigo
                        icon={<GitBranch />}
                        label="PPPOE ONLINE USERS"
                        value={pppoeOnline}
                        linkText="View All"
                        onLinkClick={() => navigate('/tenant/sessions')}
                    />

                    {/* 7. STATIC ONLINE USERS */}
                    <MetricCard
                        bgClass="bg-[#1e3b2e]" // Emerald/Sage Green
                        icon={<Radio />}
                        label="STATIC ONLINE USERS"
                        value={staticOnline}
                        linkText="View All"
                        onLinkClick={() => navigate('/tenant/sessions')}
                    />

                    {/* 8. TOTAL ONLINE USERS */}
                    <MetricCard
                        bgClass="bg-[#4a2f24]" // Deep Mahogany Brown
                        icon={<Users />}
                        label="TOTAL ONLINE USERS"
                        value={totalOnline}
                        linkText="View All"
                        onLinkClick={() => navigate('/tenant/sessions')}
                    />

                </div>

                {/* Status Bar & Action Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800/50">
                    <div className="flex items-center gap-3 bg-[#131b2e] border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-300 w-full sm:w-auto">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <span>
                            <strong className="text-emerald-400 font-bold">M-Pesa Gateway Pusher</strong> — Online · Live connection
                        </span>
                    </div>

                    <button
                        onClick={handleRefreshOnlineUsers}
                        disabled={refreshingUsers}
                        className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshingUsers ? 'animate-spin' : ''}`} />
                        Refresh Online Users
                    </button>
                </div>

            </div>

            {/* ─── SUB REVENUE TRENDS & LOGS ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent transaction activity */}
                <div className="lg:col-span-3">
                    {transactions.length > 0 ? (
                        <RecentTransactionsTable transactions={transactions} />
                    ) : (
                        <div className="bg-[#101626] border border-slate-800/80 rounded-2xl p-6 text-center text-slate-400">
                            <Layers className="w-8 h-8 mx-auto text-slate-600 mb-3" />
                            <p className="text-xs font-bold">No subscriber transactions recorded in the current session window.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Support Assist Trigger */}
            <button
                onClick={() => navigate('/tenant/support')}
                className="fixed bottom-6 right-6 z-40 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
            >
                <Headphones className="w-4 h-4" />
                Support
            </button>
        </div>
            {(showCheckout || isBlocked) && subStatus?.unpaidInvoiceId && (
                <CheckoutModal
                    invoiceId={subStatus.unpaidInvoiceId}
                    amount={subStatus.amountDue}
                    disableClose={!!isBlocked}
                    onClose={!isBlocked ? () => setShowCheckout(false) : undefined}
                    onSuccess={() => { setShowCheckout(false); load(true); }}
                />
            )}
        </>
    );
};

export default TenantPortal;
