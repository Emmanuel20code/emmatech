import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DollarSign, Clock, CheckCircle, XCircle, RefreshCw, Plus, Filter,
    Download, Shield, Zap, Search, AlertTriangle, FileText, ChevronDown,
    UserCheck, Gift, Activity, RotateCcw, X, Save, ArrowRight
} from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Subscriber { id: string; name?: string; phoneNumber: string; email?: string; }
interface Payment { id: string; mpesaReceiptNumber: string; amount: number; completedAt: string; }

interface RefundItem {
    id: string;
    type: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'WALLET_CREDIT' | 'PACKAGE_EXTENSION' | 'VOUCHER_REPLACEMENT' | 'FREE_DATA' | 'MANUAL_COMPENSATION' | 'GOODWILL_CREDIT';
    category: 'NETWORK_OUTAGE' | 'ROUTER_FAILURE' | 'POWER_FAILURE' | 'PAYMENT_FAILURE' | 'AUTH_FAILURE' | 'SLOW_INTERNET' | 'MAINTENANCE' | 'GOODWILL' | 'CUSTOM';
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
    amount: number;
    extensionMinutes?: number;
    reason: string;
    notes?: string;
    evidenceUrl?: string;
    createdAt: string;
    subscriber?: Subscriber;
    payment?: Payment;
}

interface RuleItem {
    id: string;
    name: string;
    triggerType: string;
    downtimeThresholdMinutes: number;
    compensationType: string;
    compensationValue: number;
    autoApprove: boolean;
    isEnabled: boolean;
}

interface StatsSummary {
    total: number;
    pending: number;
    approved: number;
    completed: number;
    rejected: number;
    totalRefunded: number;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const REFUND_TYPES = [
    { value: 'FULL_REFUND', label: 'Full Refund' },
    { value: 'PARTIAL_REFUND', label: 'Partial Refund' },
    { value: 'WALLET_CREDIT', label: 'Wallet Credit' },
    { value: 'PACKAGE_EXTENSION', label: 'Package Extension' },
    { value: 'VOUCHER_REPLACEMENT', label: 'Voucher Replacement' },
    { value: 'FREE_DATA', label: 'Free Data Allocation' },
    { value: 'MANUAL_COMPENSATION', label: 'Manual Compensation' },
    { value: 'GOODWILL_CREDIT', label: 'Goodwill Credit' },
];

const CATEGORIES = [
    { value: 'NETWORK_OUTAGE', label: 'Network Outage' },
    { value: 'ROUTER_FAILURE', label: 'Router Failure' },
    { value: 'POWER_FAILURE', label: 'Power Failure' },
    { value: 'PAYMENT_FAILURE', label: 'Payment Completed / Package Inactive' },
    { value: 'AUTH_FAILURE', label: 'Authentication Failure' },
    { value: 'SLOW_INTERNET', label: 'Slow Internet / Degradation' },
    { value: 'MAINTENANCE', label: 'Maintenance Window' },
    { value: 'GOODWILL', label: 'Goodwill Compensation' },
    { value: 'CUSTOM', label: 'Custom Reason' },
];

const fmtKES = (amount: number) => `KES ${Math.round(Number(amount) || 0).toLocaleString('en-US')}`;

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

const RefundsManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'requests' | 'issue' | 'rules'>('requests');
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [refunds, setRefunds] = useState<RefundItem[]>([]);
    const [rules, setRules] = useState<RuleItem[]>([]);
    const [stats, setStats] = useState<StatsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Issue Modal / Form State
    const [subSearch, setSubSearch] = useState('');
    const [subscribersList, setSubscribersList] = useState<Subscriber[]>([]);
    const [selectedSub, setSelectedSub] = useState<Subscriber | null>(null);
    const [issueForm, setIssueForm] = useState({
        type: 'PACKAGE_EXTENSION',
        category: 'NETWORK_OUTAGE',
        amountKES: '',
        extensionValue: '1',
        extensionUnit: 'DAYS', // HOURS, DAYS, WEEKS, MONTHS
        reason: '',
        notes: '',
        evidenceUrl: '',
        autoExecute: true,
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Rule Form State
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [ruleForm, setRuleForm] = useState({
        name: 'Major Outage Compensation',
        triggerType: 'ROUTER_DOWNTIME',
        downtimeThresholdMinutes: 60,
        compensationType: 'PACKAGE_EXTENSION',
        compensationValue: 60,
        autoApprove: true,
        isEnabled: true,
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [refundsRes, statsRes, rulesRes] = await Promise.allSettled([
                axios.get('/api/v1/admin/refunds', { params: { status: statusFilter, category: categoryFilter, search: searchTerm } }),
                axios.get('/api/v1/admin/refunds/stats'),
                axios.get('/api/v1/admin/refunds/rules'),
            ]);

            if (refundsRes.status === 'fulfilled') setRefunds(refundsRes.value.data.refunds || []);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.summary || null);
            if (rulesRes.status === 'fulfilled') setRules(rulesRes.value.data.rules || []);
        } catch (e) {
            console.error('[RefundsMgmt] Failed to load data:', e);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, categoryFilter, searchTerm]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Search subscribers for issue form
    useEffect(() => {
        if (!subSearch || subSearch.length < 2) {
            setSubscribersList([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await axios.get('/api/v1/admin/reports/subscribers');
                const subs: Subscriber[] = (res.data.subscribers || []).filter((s: any) =>
                    (s.name && s.name.toLowerCase().includes(subSearch.toLowerCase())) ||
                    (s.phone && s.phone.includes(subSearch))
                );
                setSubscribersList(subs);
            } catch (e) { console.error(e); }
        }, 300);
        return () => clearTimeout(timer);
    }, [subSearch]);

    // Workflow Actions
    const handleTransition = async (id: string, action: 'APPROVE' | 'REJECT' | 'CANCEL' | 'EXECUTE') => {
        setActionLoading(id);
        try {
            let rejectionReason = '';
            if (action === 'REJECT') {
                rejectionReason = prompt('Enter rejection reason:') || 'Rejected by tenant manager';
                if (!rejectionReason) { setActionLoading(null); return; }
            }
            await axios.put(`/api/v1/admin/refunds/${id}/status`, { action, rejectionReason });
            await fetchData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    // Create Refund Request
    const handleCreateRefund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSub) { setFormError('Please select a subscriber first'); return; }
        if (!issueForm.reason) { setFormError('Please provide a reason'); return; }

        setFormLoading(true);
        setFormError('');
        setFormSuccess('');

        try {
            // Calculate minutes or amount
            let extensionMinutes = 0;
            const val = Number(issueForm.extensionValue) || 1;
            if (issueForm.extensionUnit === 'HOURS') extensionMinutes = val * 60;
            else if (issueForm.extensionUnit === 'DAYS') extensionMinutes = val * 1440;
            else if (issueForm.extensionUnit === 'WEEKS') extensionMinutes = val * 10080;
            else if (issueForm.extensionUnit === 'MONTHS') extensionMinutes = val * 43200;

            const amountCents = issueForm.amountKES ? Math.round(Number(issueForm.amountKES) * 100) : 0;

            await axios.post('/api/v1/admin/refunds', {
                subscriberId: selectedSub.id,
                type: issueForm.type,
                category: issueForm.category,
                amount: amountCents,
                extensionMinutes,
                reason: issueForm.reason,
                notes: issueForm.notes,
                evidenceUrl: issueForm.evidenceUrl,
                autoExecute: issueForm.autoExecute,
            });

            setFormSuccess('Refund / Compensation successfully issued and executed!');
            setIssueForm({ type: 'PACKAGE_EXTENSION', category: 'NETWORK_OUTAGE', amountKES: '', extensionValue: '1', extensionUnit: 'DAYS', reason: '', notes: '', evidenceUrl: '', autoExecute: true });
            setSelectedSub(null);
            setSubSearch('');
            await fetchData();
        } catch (e: any) {
            setFormError(e.response?.data?.error || 'Failed to submit refund request');
        } finally {
            setFormLoading(false);
        }
    };

    // Save Rule
    const handleSaveRule = async () => {
        try {
            await axios.post('/api/v1/admin/refunds/rules', ruleForm);
            setShowRuleModal(false);
            await fetchData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to save rule');
        }
    };

    // Trigger Outage Compensation Engine
    const handleTriggerOutageEval = async () => {
        if (!confirm('Run automated outage evaluation across all active subscribers?')) return;
        try {
            const res = await axios.post('/api/v1/admin/refunds/evaluate-outages');
            alert(`Evaluated ${res.data.evaluated} subscribers. Issued ${res.data.compensated} automated compensations.`);
            await fetchData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Outage evaluation failed');
        }
    };

    // Export CSV
    const exportCSV = async () => {
        try {
            const res = await axios.get('/api/v1/admin/refunds/reports?format=csv', { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a'); a.href = url; a.download = 'refunds-report.csv'; a.click();
            URL.revokeObjectURL(url);
        } catch (e) { console.error('Export failed:', e); }
    };

    const statusBadge = (s: string) => {
        const map: Record<string, { color: string; icon: React.ReactNode }> = {
            COMPLETED: { color: 'bg-emerald-500/10 text-emerald-600', icon: <CheckCircle className="w-3 h-3" /> },
            APPROVED: { color: 'bg-sky-500/10 text-sky-600', icon: <CheckCircle className="w-3 h-3" /> },
            SUBMITTED: { color: 'bg-amber-500/10 text-amber-600', icon: <Clock className="w-3 h-3" /> },
            REJECTED: { color: 'bg-rose-500/10 text-rose-600', icon: <XCircle className="w-3 h-3" /> },
            CANCELLED: { color: 'bg-slate-500/10 text-slate-600', icon: <XCircle className="w-3 h-3" /> },
        };
        const st = map[s] || map.SUBMITTED;
        return (
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${st.color}`}>
                {st.icon} {s}
            </span>
        );
    };

    return (
        <div className="space-y-6 pb-8">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-sky-500" /> Refunds & Compensation
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Service recovery, customer credits, and outage compensations</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={exportCSV} className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500 rounded-xl text-xs font-bold text-[var(--text-secondary)] transition-all">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button onClick={handleTriggerOutageEval} className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-xl text-xs font-bold transition-all">
                        <Zap className="w-4 h-4" /> Auto Outage Eval
                    </button>
                    <button onClick={() => setActiveTab('issue')} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all">
                        <Plus className="w-4 h-4" /> Issue Refund
                    </button>
                </div>
            </div>

            {/* ── Summary Stats ── */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                        <div className="text-2xl font-black text-[var(--text-primary)]">{fmtKES(stats.totalRefunded)}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Total Refunded</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                        <div className="text-2xl font-black text-amber-600">{stats.pending}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Pending</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                        <div className="text-2xl font-black text-sky-600">{stats.approved}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Approved</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                        <div className="text-2xl font-black text-emerald-600">{stats.completed}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Completed</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                        <div className="text-2xl font-black text-rose-600">{stats.rejected}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Rejected</div>
                    </div>
                </div>
            )}

            {/* ── Tabs Navigation ── */}
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <button onClick={() => setActiveTab('requests')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Refund Requests ({refunds.length})
                </button>
                <button onClick={() => setActiveTab('issue')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'issue' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Issue Refund / Extension
                </button>
                <button onClick={() => setActiveTab('rules')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'rules' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Outage Compensation Rules ({rules.length})
                </button>
            </div>

            {/* ── TAB 1: REFUND REQUESTS TABLE ── */}
            {activeTab === 'requests' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input
                                    type="text"
                                    placeholder="Search subscriber, phone, reason..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] pl-9 pr-4 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500"
                                />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                <option value="">All Statuses</option>
                                <option value="SUBMITTED">Submitted</option>
                                <option value="APPROVED">Approved</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                                className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                <option value="">All Categories</option>
                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <button onClick={fetchData} className="p-2 hover:bg-[var(--bg-surface-elevated)] rounded-xl text-[var(--text-muted)] transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : refunds.length === 0 ? (
                        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                            <RotateCcw className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                            <p className="text-[var(--text-muted)] font-semibold">No refund requests found</p>
                        </div>
                    ) : (
                        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--border-subtle)] text-xs font-black uppercase text-[var(--text-muted)]">
                                            <th className="text-left py-3 px-4">Date & Subscriber</th>
                                            <th className="text-left py-3 px-4">Type & Category</th>
                                            <th className="text-left py-3 px-4 text-center">Compensation</th>
                                            <th className="text-left py-3 px-4">Status & Reason</th>
                                            <th className="text-right py-3 px-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {refunds.map((r, idx) => (
                                            <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="text-[10px] font-mono text-[var(--text-muted)] mb-0.5">{new Date(r.createdAt).toLocaleDateString()}</div>
                                                    <div className="font-bold text-[var(--text-primary)]">{r.subscriber?.name || 'Anonymous'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-xs font-bold text-[var(--text-primary)]">{r.type.replace('_', ' ')}</div>
                                                    <div className="text-[10px] text-[var(--text-muted)] uppercase">{r.category.replace('_', ' ')}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="font-black text-sky-500">
                                                        {r.amount > 0 ? fmtKES(r.amount) : r.extensionMinutes ? `+${Math.round(r.extensionMinutes / 60)}h` : 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {statusBadge(r.status)}
                                                        <div className="text-[10px] text-[var(--text-muted)] max-w-[150px] truncate">{r.reason}</div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {r.status === 'SUBMITTED' && (
                                                            <>
                                                                <button onClick={() => handleTransition(r.id, 'APPROVE')} disabled={actionLoading === r.id}
                                                                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg text-xs font-bold transition-all">
                                                                    Approve
                                                                </button>
                                                                <button onClick={() => handleTransition(r.id, 'REJECT')} disabled={actionLoading === r.id}
                                                                    className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg text-xs font-bold transition-all">
                                                                    Reject
                                                                </button>
                                                            </>
                                                        )}
                                                        {r.status === 'APPROVED' && (
                                                            <button onClick={() => handleTransition(r.id, 'EXECUTE')} disabled={actionLoading === r.id}
                                                                className="px-2 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-bold transition-all">
                                                                Execute
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB 2: ISSUE REFUND FORM ── */}
            {activeTab === 'issue' && (
                <div className="max-w-3xl mx-auto bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-8 shadow-md">
                    <h2 className="text-lg font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
                        <Gift className="w-5 h-5 text-sky-500" /> Issue Customer Refund / Compensation
                    </h2>

                    {formSuccess && (
                        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-2xl flex items-center gap-3 font-semibold text-sm">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" /> {formSuccess}
                        </div>
                    )}
                    {formError && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 rounded-2xl flex items-center gap-3 font-semibold text-sm">
                            <XCircle className="w-5 h-5 flex-shrink-0" /> {formError}
                        </div>
                    )}

                    <form onSubmit={handleCreateRefund} className="space-y-6">

                        {/* Step 1: Subscriber Search */}
                        <div>
                            <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">1. Select Subscriber</label>
                            {selectedSub ? (
                                <div className="flex items-center justify-between p-4 bg-[var(--bg-surface-elevated)] border border-sky-500/30 rounded-2xl">
                                    <div>
                                        <div className="font-black text-[var(--text-primary)]">{selectedSub.name || 'Anonymous'}</div>
                                        <div className="text-xs text-[var(--text-muted)] font-mono">{selectedSub.phoneNumber}</div>
                                    </div>
                                    <button type="button" onClick={() => setSelectedSub(null)} className="text-xs text-rose-500 font-bold hover:underline">
                                        Change
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input
                                        type="text"
                                        placeholder="Search subscriber by phone number or name..."
                                        value={subSearch}
                                        onChange={e => setSubSearch(e.target.value)}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500"
                                    />
                                    {subscribersList.length > 0 && (
                                        <div className="absolute z-20 left-0 right-0 top-full mt-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                                            {subscribersList.map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => { setSelectedSub(s); setSubSearch(''); setSubscribersList([]); }}
                                                    className="w-full text-left px-4 py-3 hover:bg-[var(--bg-surface-elevated)] border-b border-[var(--border-subtle)] last:border-0"
                                                >
                                                    <div className="font-bold text-[var(--text-primary)]">{s.name || 'Anonymous'}</div>
                                                    <div className="text-xs text-[var(--text-muted)] font-mono">{s.phoneNumber}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Step 2: Refund Type & Category */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">2. Compensation Type</label>
                                <select
                                    value={issueForm.type}
                                    onChange={e => setIssueForm({ ...issueForm, type: e.target.value })}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                                >
                                    {REFUND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">3. Service Issue Category</label>
                                <select
                                    value={issueForm.category}
                                    onChange={e => setIssueForm({ ...issueForm, category: e.target.value })}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                                >
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Step 3: Value Inputs */}
                        {issueForm.type === 'PACKAGE_EXTENSION' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">Extension Duration</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={issueForm.extensionValue}
                                        onChange={e => setIssueForm({ ...issueForm, extensionValue: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">Time Unit</label>
                                    <select
                                        value={issueForm.extensionUnit}
                                        onChange={e => setIssueForm({ ...issueForm, extensionUnit: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                                    >
                                        <option value="HOURS">Hours</option>
                                        <option value="DAYS">Days</option>
                                        <option value="WEEKS">Weeks</option>
                                        <option value="MONTHS">Months</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">Refund Amount (KES)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 250"
                                    value={issueForm.amountKES}
                                    onChange={e => setIssueForm({ ...issueForm, amountKES: e.target.value })}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500"
                                />
                            </div>
                        )}

                        {/* Step 4: Reason & Notes */}
                        <div>
                            <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">4. Reason & Description</label>
                            <textarea
                                rows={3}
                                placeholder="Explain reason for refund/compensation..."
                                value={issueForm.reason}
                                onChange={e => setIssueForm({ ...issueForm, reason: e.target.value })}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500"
                            />
                        </div>

                        {/* Auto-Execute Checkbox */}
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={issueForm.autoExecute}
                                onChange={e => setIssueForm({ ...issueForm, autoExecute: e.target.checked })}
                                className="w-4 h-4 accent-sky-500 rounded"
                            />
                            <span className="text-xs font-bold text-[var(--text-secondary)]">Approve and execute compensation immediately</span>
                        </label>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={formLoading || !selectedSub || !issueForm.reason}
                            className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl text-sm shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {formLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Submit Refund Request
                        </button>
                    </form>
                </div>
            )}

            {/* ── TAB 3: OUTAGE COMPENSATION RULES ── */}
            {activeTab === 'rules' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--text-muted)]">Configure downtime thresholds for automated subscriber compensations</p>
                        <button onClick={() => setShowRuleModal(true)} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all">
                            <Plus className="w-4 h-4" /> Add Rule
                        </button>
                    </div>

                    {rules.length === 0 ? (
                        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                            <Zap className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                            <p className="text-[var(--text-muted)] font-semibold">No compensation rules configured yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {rules.map(rule => (
                                <div key={rule.id} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-black text-[var(--text-primary)] text-base">{rule.name}</h3>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${rule.isEnabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-600'}`}>
                                            {rule.isEnabled ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] space-y-1">
                                        <div>Trigger: <strong className="text-[var(--text-primary)]">{rule.triggerType}</strong></div>
                                        <div>Downtime Threshold: <strong className="text-[var(--text-primary)]">{rule.downtimeThresholdMinutes} minutes</strong></div>
                                        <div>Reward: <strong className="text-[var(--text-primary)]">{rule.compensationValue} {rule.compensationType === 'PACKAGE_EXTENSION' ? 'mins extension' : 'KES'}</strong></div>
                                        <div>Auto Approve: <strong className="text-[var(--text-primary)]">{rule.autoApprove ? 'Yes' : 'No'}</strong></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RefundsManagement;
