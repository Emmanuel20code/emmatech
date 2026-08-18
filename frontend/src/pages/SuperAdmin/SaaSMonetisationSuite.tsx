import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, Users, CreditCard, ShieldCheck, AlertTriangle,
    Settings, Play, FileText, Download, CheckCircle, RefreshCw, Layers
} from 'lucide-react';
import axios from 'axios';

const SaaSMonetisationSuite: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'plans' | 'invoices' | 'subscription'>('overview');
    const [metrics, setMetrics] = useState<any>(null);
    const [pricingConfig, setPricingConfig] = useState<any>({ baseSubscriptionPriceCents: 0 });
    const [plans, setPlans] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [metricsRes, configRes, plansRes, invoicesRes] = await Promise.all([
                axios.get('/api/v1/superadmin/saas/dashboard').catch(() => ({ data: null })),
                axios.get('/api/v1/superadmin/saas/pricing-config').catch(() => ({ data: { baseSubscriptionPriceCents: 0 } })),
                axios.get('/api/v1/superadmin/saas/plans').catch(() => ({ data: [] })),
                axios.get('/api/v1/superadmin/saas/invoices').catch(() => ({ data: [] })),
            ]);

            setMetrics(metricsRes.data);
            // Convert cents to KSh for UI
            setPricingConfig({
                ...configRes.data,
                baseSubscriptionPriceCents: (configRes.data.baseSubscriptionPriceCents || 0) / 100,
                extraActiveUserPriceCents: (configRes.data.extraActiveUserPriceCents || 0) / 100,
                adMonthlyFeeCents: (configRes.data.adMonthlyFeeCents || 0) / 100,
                adCampaignFeeCents: (configRes.data.adCampaignFeeCents || 0) / 100,
                adVideoFeeCents: (configRes.data.adVideoFeeCents || 0) / 100,
                adBannerFeeCents: (configRes.data.adBannerFeeCents || 0) / 100,
                adStorageFeeCents: (configRes.data.adStorageFeeCents || 0) / 100,
                smsPriceCents: (configRes.data.smsPriceCents || 0) / 100,
                emailPriceCents: (configRes.data.emailPriceCents || 0) / 100,
                whatsappPriceCents: (configRes.data.whatsappPriceCents || 0) / 100,
                extraRouterPriceCents: (configRes.data.extraRouterPriceCents || 0) / 100,
                latePaymentFeeCents: (configRes.data.latePaymentFeeCents || 0) / 100,
            });
            setPlans(plansRes.data);
            setInvoices(invoicesRes.data);
        } catch (err: any) {
            console.error('Failed to load SaaS data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Convert KSh back to cents before sending to server
            const configToSave = {
                ...pricingConfig,
                baseSubscriptionPriceCents: pricingConfig.baseSubscriptionPriceCents * 100,
                extraActiveUserPriceCents: pricingConfig.extraActiveUserPriceCents * 100,
                adMonthlyFeeCents: pricingConfig.adMonthlyFeeCents * 100,
                adCampaignFeeCents: pricingConfig.adCampaignFeeCents * 100,
                adVideoFeeCents: pricingConfig.adVideoFeeCents * 100,
                adBannerFeeCents: pricingConfig.adBannerFeeCents * 100,
                adStorageFeeCents: pricingConfig.adStorageFeeCents * 100,
                smsPriceCents: pricingConfig.smsPriceCents * 100,
                emailPriceCents: pricingConfig.emailPriceCents * 100,
                whatsappPriceCents: pricingConfig.whatsappPriceCents * 100,
                extraRouterPriceCents: pricingConfig.extraRouterPriceCents * 100,
                latePaymentFeeCents: pricingConfig.latePaymentFeeCents * 100,
            };
            await axios.put('/api/v1/superadmin/saas/pricing-config', configToSave);
            setMessage('Configuration updated successfully!');
            fetchData();
        } catch (err: any) {
            setMessage(`Failed: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleTriggerBilling = async () => {
        setSaving(true);
        try {
            const res = await axios.post('/api/v1/superadmin/saas/trigger-billing-run');
            setMessage(`Billing run triggered! ${res.data.count} invoices generated.`);
            fetchData();
        } catch (err: any) {
            setMessage(`Billing run failed: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center min-h-[50vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mb-2" />
                <p className="text-sm font-semibold text-slate-500">Loading SaaS Monetisation Suite...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-2xl">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <DollarSign className="text-emerald-400" /> SaaS Monetisation & Subscription Suite
                    </h1>
                    <p className="text-xs font-medium text-slate-400 mt-1">
                        Configure base subscriptions, active user billing, ad fees, grace periods, and platform invoices.
                    </p>
                </div>
                <button
                    onClick={handleTriggerBilling}
                    disabled={saving}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                    <Play className="w-4 h-4" /> Trigger Platform Billing Run
                </button>
            </div>

            {message && (
                <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl text-sky-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> {message}
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 border-b border-slate-200 dark:border-slate-800">
                {[
                    { id: 'overview', label: 'Financial Overview', icon: DollarSign },
                    { id: 'subscription', label: 'Subscription Settings', icon: CreditCard },
                    { id: 'pricing', label: 'Pricing Engine Config', icon: Settings },
                    { id: 'plans', label: 'Subscription Plans', icon: Layers },
                    { id: 'invoices', label: 'Platform Invoices', icon: FileText }
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ─── TAB 1: OVERVIEW ─── */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold uppercase text-slate-400">MRR</span>
                            <div className="text-2xl font-black text-emerald-600 mt-1">KES {(metrics?.mrr || 0).toLocaleString()}</div>
                        </div>
                        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold uppercase text-slate-400">ARR</span>
                            <div className="text-2xl font-black text-blue-600 mt-1">KES {(metrics?.arr || 0).toLocaleString()}</div>
                        </div>
                        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Active Tenants</span>
                            <div className="text-2xl font-black text-indigo-600 mt-1">{metrics?.activeTenants || 0}</div>
                        </div>
                        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Grace Period</span>
                            <div className="text-2xl font-black text-amber-500 mt-1">{metrics?.graceTenants || 0}</div>
                        </div>
                        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Suspended</span>
                            <div className="text-2xl font-black text-rose-600 mt-1">{metrics?.suspendedTenants || 0}</div>
                        </div>
                        <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Outstanding</span>
                            <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">KES {(metrics?.outstandingRevenue || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TAB 2: SUBSCRIPTION SETTINGS ─── */}
            {activeTab === 'subscription' && pricingConfig && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold">Subscription Payment Settings</h3>
                    <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <label className="block font-semibold mb-1">Base Subscription Price (KSh)</label>
                            <input
                                type="number"
                                value={pricingConfig.baseSubscriptionPriceCents}
                                onChange={e => setPricingConfig({ ...pricingConfig, baseSubscriptionPriceCents: Number(e.target.value) })}
                                className="w-full px-3.5 py-2.5 rounded-xl border dark:bg-slate-700 font-mono"
                            />
                            <p className="text-xs text-slate-400 mt-1">KSh 1,500.00 / month</p>
                        </div>

                        <div>
                            <label className="block font-semibold mb-1">Subscription Payment Till Number</label>
                            <input
                                type="text"
                                value={pricingConfig.subscriptionTillNumber || ''}
                                onChange={e => setPricingConfig({ ...pricingConfig, subscriptionTillNumber: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl border dark:bg-slate-700 font-mono"
                            />
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md active:scale-95 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Subscription Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── TAB 3: PRICING ENGINE CONFIG ─── */}
            {activeTab === 'pricing' && pricingConfig && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold">Global Pricing Engine Configuration</h3>
                    <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div>
                            <label className="block font-semibold mb-1">Included Active Users</label>
                            <input
                                type="number"
                                value={pricingConfig.includedActiveUsers}
                                onChange={e => setPricingConfig({ ...pricingConfig, includedActiveUsers: Number(e.target.value) })}
                                className="w-full px-3.5 py-2.5 rounded-xl border dark:bg-slate-700"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold mb-1">Extra User Price (KSh)</label>
                            <input
                                type="number"
                                value={pricingConfig.extraActiveUserPriceCents}
                                onChange={e => setPricingConfig({ ...pricingConfig, extraActiveUserPriceCents: Number(e.target.value) })}
                                className="w-full px-3.5 py-2.5 rounded-xl border dark:bg-slate-700 font-mono"
                            />
                            <p className="text-xs text-slate-400 mt-1">KSh 15.00 per extra user</p>
                        </div>

                        <div>
                            <label className="block font-semibold mb-1">Monthly Ad Fee (KSh)</label>
                            <input
                                type="number"
                                value={pricingConfig.adMonthlyFeeCents}
                                onChange={e => setPricingConfig({ ...pricingConfig, adMonthlyFeeCents: Number(e.target.value) })}
                                className="w-full px-3.5 py-2.5 rounded-xl border dark:bg-slate-700 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold mb-1">Value Added Tax (VAT %)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={pricingConfig.vatPercentage}
                                onChange={e => setPricingConfig({ ...pricingConfig, vatPercentage: Number(e.target.value) })}
                                className="w-full px-3.5 py-2.5 rounded-xl border dark:bg-slate-700 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold mb-1">Grace Period (Days)</label>
                            <input
                                type="number"
                                value={pricingConfig.gracePeriodDays}
                                onChange={e => setPricingConfig({ ...pricingConfig, gracePeriodDays: Number(e.target.value) })}
                                className="w-full px-3.5 py-2.5 rounded-xl border dark:bg-slate-700"
                            />
                        </div>

                        <div className="md:col-span-3 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md active:scale-95 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Global Rules'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── TAB 3: SUBSCRIPTION PLANS ─── */}
            {activeTab === 'plans' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((p: any) => (
                        <div key={p.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 relative overflow-hidden">
                            {p.isPopular && (
                                <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-sky-500 text-white px-2 py-0.5 rounded-full">Most Popular</span>
                            )}
                            <h3 className="text-xl font-black">{p.name}</h3>
                            <div className="text-3xl font-black text-blue-600">KES {(Number(p.monthlyPriceCents) / 100).toLocaleString()}<span className="text-xs font-normal text-slate-400">/mo</span></div>
                            <p className="text-xs text-slate-500">{p.description}</p>
                            <ul className="text-xs space-y-2 border-t pt-4 border-slate-100 dark:border-slate-700">
                                <li>• Active Users: <strong>{p.maxActiveUsers === -1 ? 'Unlimited' : p.maxActiveUsers}</strong></li>
                                <li>• Routers: <strong>{p.maxRouters === -1 ? 'Unlimited' : p.maxRouters}</strong></li>
                                <li>• Staff Accounts: <strong>{p.maxStaff === -1 ? 'Unlimited' : p.maxStaff}</strong></li>
                                <li>• Support Level: <strong>{p.supportLevel}</strong></li>
                            </ul>
                            <button
                                onClick={() => navigate(`/checkout?type=SUBSCRIPTION_PLAN&id=${p.id}&slug=${p.slug}`)}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition"
                            >
                                Activate / Subscribe Plan
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── TAB 4: PLATFORM INVOICES ─── */}
            {activeTab === 'invoices' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold">Platform Tenant Invoices</h3>
                    <div className="responsive-table-wrapper">
                        <table className="w-full text-left text-sm min-w-[700px]">
                            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-500">
                                <tr>
                                    <th className="p-3">Invoice #</th>
                                    <th className="p-3">Tenant</th>
                                    <th className="p-3">Due Date</th>
                                    <th className="p-3">Amount</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {invoices.map((inv: any) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                                        <td className="p-3 font-mono font-bold">{inv.invoiceNumber}</td>
                                        <td className="p-3 font-semibold">{inv.Tenant?.name || inv.tenantId}</td>
                                        <td className="p-3 text-slate-400">{new Date(inv.dueDate).toLocaleDateString()}</td>
                                        <td className="p-3 font-black text-emerald-600">KES {(Number(inv.totalAmountCents) / 100).toLocaleString()}</td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 text-xs rounded-full font-bold ${inv.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {inv.paymentStatus}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SaaSMonetisationSuite;
