import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Ticket, Plus, RefreshCw, Printer, Download, Copy, Check, Trash2,
    Search, Filter, Layers, CheckCircle2, Clock, AlertCircle, Sparkles,
    Eye, X, ArrowRight, ShieldCheck, Tag, FileSpreadsheet, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../components/Common/BackButton';
import ThemeToggle from '../components/Common/ThemeToggle';
import PageRefreshButton from '../components/Common/PageRefreshButton';

interface HotspotPackage {
    id: number;
    name: string;
    price: number;
    durationMinutes?: number;
    validity?: string;
    type?: string;
    downloadSpeed?: string;
    uploadSpeed?: string;
}

interface VoucherItem {
    id: string;
    code: string;
    packageId: number;
    price: number;
    plan: string;
    validity?: string;
    batch: string;
    status: 'AVAILABLE' | 'USED' | 'EXPIRED';
    usedAt?: string | null;
    createdAt: string;
}

interface VoucherStats {
    total: number;
    available: number;
    used: number;
    expired: number;
    batches: string[];
}

export default function HotspotVouchers() {
    const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
    const [packages, setPackages] = useState<HotspotPackage[]>([]);
    const [stats, setStats] = useState<VoucherStats>({ total: 0, available: 0, used: 0, expired: 0, batches: [] });
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'USED' | 'EXPIRED'>('ALL');
    const [batchFilter, setBatchFilter] = useState<string>('ALL');
    const [packageFilter, setPackageFilter] = useState<string>('ALL');
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    // Modals & Popups
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printBatchSelect, setPrintBatchSelect] = useState<string>('ALL');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Generation Form State
    const [genForm, setGenForm] = useState({
        packageId: '',
        count: 20,
        batch: '',
        prefix: 'JV',
        codeLength: 6
    });

    const printRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [vRes, sRes, pRes] = await Promise.allSettled([
                axios.get('/api/v1/admin/vouchers', {
                    params: {
                        status: statusFilter !== 'ALL' ? statusFilter : undefined,
                        batch: batchFilter !== 'ALL' ? batchFilter : undefined,
                        packageId: packageFilter !== 'ALL' ? packageFilter : undefined,
                        search: searchQuery ? searchQuery.trim() : undefined,
                        limit: 500
                    }
                }),
                axios.get('/api/v1/admin/vouchers/stats'),
                axios.get('/api/v1/admin/packages')
            ]);

            if (vRes.status === 'fulfilled') {
                setVouchers(Array.isArray(vRes.value.data) ? vRes.value.data : []);
            }
            if (sRes.status === 'fulfilled') {
                setStats(sRes.value.data || { total: 0, available: 0, used: 0, expired: 0, batches: [] });
            }
            if (pRes.status === 'fulfilled') {
                const pkgData = Array.isArray(pRes.value.data) ? pRes.value.data : (pRes.value.data?.packages || []);
                setPackages(pkgData);
                if (pkgData.length > 0 && !genForm.packageId) {
                    setGenForm(prev => ({ ...prev, packageId: String(pkgData[0].id) }));
                }
            }
        } catch (err) {
            console.error('Error fetching vouchers:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, batchFilter, packageFilter, searchQuery, genForm.packageId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleGenerateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!genForm.packageId) {
            alert('Please select a hotspot package for the vouchers.');
            return;
        }

        setIsGenerating(true);
        try {
            const batchName = genForm.batch.trim() || `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
            const res = await axios.post('/api/v1/admin/vouchers/generate', {
                packageId: Number(genForm.packageId),
                count: Number(genForm.count) || 10,
                batch: batchName,
                prefix: genForm.prefix.trim().toUpperCase(),
                codeLength: Number(genForm.codeLength) || 6
            });

            if (res.data?.success) {
                setIsGenerateModalOpen(false);
                setGenForm(prev => ({
                    ...prev,
                    batch: '',
                    count: 20
                }));
                await fetchData();
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to generate vouchers');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteVoucher = async (id: string, code: string) => {
        if (!window.confirm(`Are you sure you want to delete unused voucher code ${code}?`)) return;
        try {
            await axios.delete(`/api/v1/admin/vouchers/${id}`);
            setVouchers(prev => prev.filter(v => v.id !== id));
            setStats(prev => ({
                ...prev,
                total: Math.max(0, prev.total - 1),
                available: Math.max(0, prev.available - 1)
            }));
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete voucher');
        }
    };

    const handleDeleteBatch = async (batchName: string) => {
        if (!window.confirm(`Are you sure you want to delete all AVAILABLE vouchers in batch "${batchName}"? Used vouchers will be retained.`)) return;
        try {
            await axios.post('/api/v1/admin/vouchers/bulk-delete', { batch: batchName });
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete batch');
        }
    };

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleExportCSV = () => {
        if (vouchers.length === 0) {
            alert('No vouchers to export.');
            return;
        }

        const headers = ['Voucher Code', 'Plan', 'Price (KES)', 'Batch', 'Status', 'Created Date', 'Used Date'];
        const rows = vouchers.map(v => [
            `"${v.code}"`,
            `"${v.plan}"`,
            v.price,
            `"${v.batch}"`,
            `"${v.status}"`,
            `"${new Date(v.createdAt).toLocaleString()}"`,
            v.usedAt ? `"${new Date(v.usedAt).toLocaleString()}"` : '""'
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Hotspot-Vouchers-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        window.print();
    };

    const printFilteredVouchers = printBatchSelect === 'ALL'
        ? vouchers
        : vouchers.filter(v => v.batch === printBatchSelect);

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-16">
            {/* Top Bar Navigation & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <BackButton />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <Ticket size={22} />
                            </span>
                            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                                Hotspot Voucher Generator
                            </h1>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] font-medium mt-1">
                            Generate, manage, export, and print prepaid Wi-Fi vouchers for your hotspot subscribers.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <PageRefreshButton />
                    <ThemeToggle />
                    <button
                        id="generate-voucher-btn"
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus size={18} />
                        <span>Generate Vouchers</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Total Generated</span>
                        <Ticket size={18} className="text-sky-500" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-2">
                        {stats.total.toLocaleString()}
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)] font-semibold mt-1 block">All-time vouchers</span>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Available (Unused)</span>
                        <CheckCircle2 size={18} className="text-emerald-500" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-500 mt-2">
                        {stats.available.toLocaleString()}
                    </p>
                    <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Ready for customers</span>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Redeemed / Used</span>
                        <Clock size={18} className="text-amber-500" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-amber-500 mt-2">
                        {stats.used.toLocaleString()}
                    </p>
                    <span className="text-[11px] text-amber-600 font-semibold mt-1 block">Active / Past sessions</span>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Batches Created</span>
                        <Layers size={18} className="text-purple-500" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-2">
                        {(stats.batches || []).length}
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)] font-semibold mt-1 block">Batch groups</span>
                </div>
            </div>

            {/* Filter & Inventory Controls */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Search Field */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search by voucher code or prefix..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-500 placeholder-[var(--text-muted)]"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Action Buttons: Export, Print, Refresh */}
                    <div className="flex items-center flex-wrap gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold transition-colors"
                        >
                            <Download size={14} />
                            <span>Export CSV</span>
                        </button>

                        <button
                            onClick={() => setIsPrintModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold transition-colors"
                        >
                            <Printer size={14} />
                            <span>Print Sheet</span>
                        </button>

                        <button
                            onClick={fetchData}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold transition-colors"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Filter Pills and View Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center flex-wrap gap-2">
                        {/* Status Filters */}
                        {(['ALL', 'AVAILABLE', 'USED', 'EXPIRED'] as const).map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === st
                                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                            >
                                {st}
                            </button>
                        ))}

                        {/* Batch Filter Dropdown */}
                        {stats.batches && stats.batches.length > 0 && (
                            <select
                                value={batchFilter}
                                onChange={e => setBatchFilter(e.target.value)}
                                className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-500"
                            >
                                <option value="ALL">All Batches ({stats.batches.length})</option>
                                {stats.batches.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        )}

                        {/* Package Filter Dropdown */}
                        {packages.length > 0 && (
                            <select
                                value={packageFilter}
                                onChange={e => setPackageFilter(e.target.value)}
                                className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-500"
                            >
                                <option value="ALL">All Packages</option>
                                {packages.map(p => (
                                    <option key={p.id} value={String(p.id)}>{p.name} (KES {p.price})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* View Switcher */}
                    <div className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-subtle)] self-start sm:self-auto">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewMode === 'cards' ? 'bg-amber-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                            Cards
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewMode === 'table' ? 'bg-amber-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                            Table
                        </button>
                    </div>
                </div>
            </div>

            {/* Voucher List Content */}
            {loading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
                    <RefreshCw className="animate-spin text-amber-500" size={32} />
                    <p className="text-sm font-semibold text-[var(--text-muted)]">Loading voucher repository...</p>
                </div>
            ) : vouchers.length === 0 ? (
                <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-subtle)] rounded-3xl p-12 text-center max-w-lg mx-auto shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                        <Ticket size={28} />
                    </div>
                    <h3 className="text-lg font-black text-[var(--text-primary)] mb-1">No Hotspot Vouchers Found</h3>
                    <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
                        Generate a new batch of prepaid hotspot Wi-Fi voucher tokens to sell to your customers or distribute at your premises.
                    </p>
                    <button
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all"
                    >
                        Generate Your First Batch
                    </button>
                </div>
            ) : viewMode === 'cards' ? (
                /* Card View with Perforated Voucher Look */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {vouchers.map((v, i) => {
                        const isAvailable = v.status === 'AVAILABLE';
                        const isUsed = v.status === 'USED';
                        return (
                            <motion.div
                                key={v.id || i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                                className="group relative bg-[var(--bg-surface)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 flex"
                            >
                                {/* Left Voucher Stub */}
                                <div className="w-12 bg-slate-900 flex items-center justify-center relative select-none">
                                    <div className="absolute top-0 bottom-0 right-0 border-r-2 border-dashed border-white/20"></div>
                                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-[var(--bg-surface)] rounded-full"></div>
                                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-[var(--bg-surface)] rounded-full"></div>
                                    <span className="-rotate-90 text-white/40 text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                                        HOTSPOT
                                    </span>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 p-5 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                                                    Wi-Fi Voucher
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <code className="text-lg font-black text-[var(--text-primary)] font-mono tracking-wider bg-[var(--bg-surface-elevated)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] group-hover:border-amber-500/40 transition-colors">
                                                        {v.code}
                                                    </code>
                                                    <button
                                                        onClick={() => handleCopy(v.code)}
                                                        title="Copy Code"
                                                        className="p-1.5 text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                                                    >
                                                        {copiedCode === v.code ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-sm font-black text-[var(--text-primary)]">
                                                    KES {v.price}
                                                </p>
                                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1 ${isAvailable
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                    : isUsed
                                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                        : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                    {v.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-1 my-3 text-xs text-[var(--text-muted)]">
                                            <div className="flex justify-between">
                                                <span className="font-medium">Plan:</span>
                                                <span className="font-bold text-[var(--text-primary)]">{v.plan}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-medium">Batch:</span>
                                                <span className="font-semibold text-[var(--text-primary)] font-mono text-[11px]">{v.batch}</span>
                                            </div>
                                            {v.usedAt && (
                                                <div className="flex justify-between text-amber-600">
                                                    <span className="font-medium">Used At:</span>
                                                    <span>{new Date(v.usedAt).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs">
                                        <span className="text-[11px] text-[var(--text-muted)]">
                                            {new Date(v.createdAt).toLocaleDateString()}
                                        </span>
                                        {isAvailable && (
                                            <button
                                                onClick={() => handleDeleteVoucher(v.id, v.code)}
                                                title="Delete Unused Voucher"
                                                className="p-1 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                /* Tabular List View */
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                    <th className="py-3 px-4">Voucher Code</th>
                                    <th className="py-3 px-4">Package Plan</th>
                                    <th className="py-3 px-4">Price</th>
                                    <th className="py-3 px-4">Batch Name</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Created Date</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                                {vouchers.map(v => (
                                    <tr key={v.id} className="hover:bg-[var(--bg-surface-elevated)]/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-[var(--text-primary)]">{v.code}</span>
                                                <button
                                                    onClick={() => handleCopy(v.code)}
                                                    className="p-1 text-[var(--text-muted)] hover:text-amber-500 rounded"
                                                >
                                                    {copiedCode === v.code ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{v.plan}</td>
                                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">KES {v.price}</td>
                                        <td className="py-3 px-4 font-mono text-xs text-[var(--text-muted)]">{v.batch}</td>
                                        <td className="py-3 px-4">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${v.status === 'AVAILABLE'
                                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                : v.status === 'USED'
                                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                    : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                {v.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                                            {new Date(v.createdAt).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {v.status === 'AVAILABLE' && (
                                                <button
                                                    onClick={() => handleDeleteVoucher(v.id, v.code)}
                                                    className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* GENERATE VOUCHERS MODAL */}
            <AnimatePresence>
                {isGenerateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        <Ticket size={20} />
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-black text-[var(--text-primary)]">Generate Voucher Batch</h3>
                                        <p className="text-xs text-[var(--text-muted)]">Create pre-paid database-backed Wi-Fi tokens</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsGenerateModalOpen(false)}
                                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] rounded-xl"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleGenerateSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-2">
                                        Select Linked Hotspot Package *
                                    </label>
                                    <select
                                        value={genForm.packageId}
                                        onChange={e => setGenForm({ ...genForm, packageId: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-500"
                                        required
                                    >
                                        <option value="">-- Choose Hotspot Package --</option>
                                        {packages.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} — KES {p.price} {p.validity ? `(${p.validity})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-2">
                                            Quantity *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="500"
                                            value={genForm.count}
                                            onChange={e => setGenForm({ ...genForm, count: Math.max(1, Math.min(500, parseInt(e.target.value) || 1)) })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                                            required
                                        />
                                        <div className="flex gap-1.5 mt-1.5">
                                            {[10, 25, 50, 100].map(cnt => (
                                                <button
                                                    key={cnt}
                                                    type="button"
                                                    onClick={() => setGenForm({ ...genForm, count: cnt })}
                                                    className="px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[10px] font-bold text-[var(--text-muted)] hover:text-amber-500"
                                                >
                                                    {cnt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-2">
                                            Code Prefix (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. JV, CAFE, DEC"
                                            value={genForm.prefix}
                                            onChange={e => setGenForm({ ...genForm, prefix: e.target.value.toUpperCase() })}
                                            maxLength={6}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-xl text-sm font-bold uppercase focus:outline-none focus:border-amber-500 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-2">
                                            Batch Identifier
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. LOBBY-BATCH-01"
                                            value={genForm.batch}
                                            onChange={e => setGenForm({ ...genForm, batch: e.target.value.toUpperCase() })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-500 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase text-[var(--text-muted)] tracking-wider mb-2">
                                            Code Length
                                        </label>
                                        <select
                                            value={genForm.codeLength}
                                            onChange={e => setGenForm({ ...genForm, codeLength: Number(e.target.value) })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-500"
                                        >
                                            <option value={6}>6 Characters (Fast Entry)</option>
                                            <option value={8}>8 Characters (Standard)</option>
                                            <option value={10}>10 Characters (High Entropy)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs text-amber-600 space-y-1">
                                    <p className="font-bold">Summary Preview:</p>
                                    <p>Will generate <strong>{genForm.count}</strong> vouchers formatted like: <code className="font-mono bg-amber-500/20 px-1.5 py-0.5 rounded font-bold text-amber-700">{genForm.prefix ? `${genForm.prefix}-XXXXXX` : 'XXXXXX'}</code></p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsGenerateModalOpen(false)}
                                        className="flex-1 py-3 bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] rounded-xl font-bold text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isGenerating}
                                        className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Ticket size={16} />}
                                        <span>{isGenerating ? 'Generating...' : 'Start Generation'}</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* PRINT VOUCHER SHEET MODAL */}
            <AnimatePresence>
                {isPrintModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Printer size={20} className="text-amber-500" />
                                    <div>
                                        <h3 className="text-lg font-black text-[var(--text-primary)]">Printable Voucher Sheet</h3>
                                        <p className="text-xs text-[var(--text-muted)]">Ready-to-cut physical Wi-Fi access tokens</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={printBatchSelect}
                                        onChange={e => setPrintBatchSelect(e.target.value)}
                                        className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    >
                                        <option value="ALL">All Batches</option>
                                        {stats.batches.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handlePrint}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-bold rounded-xl text-xs shadow"
                                    >
                                        <Printer size={14} />
                                        <span>Print Now</span>
                                    </button>
                                    <button
                                        onClick={() => setIsPrintModalOpen(false)}
                                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Print Sheet Scrollable Preview */}
                            <div ref={printRef} className="p-6 overflow-y-auto flex-1 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3">
                                    {printFilteredVouchers.slice(0, 60).map((v, i) => (
                                        <div key={v.id || i} className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-white text-slate-900 text-center space-y-1.5 shadow-sm">
                                            <div className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                                WI-FI ACCESS PASS
                                            </div>
                                            <div className="font-mono text-base font-black tracking-widest bg-slate-100 py-1 px-2 rounded border border-slate-200">
                                                {v.code}
                                            </div>
                                            <div className="flex justify-between text-[11px] font-bold text-slate-700 px-1">
                                                <span>{v.plan}</span>
                                                <span>KES {v.price}</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-mono">
                                                {v.batch}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
