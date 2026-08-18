import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    RefreshCw, Download, BarChart3, TrendingUp, Activity,
    Package, Wifi, ShieldCheck, DollarSign, Filter
} from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface RevenueData { today: number; month: number; }
interface BandwidthData { activeSessions: number; totalIn: number; totalOut: number; usageByRouter: Record<string, { in: number; out: number }> }
interface PerformanceData { rate: number; failed: number; success: number; }
interface TrafficContext { peakHours: string; netEfficiency: string; }
interface DailyRevenue { date: string; total: number; }
interface MonthlyTrend { month: string; total: number; }
interface SubGrowth { date: string; count: number; }
interface PackageSale { name: string; count: number; revenue: number; }
interface HourlyTrend { hour: string; amount: number; }

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CHART_COLORS = ['#38bdf8', '#10b981', '#a855f7', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

const fmtKES = (v: any) => `KES ${Math.round(Number(v) || 0).toLocaleString('en-US')}`;
const fmtMB = (bytes: number) => bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;

// ─── CHART CARD WRAPPER ──────────────────────────────────────────────────────

const ChartCard: React.FC<{ title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, sub, children, action }) => (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between mb-4">
            <div>
                <h3 className="text-sm font-black text-[var(--text-primary)]">{title}</h3>
                {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
            </div>
            {action}
        </div>
        {children}
    </div>
);

// ─── STAT BADGE ──────────────────────────────────────────────────────────────

const StatBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
    <div className="text-center">
        <div className={`text-xl font-black ${color}`}>{value}</div>
        <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mt-0.5">{label}</div>
    </div>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
    const [revenue, setRevenue] = useState<RevenueData | null>(null);
    const [bandwidth, setBandwidth] = useState<BandwidthData | null>(null);
    const [performance, setPerformance] = useState<PerformanceData | null>(null);
    const [trafficContext, setTrafficContext] = useState<TrafficContext | null>(null);
    const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
    const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
    const [subGrowth, setSubGrowth] = useState<SubGrowth[]>([]);
    const [packageSales, setPackageSales] = useState<PackageSale[]>([]);
    const [hourlyTrend, setHourlyTrend] = useState<HourlyTrend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dateRange, setDateRange] = useState('30d');

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const results = await Promise.allSettled([
                axios.get<RevenueData>('/api/v1/admin/analytics/revenue'),
                axios.get<BandwidthData>('/api/v1/admin/analytics/bandwidth'),
                axios.get<PerformanceData>('/api/v1/admin/analytics/performance'),
                axios.get<TrafficContext>('/api/v1/admin/analytics/context'),
                axios.get<DailyRevenue[]>('/api/v1/admin/analytics/revenue-trend'),
                axios.get<MonthlyTrend[]>('/api/v1/admin/analytics/monthly-trend'),
                axios.get<SubGrowth[]>('/api/v1/admin/analytics/subscriber-growth'),
                axios.get<PackageSale[]>('/api/v1/admin/analytics/package-sales'),
                axios.get<{ revenueTrend: HourlyTrend[] }>('/api/v1/admin/analytics/hourly-trends'),
            ]);

            if (results[0].status === 'fulfilled') setRevenue(results[0].value.data);
            if (results[1].status === 'fulfilled') setBandwidth(results[1].value.data);
            if (results[2].status === 'fulfilled') setPerformance(results[2].value.data);
            if (results[3].status === 'fulfilled') setTrafficContext(results[3].value.data);
            if (results[4].status === 'fulfilled') setDailyRevenue(results[4].value.data || []);
            if (results[5].status === 'fulfilled') setMonthlyTrend(results[5].value.data || []);
            if (results[6].status === 'fulfilled') setSubGrowth(results[6].value.data || []);
            if (results[7].status === 'fulfilled') setPackageSales(results[7].value.data || []);
            if (results[8].status === 'fulfilled') setHourlyTrend((results[8].value.data as any)?.revenueTrend || []);
        } catch (error) {
            console.error('[Analytics] Load failed:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(true), 5_000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const exportCSV = async (type: string) => {
        try {
            const res = await axios.get(`/api/v1/admin/reports/${type}?format=csv`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}-report.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('[Analytics] Export failed:', e);
        }
    };

    if (loading) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-widest">Loading Analytics...</p>
            </div>
        </div>
    );

    // Payment pie data
    const paymentPie = [
        { name: 'Success', value: performance?.success || 0, color: '#10b981' },
        { name: 'Failed', value: performance?.failed || 0, color: '#ef4444' },
    ];

    // Bandwidth pie by router
    const bwRouterData = Object.entries(bandwidth?.usageByRouter || {}).map(([id, val]) => ({
        name: `Router ${id.slice(-4)}`,
        value: val.in + val.out,
    }));

    return (
        <div className="space-y-6 pb-8">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-xl font-bold text-[var(--text-primary)]">
                            Real-time <span className="text-sky-500">Insights</span>
                        </h1>
                        <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold rounded-full flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            LIVE
                        </div>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">Network analytics — refreshes every 30 seconds</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Date range */}
                    <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-1">
                        {['7d', '30d', '90d'].map(r => (
                            <button key={r} onClick={() => setDateRange(r)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateRange === r ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                                {r}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => exportCSV('revenue')} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500 rounded-xl text-xs font-bold text-[var(--text-secondary)] transition-all">
                        <Download className="w-3.5 h-3.5" /> Revenue CSV
                    </button>
                    <button onClick={() => exportCSV('payments')} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500 rounded-xl text-xs font-bold text-[var(--text-secondary)] transition-all">
                        <Download className="w-3.5 h-3.5" /> Payments CSV
                    </button>
                    <button onClick={() => fetchData(true)} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-60">
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Summary Stats ── */}
            {(revenue || bandwidth || performance || trafficContext) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-[var(--text-primary)]">
                                KES {Math.round(Number(revenue?.month) || 0).toLocaleString('en-US')}
                            </div>
                            <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">Month Revenue</div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Wifi className="w-5 h-5 text-sky-600" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-[var(--text-primary)]">{bandwidth?.activeSessions || 0}</div>
                            <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">Active Sessions</div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-[var(--text-primary)]">{performance?.rate?.toFixed(1) || '100'}%</div>
                            <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">Payment Success</div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Activity className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-[var(--text-primary)]">{trafficContext?.peakHours || '—'}</div>
                            <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">Peak Hours</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Revenue Trend (7 days) ── */}
            {dailyRevenue.length > 0 && (
                <ChartCard title="Daily Revenue — Last 7 Days" sub="Total KES collected per day" action={
                    <button onClick={() => exportCSV('revenue')} className="text-xs text-sky-500 hover:text-sky-600 font-bold flex items-center gap-1">
                        <Download className="w-3 h-3" /> CSV
                    </button>
                }>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                            <YAxis tickFormatter={fmtKES} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={80} />
                            <Tooltip formatter={(v: any) => [fmtKES(v), 'Revenue']} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                            <Area type="monotone" dataKey="total" stroke="#38bdf8" strokeWidth={2.5} fill="url(#revG)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* ── Monthly Trend + Hourly ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {monthlyTrend.length > 0 && (
                    <ChartCard title="Monthly Revenue — Last 12 Months">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                                <YAxis tickFormatter={fmtKES} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={75} />
                                <Tooltip formatter={(v: any) => [fmtKES(v), 'Revenue']} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                                <Bar dataKey="total" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {hourlyTrend.length > 0 && (
                    <ChartCard title="Hourly Revenue — Last 24 Hours">
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={hourlyTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                                <YAxis tickFormatter={fmtKES} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={80} />
                                <Tooltip formatter={(v: any) => [fmtKES(v), 'Revenue']} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>

            {/* ── Subscriber Growth ── */}
            {subGrowth.length > 0 && (
                <ChartCard title="Subscriber Growth — Last 30 Days" sub="New subscribers added per day" action={
                    <button onClick={() => exportCSV('subscribers')} className="text-xs text-sky-500 hover:text-sky-600 font-bold flex items-center gap-1">
                        <Download className="w-3 h-3" /> CSV
                    </button>
                }>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={subGrowth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id="subG" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={30} />
                            <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                            <Area type="monotone" dataKey="count" name="New Subscribers" stroke="#10b981" strokeWidth={2.5} fill="url(#subG)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* ── Package Sales + Payment Performance ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {packageSales.length > 0 && (
                    <ChartCard title="Top Packages by Revenue" sub="Total revenue per package (all time)">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={packageSales.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                <XAxis type="number" tickFormatter={fmtKES} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={100} />
                                <Tooltip formatter={(v: any) => [fmtKES(v), 'Revenue']} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                                <Bar dataKey="revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {performance && (
                    <ChartCard title="Payment Performance" sub="Success vs failed payment ratio">
                        <div className="flex items-center gap-6">
                            <ResponsiveContainer width={160} height={160}>
                                <PieChart>
                                    <Pie data={paymentPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" strokeWidth={0}>
                                        {paymentPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-4">
                                <StatBadge label="Success Rate" value={`${performance.rate?.toFixed(1) || 100}%`} color="text-emerald-500" />
                                <StatBadge label="Successful" value={String(performance.success || 0)} color="text-sky-500" />
                                <StatBadge label="Failed" value={String(performance.failed || 0)} color="text-rose-500" />
                                <div className="space-y-1.5">
                                    {paymentPie.map(d => (
                                        <div key={d.name} className="flex items-center gap-2 text-xs">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                            <span className="text-[var(--text-secondary)]">{d.name}: <strong className="text-[var(--text-primary)]">{d.value}</strong></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ChartCard>
                )}
            </div>

            {/* ── Bandwidth Usage ── */}
            {bandwidth && (
                <ChartCard title="Bandwidth Usage" sub={`Total: ${fmtMB(bandwidth.totalIn + bandwidth.totalOut)} transferred across all sessions`} action={
                    <button onClick={() => exportCSV('bandwidth')} className="text-xs text-sky-500 hover:text-sky-600 font-bold flex items-center gap-1">
                        <Download className="w-3 h-3" /> CSV
                    </button>
                }>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <StatBadge label="Sessions" value={String(bandwidth.activeSessions)} color="text-sky-500" />
                        <StatBadge label="Download" value={fmtMB(bandwidth.totalIn)} color="text-emerald-500" />
                        <StatBadge label="Upload" value={fmtMB(bandwidth.totalOut)} color="text-violet-500" />
                    </div>
                    {bwRouterData.length > 0 && (
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width={140} height={140}>
                                <PieChart>
                                    <Pie data={bwRouterData} cx="50%" cy="50%" outerRadius={60} dataKey="value" strokeWidth={0}>
                                        {bwRouterData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => [fmtMB(Number(v) || 0), 'Usage']} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1.5">
                                {bwRouterData.map((d, i) => (
                                    <div key={d.name} className="flex items-center gap-2 text-xs">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        <span className="text-[var(--text-secondary)]">{d.name}: <strong className="text-[var(--text-primary)]">{fmtMB(d.value)}</strong></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ChartCard>
            )}
        </div>
    );
};


export default Analytics;
