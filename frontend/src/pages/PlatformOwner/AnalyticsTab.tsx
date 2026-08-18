import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    TrendingUp,
    DollarSign,
    PieChart as PieChartIcon,
    Building2,
    Calendar,
    ArrowUpRight
} from 'lucide-react';

const AnalyticsTab: React.FC = () => {
    const [analytics, setAnalytics] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const response = await axios.get('/api/v1/platform-owner/analytics');
            setAnalytics(response.data);
        } catch (error: any) {
            console.error('Failed to load platform analytics:', error);
            setErrorMsg(error.response?.data?.error || 'Failed to load platform analytics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-medium">Computing Platform Analytics & Financial Splits...</p>
                </div>
            </div>
        );
    }

    if (errorMsg || !analytics) {
        return (
            <div className="p-8 text-center bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] space-y-4">
                <p className="text-rose-500 font-bold text-sm">{errorMsg || 'Unable to load analytics data.'}</p>
                <button
                    onClick={fetchAnalytics}
                    className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    const { revenueTimeSeries, channelDistribution, topTenants } = analytics;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)]">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <TrendingUp className="text-amber-500" size={24} /> Platform Financials & Revenue Split
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Real-time transaction volume, platform commission splits, channel performance, and top performing tenant ISPs.
                </p>
            </div>

            {/* Top Grid: Channel Split & Top Tenants */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Channels */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <PieChartIcon size={18} className="text-emerald-400" /> Revenue Distribution by Payment Channel
                    </h4>

                    <div className="space-y-3 pt-2">
                        {Object.keys(channelDistribution || {}).length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)] py-4 text-center">No transaction channel data yet.</p>
                        ) : (
                            Object.keys(channelDistribution).map((channel) => {
                                const val = channelDistribution[channel];
                                return (
                                    <div key={channel} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                                        <span className="font-bold text-xs text-[var(--text-primary)] uppercase tracking-wider">{channel}</span>
                                        <span className="font-mono font-extrabold text-sm text-emerald-400">KES {val.toLocaleString()}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Top Tenants */}
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <Building2 size={18} className="text-sky-400" /> Top Grossing Tenants
                    </h4>

                    <div className="space-y-3 pt-2">
                        {topTenants && topTenants.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)] py-4 text-center">No tenant revenue recorded yet.</p>
                        ) : (
                            topTenants?.map((t: any, idx: number) => (
                                <div key={t.tenantId} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs font-black">
                                            #{idx + 1}
                                        </span>
                                        <span className="font-bold text-xs text-[var(--text-primary)]">{t.name}</span>
                                    </div>
                                    <span className="font-mono font-extrabold text-sm text-[var(--text-primary)]">
                                        KES {t.revenue.toLocaleString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Time Series Table */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
                <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <Calendar size={18} className="text-purple-400" /> Daily Revenue & Commission History (Last 30 Days)
                </h4>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] uppercase text-[10px] font-black tracking-wider border-b border-[var(--border-subtle)]">
                            <tr>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4 text-right">Transactions</th>
                                <th className="py-3 px-4 text-right">Gross Revenue</th>
                                <th className="py-3 px-4 text-right">Platform Commission</th>
                                <th className="py-3 px-4 text-right">Tenant Proceeds</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {revenueTimeSeries && revenueTimeSeries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">No historical transaction metrics recorded yet.</td>
                                </tr>
                            ) : (
                                revenueTimeSeries?.map((row: any) => (
                                    <tr key={row.date} className="hover:bg-[var(--bg-surface-elevated)]/50 font-mono">
                                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">{row.date}</td>
                                        <td className="py-3 px-4 text-right text-[var(--text-primary)]">{row.transactionCount}</td>
                                        <td className="py-3 px-4 text-right font-bold text-[var(--text-primary)]">KES {row.grossRevenue.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-right font-bold text-amber-400">KES {row.platformCommission.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-right font-bold text-emerald-400">KES {row.tenantRevenue.toLocaleString()}</td>
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

export default AnalyticsTab;
