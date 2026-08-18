import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    MessageSquare, Plus, Edit3, Trash2, CheckCircle2, AlertTriangle,
    Wifi, Send, X, RefreshCw, Eye, EyeOff, Package,
    Settings, ToggleLeft, ToggleRight,
    Save, ShieldCheck, DollarSign, TrendingUp, Lock, Zap, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ================================================================
// TYPES
// ================================================================

interface SmsGateway {
    id: string;
    name: string;
    provider: string;
    apiBaseUrl: string | null;
    apiKeyMasked: string;
    apiSecretMasked: string;
    senderId: string | null;
    callbackUrl: string | null;
    isActive: boolean;
    supportedCountries: string[];
    supportedCurrencies: string[];
    taxRate: number;
    minPurchaseAmount: number;
    maxPurchaseAmount: number;
    createdAt: string;
}

interface SmsPackage {
    id: string;
    name: string;
    smsCount: number;
    sellingPrice: number;
    costPrice: number;
    status: 'ACTIVE' | 'INACTIVE';
    description: string | null;
    isCustom: boolean;
    sortOrder: number;
    createdAt: string;
}

type ActiveSection = 'gateways' | 'packages' | 'procurement';

const formatAmount = (cents: number) => `KES ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

// ================================================================
// GATEWAY FORM
// ================================================================

const PROVIDERS = ['TALKSASA', 'AFRICASTALKING', 'INFOBIP', 'VONAGE', 'TWILIO', 'GENERIC'];

interface GatewayFormProps {
    initial?: Partial<SmsGateway>;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    isNew: boolean;
}

const GatewayForm = ({ initial, onSave, onCancel, isNew }: GatewayFormProps) => {
    const [form, setForm] = useState({
        name: initial?.name || '',
        provider: initial?.provider || 'TALKSASA',
        apiBaseUrl: initial?.apiBaseUrl || '',
        apiKey: '',
        apiSecret: '',
        senderId: initial?.senderId || '',
        callbackUrl: initial?.callbackUrl || '',
        isActive: initial?.isActive ?? true,
        taxRate: initial?.taxRate ?? 0,
        minPurchaseAmount: initial?.minPurchaseAmount ? (initial.minPurchaseAmount / 100) : 100,
        maxPurchaseAmount: initial?.maxPurchaseAmount ? (initial.maxPurchaseAmount / 100) : 100000,
        supportedCountries: (initial?.supportedCountries || ['KE']).join(', '),
        supportedCurrencies: (initial?.supportedCurrencies || ['KES']).join(', '),
    });
    const [showKey, setShowKey] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!form.name || !form.provider) { setError('Name and provider are required'); return; }
        setIsSaving(true); setError('');
        try {
            await onSave({
                name: form.name,
                provider: form.provider,
                apiBaseUrl: form.apiBaseUrl || undefined,
                apiKey: form.apiKey || undefined,
                apiSecret: form.apiSecret || undefined,
                senderId: form.senderId || undefined,
                callbackUrl: form.callbackUrl || undefined,
                isActive: form.isActive,
                taxRate: Number(form.taxRate),
                minPurchaseAmount: Math.round(Number(form.minPurchaseAmount) * 100),
                maxPurchaseAmount: Math.round(Number(form.maxPurchaseAmount) * 100),
                supportedCountries: form.supportedCountries.split(',').map(s => s.trim()).filter(Boolean),
                supportedCurrencies: form.supportedCurrencies.split(',').map(s => s.trim()).filter(Boolean),
            });
        } catch (e: any) {
            setError(e.response?.data?.error || e.message || 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const input = 'w-full px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-sky-500 transition-shadow';
    const label = 'block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider';

    return (
        <div className="space-y-5">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={label}>Gateway Name</label>
                    <input className={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Africa's Talking Production" />
                </div>
                <div>
                    <label className={label}>Provider</label>
                    <select className={input} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
                        {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className={label}>API Base URL</label>
                <input className={input} value={form.apiBaseUrl} onChange={e => setForm(f => ({ ...f, apiBaseUrl: e.target.value }))} placeholder="https://api.africastalking.com" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={label}>API Key {!isNew && <span className="text-[var(--text-muted)] normal-case ml-1">(leave blank to keep current)</span>}</label>
                    <div className="relative">
                        <input
                            className={input + ' pr-10'}
                            type={showKey ? 'text' : 'password'}
                            value={form.apiKey}
                            onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                            placeholder={isNew ? 'Enter API Key' : '••••••••'}
                        />
                        <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                <div>
                    <label className={label}>API Secret / Username {!isNew && <span className="text-[var(--text-muted)] normal-case ml-1">(optional)</span>}</label>
                    <div className="relative">
                        <input
                            className={input + ' pr-10'}
                            type={showSecret ? 'text' : 'password'}
                            value={form.apiSecret}
                            onChange={e => setForm(f => ({ ...f, apiSecret: e.target.value }))}
                            placeholder={isNew ? 'Enter API Secret' : '••••••••'}
                        />
                        <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={label}>Sender ID</label>
                    <input className={input} value={form.senderId} onChange={e => setForm(f => ({ ...f, senderId: e.target.value }))} placeholder="e.g. SURFBILL" />
                </div>
                <div>
                    <label className={label}>Callback URL</label>
                    <input className={input} value={form.callbackUrl} onChange={e => setForm(f => ({ ...f, callbackUrl: e.target.value }))} placeholder="https://yourdomain.com/api/v1/sms/purchase/callback" />
                </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div>
                    <label className={label}>Tax Rate (%)</label>
                    <input type="number" min={0} max={100} step={0.1} className={input} value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                    <label className={label}>Min Purchase (KES)</label>
                    <input type="number" min={0} className={input} value={form.minPurchaseAmount} onChange={e => setForm(f => ({ ...f, minPurchaseAmount: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                    <label className={label}>Max Purchase (KES)</label>
                    <input type="number" min={0} className={input} value={form.maxPurchaseAmount} onChange={e => setForm(f => ({ ...f, maxPurchaseAmount: parseFloat(e.target.value) || 0 }))} />
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={label}>Supported Countries (comma-separated)</label>
                    <input className={input} value={form.supportedCountries} onChange={e => setForm(f => ({ ...f, supportedCountries: e.target.value }))} placeholder="KE, TZ, UG" />
                </div>
                <div>
                    <label className={label}>Supported Currencies (comma-separated)</label>
                    <input className={input} value={form.supportedCurrencies} onChange={e => setForm(f => ({ ...f, supportedCurrencies: e.target.value }))} placeholder="KES, TZS, UGX" />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                    {form.isActive
                        ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                        : <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />}
                </button>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                    {form.isActive ? 'Gateway Active' : 'Gateway Inactive'}
                </span>
            </div>

            <div className="flex gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <button onClick={handleSubmit} disabled={isSaving} className="btn-primary flex-1">
                    {isSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : <><Save className="w-4 h-4" />{isNew ? 'Create Gateway' : 'Save Changes'}</>}
                </button>
                <button onClick={onCancel} className="btn-secondary px-5">Cancel</button>
            </div>
        </div>
    );
};

// ================================================================
// PACKAGE FORM
// ================================================================

interface PackageFormProps {
    initial?: Partial<SmsPackage>;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    isNew: boolean;
}

const PackageForm = ({ initial, onSave, onCancel, isNew }: PackageFormProps) => {
    const [form, setForm] = useState({
        name: initial?.name || '',
        smsCount: initial?.smsCount || 100,
        sellingPrice: initial?.sellingPrice ? initial.sellingPrice / 100 : 0,
        costPrice: initial?.costPrice ? initial.costPrice / 100 : 0,
        description: initial?.description || '',
        status: initial?.status || 'ACTIVE',
        isCustom: initial?.isCustom || false,
        sortOrder: initial?.sortOrder || 0,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!form.name || !form.smsCount || !form.sellingPrice) { setError('Name, SMS count, and selling price are required'); return; }
        setIsSaving(true); setError('');
        try {
            await onSave({
                name: form.name,
                smsCount: Number(form.smsCount),
                sellingPrice: Math.round(Number(form.sellingPrice) * 100),
                costPrice: Math.round(Number(form.costPrice) * 100),
                description: form.description || null,
                status: form.status,
                isCustom: form.isCustom,
                sortOrder: Number(form.sortOrder),
            });
        } catch (e: any) {
            setError(e.response?.data?.error || e.message || 'Failed to save');
        } finally { setIsSaving(false); }
    };

    const input = 'w-full px-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-sky-500 transition-shadow';
    const label = 'block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider';

    const margin = form.sellingPrice && form.costPrice ? ((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.sellingPrice) * 100).toFixed(1) : null;

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={label}>Package Name</label>
                    <input className={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starter Pack" />
                </div>
                <div>
                    <label className={label}>SMS Count</label>
                    <input type="number" min={1} className={input} value={form.smsCount} onChange={e => setForm(f => ({ ...f, smsCount: parseInt(e.target.value) || 0 }))} />
                </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={label}>Selling Price (KES)</label>
                    <input type="number" min={0} step={0.01} className={input} value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                    <label className={label}>Cost Price (KES) <span className="text-[var(--text-muted)] normal-case">(internal)</span></label>
                    <input type="number" min={0} step={0.01} className={input} value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))} />
                </div>
            </div>

            {margin && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    <span className="font-bold">Margin: {margin}%</span> — Profit: KES {(Number(form.sellingPrice) - Number(form.costPrice)).toFixed(2)} per package
                </div>
            )}

            <div>
                <label className={label}>Description (optional)</label>
                <textarea className={input} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Package description visible to tenants..." />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div>
                    <label className={label}>Status</label>
                    <select className={input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                </div>
                <div>
                    <label className={label}>Sort Order</label>
                    <input type="number" min={0} className={input} value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                        <input type="checkbox" checked={form.isCustom} onChange={e => setForm(f => ({ ...f, isCustom: e.target.checked }))} className="w-4 h-4 rounded accent-sky-500" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">Custom Package</span>
                    </label>
                </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <button onClick={handleSubmit} disabled={isSaving} className="btn-primary flex-1">
                    {isSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : <><Save className="w-4 h-4" />{isNew ? 'Create Package' : 'Save Changes'}</>}
                </button>
                <button onClick={onCancel} className="btn-secondary px-5">Cancel</button>
            </div>
        </div>
    );
};

// ================================================================
// MAIN COMPONENT
// ================================================================

const SmsGatewayManager = () => {
    const [section, setSection] = useState<ActiveSection>('gateways');
    const [gateways, setGateways] = useState<SmsGateway[]>([]);
    const [packages, setPackages] = useState<SmsPackage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showGatewayForm, setShowGatewayForm] = useState(false);
    const [showPackageForm, setShowPackageForm] = useState(false);
    const [editingGateway, setEditingGateway] = useState<SmsGateway | null>(null);
    const [editingPackage, setEditingPackage] = useState<SmsPackage | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [testingGateway, setTestingGateway] = useState<string | null>(null);
    const [testPhones, setTestPhones] = useState<Record<string, string>>({});
    const [procurementData, setProcurementData] = useState<any>(null);
    const [isRetrying, setIsRetrying] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [gRes, pRes, procRes] = await Promise.all([
                axios.get<SmsGateway[]>('/api/v1/superadmin/sms/gateways'),
                axios.get<SmsPackage[]>('/api/v1/superadmin/sms/packages'),
                axios.get('/api/v1/superadmin/sms-procurement/summary').catch(() => ({ data: null }))
            ]);
            setGateways(gRes.data);
            setPackages(pRes.data);
            if (procRes.data) setProcurementData(procRes.data);
        } catch (e: any) {
            setNotification({ type: 'error', text: e.response?.data?.error || 'Failed to load data' });
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRetryProcurement = async (taskId: string) => {
        setIsRetrying(taskId);
        try {
            const res = await axios.post(`/api/v1/superadmin/sms-procurement/tasks/${taskId}/retry`);
            if (res.data.success) {
                showNotification('success', 'Procurement retried successfully!');
            } else {
                showNotification('error', res.data.task?.failureReason || 'Procurement retry failed.');
            }
            fetchData();
        } catch (err: any) {
            showNotification('error', err.response?.data?.error || 'Failed to retry procurement.');
        } finally {
            setIsRetrying(null);
        }
    };

    const showNotification = (type: 'success' | 'error', text: string) => {
        setNotification({ type, text });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleSaveGateway = async (data: any) => {
        if (editingGateway) {
            await axios.put(`/api/v1/superadmin/sms/gateways/${editingGateway.id}`, data);
            showNotification('success', 'Gateway updated successfully');
        } else {
            await axios.post('/api/v1/superadmin/sms/gateways', data);
            showNotification('success', 'Gateway created successfully');
        }
        setShowGatewayForm(false);
        setEditingGateway(null);
        fetchData();
    };

    const handleDeleteGateway = async (id: string) => {
        if (!confirm('Delete this gateway? This cannot be undone.')) return;
        await axios.delete(`/api/v1/superadmin/sms/gateways/${id}`);
        showNotification('success', 'Gateway deleted');
        fetchData();
    };

    const handleTestConnection = async (id: string) => {
        setTestingGateway(id);
        try {
            const r = await axios.post<{ success: boolean; message: string; responseTime?: number }>(`/api/v1/superadmin/sms/gateways/${id}/test-connection`);
            showNotification(r.data.success ? 'success' : 'error', r.data.message + (r.data.responseTime ? ` (${r.data.responseTime}ms)` : ''));
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Test failed');
        } finally { setTestingGateway(null); }
    };

    const handleTestSms = async (id: string) => {
        const phone = testPhones[id];
        if (!phone) { showNotification('error', 'Enter a phone number first'); return; }
        setTestingGateway(id + '-sms');
        try {
            const r = await axios.post<{ success: boolean; message: string }>(`/api/v1/superadmin/sms/gateways/${id}/test-sms`, { phone });
            showNotification(r.data.success ? 'success' : 'error', r.data.message);
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Test SMS failed');
        } finally { setTestingGateway(null); }
    };

    const handleSavePackage = async (data: any) => {
        if (editingPackage) {
            await axios.put(`/api/v1/superadmin/sms/packages/${editingPackage.id}`, data);
            showNotification('success', 'Package updated successfully');
        } else {
            await axios.post('/api/v1/superadmin/sms/packages', data);
            showNotification('success', 'Package created successfully');
        }
        setShowPackageForm(false);
        setEditingPackage(null);
        fetchData();
    };

    const handleDeactivatePackage = async (id: string) => {
        if (!confirm('Deactivate this package? Existing purchases are unaffected.')) return;
        await axios.delete(`/api/v1/superadmin/sms/packages/${id}`);
        showNotification('success', 'Package deactivated');
        fetchData();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/25">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[var(--text-primary)]">SMS Gateway Management</h2>
                        <p className="text-xs text-[var(--text-muted)]">Configure providers and manage SMS credit packages</p>
                    </div>
                </div>
                <button onClick={fetchData} className="btn-secondary py-2 px-3 text-sm">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Notification */}
            <AnimatePresence>
                {notification && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border ${notification.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'}`}
                    >
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                        <p className="text-sm font-medium flex-1">{notification.text}</p>
                        <button onClick={() => setNotification(null)}><X className="w-4 h-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Section Tabs */}
            <div className="flex flex-wrap gap-2 bg-[var(--bg-surface-elevated)] p-1 rounded-2xl w-fit">
                {[
                    { id: 'gateways' as ActiveSection, label: 'SMS Gateways', icon: Settings },
                    { id: 'packages' as ActiveSection, label: 'SMS Packages', icon: Package },
                    { id: 'procurement' as ActiveSection, label: 'Procurement & Margin Protection', icon: ShieldCheck },
                ].map(s => (
                    <button key={s.id} onClick={() => setSection(s.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${section === s.id ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                        <s.icon className="w-4 h-4" />{s.label}
                    </button>
                ))}
            </div>

            {/* GATEWAYS SECTION */}
            {section === 'gateways' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-[var(--text-muted)]">{gateways.length} gateway{gateways.length !== 1 ? 's' : ''} configured</p>
                        <button onClick={() => { setEditingGateway(null); setShowGatewayForm(!showGatewayForm); }} className="btn-primary py-2.5 px-5 text-sm">
                            <Plus className="w-4 h-4" /> Add Gateway
                        </button>
                    </div>

                    <AnimatePresence>
                        {showGatewayForm && !editingGateway && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="bg-[var(--bg-surface)] border-2 border-sky-200 dark:border-sky-800 rounded-3xl p-6 shadow-xl">
                                <h3 className="font-black text-[var(--text-primary)] text-lg mb-5">New SMS Gateway</h3>
                                <GatewayForm isNew={true} onSave={handleSaveGateway} onCancel={() => setShowGatewayForm(false)} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isLoading ? (
                        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-40 bg-[var(--bg-surface-elevated)] rounded-3xl animate-pulse" />)}</div>
                    ) : gateways.length === 0 ? (
                        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl text-[var(--text-muted)]">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p className="font-semibold">No SMS gateways configured</p>
                            <p className="text-sm mt-1">Add your first gateway to enable SMS features for tenants</p>
                        </div>
                    ) : (
                        gateways.map(gw => (
                            <div key={gw.id} className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${gw.isActive ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-[var(--bg-surface-elevated)]'}`}>
                                            <MessageSquare className={`w-6 h-6 ${gw.isActive ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="font-black text-[var(--text-primary)] text-lg">{gw.name}</h3>
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{gw.provider}</span>
                                                {gw.isActive
                                                    ? <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3" />Active</span>
                                                    : <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">Inactive</span>}
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                                <div><p className="text-xs text-[var(--text-muted)]">Sender ID</p><p className="text-sm font-bold text-[var(--text-primary)]">{gw.senderId || '—'}</p></div>
                                                <div><p className="text-xs text-[var(--text-muted)]">API Key</p><p className="text-sm font-mono text-[var(--text-secondary)]">{gw.apiKeyMasked || '—'}</p></div>
                                                <div><p className="text-xs text-[var(--text-muted)]">Tax Rate</p><p className="text-sm font-bold text-[var(--text-primary)]">{gw.taxRate}%</p></div>
                                                <div><p className="text-xs text-[var(--text-muted)]">Min / Max</p><p className="text-sm font-bold text-[var(--text-primary)]">{formatAmount(gw.minPurchaseAmount)} / {formatAmount(gw.maxPurchaseAmount)}</p></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Test Tools */}
                                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-3 items-center">
                                        <button
                                            onClick={() => handleTestConnection(gw.id)}
                                            disabled={testingGateway === gw.id}
                                            className="btn-secondary py-2 px-4 text-xs"
                                        >
                                            {testingGateway === gw.id ? <><div className="w-3 h-3 border border-sky-500 border-t-transparent rounded-full animate-spin" />Testing...</> : <><Wifi className="w-3 h-3" />Test Connection</>}
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="tel"
                                                value={testPhones[gw.id] || ''}
                                                onChange={e => setTestPhones(p => ({ ...p, [gw.id]: e.target.value }))}
                                                placeholder="Phone for test SMS"
                                                className="px-3 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] text-xs outline-none focus:ring-2 focus:ring-sky-500 w-40"
                                            />
                                            <button
                                                onClick={() => handleTestSms(gw.id)}
                                                disabled={testingGateway === gw.id + '-sms'}
                                                className="btn-secondary py-2 px-4 text-xs"
                                            >
                                                {testingGateway === gw.id + '-sms' ? <><div className="w-3 h-3 border border-sky-500 border-t-transparent rounded-full animate-spin" />Sending...</> : <><Send className="w-3 h-3" />Test SMS</>}
                                            </button>
                                        </div>

                                        <div className="ml-auto flex gap-2">
                                            <button
                                                onClick={() => { setEditingGateway(gw); setShowGatewayForm(true); }}
                                                className="p-2 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-900/20 text-[var(--text-muted)] hover:text-sky-600 transition-colors"
                                            ><Edit3 className="w-4 h-4" /></button>
                                            <button
                                                onClick={() => handleDeleteGateway(gw.id)}
                                                className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                                            ><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Form */}
                                <AnimatePresence>
                                    {showGatewayForm && editingGateway?.id === gw.id && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="border-t border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] p-5">
                                            <h4 className="font-black text-[var(--text-primary)] mb-4">Edit Gateway</h4>
                                            <GatewayForm isNew={false} initial={gw} onSave={handleSaveGateway} onCancel={() => { setShowGatewayForm(false); setEditingGateway(null); }} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* PACKAGES SECTION */}
            {section === 'packages' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-[var(--text-muted)]">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
                        <button onClick={() => { setEditingPackage(null); setShowPackageForm(!showPackageForm); }} className="btn-primary py-2.5 px-5 text-sm">
                            <Plus className="w-4 h-4" /> Add Package
                        </button>
                    </div>

                    <AnimatePresence>
                        {showPackageForm && !editingPackage && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="bg-[var(--bg-surface)] border-2 border-sky-200 dark:border-sky-800 rounded-3xl p-6 shadow-xl">
                                <h3 className="font-black text-[var(--text-primary)] text-lg mb-5">New SMS Package</h3>
                                <PackageForm isNew={true} onSave={handleSavePackage} onCancel={() => setShowPackageForm(false)} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isLoading ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="h-44 bg-[var(--bg-surface-elevated)] rounded-3xl animate-pulse" />)}</div>
                    ) : packages.length === 0 ? (
                        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl text-[var(--text-muted)]">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p className="font-semibold">No packages yet</p>
                            <p className="text-sm mt-1">Create packages that tenants can purchase</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {packages.map(pkg => (
                                <div key={pkg.id}>
                                    <div className={`bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-4 ${pkg.status === 'INACTIVE' ? 'opacity-60' : ''}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pkg.status === 'ACTIVE' ? 'bg-gradient-to-br from-sky-400 to-blue-600' : 'bg-[var(--bg-surface-elevated)]'}`}>
                                                <MessageSquare className={`w-5 h-5 ${pkg.status === 'ACTIVE' ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                                            </div>
                                            <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                <div>
                                                    <p className="text-xs text-[var(--text-muted)]">Name</p>
                                                    <p className="font-bold text-[var(--text-primary)] text-sm">{pkg.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-[var(--text-muted)]">SMS Count</p>
                                                    <p className="font-bold text-sky-600 dark:text-sky-400 text-sm">{pkg.smsCount.toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-[var(--text-muted)]">Selling Price</p>
                                                    <p className="font-bold text-[var(--text-primary)] text-sm">{formatAmount(pkg.sellingPrice)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-[var(--text-muted)]">Cost Price</p>
                                                    <p className="font-bold text-[var(--text-secondary)] text-sm">{formatAmount(pkg.costPrice)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-[var(--text-muted)]">Status</p>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pkg.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{pkg.status}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => { setEditingPackage(pkg); setShowPackageForm(true); }}
                                                    className="p-2 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-900/20 text-[var(--text-muted)] hover:text-sky-600 transition-colors">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                {pkg.status === 'ACTIVE' && (
                                                    <button onClick={() => handleDeactivatePackage(pkg.id)}
                                                        className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[var(--text-muted)] hover:text-rose-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {pkg.description && <p className="text-xs text-[var(--text-muted)] mt-2 ml-14">{pkg.description}</p>}
                                    </div>

                                    {/* Edit Form Inline */}
                                    <AnimatePresence>
                                        {showPackageForm && editingPackage?.id === pkg.id && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="bg-[var(--bg-surface)] border border-sky-200 dark:border-sky-800 rounded-2xl p-5 mt-2 shadow-lg">
                                                <h4 className="font-black text-[var(--text-primary)] mb-4">Edit Package</h4>
                                                <PackageForm isNew={false} initial={pkg} onSave={handleSavePackage} onCancel={() => { setShowPackageForm(false); setEditingPackage(null); }} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* AUTOMATED PROCUREMENT & MARGIN PROTECTION SECTION */}
            {section === 'procurement' && procurementData && (
                <div className="space-y-6">
                    {/* Financial Ledger Balances */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-5 bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl space-y-1">
                            <div className="flex items-center justify-between text-emerald-400">
                                <span className="text-xs font-bold uppercase tracking-wider">Reserved Profit Balance</span>
                                <Lock className="w-4 h-4" />
                            </div>
                            <p className="text-2xl font-black text-white">KES {procurementData.summary.totalReservedProfitKes.toLocaleString()}</p>
                            <p className="text-[10px] text-emerald-400 font-semibold">🔒 Protected from Procurement</p>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-sky-950/40 to-slate-900 border border-sky-500/30 rounded-2xl space-y-1">
                            <div className="flex items-center justify-between text-sky-400">
                                <span className="text-xs font-bold uppercase tracking-wider">Procurement Fund Balance</span>
                                <DollarSign className="w-4 h-4" />
                            </div>
                            <p className="text-2xl font-black text-white">KES {procurementData.summary.availableProcurementFundKes.toLocaleString()}</p>
                            <p className="text-[10px] text-sky-400 font-semibold">Available for Provider Purchases</p>
                        </div>

                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total SMS Revenue</span>
                            <p className="text-2xl font-black text-white">KES {procurementData.summary.totalRevenueKes.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400">Margin: <strong className="text-emerald-400">{procurementData.summary.profitMarginPercentage}%</strong></p>
                        </div>

                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS Inventory Balance</span>
                            <p className="text-2xl font-black text-amber-400">{procurementData.summary.smsInventoryCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span></p>
                            <p className="text-[10px] text-slate-400">Provider Credit Pool</p>
                        </div>
                    </div>

                    {/* Procurement Tasks List */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black text-white flex items-center gap-2">
                                <Zap className="w-4 h-4 text-sky-400" /> Automated Procurement Tasks & Failsafes
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold">
                                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg">{procurementData.summary.successfulProcurementsCount} Completed</span>
                                <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 rounded-lg">{procurementData.summary.failedProcurementsCount} Failed</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-800/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-700">
                                    <tr>
                                        <th className="p-3">Procurement #</th>
                                        <th className="p-3">SMS Units</th>
                                        <th className="p-3">Paid (KES)</th>
                                        <th className="p-3">Provider Cost</th>
                                        <th className="p-3">Reserved Profit</th>
                                        <th className="p-3">Mode</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Provider Ref</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {procurementData.recentProcurements.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-slate-800/40">
                                            <td className="p-3 font-mono font-bold text-white">{p.procurementNumber}</td>
                                            <td className="p-3 font-bold text-sky-400">{p.smsCount.toLocaleString()}</td>
                                            <td className="p-3 font-bold">KES {(p.amountPaidCents / 100).toLocaleString()}</td>
                                            <td className="p-3 font-bold text-slate-400">KES {(p.providerCostCents / 100).toLocaleString()}</td>
                                            <td className="p-3 font-bold text-emerald-400">KES {(p.reservedProfitCents / 100).toLocaleString()}</td>
                                            <td className="p-3"><span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-bold">{p.executionMode}</span></td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${p.procurementStatus === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : p.procurementStatus === 'FAILED' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                    {p.procurementStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-[10px] text-slate-400">{p.providerReference || 'N/A'}</td>
                                            <td className="p-3 text-right">
                                                {p.procurementStatus === 'FAILED' && (
                                                    <button
                                                        onClick={() => handleRetryProcurement(p.id)}
                                                        disabled={isRetrying === p.id}
                                                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition disabled:opacity-50"
                                                    >
                                                        {isRetrying === p.id ? 'Retrying...' : 'Retry'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financial Audit Trail */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                            <FileText className="w-4 h-4 text-sky-400" /> Margin Protection Financial Audit Log
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-800/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-700">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Transaction Type</th>
                                        <th className="p-3">Amount (KES)</th>
                                        <th className="p-3">Procurement Bal After</th>
                                        <th className="p-3">Profit Reserved Bal After</th>
                                        <th className="p-3">Audit Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {procurementData.recentLedgerTransactions.map((tx: any, idx: number) => (
                                        <tr key={`${tx.id}-${idx}`}>
                                            <td className="p-3 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.transactionType === 'PROFIT_RESERVED' ? 'bg-emerald-500/20 text-emerald-400' : tx.transactionType === 'PROCUREMENT_DEBIT' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-300'}`}>
                                                    {tx.transactionType}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold">KES {(tx.amountCents / 100).toLocaleString()}</td>
                                            <td className="p-3 font-mono text-slate-400">KES {(tx.providerProcurementBalanceAfterCents / 100).toLocaleString()}</td>
                                            <td className="p-3 font-mono text-emerald-400">KES {(tx.reservedProfitBalanceAfterCents / 100).toLocaleString()}</td>
                                            <td className="p-3 text-slate-400">{tx.notes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmsGatewayManager;
