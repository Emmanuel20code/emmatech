import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FileText,
    Download,
    Printer,
    Building2,
    DollarSign,
    Users,
    Wifi
} from 'lucide-react';

const ReportsTab: React.FC = () => {
    const [reportData, setReportData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchReports = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const response = await axios.get('/api/v1/platform-owner/reports');
            setReportData(response.data);
        } catch (error: any) {
            console.error('Failed to load consolidated reports:', error);
            setErrorMsg(error.response?.data?.error || 'Failed to load consolidated reports.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-medium">Generating Consolidated Platform Reports Hub...</p>
                </div>
            </div>
        );
    }

    if (errorMsg || !reportData) {
        return (
            <div className="p-8 text-center bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] space-y-4">
                <p className="text-rose-500 font-bold text-sm">{errorMsg || 'Unable to load consolidated reports.'}</p>
                <button
                    onClick={fetchReports}
                    className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    const { summary, topTenants, generatedAt } = reportData;

    return (
        <div className="space-y-8 print:p-0">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] print:hidden">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <FileText className="text-amber-500" size={24} /> Consolidated Platform Reports Hub
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        One-stop executive report summarizing tenants, subscriber growth, router uptime, and gross revenue.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2"
                    >
                        <Printer size={16} /> Print / Export PDF
                    </button>
                </div>
            </div>

            {/* Printable Executive Report Card */}
            <div className="bg-[var(--bg-surface)] p-8 rounded-2xl border border-[var(--border-subtle)] space-y-8 shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-6">
                    <div>
                        <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-wider">Jevish Platform Executive Report</h2>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">Generated: {new Date(generatedAt).toLocaleString()}</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black rounded-full uppercase tracking-widest">
                        CONFIDENTIAL
                    </span>
                </div>

                {/* Key Summary Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)]">
                        <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Total Gross Revenue</p>
                        <p className="text-xl font-black text-[var(--text-primary)] mt-1">KES {summary?.financials?.totalGrossRevenue?.toLocaleString() || 0}</p>
                    </div>

                    <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)]">
                        <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Platform Fee Earned</p>
                        <p className="text-xl font-black text-amber-400 mt-1">KES {summary?.financials?.totalPlatformCommission?.toLocaleString() || 0}</p>
                    </div>

                    <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)]">
                        <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Total Tenants</p>
                        <p className="text-xl font-black text-sky-400 mt-1">{summary?.tenants?.total || 0}</p>
                    </div>

                    <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)]">
                        <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Total Subscribers</p>
                        <p className="text-xl font-black text-emerald-400 mt-1">{summary?.subscribers?.total?.toLocaleString() || 0}</p>
                    </div>
                </div>

                {/* Top Tenants Summary Table */}
                <div className="space-y-4">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Top Performing Tenant Directory</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] uppercase text-[10px] font-black tracking-wider border-b border-[var(--border-subtle)]">
                                <tr>
                                    <th className="py-3 px-4">Tenant</th>
                                    <th className="py-3 px-4">Subdomain</th>
                                    <th className="py-3 px-4 text-right">Subscribers</th>
                                    <th className="py-3 px-4 text-right">Gross Revenue</th>
                                    <th className="py-3 px-4 text-right">Platform Fee</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                                {topTenants?.map((t: any) => (
                                    <tr key={t.id} className="font-mono">
                                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">{t.name}</td>
                                        <td className="py-3 px-4 text-[var(--text-secondary)]">.{t.subdomain}</td>
                                        <td className="py-3 px-4 text-right text-[var(--text-primary)]">{t.subscriberCount}</td>
                                        <td className="py-3 px-4 text-right font-bold text-[var(--text-primary)]">KES {t.totalRevenue?.toLocaleString() || 0}</td>
                                        <td className="py-3 px-4 text-right font-bold text-amber-400">KES {t.platformCommission?.toLocaleString() || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsTab;
