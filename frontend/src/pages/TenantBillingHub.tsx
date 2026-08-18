import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Wallet, ShieldCheck, AlertTriangle, FileText, Download,
    CreditCard, ArrowUpRight, CheckCircle, RefreshCw, Layers
} from 'lucide-react';
import axios from 'axios';
import SubscriptionStatusWidget from '../components/SubscriptionStatusWidget';

interface ActiveUsers {
    todayActive: number;
    monthlyActive: number;
    cycleActive: number;
    historicalActive: number;
}

interface BillingOverview {
    activeUsers?: ActiveUsers;
}

interface InvoiceItem {
    id: string;
    invoiceNumber: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    dueDate: string;
    totalAmountCents: number;
    paymentStatus: string;
}

const TenantBillingHub: React.FC = () => {
    const navigate = useNavigate();
    const [overview, setOverview] = useState<BillingOverview | null>(null);
    const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadBilling = async () => {
            try {
                const [overviewRes, invoicesRes] = await Promise.all([
                    axios.get<BillingOverview>('/api/v1/tenant/saas/subscription').catch(() => ({ data: null })),
                    axios.get<InvoiceItem[]>('/api/v1/tenant/saas/invoices').catch(() => ({ data: [] })),
                ]);
                if (isMounted) {
                    setOverview(overviewRes ? overviewRes.data : null);
                    setInvoices(invoicesRes ? invoicesRes.data : []);
                }
            } catch (err: unknown) {
                console.error('Failed to load tenant billing data', err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };
        loadBilling();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleDownloadPdf = async (invoiceId: string) => {
        try {
            const res = await axios.get<{ pdfDataUrl?: string; htmlContent?: string }>(`/api/v1/tenant/saas/invoices/${invoiceId}/pdf`);
            if (res.data.pdfDataUrl) {
                const win = window.open();
                if (win && res.data.htmlContent) {
                    win.document.write(res.data.htmlContent);
                }
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            alert(`Download error: ${errMsg}`);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center min-h-[50vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mb-2" />
                <p className="text-sm font-semibold text-slate-500">Loading Billing Hub...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Reusable Subscription & Billing Overview Widget */}
            <SubscriptionStatusWidget />

            {/* Active Users Gauge */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Today Active</span>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{overview?.activeUsers?.todayActive || 0}</div>
                </div>
                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Monthly Active</span>
                    <div className="text-2xl font-black text-blue-600 mt-1">{overview?.activeUsers?.monthlyActive || 0}</div>
                </div>
                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Billing Cycle Active</span>
                    <div className="text-2xl font-black text-purple-600 mt-1">{overview?.activeUsers?.cycleActive || 0}</div>
                </div>
                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Historical Total</span>
                    <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">{overview?.activeUsers?.historicalActive || 0}</div>
                </div>
            </div>

            {/* Invoice History */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <FileText className="text-sky-500" /> Billing History & Invoices
                </h3>
                <div className="responsive-table-wrapper">
                    <table className="w-full text-left text-sm min-w-[640px]">
                        <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-500">
                            <tr>
                                <th className="p-3">Invoice #</th>
                                <th className="p-3">Period</th>
                                <th className="p-3">Due Date</th>
                                <th className="p-3">Total Amount</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {invoices.map((inv: any) => (
                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                                    <td className="p-3 font-mono font-bold">{inv.invoiceNumber}</td>
                                    <td className="p-3 text-xs text-slate-400">
                                        {new Date(inv.billingPeriodStart).toLocaleDateString()} - {new Date(inv.billingPeriodEnd).toLocaleDateString()}
                                    </td>
                                    <td className="p-3 text-xs text-slate-400">{new Date(inv.dueDate).toLocaleDateString()}</td>
                                    <td className="p-3 font-black text-emerald-600">KES {(Number(inv.totalAmountCents) / 100).toLocaleString()}</td>
                                    <td className="p-3">
                                        <span className={`px-2.5 py-1 text-xs rounded-full font-bold ${inv.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {inv.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                        {inv.paymentStatus !== 'PAID' && (
                                            <button
                                                onClick={() => navigate(`/checkout?invoiceId=${inv.id}`)}
                                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition shadow-sm"
                                            >
                                                Pay Now
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDownloadPdf(inv.id)}
                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 transition"
                                        >
                                            View Invoice
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TenantBillingHub;
