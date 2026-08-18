import React, { useState, useEffect } from 'react';
import {
    Plus, Wifi, Clock, Database, Trash2, Edit, Save, X, Users, Zap,
    RefreshCw, Shield, AlertCircle, TrendingUp, DollarSign, Smartphone, CheckCircle2, Lock, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import BackButton from '../components/Common/BackButton';

interface PackageStats {
    salesCount: number;
    revenue: number;
    activeUsers: number;
    expiredSessions: number;
}

interface Package {
    id: number;
    name: string;
    price: string;
    type: 'HOTSPOT' | 'ISP';
    durationMinutes: number | null;
    dataLimitBytes: string | null;
    downloadSpeed: string;
    uploadSpeed: string;
    validity: number;
    sharedUsers: number;
    expiryAction: 'SUSPEND' | 'DELETE' | 'NOTIFY';
    isEnabled: boolean;
    description: string;
    stats?: PackageStats;
}

const Packages = () => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingPackage, setEditingPackage] = useState<Package | null>(null);
    const [syncingId, setSyncingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [packageTypeFilter, setPackageTypeFilter] = useState<'ALL' | 'HOTSPOT' | 'PPPOE'>('ALL');

    // Live Captive Portal Preview State
    const [showLivePreview, setShowLivePreview] = useState(true);
    const [previewSelectedPackage, setPreviewSelectedPackage] = useState<Package | null>(null);
    const [previewPhone, setPreviewPhone] = useState('');
    const [previewVoucher, setPreviewVoucher] = useState('');
    const [previewTab, setPreviewTab] = useState<'MPESA' | 'VOUCHER'>('MPESA');
    const [previewStatus, setPreviewStatus] = useState<'idle' | 'processing' | 'waiting_pin' | 'success' | 'failed'>('idle');
    const [previewMsg, setPreviewMsg] = useState('');

    const initialFormData = {
        name: '',
        price: '',
        type: 'HOTSPOT',
        durationValue: '60',
        durationType: 'minutes', // 'minutes', 'hours', 'days'
        dataLimitEnabled: false,
        dataLimitValue: '1024', // MB
        downloadSpeed: '2M',
        uploadSpeed: '1M',
        validity: '30',
        sharedUsers: '1',
        expiryAction: 'SUSPEND',
        description: '',
        isVisible: true
    };

    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            const response = await axios.get('/api/v1/admin/packages');
            const data = response.data;
            let loaded: Package[] = [];
            if (Array.isArray(data)) {
                loaded = data;
            } else if (data && typeof data === 'object' && Array.isArray((data as any).packages)) {
                loaded = (data as any).packages;
            } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
                loaded = (data as any).data;
            }
            setPackages(loaded);
            if (loaded.length > 0) {
                setPreviewSelectedPackage(prev => prev || loaded[0]);
            }
        } catch (err: unknown) {
            console.error('[Packages] Failed to load packages:', err);
            setError('Failed to load packages. Please check your connection.');
            setPackages([]);
        } finally {
            setLoading(false);
        }
    };

    const pollPreviewPayment = (paymentId: string) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await axios.get(`/api/v1/portal/payment-status/${paymentId}`);
                if (res.data?.status === 'SUCCESS') {
                    clearInterval(interval);
                    setPreviewStatus('success');
                    setPreviewMsg('Payment received! Internet access activated via M-Pesa.');
                } else if (res.data?.status === 'FAILED') {
                    clearInterval(interval);
                    setPreviewStatus('failed');
                    setPreviewMsg(res.data?.failureReason || 'Payment failed or cancelled.');
                } else if (attempts >= 40) {
                    clearInterval(interval);
                    setPreviewStatus('failed');
                    setPreviewMsg('Payment check timed out. Please verify STK prompt on your phone.');
                }
            } catch (_) {}
        }, 3000);
    };

    const handlePreviewCheckout = async () => {
        if (!previewSelectedPackage) {
            setPreviewMsg('Please select a package first.');
            return;
        }

        if (previewTab === 'MPESA') {
            const cleanPhone = previewPhone.replace(/[^0-9]/g, '');
            if (!cleanPhone || cleanPhone.length < 9) {
                setPreviewMsg('Please enter a valid M-Pesa phone number (e.g. 0712345678 or 254712345678).');
                return;
            }

            setPreviewStatus('processing');
            setPreviewMsg('Initiating REAL M-Pesa STK Push...');

            try {
                const tenantId = localStorage.getItem('tenantId') || 'primary';
                const formattedPhone = cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) : cleanPhone;

                const res = await axios.post(`/api/v1/portal/${tenantId}/pay`, {
                    phone: formattedPhone,
                    packageId: previewSelectedPackage.id,
                    mac: '00:11:22:33:44:55',
                    ip: '192.168.88.100'
                });

                if (res.data?.success || res.data?.paymentId) {
                    setPreviewStatus('waiting_pin');
                    setPreviewMsg(res.data?.message || 'REAL M-Pesa STK Push prompt sent to your phone! Please enter your M-Pesa PIN.');
                    
                    if (res.data?.paymentId) {
                        pollPreviewPayment(res.data.paymentId);
                    }
                } else {
                    setPreviewStatus('failed');
                    setPreviewMsg(res.data?.error || 'Payment initiation failed.');
                }
            } catch (err: any) {
                const apiError = err.response?.data;
                let errorText = 'M-Pesa STK Push failed. Please check your phone number and M-Pesa API credentials in Settings.';
                if (apiError?.details && Array.isArray(apiError.details) && apiError.details.length > 0) {
                    errorText = `Validation error: ${apiError.details.map((d: any) => d.msg || d.param).join(', ')}`;
                } else if (apiError?.error) {
                    errorText = apiError.error;
                }
                setPreviewStatus('failed');
                setPreviewMsg(errorText);
            }
        } else if (previewTab === 'VOUCHER') {
            if (!previewVoucher.trim()) {
                setPreviewMsg('Please enter a voucher code.');
                return;
            }
            setPreviewStatus('processing');
            setPreviewMsg('Validating voucher code...');
            try {
                const tenantId = localStorage.getItem('tenantId') || 'primary';
                const res = await axios.post(`/api/v1/portal/${tenantId}/redeem-voucher`, { voucherCode: previewVoucher });
                if (res.data?.success) {
                    setPreviewStatus('success');
                    setPreviewMsg('Voucher redeemed successfully! Internet access activated.');
                } else {
                    setPreviewStatus('failed');
                    setPreviewMsg(res.data?.message || 'Invalid or already used voucher code.');
                }
            } catch (err: any) {
                setPreviewStatus('failed');
                setPreviewMsg(err.response?.data?.error || 'Voucher validation failed.');
            }
        }
    };

    const handleSync = async (id: number) => {
        setSyncingId(id);
        try {
            interface SyncResult {
                routerName: string;
                status: 'SUCCESS' | 'FAILED';
                error?: string;
            }
            const res = await axios.post<{ success: boolean; results: SyncResult[] }>(`/api/v1/admin/packages/${id}/sync`);
            if (res.data.success) {
                alert('Successfully synced to all routers!');
            } else {
                const failed = res.data.results.filter(r => r.status === 'FAILED');
                alert(`Sync completed with issues:\n${failed.map(f => `${f.routerName}: ${f.error}`).join('\n')}`);
            }
        } catch (err: unknown) {
            let errorMsg = 'Sync failed';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMsg = err.response.data.error;
            }
            alert(errorMsg);
        } finally {
            setSyncingId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Convert values
            const durationMinutes = formData.durationType === 'days'
                ? parseInt(formData.durationValue) * 1440
                : formData.durationType === 'hours'
                    ? parseInt(formData.durationValue) * 60
                    : parseInt(formData.durationValue);

            const dataLimitBytes = formData.dataLimitEnabled
                ? BigInt(formData.dataLimitValue) * BigInt(1024 * 1024)
                : null;

            const payload = {
                ...formData,
                durationMinutes,
                dataLimitBytes: dataLimitBytes ? dataLimitBytes.toString() : null,
                price: formData.price,
                validity: parseInt(formData.validity),
                sharedUsers: parseInt(formData.sharedUsers)
            };

            if (editingPackage) {
                await axios.put(`/api/v1/admin/packages/${editingPackage.id}`, payload);
            } else {
                await axios.post('/api/v1/admin/packages', payload);
            }

            setIsAdding(false);
            setEditingPackage(null);
            await fetchPackages();
            setFormData(initialFormData);
        } catch (err: unknown) {
            let errorMsg = 'Operation failed';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMsg = err.response.data.error;
            } else if (axios.isAxiosError(err) && err.response?.data?.message) {
                errorMsg = err.response.data.message;
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this package? This action cannot be undone if no subscribers are active.')) return;
        try {
            await axios.post(`/api/v1/admin/packages/${id}/delete`);
            await fetchPackages();
        } catch (err: unknown) {
            let errorMsg = 'Failed to delete package';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMsg = err.response.data.error;
            }
            alert(errorMsg);
        }
    };

    const openEdit = (pkg: Package) => {
        const durationType = pkg.durationMinutes && pkg.durationMinutes >= 1440 ? 'days' : (pkg.durationMinutes && pkg.durationMinutes >= 60 ? 'hours' : 'minutes');
        const durationValue = durationType === 'days' ? (pkg.durationMinutes! / 1440).toString() : (durationType === 'hours' ? (pkg.durationMinutes! / 60).toString() : (pkg.durationMinutes || '0').toString());

        setFormData({
            ...initialFormData,
            name: pkg.name,
            price: pkg.price.toString(),
            type: pkg.type,
            durationValue,
            durationType,
            dataLimitEnabled: pkg.dataLimitBytes !== null,
            dataLimitValue: pkg.dataLimitBytes ? (BigInt(pkg.dataLimitBytes) / BigInt(1024 * 1024)).toString() : '1024',
            downloadSpeed: pkg.downloadSpeed,
            uploadSpeed: pkg.uploadSpeed,
            validity: pkg.validity.toString(),
            sharedUsers: pkg.sharedUsers.toString(),
            expiryAction: pkg.expiryAction,
            description: pkg.description || ''
        });
        setEditingPackage(pkg);
        setIsAdding(true);
    };

    const safePackages = Array.isArray(packages) ? packages : [];

    // Calculate totals for analytics bar
    const totalRev = safePackages.reduce((sum, pkg) => sum + (pkg.stats?.revenue || 0), 0);
    const totalSales = safePackages.reduce((sum, pkg) => sum + (pkg.stats?.salesCount || 0), 0);
    const totalUsers = safePackages.reduce((sum, pkg) => sum + (pkg.stats?.activeUsers || 0), 0);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                        <Zap className="w-5 h-5 text-sky-500" /> Billing Packages & Live Portal Preview
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm mt-0.5">Control revenue streams, edit packages, and test real subscriber M-Pesa STK Push payments</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowLivePreview(!showLivePreview)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                            showLivePreview ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                        <Smartphone size={18} /> {showLivePreview ? 'Hide Live Preview' : 'Show Live Preview'}
                    </button>
                    <button
                        onClick={() => { setIsAdding(true); setEditingPackage(null); setFormData(initialFormData); }}
                        className="btn-primary"
                    >
                        <Plus className="w-4 h-4" /> Create Package
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {/* Global Analytics Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: 'Total Revenue', value: `KES ${totalRev.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: 'Total Sales', value: totalSales, icon: TrendingUp, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                        { label: 'Active Users', value: totalUsers, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { label: 'Avg Pkg Price', value: `KES ${safePackages.length ? Math.round(safePackages.reduce((s, p) => s + (parseInt(p.price) || 0), 0) / safePackages.length) : 0}`, icon: Shield, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                    ].map((stat, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                            key={i} className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex items-center gap-5"
                        >
                            <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                                <stat.icon size={28} />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{stat.label}</p>
                                <p className="text-xl font-black text-white">{stat.value}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* LIVE CAPTIVE PORTAL PREVIEW SECTION WITH REAL STK PUSH */}
                <AnimatePresence>
                    {showLivePreview && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900 border border-sky-500/30 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden mb-12"
                        >
                            <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
                            
                            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-8">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/30 rounded-full text-sky-400 text-xs font-black uppercase tracking-widest mb-3">
                                        <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                                        Live Captive Portal Preview (Real M-Pesa STK Push)
                                    </div>
                                    <h2 className="text-2xl font-black text-white">Test Subscriber Checkout & Real M-Pesa STK Push</h2>
                                    <p className="text-slate-400 text-sm mt-1">Select any package below, enter your Safaricom phone number, and trigger a real M-Pesa STK Push prompt to your phone.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-400">Payment Mode:</span>
                                    <div className="bg-slate-900 p-1 rounded-xl border border-white/10 flex">
                                        <button onClick={() => setPreviewTab('MPESA')} className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${previewTab === 'MPESA' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}>M-Pesa STK</button>
                                        <button onClick={() => setPreviewTab('VOUCHER')} className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${previewTab === 'VOUCHER' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}>Voucher</button>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Phone Mockup Frame */}
                            <div className="max-w-md mx-auto bg-slate-950 border-4 border-slate-800 rounded-[3rem] p-6 shadow-2xl relative text-white">
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                                    <div className="w-3 h-3 rounded-full bg-slate-950"></div>
                                </div>

                                <div className="pt-6 pb-4 text-center space-y-2">
                                    <div className="w-12 h-12 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                        <Wifi size={24} />
                                    </div>
                                    <h3 className="text-lg font-black text-white">Wi-Fi Captive Portal</h3>
                                    <p className="text-xs text-slate-400">Select a package to trigger M-Pesa payment prompt</p>
                                </div>

                                {/* Packages Selection in Preview */}
                                <div className="space-y-3 my-4 max-h-64 overflow-y-auto pr-1">
                                    {safePackages.length > 0 ? (
                                        safePackages.map(pkg => {
                                            const isSelected = previewSelectedPackage?.id === pkg.id;
                                            return (
                                                <div
                                                    key={pkg.id}
                                                    onClick={() => {
                                                        setPreviewSelectedPackage(pkg);
                                                        setPreviewMsg('');
                                                        setPreviewStatus('idle');
                                                    }}
                                                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-sky-950/80 border-sky-500 shadow-lg shadow-sky-500/20' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-sm text-white">{pkg.name}</h4>
                                                            {isSelected && <CheckCircle2 size={16} className="text-sky-400" />}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{pkg.downloadSpeed} / {pkg.uploadSpeed} • {pkg.validity} Days validity</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-emerald-400 text-sm">KES {pkg.price}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-8 text-slate-500 text-xs">No active packages found. Create one below!</div>
                                    )}
                                </div>

                                {/* Checkout Interaction Area */}
                                {previewSelectedPackage && (
                                    <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-4 space-y-3">
                                        <div className="flex justify-between text-xs text-slate-300">
                                            <span>Selected: <strong className="text-white">{previewSelectedPackage.name}</strong></span>
                                            <span className="font-black text-emerald-400">KES {previewSelectedPackage.price}</span>
                                        </div>

                                        {previewTab === 'MPESA' ? (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={previewPhone}
                                                    onChange={e => setPreviewPhone(e.target.value)}
                                                    placeholder="Enter M-Pesa Phone (e.g. 0712345678)"
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-sky-500"
                                                />
                                                <button
                                                    onClick={handlePreviewCheckout}
                                                    disabled={previewStatus === 'processing' || previewStatus === 'waiting_pin'}
                                                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    {previewStatus === 'processing' ? (
                                                        <>
                                                            <RefreshCw size={14} className="animate-spin" />
                                                            Sending STK Push...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Lock size={14} />
                                                            Pay KES {previewSelectedPackage.price} via Real M-Pesa STK
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={previewVoucher}
                                                    onChange={e => setPreviewVoucher(e.target.value)}
                                                    placeholder="Enter Voucher Code"
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-sky-500"
                                                />
                                                <button
                                                    onClick={handlePreviewCheckout}
                                                    disabled={previewStatus === 'processing'}
                                                    className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-sky-500/20 cursor-pointer"
                                                >
                                                    Redeem & Connect
                                                </button>
                                            </div>
                                        )}

                                        {previewMsg && (
                                            <div className={`p-3 rounded-xl text-xs font-bold text-center ${
                                                previewStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                previewStatus === 'waiting_pin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' :
                                                previewStatus === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                                'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                            }`}>
                                                {previewMsg}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {isAdding && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="mb-12 overflow-hidden"
                        >
                            <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 md:p-14 shadow-2xl">
                                <div className="flex justify-between items-center mb-12">
                                    <div>
                                        <h2 className="text-3xl font-black text-white">{editingPackage ? 'Edit Package' : 'New Commerce Package'}</h2>
                                        <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">MikroTik Profile Sync Enabled</p>
                                    </div>
                                    <button onClick={() => setIsAdding(false)} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-10">
                                    {/* Column 1: Identity */}
                                    <div className="space-y-8">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-4">Package Identity</label>
                                            <div className="space-y-6">
                                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold focus:border-sky-500 focus:outline-none transition-all" placeholder="Package Name" />

                                                <div className="relative">
                                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                                                    <input required type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })}
                                                        className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white font-bold focus:border-emerald-500 focus:outline-none transition-all" placeholder="Price (KES)" />
                                                </div>

                                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as 'HOTSPOT' | 'ISP' })}
                                                    className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold focus:border-sky-500 focus:outline-none transition-all appearance-none cursor-pointer">
                                                    <option value="HOTSPOT">Hotspot (Voucher/Login)</option>
                                                    <option value="ISP">Fixed Home (PPPoE)</option>
                                                </select>

                                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                    className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-medium text-sm focus:border-sky-500 focus:outline-none transition-all h-32" placeholder="Description (Optional)" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Limits */}
                                    <div className="space-y-8">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-4">Quota & Validity</label>
                                            <div className="space-y-6">
                                                <div className="bg-slate-900/40 p-1 border border-white/5 rounded-2xl flex">
                                                    {['minutes', 'hours', 'days'].map(t => (
                                                        <button key={t} type="button" onClick={() => setFormData({ ...formData, durationType: t })}
                                                            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.durationType === t ? 'bg-sky-500 text-white' : 'text-slate-500 hover:text-white'}`}>
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                                <input required type="number" value={formData.durationValue} onChange={e => setFormData({ ...formData, durationValue: e.target.value })}
                                                    className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold text-center text-xl" />

                                                <div className="pt-4 border-t border-white/5">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <span className="text-xs font-bold text-slate-400">Enable Data Cap?</span>
                                                        <button type="button" onClick={() => setFormData({ ...formData, dataLimitEnabled: !formData.dataLimitEnabled })}
                                                            className={`w-12 h-6 rounded-full transition-all relative ${formData.dataLimitEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.dataLimitEnabled ? 'left-7' : 'left-1'}`}></div>
                                                        </button>
                                                    </div>
                                                    {formData.dataLimitEnabled && (
                                                        <div className="relative">
                                                            <input type="number" value={formData.dataLimitValue} onChange={e => setFormData({ ...formData, dataLimitValue: e.target.value })}
                                                                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold" />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">MB</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Account Validity (Days)</label>
                                                    <input required type="number" value={formData.validity} onChange={e => setFormData({ ...formData, validity: e.target.value })}
                                                        className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 3: Network */}
                                    <div className="space-y-8">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-4">Network & QoS</label>
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Download</span>
                                                        <input required type="text" value={formData.downloadSpeed} onChange={e => setFormData({ ...formData, downloadSpeed: e.target.value })}
                                                            className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold text-center" placeholder="5M" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Upload</span>
                                                        <input required type="text" value={formData.uploadSpeed} onChange={e => setFormData({ ...formData, uploadSpeed: e.target.value })}
                                                            className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold text-center" placeholder="2M" />
                                                    </div>
                                                </div>

                                                <div className="bg-slate-900/40 p-6 rounded-2xl border border-white/5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block">Expiry Behavior</label>
                                                    <div className="space-y-3">
                                                        {['SUSPEND', 'DELETE', 'NOTIFY'].map(action => (
                                                            <label key={action} className="flex items-center gap-3 cursor-pointer group">
                                                                <input type="radio" name="expiryAction" value={action} checked={formData.expiryAction === action}
                                                                    onChange={e => setFormData({ ...formData, expiryAction: e.target.value as 'SUSPEND' | 'DELETE' | 'NOTIFY' })} className="hidden" />
                                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${formData.expiryAction === action ? 'border-sky-500 bg-sky-500' : 'border-slate-700'}`}>
                                                                    {formData.expiryAction === action && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                                                </div>
                                                                <span className={`text-xs font-bold transition-all ${formData.expiryAction === action ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>{action}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Device Limit</label>
                                                    <input required type="number" value={formData.sharedUsers} onChange={e => setFormData({ ...formData, sharedUsers: e.target.value })}
                                                        className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-3 pt-10 border-t border-white/5 mt-4">
                                        {error && <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-bold text-center text-sm">{error}</div>}
                                        <div className="flex gap-6">
                                            <button type="submit" disabled={loading} className="flex-[3] bg-sky-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl shadow-sky-500/20 hover:bg-sky-400 transition-all flex items-center justify-center gap-3 active:scale-95">
                                                {loading ? <RefreshCw className="animate-spin" /> : (editingPackage ? <><Save /> Save Changes & Re-Sync</> : <><Save /> Activate & Deploy Package</>)}
                                            </button>
                                            <button type="button" onClick={() => setIsAdding(false)} className="flex-1 bg-white/5 text-white py-5 rounded-[2rem] font-bold hover:bg-white/10 transition-all">Cancel</button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Packages Table List */}
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl">
                    <div className="px-4 sm:px-10 py-5 sm:py-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                            <Wifi className="text-sky-400" /> Active Inventory
                        </h3>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Local DB</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-sky-500 rounded-full"></div> Cloud Sync</div>
                        </div>
                    </div>

                    {/* Separation / Isolation Tabs */}
                    <div className="px-4 sm:px-10 py-4 border-b border-white/5 bg-slate-950/40 flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => setPackageTypeFilter('ALL')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                                packageTypeFilter === 'ALL' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                        >
                            All Packages ({safePackages.length})
                        </button>
                        <button
                            onClick={() => setPackageTypeFilter('HOTSPOT')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                                packageTypeFilter === 'HOTSPOT' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                        >
                            <Wifi size={14} /> Hotspot Voucher Packages ({safePackages.filter(p => p.type === 'HOTSPOT').length})
                        </button>
                        <button
                            onClick={() => setPackageTypeFilter('PPPOE')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                                packageTypeFilter === 'PPPOE' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                        >
                            <Database size={14} /> PPPoE / ISP Fixed Packages ({safePackages.filter(p => p.type === 'ISP' || p.type === 'PPPOE' || p.type === 'PPPoE').length})
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[640px]">
                            <thead>
                                <tr className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5 bg-black/20">
                                    <th className="px-4 sm:px-10 py-4 sm:py-6">Package & Type</th>
                                    <th className="px-4 sm:px-6 py-4 sm:py-6 text-center">Billing Price</th>
                                    <th className="px-4 sm:px-6 py-4 sm:py-6">Network Limits</th>
                                    <th className="px-4 sm:px-6 py-4 sm:py-6 text-center">Sales Performance</th>
                                    <th className="px-4 sm:px-6 py-4 sm:py-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {safePackages.filter(pkg => {
                                    if (packageTypeFilter === 'HOTSPOT') return pkg.type === 'HOTSPOT';
                                    if (packageTypeFilter === 'PPPOE') return pkg.type === 'ISP' || pkg.type === 'PPPOE' || pkg.type === 'PPPoE';
                                    return true;
                                }).map((pkg) => (
                                    <tr key={pkg.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-4 sm:px-10 py-6 sm:py-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                                                    {pkg.type === 'HOTSPOT' ? <Wifi size={20} /> : <Database size={20} />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-white text-base leading-tight">{pkg.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                                        {pkg.type} Profile · {pkg.validity}d Validity
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-center">
                                            <div className="text-xl font-black text-emerald-400">KES {pkg.price}</div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Standard Billing</p>
                                        </td>
                                        <td className="px-6 py-8">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                                                    <Zap size={14} className="text-sky-400" /> {pkg.downloadSpeed} / {pkg.uploadSpeed}
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2">
                                                    {pkg.dataLimitBytes ? `${Math.round(Number(BigInt(pkg.dataLimitBytes) / BigInt(1024 * 1024)))}MB Cap` : 'Unlimited'} · 
                                                    {pkg.durationMinutes ? (pkg.durationMinutes >= 1440 ? ` ${pkg.durationMinutes / 1440}d Time` : ` ${pkg.durationMinutes / 60}h Time`) : ' No Limit'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <div className="text-sm font-black text-white">{pkg.stats?.salesCount || 0} Sales</div>
                                                <p className="text-[10px] font-bold text-emerald-400 tracking-tighter uppercase mt-1">
                                                    KES {(pkg.stats?.revenue || 0).toLocaleString()}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleSync(pkg.id)} disabled={syncingId === pkg.id}
                                                    className="p-2.5 bg-white/5 hover:bg-sky-500/10 text-sky-400 rounded-xl transition-all border border-sky-500/20" title="Sync to MikroTik">
                                                    <RefreshCw size={14} className={syncingId === pkg.id ? 'animate-spin' : ''} />
                                                </button>
                                                <button onClick={() => openEdit(pkg)} className="p-2.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white rounded-xl transition-all border border-sky-500/20" title="Edit Package">
                                                    <Edit size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(pkg.id)} className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20" title="Delete Package">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {safePackages.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="py-24 text-center">
                                            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-500">
                                                <AlertCircle size={40} />
                                            </div>
                                            <h4 className="text-xl font-black text-white mb-2">Inventory Empty</h4>
                                            <p className="text-slate-500 font-bold mb-10 max-w-xs mx-auto text-sm">Create your first billing package to start selling internet access.</p>
                                            <button onClick={() => setIsAdding(true)} className="bg-sky-500 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-sky-500/20 active:scale-95 transition-transform">Get Started</button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Packages;
