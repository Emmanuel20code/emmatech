import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ShieldCheck, AlertTriangle, FileText, Download,
    CreditCard, ArrowUpRight, CheckCircle2, RefreshCw, Calendar, DollarSign
} from 'lucide-react';

interface SubscriptionOverview {
    planName?: string;
    status?: string;
    currentPeriodEnd?: string;
    amountDue?: number;
    unpaidInvoiceId?: string;
    tenantName?: string;
    billingCycle?: string;
    activeUsers?: {
        todayActive: number;
        monthlyActive: number;
        cycleActive: number;
        historicalActive: number;
    };
}

export const SubscriptionStatusWidget: React.FC = () => {
    const navigate = useNavigate();
    const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSubscriptionDetails();
    }, []);

    const fetchSubscriptionDetails = async () => {
        setLoading(true);
        try {
            const [overviewRes, invoicesRes] = await Promise.all([
                axios.get('/api/v1/tenant/saas/subscription').catch(() => ({ data: null })),
                axios.get('/api/v1/tenant/saas/invoices').catch(() => ({ data: [] })),
            ]);
            setOverview(overviewRes.data);
            setInvoices(invoicesRes.data || []);
        } catch (err) {
            console.error('Failed to load subscription status', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse flex items-center justify-center min-h-[140px]">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
            </div>
        );
    }

    const currentStatus = overview?.status || 'ACTIVE';
    const planName = overview?.planName || 'Starter Plan';
    const renewalDate = overview?.currentPeriodEnd ? new Date(overview.currentPeriodEnd).toLocaleDateString() : 'Active';
    const amountDue = overview?.amountDue || 0;

    return (
        <div className="space-y-6">
            {/* Status Card Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="px-3.5 py-1 text-xs font-black uppercase tracking-widest bg-sky-500/20 text-sky-400 rounded-full border border-sky-500/30 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" /> {planName}
                            </span>
                            <span className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full ${
                                currentStatus === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                                {currentStatus}
                            </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight">{overview?.tenantName || 'Tenant Account'}</h2>
                        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-sky-400" /> Renewal Date: <strong className="text-slate-200">{renewalDate}</strong>
                            </span>
                            <span>Cycle: <strong className="text-slate-200 uppercase">{overview?.billingCycle || 'MONTHLY'}</strong></span>
                        </div>
                    </div>

                    {/* Action buttons & Amount due */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {amountDue > 0 ? (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                                <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Amount Due</div>
                                <div className="text-xl font-black text-white">KES {amountDue.toLocaleString()}</div>
                                <button
                                    onClick={() => navigate(`/checkout?invoiceId=${overview?.unpaidInvoiceId}`)}
                                    className="w-full px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                    <CreditCard className="w-4 h-4" /> Pay Now
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => navigate('/checkout?type=SUBSCRIPTION_PLAN')}
                                className="px-6 py-3.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-2xl transition shadow-xl shadow-sky-500/25 active:scale-95 flex items-center justify-center gap-2"
                            >
                                <ArrowUpRight className="w-4 h-4" /> Upgrade Subscription Plan
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionStatusWidget;
