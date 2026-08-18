import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    MessageSquare, ShoppingCart, History, BarChart3, Settings,
    Zap, TrendingUp, AlertTriangle, CheckCircle2, Send,
    Download, RefreshCw, Plus, Search, X,
    Smartphone, Wallet, CreditCard,
    Users, Calendar, FileText, Trash2, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../components/Common/BackButton';
import ThemeToggle from '../components/Common/ThemeToggle';
import { useAuth } from '../context/AuthContext';

// ================================================================
// TYPES
// ================================================================

interface SmsPackage {
    id: string;
    name: string;
    smsCount: number;
    sellingPrice: number;
    description: string | null;
    isCustom: boolean;
    costPerSms: number;
}

interface SmsBalance {
    balance: number;
    usedCredits: number;
    purchasedCredits: number;
    lastPurchaseAt: string | null;
    lowBalanceThreshold: number;
}

interface SmsDashboardStats {
    balance: number;
    usedToday: number;
    usedThisMonth: number;
    totalPurchased: number;
    totalTransactions: number;
    lastPurchase: string | null;
    campaignSuccessRate: number;
}

interface SmsTransaction {
    id: string;
    createdAt: string;
    creditsAdded: number;
    amount: number;
    paymentMethod: string;
    status: string;
    invoiceNumber: string;
    paymentReference: string;
    sms_package?: { name: string; smsCount: number };
}

interface SmsCampaign {
    id: string;
    name: string;
    type: string;
    status: string;
    content: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    scheduledAt: string | null;
}

interface SmsTemplate {
    id: string;
    name: string;
    content: string;
    createdAt: string;
}

type ActiveTab = 'buy' | 'balance' | 'history' | 'campaigns' | 'settings';

// ================================================================
// HELPER COMPONENTS
// ================================================================

const formatAmount = (cents: number) => `KES ${(cents / 100).toFixed(2)}`;
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
        COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
        SENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${map[status] || 'bg-slate-100 text-slate-600'}`}>
            {status}
        </span>
    );
};

// ================================================================
// BUY SMS TAB
// ================================================================

const BuySmsTab = ({ balance, onPurchaseSuccess }: { balance: SmsBalance | null; onPurchaseSuccess: () => void }) => {
    const [packages, setPackages] = useState<SmsPackage[]>([]);
    const [selectedPkg, setSelectedPkg] = useState<SmsPackage | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'INTASEND'>('WALLET');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [pendingTrackingId, setPendingTrackingId] = useState<string | null>(null);
    const [pollCount, setPollCount] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        setIsLoading(true);
        axios.get<SmsPackage[]>('/api/v1/sms/packages')
            .then(r => setPackages(r.data))
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);

    // Poll for IntaSend completion
    useEffect(() => {
        if (!pendingTrackingId) return;
        pollRef.current = setInterval(async () => {
            setPollCount(c => c + 1);
            if (pollCount >= 24) { // 2 min max
                clearInterval(pollRef.current!);
                setPendingTrackingId(null);
                setMessage({ type: 'error', text: 'Payment timed out. If you paid, credits will be added automatically.' });
                setIsPurchasing(false);
                return;
            }
            try {
                const r = await axios.get<{ status: string; creditsAdded: number }>(`/api/v1/sms/purchase/status/${pendingTrackingId}`);
                if (r.data.status === 'COMPLETED') {
                    clearInterval(pollRef.current!);
                    setPendingTrackingId(null);
                    setIsPurchasing(false);
                    setMessage({ type: 'success', text: `🎉 Purchase complete! ${r.data.creditsAdded} SMS credits added.` });
                    onPurchaseSuccess();
                }
            } catch { }
        }, 5000);
        return () => clearInterval(pollRef.current!);
    }, [pendingTrackingId, pollCount]);

    const handlePurchase = async () => {
        if (!selectedPkg) return;
        setIsPurchasing(true);
        setMessage(null);
        try {
            if (paymentMethod === 'WALLET') {
                const r = await axios.post('/api/v1/sms/purchase/wallet', { packageId: selectedPkg.id });
                setMessage({ type: 'success', text: `✅ ${r.data.message}. Invoice: ${r.data.invoiceNumber}` });
                onPurchaseSuccess();
                setSelectedPkg(null);
                setIsPurchasing(false);
            } else {
                if (!phone) { setMessage({ type: 'error', text: 'Phone number is required for M-Pesa payment' }); setIsPurchasing(false); return; }
                const r = await axios.post('/api/v1/sms/purchase/intasend', { packageId: selectedPkg.id, phoneNumber: phone });
                setPendingTrackingId(r.data.smsTransactionId);
                setMessage({ type: 'success', text: '📱 STK Push sent! Check your phone and enter your M-Pesa PIN.' });
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Purchase failed. Please try again.' });
            setIsPurchasing(false);
        }
    };

    const popularPkg = packages.find(p => p.smsCount === 1000) || packages[Math.floor(packages.length / 2)];

    return (
        <div className="space-y-8">
            {/* Balance Banner */}
            {balance && (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-500/25">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white blur-3xl" />
                        <div className="absolute bottom-0 left-8 w-24 h-24 rounded-full bg-white blur-2xl" />
                    </div>
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-sky-200 text-sm font-semibold mb-1">Current SMS Balance</p>
                            <p className="text-5xl font-black">{balance.balance.toLocaleString()}</p>
                            <p className="text-sky-200 text-sm mt-1">credits available</p>
                        </div>
                        <div className="text-right">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                <MessageSquare className="w-8 h-8 text-white" />
                            </div>
                        </div>
                    </div>
                    {balance.balance <= balance.lowBalanceThreshold && balance.balance > 0 && (
                        <div className="mt-4 bg-amber-400/20 border border-amber-300/30 rounded-xl p-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
                            <p className="text-amber-100 text-sm font-medium">Low balance! Purchase more credits to keep your campaigns running.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Feedback */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`flex items-start gap-3 p-4 rounded-2xl border ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'}`}
                    >
                        {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                        <p className="text-sm font-medium">{message.text}</p>
                        <button onClick={() => setMessage(null)} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Packages Grid */}
            <div>
                <h2 className="text-xl font-black text-[var(--text-primary)] mb-4">Choose a Package</h2>
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-48 bg-[var(--bg-surface-elevated)] rounded-3xl animate-pulse" />)}
                    </div>
                ) : packages.length === 0 ? (
                    <div className="text-center py-16 text-[var(--text-muted)]">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">No SMS packages available yet.</p>
                        <p className="text-sm">Contact your administrator to set up packages.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {packages.map(pkg => {
                            const isPopular = pkg.id === popularPkg?.id;
                            const isSelected = selectedPkg?.id === pkg.id;
                            return (
                                <motion.button
                                    key={pkg.id}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setSelectedPkg(isSelected ? null : pkg)}
                                    className={`relative text-left p-6 rounded-3xl border-2 transition-all duration-200 ${isSelected
                                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 shadow-xl shadow-sky-500/20'
                                        : 'border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-sky-300'}`}
                                >
                                    {isPopular && (
                                        <div className="absolute -top-3 left-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                                            ⭐ Most Popular
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-sky-500' : 'bg-[var(--bg-surface-elevated)]'}`}>
                                            <MessageSquare className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
                                        </div>
                                        {isSelected && <CheckCircle2 className="w-6 h-6 text-sky-500" />}
                                    </div>
                                    <h3 className="text-lg font-black text-[var(--text-primary)] mb-1">{pkg.name}</h3>
                                    <p className="text-3xl font-black text-sky-600 dark:text-sky-400 mb-1">{pkg.smsCount.toLocaleString()} <span className="text-base font-bold text-[var(--text-secondary)]">SMS</span></p>
                                    <p className="text-2xl font-black text-[var(--text-primary)]">{formatAmount(pkg.sellingPrice)}</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{(pkg.costPerSms / 100).toFixed(3)} KES per SMS</p>
                                    {pkg.description && <p className="text-sm text-[var(--text-secondary)] mt-2">{pkg.description}</p>}
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Purchase Panel */}
            <AnimatePresence>
                {selectedPkg && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl p-6 shadow-xl"
                    >
                        <h3 className="text-lg font-black text-[var(--text-primary)] mb-5">Complete Purchase</h3>
                        <div className="grid sm:grid-cols-2 gap-6">
                            {/* Summary */}
                            <div className="bg-[var(--bg-surface-elevated)] rounded-2xl p-4 space-y-3">
                                <h4 className="font-bold text-[var(--text-secondary)] text-sm uppercase tracking-wider">Order Summary</h4>
                                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Package</span><span className="font-bold text-[var(--text-primary)]">{selectedPkg.name}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">SMS Credits</span><span className="font-bold text-[var(--text-primary)]">{selectedPkg.smsCount.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Price per SMS</span><span className="font-bold text-[var(--text-primary)]">{(selectedPkg.costPerSms / 100).toFixed(3)} KES</span></div>
                                <div className="border-t border-[var(--border-strong)] pt-3 flex justify-between">
                                    <span className="font-bold text-[var(--text-primary)]">Total</span>
                                    <span className="font-black text-xl text-sky-600 dark:text-sky-400">{formatAmount(selectedPkg.sellingPrice)}</span>
                                </div>
                            </div>

                            {/* Payment */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-[var(--text-secondary)] text-sm uppercase tracking-wider">Payment Method</h4>
                                {[
                                    { id: 'WALLET', label: 'Wallet Balance', icon: Wallet, desc: balance ? `Available: ${formatAmount(balance.balance * 0)}` : 'Instant deduction' },
                                    { id: 'INTASEND', label: 'M-Pesa (IntaSend)', icon: Smartphone, desc: 'STK Push to your phone' },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setPaymentMethod(m.id as any)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${paymentMethod === m.id ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] hover:border-sky-300'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === m.id ? 'bg-sky-500' : 'bg-[var(--bg-surface)]'}`}>
                                            <m.icon className={`w-5 h-5 ${paymentMethod === m.id ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-[var(--text-primary)]">{m.label}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{m.desc}</p>
                                        </div>
                                    </button>
                                ))}

                                {paymentMethod === 'INTASEND' && (
                                    <input
                                        type="tel"
                                        placeholder="Phone number (e.g. 0712345678)"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] focus:ring-2 focus:ring-sky-500 outline-none"
                                    />
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handlePurchase}
                                        disabled={isPurchasing}
                                        className="flex-1 btn-primary py-3.5 text-sm rounded-2xl"
                                    >
                                        {isPurchasing ? (
                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                {pendingTrackingId ? 'Waiting...' : 'Processing...'}</>
                                        ) : (
                                            <><ShoppingCart className="w-4 h-4" /> Quick Buy ({formatAmount(selectedPkg.sellingPrice)})</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => window.location.href = `/checkout?type=SMS_CREDITS&id=${selectedPkg.id}`}
                                        className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl transition flex items-center gap-1.5"
                                    >
                                        Full Checkout <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ================================================================
// BALANCE TAB
// ================================================================

const BalanceTab = ({ stats, onRefresh }: { stats: SmsDashboardStats | null; onRefresh: () => void }) => {
    const statCards = [
        { label: 'Current Balance', value: stats?.balance?.toLocaleString() ?? '—', unit: 'credits', color: 'sky', icon: MessageSquare },
        { label: 'Used Today', value: stats?.usedToday?.toLocaleString() ?? '—', unit: 'SMS', color: 'emerald', icon: Zap },
        { label: 'Used This Month', value: stats?.usedThisMonth?.toLocaleString() ?? '—', unit: 'SMS', color: 'violet', icon: TrendingUp },
        { label: 'Total Purchased', value: stats?.totalPurchased?.toLocaleString() ?? '—', unit: 'credits', color: 'amber', icon: ShoppingCart },
        { label: 'Transactions', value: stats?.totalTransactions?.toLocaleString() ?? '—', unit: 'total', color: 'blue', icon: CreditCard },
        { label: 'Campaign Success', value: stats ? `${stats.campaignSuccessRate}%` : '—', unit: 'rate', color: 'rose', icon: BarChart3 },
    ];

    const colorMap: Record<string, string> = {
        sky: 'from-sky-500 to-blue-600 shadow-sky-500/25',
        emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
        violet: 'from-violet-500 to-purple-600 shadow-violet-500/25',
        amber: 'from-amber-500 to-orange-600 shadow-amber-500/25',
        blue: 'from-blue-500 to-indigo-600 shadow-blue-500/25',
        rose: 'from-rose-500 to-pink-600 shadow-rose-500/25',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[var(--text-primary)]">SMS Balance Overview</h2>
                <button onClick={onRefresh} className="btn-secondary py-2 px-4 text-sm">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {statCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className={`relative overflow-hidden bg-gradient-to-br ${colorMap[card.color]} rounded-3xl p-5 text-white shadow-xl`}
                    >
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white blur-2xl" />
                        </div>
                        <div className="relative">
                            <card.icon className="w-7 h-7 mb-3 opacity-80" />
                            <p className="text-3xl font-black mb-0.5">{card.value}</p>
                            <p className="text-sm opacity-75">{card.label}</p>
                            <p className="text-xs opacity-60 uppercase tracking-wider mt-0.5">{card.unit}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {stats?.lastPurchase && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl p-5">
                    <p className="text-[var(--text-secondary)] text-sm font-semibold">Last Purchase</p>
                    <p className="text-[var(--text-primary)] font-bold mt-1">{formatDate(stats.lastPurchase)}</p>
                </div>
            )}
        </div>
    );
};

// ================================================================
// HISTORY TAB
// ================================================================

const HistoryTab = () => {
    const [transactions, setTransactions] = useState<SmsTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const r = await axios.get<{ data: SmsTransaction[]; total: number }>('/api/v1/sms/history', {
                params: { page, limit: 15, status: statusFilter || undefined }
            });
            setTransactions(r.data.data);
            setTotal(r.data.total);
        } catch { } finally { setIsLoading(false); }
    }, [page, statusFilter]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const handleExport = async () => {
        const r = await axios.get('/api/v1/sms/history/export', { responseType: 'blob' });
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url; a.download = `sms-history-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const filtered = transactions.filter(tx =>
        !search || tx.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
        tx.sms_package?.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by invoice or package..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                    <option value="">All Statuses</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PENDING">Pending</option>
                    <option value="FAILED">Failed</option>
                </select>
                <button onClick={handleExport} className="btn-secondary py-2.5 px-4 text-sm">
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-strong)] overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-muted)]">
                        <History className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">No purchase history yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[var(--bg-surface-elevated)] border-b border-[var(--border-strong)]">
                                <tr>
                                    {['Date', 'Package', 'Credits', 'Amount', 'Method', 'Invoice', 'Status'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                                {filtered.map((tx, idx) => (
                                    <tr key={`${tx.id}-${idx}`} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{formatDate(tx.createdAt)}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">{tx.sms_package?.name || 'Custom'}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-sky-600 dark:text-sky-400">{tx.creditsAdded?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-[var(--text-primary)]">{formatAmount(tx.amount)}</td>
                                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{tx.paymentMethod}</td>
                                        <td className="px-4 py-3 text-xs font-mono text-[var(--text-muted)]">{tx.invoiceNumber || '—'}</td>
                                        <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {total > 15 && (
                <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <p>Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Prev</button>
                        <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ================================================================
// CAMPAIGNS TAB
// ================================================================

const CampaignsTab = ({ balance }: { balance: SmsBalance | null }) => {
    const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
    const [templates, setTemplates] = useState<SmsTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', content: '', recipientType: 'ALL', templateId: '' });
    const [isSending, setIsSending] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [charCount, setCharCount] = useState(0);

    useEffect(() => {
        Promise.all([
            axios.get<SmsCampaign[]>('/api/v1/sms/campaigns'),
            axios.get<SmsTemplate[]>('/api/v1/sms/templates')
        ]).then(([c, t]) => { setCampaigns(c.data); setTemplates(t.data); })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);

    const handleCreate = async () => {
        if (!form.name || !form.content) { setMsg({ type: 'error', text: 'Name and content are required' }); return; }
        setIsSending(true); setMsg(null);
        try {
            const r = await axios.post<{ campaignId: string; recipientCount: number; creditsRequired: number }>('/api/v1/sms/campaigns', form);
            setMsg({ type: 'success', text: `✅ Campaign sent to ${r.data.recipientCount} recipients. ${r.data.creditsRequired} credits used.` });
            setShowCreate(false);
            setForm({ name: '', content: '', recipientType: 'ALL', templateId: '' });
            const updated = await axios.get<SmsCampaign[]>('/api/v1/sms/campaigns');
            setCampaigns(updated.data);
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to send campaign' });
        } finally { setIsSending(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-[var(--text-primary)]">SMS Campaigns</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Balance: <span className="font-bold text-sky-600 dark:text-sky-400">{balance?.balance?.toLocaleString() ?? 0} credits</span></p>
                </div>
                <button onClick={() => { setShowCreate(!showCreate); setMsg(null); }} className="btn-primary py-2.5 px-5 text-sm">
                    <Plus className="w-4 h-4" /> New Campaign
                </button>
            </div>

            <AnimatePresence>
                {msg && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border ${msg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 text-rose-800 dark:text-rose-200'}`}>
                        {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                        <p className="text-sm font-medium flex-1">{msg.text}</p>
                        <button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Form */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl p-6 space-y-4 shadow-xl">
                        <h3 className="font-black text-[var(--text-primary)] text-lg">Create SMS Campaign</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-[var(--text-secondary)] mb-1.5">Campaign Name</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Monthly Renewal Reminder"
                                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[var(--text-secondary)] mb-1.5">Recipients</label>
                                <select
                                    value={form.recipientType}
                                    onChange={e => setForm(f => ({ ...f, recipientType: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="ALL">All Subscribers</option>
                                    <option value="ACTIVE">Active Subscribers Only</option>
                                </select>
                            </div>
                        </div>
                        {templates.length > 0 && (
                            <div>
                                <label className="block text-sm font-bold text-[var(--text-secondary)] mb-1.5">Use Template (optional)</label>
                                <select
                                    value={form.templateId}
                                    onChange={e => {
                                        const tmpl = templates.find(t => t.id === e.target.value);
                                        setForm(f => ({ ...f, templateId: e.target.value, content: tmpl?.content || f.content }));
                                    }}
                                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="">No template</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-secondary)] mb-1.5">
                                Message Content <span className="text-[var(--text-muted)] font-normal ml-1">({charCount}/160 chars)</span>
                            </label>
                            <textarea
                                value={form.content}
                                onChange={e => { setForm(f => ({ ...f, content: e.target.value })); setCharCount(e.target.value.length); }}
                                rows={4}
                                placeholder="Type your SMS message here..."
                                className="w-full px-4 py-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] focus:ring-2 focus:ring-sky-500 outline-none text-sm resize-none"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleCreate} disabled={isSending} className="btn-primary flex-1">
                                {isSending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Campaign</>}
                            </button>
                            <button onClick={() => setShowCreate(false)} className="btn-secondary px-5">Cancel</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Campaign List */}
            {isLoading ? (
                <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-[var(--bg-surface-elevated)] rounded-2xl animate-pulse" />)}</div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-muted)]">
                    <Send className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-semibold">No campaigns yet</p>
                    <p className="text-sm">Create your first SMS campaign above</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(c => (
                        <div key={c.id} className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-[var(--text-primary)] truncate">{c.name}</h4>
                                        <StatusBadge status={c.status} />
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] truncate">{c.content}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.totalRecipients} recipients</span>
                                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" />{c.sentCount} sent</span>
                                        {c.failedCount > 0 && <span className="flex items-center gap-1 text-rose-500"><X className="w-3 h-3" />{c.failedCount} failed</span>}
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(c.createdAt)}</span>
                                    </div>
                                </div>
                                {c.totalRecipients > 0 && (
                                    <div className="text-right shrink-0">
                                        <p className="text-lg font-black text-sky-600 dark:text-sky-400">{Math.round((c.sentCount / c.totalRecipients) * 100)}%</p>
                                        <p className="text-xs text-[var(--text-muted)]">success</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ================================================================
// SETTINGS TAB
// ================================================================

const SettingsTab = () => {
    const [templates, setTemplates] = useState<SmsTemplate[]>([]);
    const [showAddTemplate, setShowAddTemplate] = useState(false);
    const [newTemplate, setNewTemplate] = useState({ name: '', content: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [gatewayInfo, setGatewayInfo] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            axios.get<SmsTemplate[]>('/api/v1/sms/templates'),
            axios.get('/api/v1/sms/gateway-info'),
        ]).then(([t, g]) => { setTemplates(t.data); setGatewayInfo(g.data); }).catch(() => { });
    }, []);

    const handleAddTemplate = async () => {
        if (!newTemplate.name || !newTemplate.content) { setMsg({ type: 'error', text: 'Name and content required' }); return; }
        setIsSaving(true);
        try {
            const r = await axios.post<SmsTemplate>('/api/v1/sms/templates', newTemplate);
            setTemplates(t => [r.data, ...t]);
            setNewTemplate({ name: '', content: '' });
            setShowAddTemplate(false);
            setMsg({ type: 'success', text: 'Template saved' });
        } catch (e: any) { setMsg({ type: 'error', text: e.response?.data?.error || 'Failed' }); }
        finally { setIsSaving(false); }
    };

    const handleDeleteTemplate = async (id: string) => {
        await axios.delete(`/api/v1/sms/templates/${id}`);
        setTemplates(t => t.filter(x => x.id !== id));
    };

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Gateway Info */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl p-6">
                <h3 className="font-black text-[var(--text-primary)] text-lg mb-4">SMS Gateway</h3>
                {gatewayInfo?.configured ? (
                    <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                            <span className="text-[var(--text-secondary)] text-sm">Provider</span>
                            <span className="font-bold text-[var(--text-primary)] text-sm">{gatewayInfo.provider}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[var(--border-subtle)]">
                            <span className="text-[var(--text-secondary)] text-sm">Sender ID</span>
                            <span className="font-bold text-[var(--text-primary)] text-sm">{gatewayInfo.senderId || 'Default'}</span>
                        </div>
                        <div className="flex justify-between py-2">
                            <span className="text-[var(--text-secondary)] text-sm">Tax Rate</span>
                            <span className="font-bold text-[var(--text-primary)] text-sm">{gatewayInfo.taxRate}%</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" /><span className="text-sm font-bold">Gateway Active</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-bold text-sm">No SMS Gateway Configured</p>
                            <p className="text-xs mt-0.5">Contact your Super Admin to configure an SMS provider.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Templates */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-[var(--text-primary)] text-lg">SMS Templates</h3>
                    <button onClick={() => setShowAddTemplate(!showAddTemplate)} className="btn-primary py-2 px-4 text-sm">
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>

                {msg && (
                    <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {msg.text}
                    </div>
                )}

                <AnimatePresence>
                    {showAddTemplate && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                            <div className="space-y-3 p-4 bg-[var(--bg-surface-elevated)] rounded-2xl">
                                <input
                                    value={newTemplate.name}
                                    onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
                                    placeholder="Template name"
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-sky-500"
                                />
                                <textarea
                                    value={newTemplate.content}
                                    onChange={e => setNewTemplate(t => ({ ...t, content: e.target.value }))}
                                    rows={3}
                                    placeholder="Template content..."
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleAddTemplate} disabled={isSaving} className="btn-primary py-2 px-4 text-sm flex-1">
                                        {isSaving ? 'Saving...' : 'Save Template'}
                                    </button>
                                    <button onClick={() => setShowAddTemplate(false)} className="btn-secondary py-2 px-3 text-sm">Cancel</button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {templates.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-sm text-center py-6">No templates yet. Add one above.</p>
                ) : (
                    <div className="space-y-3">
                        {templates.map(t => (
                            <div key={t.id} className="flex items-start gap-3 p-3 bg-[var(--bg-surface-elevated)] rounded-2xl">
                                <FileText className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[var(--text-primary)] text-sm">{t.name}</p>
                                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{t.content}</p>
                                </div>
                                <button onClick={() => handleDeleteTemplate(t.id)} className="shrink-0 p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-500 text-[var(--text-muted)] transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ================================================================
// MAIN PAGE
// ================================================================

const SMSCredits = () => {
    const { logout } = useAuth();
    const [activeTab, setActiveTab] = useState<ActiveTab>('buy');
    const [balance, setBalance] = useState<SmsBalance | null>(null);
    const [stats, setStats] = useState<SmsDashboardStats | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    const fetchAll = useCallback(async () => {
        setIsLoadingStats(true);
        try {
            const [balRes, statsRes] = await Promise.all([
                axios.get<SmsBalance>('/api/v1/sms/balance'),
                axios.get<SmsDashboardStats>('/api/v1/sms/stats'),
            ]);
            setBalance(balRes.data);
            setStats(statsRes.data);
        } catch (e: any) {
            if (axios.isAxiosError(e) && e.response?.status === 401) logout();
        } finally {
            setIsLoadingStats(false);
        }
    }, [logout]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const tabs: { id: ActiveTab; label: string; icon: any }[] = [
        { id: 'buy', label: 'Buy SMS', icon: ShoppingCart },
        { id: 'balance', label: 'SMS Balance', icon: BarChart3 },
        { id: 'history', label: 'History', icon: History },
        { id: 'campaigns', label: 'Campaigns', icon: Send },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                        <MessageSquare className="w-5 h-5 text-sky-500" /> Communication
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm mt-0.5">SMS Credits & Campaigns</p>
                </div>
                
                {/* Tab Bar */}
                <div className="flex bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-subtle)] overflow-x-auto scrollbar-hide max-w-full">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === tab.id
                                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="w-full">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                    >
                        {activeTab === 'buy' && <BuySmsTab balance={balance} onPurchaseSuccess={fetchAll} />}
                        {activeTab === 'balance' && <BalanceTab stats={stats} onRefresh={fetchAll} />}
                        {activeTab === 'history' && <HistoryTab />}
                        {activeTab === 'campaigns' && <CampaignsTab balance={balance} />}
                        {activeTab === 'settings' && <SettingsTab />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default SMSCredits;
