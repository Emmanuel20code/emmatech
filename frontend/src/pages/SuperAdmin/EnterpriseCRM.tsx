import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Building2, Users, DollarSign, TrendingUp, Filter, Search, Plus,
    FileText, CheckCircle2, XCircle, Clock, ChevronRight, Mail, Phone,
    Globe, MapPin, Download, Sparkles, Send, Edit, ShieldCheck, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../../components/Common/BackButton';

interface Lead {
    id: string;
    leadNumber: string;
    companyName: string;
    contactPerson: string;
    position: string;
    phone: string;
    email: string;
    subscriberCount: number;
    routerCount: number;
    monthlyBudget: string;
    notes: string;
    status: string;
    createdAt: string;
    enterprise_quotes?: any[];
}

interface Analytics {
    summary: {
        openQuotes: number;
        wonDeals: number;
        lostDeals: number;
        conversionRate: number;
        totalEnterpriseRevenueKes: number;
        averageDealSizeKes: number;
        totalPipelineValueKes: number;
    };
    leadsByStatus: Record<string, number>;
}

const STAGES = [
    { key: 'NEW', label: 'New Leads', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { key: 'CONTACTED', label: 'Contacted', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { key: 'QUALIFICATION', label: 'Qualification', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    { key: 'PROPOSAL_SENT', label: 'Proposal Sent', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    { key: 'AWAITING_APPROVAL', label: 'Awaiting Approval', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    { key: 'WON', label: 'Won Deals', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { key: 'LOST', label: 'Lost Deals', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
];

export const EnterpriseCRM: React.FC = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Quote Builder Form State
    const [quoteForm, setQuoteForm] = useState({
        monthlyCostKes: 45000,
        setupFeeKes: 15000,
        maxActiveUsers: -1,
        maxRouters: -1,
        smsAllocation: 10000,
        whatsappAllocation: 5000,
        storageAllocationMB: 10240,
        discountKes: 5000,
        contractDurationMonths: 12,
        termsAndConditions: 'Standard Enterprise SLA & 99.9% Uptime Guarantee applied.'
    });
    const [isCreatingQuote, setIsCreatingQuote] = useState(false);
    const [quoteMessage, setQuoteMessage] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [leadsRes, analyticsRes] = await Promise.all([
                axios.get('/api/v1/enterprise/superadmin/leads', { params: filterStatus ? { status: filterStatus } : {} }),
                axios.get('/api/v1/enterprise/superadmin/analytics')
            ]);
            setLeads(leadsRes.data.leads || []);
            setAnalytics(analyticsRes.data);
        } catch (err: any) {
            console.error('Failed to fetch CRM data', err);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateStatus = async (leadId: string, status: string) => {
        try {
            await axios.put(`/api/v1/enterprise/superadmin/leads/${leadId}/status`, { status });
            fetchData();
            if (selectedLead && selectedLead.id === leadId) {
                setSelectedLead(prev => prev ? { ...prev, status } : null);
            }
        } catch (err: any) {
            alert('Failed to update stage: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCreateQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLead) return;

        setIsCreatingQuote(true);
        setQuoteMessage('');

        try {
            const res = await axios.post('/api/v1/enterprise/superadmin/quotes', {
                leadId: selectedLead.id,
                ...quoteForm
            });

            if (res.data.id) {
                setQuoteMessage(`Quote ${res.data.quoteNumber} created and dispatched to ${selectedLead.email}`);
                setTimeout(() => {
                    setShowQuoteModal(false);
                    fetchData();
                }, 1500);
            }
        } catch (err: any) {
            setQuoteMessage('Failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsCreatingQuote(false);
        }
    };

    const exportToCSV = () => {
        const headers = ['Lead Number', 'Company Name', 'Contact Person', 'Email', 'Phone', 'Subscribers', 'Routers', 'Status', 'Date'];
        const rows = leads.map(l => [
            l.leadNumber,
            `"${l.companyName}"`,
            `"${l.contactPerson}"`,
            l.email,
            l.phone,
            l.subscriberCount,
            l.routerCount,
            l.status,
            new Date(l.createdAt).toLocaleDateString()
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Enterprise_Leads_Report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredLeads = leads.filter(l =>
        l.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans p-4 md:p-10 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <BackButton />
                    <div>
                        <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                            SUPER ADMIN • EXECUTIVE CRM
                        </span>
                        <h1 className="text-2xl md:text-3xl font-black text-white mt-1">Enterprise Sales CRM & Pipeline</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToCSV}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" /> Export CSV Report
                    </button>
                </div>
            </div>

            {/* Executive Analytics Metrics */}
            {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Enterprise Revenue (Won ARR)</span>
                        <p className="text-2xl font-black text-emerald-400">KES {analytics.summary.totalEnterpriseRevenueKes.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Open Pipeline Value</span>
                        <p className="text-2xl font-black text-sky-400">KES {analytics.summary.totalPipelineValueKes.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Won Deals / Conversion Rate</span>
                        <p className="text-2xl font-black text-white">{analytics.summary.wonDeals} <span className="text-xs text-slate-400">({analytics.summary.conversionRate}%)</span></p>
                    </div>
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Open Proposals Sent</span>
                        <p className="text-2xl font-black text-amber-400">{analytics.summary.openQuotes}</p>
                    </div>
                </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search company, contact person, email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                    <button
                        onClick={() => setFilterStatus('')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${!filterStatus ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                        All Leads ({leads.length})
                    </button>
                    {STAGES.map(s => (
                        <button
                            key={s.key}
                            onClick={() => setFilterStatus(s.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${filterStatus === s.key ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                        >
                            {s.label} ({analytics?.leadsByStatus[s.key] || 0})
                        </button>
                    ))}
                </div>
            </div>

            {/* Pipeline Stage Columns / Lead Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredLeads.map((lead) => {
                    const quotes = lead.enterprise_quotes || [];
                    const latestQuote = quotes.length > 0 ? quotes[quotes.length - 1] : null;

                    return (
                        <div
                            key={lead.id}
                            onClick={() => setSelectedLead(lead)}
                            className={`p-6 bg-slate-900 border ${selectedLead?.id === lead.id ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-800'} rounded-3xl cursor-pointer hover:border-slate-700 transition space-y-4 relative group`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{lead.leadNumber}</span>
                                    <h3 className="text-lg font-black text-white group-hover:text-sky-400 transition">{lead.companyName}</h3>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${STAGES.find(s => s.key === lead.status)?.color || 'bg-slate-800 text-slate-300'}`}>
                                    {lead.status}
                                </span>
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-300 font-medium">
                                <p className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-slate-400" /> {lead.contactPerson} ({lead.position || 'Contact'})</p>
                                <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" /> {lead.email}</p>
                                <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {lead.phone}</p>
                            </div>

                            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-400">
                                <span>{lead.subscriberCount} Subs • {lead.routerCount} Routers</span>
                                <span className="text-sky-400 flex items-center gap-1">Details <ChevronRight className="w-4 h-4" /></span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Selected Lead Drawer / Actions */}
            {selectedLead && (
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                            <span className="text-xs font-mono text-slate-400">{selectedLead.leadNumber}</span>
                            <h2 className="text-2xl font-black text-white">{selectedLead.companyName}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowQuoteModal(true)}
                                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                            >
                                <Sparkles className="w-4 h-4" /> Create Custom Quotation
                            </button>
                            <button onClick={() => setSelectedLead(null)} className="px-3 py-2 text-xs text-slate-400 hover:text-white">CLOSE</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-3">
                            <p className="text-xs font-black uppercase text-slate-400">Lead Stage Control:</p>
                            <div className="flex flex-wrap gap-2">
                                {STAGES.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => handleUpdateStatus(selectedLead.id, s.key)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedLead.status === s.key ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 text-slate-300">
                            <p><strong>Monthly Budget:</strong> {selectedLead.monthlyBudget || 'Flexible'}</p>
                            <p><strong>Notes:</strong> {selectedLead.notes || 'None provided'}</p>
                            <p><strong>Captured On:</strong> {new Date(selectedLead.createdAt).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Quote Builder Modal */}
            {showQuoteModal && selectedLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 text-white my-8">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <span className="text-xs font-mono text-sky-400">QUOTE BUILDER</span>
                                <h3 className="text-xl font-black">Generate Custom Enterprise Quote for {selectedLead.companyName}</h3>
                            </div>
                            <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
                        </div>

                        {quoteMessage && (
                            <div className="p-3 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-xl text-xs font-bold text-center">
                                {quoteMessage}
                            </div>
                        )}

                        <form onSubmit={handleCreateQuote} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">Monthly Cost (KES) *</label>
                                    <input
                                        type="number" required value={quoteForm.monthlyCostKes}
                                        onChange={e => setQuoteForm({ ...quoteForm, monthlyCostKes: Number(e.target.value) })}
                                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">Setup Fee (KES)</label>
                                    <input
                                        type="number" value={quoteForm.setupFeeKes}
                                        onChange={e => setQuoteForm({ ...quoteForm, setupFeeKes: Number(e.target.value) })}
                                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">Max Subscribers (-1 for Unlimited)</label>
                                    <input
                                        type="number" value={quoteForm.maxActiveUsers}
                                        onChange={e => setQuoteForm({ ...quoteForm, maxActiveUsers: Number(e.target.value) })}
                                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">Max Routers (-1 for Unlimited)</label>
                                    <input
                                        type="number" value={quoteForm.maxRouters}
                                        onChange={e => setQuoteForm({ ...quoteForm, maxRouters: Number(e.target.value) })}
                                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">SMS Allocation Credits</label>
                                    <input
                                        type="number" value={quoteForm.smsAllocation}
                                        onChange={e => setQuoteForm({ ...quoteForm, smsAllocation: Number(e.target.value) })}
                                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-300 mb-1">Discount Amount (KES)</label>
                                    <input
                                        type="number" value={quoteForm.discountKes}
                                        onChange={e => setQuoteForm({ ...quoteForm, discountKes: Number(e.target.value) })}
                                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-300 mb-1">Terms & SLA Agreements</label>
                                <textarea
                                    rows={3} value={quoteForm.termsAndConditions}
                                    onChange={e => setQuoteForm({ ...quoteForm, termsAndConditions: e.target.value })}
                                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setShowQuoteModal(false)} className="px-4 py-2 bg-slate-800 rounded-xl font-bold">Cancel</button>
                                <button type="submit" disabled={isCreatingQuote} className="px-6 py-2 bg-sky-500 text-white rounded-xl font-bold">
                                    {isCreatingQuote ? 'Generating Proposal...' : 'Issue & Send Custom Proposal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseCRM;
