import React, { useState, useEffect, useCallback } from 'react';
import DeviceBindingsView from '../components/Subscribers/DeviceBindingsView';
import axios from 'axios';
import {
    Users, UserPlus, Upload, FolderPlus, CheckCircle2, Clock, AlertTriangle,
    Search, RefreshCw, Download, Edit3, Trash2, Lock, ShieldAlert, Wallet,
    Router, Check, X, FileText, ChevronRight, Eye, Phone, Mail, MapPin, Zap,
    ArrowUpRight, ArrowDownRight, Plus, Sliders, Layers
} from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface PackageItem { id: number; name: string; price: number; durationMinutes: number; }
interface RouterItem { id: string; name: string; ipAddress?: string; host?: string; isOnline: boolean; }
interface GroupItem { id: string; name: string; description?: string; discountPercentage: number; }

interface SubscriberItem {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber: string;
    altPhone?: string;
    email?: string;
    idNumber?: string;
    username?: string;
    pppoeUsername?: string;
    macAddress?: string;
    address?: string;
    location?: string;
    customerType: string;
    connectionType: string;
    status: string;
    expiryDate?: string;
    notes?: string;
    autoRenewal: boolean;
    notificationsEnabled: boolean;
    isDraft: boolean;
    package?: PackageItem;
    subscriber_group?: GroupItem;
    routerId?: string;
}

interface StatsSummary {
    total: number;
    active: number;
    expired: number;
    suspended: number;
    drafts: number;
    groupsCount: number;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

const SubscribersManagement: React.FC = () => {
    // Menu Tab state: 'all' | 'add' | 'import' | 'groups' | 'active' | 'expired' | 'suspended'
    const [activeTab, setActiveTab] = useState<'all' | 'add' | 'import' | 'groups' | 'active' | 'expired' | 'suspended' | 'bindings'>('all');

    const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
    const [packages, setPackages] = useState<PackageItem[]>([]);
    const [routers, setRouters] = useState<RouterItem[]>([]);
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [stats, setStats] = useState<StatsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('');

    // Detail Modal / Drawer state
    const [viewSub, setViewSub] = useState<SubscriberItem | null>(null);
    const [subDetails, setSubDetails] = useState<any>(null);
    const [walletAction, setWalletAction] = useState<{ action: 'CREDIT' | 'DEBIT'; amount: string; reason: string }>({ action: 'CREDIT', amount: '', reason: '' });

    // Add Subscriber Form state
    const [addForm, setAddForm] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        altPhone: '',
        email: '',
        idNumber: '',
        username: '',
        password: '',
        address: '',
        location: '',
        macAddress: '',
        customerType: 'RESIDENTIAL',
        connectionType: 'HOTSPOT',
        customerGroupId: '',
        routerId: '',
        packageId: '',
        expiryDate: '',
        initialBalanceKES: '0',
        autoRenewal: false,
        notificationsEnabled: true,
        activateImmediately: true,
        isDraft: false,
        notes: '',
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Bulk Import state
    const [csvRows, setCsvRows] = useState<any[]>([]);
    const [importErrors, setImportErrors] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [importSuccessMsg, setImportSuccessMsg] = useState('');

    // Group Form State
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupForm, setGroupForm] = useState({ name: '', description: '', discountPercentage: '0' });

    // Discovery State
    const [discoveredDevices, setDiscoveredDevices] = useState<{ id: string, address: string, macAddress: string, hostname: string }[]>([]);
    const [discovering, setDiscovering] = useState(false);

    // Load initial data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let statusQuery = '';
            if (activeTab === 'active') statusQuery = 'ACTIVE';
            else if (activeTab === 'expired') statusQuery = 'EXPIRED';
            else if (activeTab === 'suspended') statusQuery = 'SUSPENDED';

            const [subsRes, statsRes, pkgsRes, routersRes, groupsRes] = await Promise.allSettled([
                axios.get('/api/v1/admin/subscribers', { params: { status: statusQuery, type: selectedTypeFilter, search: searchTerm } }),
                axios.get('/api/v1/admin/subscribers/stats'),
                axios.get('/api/v1/admin/packages'),
                axios.get('/api/v1/routers'),
                axios.get('/api/v1/admin/subscribers/groups'),
            ]);

            if (subsRes.status === 'fulfilled') setSubscribers(subsRes.value.data.subscribers || []);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || null);
            if (pkgsRes.status === 'fulfilled') setPackages(pkgsRes.value.data.packages || pkgsRes.value.data || []);
            if (routersRes.status === 'fulfilled') setRouters(routersRes.value.data.routers || []);
            if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value.data.groups || []);
        } catch (e) {
            console.error('[SubscribersMgmt] Error loading data:', e);
        } finally {
            setLoading(false);
        }
    }, [activeTab, selectedTypeFilter, searchTerm]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDiscoverDevices = async () => {
        if (!addForm.routerId) {
            alert('Please select a router first to discover devices.');
            return;
        }
        setDiscovering(true);
        try {
            const res = await axios.get(`/api/v1/routers/${addForm.routerId}/discovery`);
            setDiscoveredDevices(res.data.devices || []);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to discover devices');
        } finally {
            setDiscovering(false);
        }
    };

    // Handle Add Subscriber Submission
    const handleAddSubscriber = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormMessage(null);

        try {
            const res = await axios.post('/api/v1/admin/subscribers', addForm);
            setFormMessage({
                type: 'success',
                text: `Subscriber "${res.data.subscriber.name}" created successfully! MikroTik router sync: ${res.data.mikrotikSynced ? 'Synced OK' : (res.data.mikrotikError || 'Skipped/Offline')}`
            });
            // Reset Form
            setAddForm({
                firstName: '', lastName: '', phoneNumber: '', altPhone: '', email: '', idNumber: '',
                username: '', password: '', address: '', location: '', macAddress: '', customerType: 'RESIDENTIAL',
                connectionType: 'HOTSPOT', customerGroupId: '', routerId: '', packageId: '', expiryDate: '',
                initialBalanceKES: '0', autoRenewal: false, notificationsEnabled: true, activateImmediately: true,
                isDraft: false, notes: '',
            });
            await fetchData();
        } catch (err: any) {
            setFormMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create subscriber' });
        } finally {
            setFormLoading(false);
        }
    };

    // CSV File Reader
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            if (lines.length <= 1) {
                alert('CSV file is empty or missing data rows');
                return;
            }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const parsedRows = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const obj: any = {};
                headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
                return obj;
            });
            setCsvRows(parsedRows);
            setImportErrors([]);
            setImportSuccessMsg('');
        };
        reader.readAsText(file);
    };

    // Execute Bulk Import
    const handleExecuteImport = async () => {
        if (csvRows.length === 0) return;
        setImporting(true);
        setImportErrors([]);
        setImportSuccessMsg('');

        try {
            const res = await axios.post('/api/v1/admin/subscribers/bulk-import', { rows: csvRows });
            if (res.data.success) {
                setImportSuccessMsg(`Successfully imported ${res.data.importedCount} subscribers!`);
                setCsvRows([]);
                await fetchData();
            } else if (res.data.errors) {
                setImportErrors(res.data.errors);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    // Download CSV Template
    const downloadTemplate = () => {
        window.open('/api/v1/admin/subscribers/template', '_blank');
    };

    // Status Action (Suspend, Reactivate, Archive, Delete)
    const handleStatusAction = async (id: string, action: 'SUSPEND' | 'REACTIVATE' | 'ARCHIVE' | 'DELETE') => {
        if (action === 'DELETE' && !confirm('Are you sure you want to delete this subscriber? This cannot be undone.')) return;
        try {
            await axios.post(`/api/v1/admin/subscribers/${id}/status`, { action });
            if (viewSub?.id === id) setViewSub(null);
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Action failed');
        }
    };

    // View Details
    const openSubscriberDrawer = async (sub: SubscriberItem) => {
        setViewSub(sub);
        try {
            const res = await axios.get(`/api/v1/admin/subscribers/${sub.id}`);
            setSubDetails(res.data);
        } catch (e) { console.error(e); }
    };

    // Wallet Action (Credit/Debit)
    const handleWalletSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!viewSub || !walletAction.amount) return;
        try {
            await axios.post(`/api/v1/admin/subscribers/${viewSub.id}/wallet`, {
                action: walletAction.action,
                amountKES: Number(walletAction.amount),
                reason: walletAction.reason
            });
            const updated = await axios.get(`/api/v1/admin/subscribers/${viewSub.id}`);
            setSubDetails(updated.data);
            setWalletAction({ action: 'CREDIT', amount: '', reason: '' });
            alert(`Wallet ${walletAction.action.toLowerCase()}ed successfully!`);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Wallet transaction failed');
        }
    };

    // Save Group
    const handleSaveGroup = async () => {
        try {
            await axios.post('/api/v1/admin/subscribers/groups', groupForm);
            setShowGroupModal(false);
            setGroupForm({ name: '', description: '', discountPercentage: '0' });
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to save group');
        }
    };

    const statusBadge = (s: string, isDraft?: boolean) => {
        if (isDraft) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600">Draft</span>;
        if (s === 'ACTIVE') return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600">Active</span>;
        if (s === 'SUSPENDED') return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600">Suspended</span>;
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600">Expired</span>;
    };

    return (
        <div className="space-y-6 pb-8">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Users className="w-5 h-5 text-sky-500" /> Subscriber Management & Onboarding
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Manage customer onboarding, billing profiles, MikroTik sync, and wallets</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab('import')} className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500 rounded-xl text-xs font-bold text-[var(--text-secondary)] transition-all">
                        <Upload className="w-4 h-4" /> Bulk Import
                    </button>
                    <button onClick={() => setActiveTab('add')} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all shadow-md">
                        <UserPlus className="w-4 h-4" /> Add Subscriber
                    </button>
                </div>
            </div>

            {/* ── KPI Stats Summary ── */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div onClick={() => setActiveTab('all')} className={`bg-[var(--bg-surface)] rounded-2xl border p-4 text-center cursor-pointer transition-all ${activeTab === 'all' ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-[var(--border-subtle)]'}`}>
                        <div className="text-2xl font-black text-[var(--text-primary)]">{stats.total}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">All Subscribers</div>
                    </div>
                    <div onClick={() => setActiveTab('active')} className={`bg-[var(--bg-surface)] rounded-2xl border p-4 text-center cursor-pointer transition-all ${activeTab === 'active' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-[var(--border-subtle)]'}`}>
                        <div className="text-2xl font-black text-emerald-600">{stats.active}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Active</div>
                    </div>
                    <div onClick={() => setActiveTab('expired')} className={`bg-[var(--bg-surface)] rounded-2xl border p-4 text-center cursor-pointer transition-all ${activeTab === 'expired' ? 'border-slate-500 ring-2 ring-slate-500/20' : 'border-[var(--border-subtle)]'}`}>
                        <div className="text-2xl font-black text-slate-600">{stats.expired}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Expired</div>
                    </div>
                    <div onClick={() => setActiveTab('suspended')} className={`bg-[var(--bg-surface)] rounded-2xl border p-4 text-center cursor-pointer transition-all ${activeTab === 'suspended' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-[var(--border-subtle)]'}`}>
                        <div className="text-2xl font-black text-rose-600">{stats.suspended}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Suspended</div>
                    </div>
                    <div onClick={() => setActiveTab('groups')} className={`bg-[var(--bg-surface)] rounded-2xl border p-4 text-center cursor-pointer transition-all ${activeTab === 'groups' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-[var(--border-subtle)]'}`}>
                        <div className="text-2xl font-black text-amber-600">{stats.groupsCount}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">Groups</div>
                    </div>
                </div>
            )}

            {/* ── Sub-Menu Navigation Tabs ── */}
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 overflow-x-auto">
                <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'all' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    All Subscribers
                </button>
                <button onClick={() => setActiveTab('add')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'add' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Add Subscriber
                </button>
                <button onClick={() => setActiveTab('import')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'import' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Bulk Import
                </button>
                <button onClick={() => setActiveTab('groups')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'groups' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Subscriber Groups
                </button>
                <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'active' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Active ({stats?.active || 0})
                </button>
                <button onClick={() => setActiveTab('expired')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'expired' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Expired ({stats?.expired || 0})
                </button>
                <button onClick={() => setActiveTab('suspended')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'suspended' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Suspended ({stats?.suspended || 0})
                </button>
                <button onClick={() => setActiveTab('bindings')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'bindings' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                    Device Bindings (TV/Phones)
                </button>
            </div>

            
            {/* ── DEVICE BINDINGS VIEW ── */}
            {activeTab === 'bindings' && (
                <DeviceBindingsView routers={routers} subscribers={subscribers} />
            )}

            {/* ── VIEW 1: SUBSCRIBERS TABLE (All / Active / Expired / Suspended) ── */}
            {['all', 'active', 'expired', 'suspended'].includes(activeTab) && (
                <div className="space-y-4">
                    {/* Search & Filters */}
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-3 flex-wrap flex-1">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input
                                    type="text"
                                    placeholder="Search name, phone, username, email, ID..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] pl-10 pr-4 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500"
                                />
                            </div>
                            <select value={selectedTypeFilter} onChange={e => setSelectedTypeFilter(e.target.value)}
                                className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                <option value="">All Customer Types</option>
                                <option value="RESIDENTIAL">Residential</option>
                                <option value="BUSINESS">Business</option>
                                <option value="CORPORATE">Corporate</option>
                                <option value="INSTITUTION">Institution</option>
                                <option value="HOTSPOT">Hotspot</option>
                                <option value="PPPOE">PPPoE</option>
                            </select>
                        </div>
                        <button onClick={fetchData} className="p-2 hover:bg-[var(--bg-surface-elevated)] rounded-xl text-[var(--text-muted)] transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : subscribers.length === 0 ? (
                        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                            <Users className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                            <p className="text-[var(--text-muted)] font-semibold">No subscribers found matching criteria</p>
                        </div>
                    ) : (
                        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--border-subtle)] text-xs font-black uppercase text-[var(--text-muted)]">
                                            <th className="text-left py-3.5 px-4">Subscriber & Contact</th>
                                            <th className="text-left py-3.5 px-4">Type & Connection</th>
                                            <th className="text-left py-3.5 px-4">Package</th>
                                            <th className="text-left py-3.5 px-4">Status & Expiry</th>
                                            <th className="text-right py-3.5 px-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subscribers.map(s => (
                                            <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-[var(--text-primary)]">{s.name || 'Anonymous'}</div>
                                                    <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{s.phoneNumber}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-xs font-bold text-[var(--text-primary)]">
                                                        {s.customerType || 'RESIDENTIAL'}
                                                    </div>
                                                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{s.connectionType || 'HOTSPOT'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm font-semibold text-sky-500">{s.package?.name || 'No Package'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1">
                                                        {statusBadge(s.status, s.isDraft)}
                                                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                                                            {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : 'Lifetime'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button onClick={() => openSubscriberDrawer(s)} className="p-2 hover:bg-sky-500/10 text-sky-600 rounded-lg transition-colors" title="View Profile">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {s.status === 'SUSPENDED' ? (
                                                            <button onClick={() => handleStatusAction(s.id, 'REACTIVATE')} className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-500/20">
                                                                Reactivate
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleStatusAction(s.id, 'SUSPEND')} className="px-2 py-1 bg-rose-500/10 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-500/20">
                                                                Suspend
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

            {/* ── VIEW 2: ADD SUBSCRIBER FORM ── */}
            {activeTab === 'add' && (
                <div className="max-w-4xl mx-auto bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-8 shadow-md">
                    <h2 className="text-lg font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-sky-500" /> Customer Onboarding & Subscriber Registration
                    </h2>

                    {formMessage && (
                        <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold ${formMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-700'}`}>
                            {formMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                            {formMessage.text}
                        </div>
                    )}

                    <form onSubmit={handleAddSubscriber} className="space-y-8">
                        {/* Section 1: Personal & Identity */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase text-sky-600 tracking-wider">1. Personal Details & Identity</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">First Name</label>
                                    <input type="text" placeholder="John" value={addForm.firstName} onChange={e => setAddForm({ ...addForm, firstName: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Last Name</label>
                                    <input type="text" placeholder="Doe" value={addForm.lastName} onChange={e => setAddForm({ ...addForm, lastName: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">National ID / Passport</label>
                                    <input type="text" placeholder="12345678" value={addForm.idNumber} onChange={e => setAddForm({ ...addForm, idNumber: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Phone Number *</label>
                                    <input type="text" required placeholder="254712345678" value={addForm.phoneNumber} onChange={e => setAddForm({ ...addForm, phoneNumber: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Alternative Phone</label>
                                    <input type="text" placeholder="254798765432" value={addForm.altPhone} onChange={e => setAddForm({ ...addForm, altPhone: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Email Address</label>
                                    <input type="email" placeholder="subscriber@example.com" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Address</label>
                                    <input type="text" placeholder="House 4B, Westlands Road" value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Location / Building</label>
                                    <input type="text" placeholder="Nairobi" value={addForm.location} onChange={e => setAddForm({ ...addForm, location: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Account & Credentials */}
                        <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                            <h3 className="text-xs font-black uppercase text-sky-600 tracking-wider">2. Account Credentials & Service Type</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Connection Type</label>
                                    <select value={addForm.connectionType} onChange={e => setAddForm({ ...addForm, connectionType: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                        <option value="HOTSPOT">Hotspot User</option>
                                        <option value="PPPOE">PPPoE User</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Customer Category</label>
                                    <select value={addForm.customerType} onChange={e => setAddForm({ ...addForm, customerType: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                        <option value="RESIDENTIAL">Residential</option>
                                        <option value="BUSINESS">Business</option>
                                        <option value="CORPORATE">Corporate</option>
                                        <option value="INSTITUTION">Institution</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Login Username</label>
                                    <input type="text" placeholder="johndoe" value={addForm.username} onChange={e => setAddForm({ ...addForm, username: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Login Password</label>
                                    <input type="text" placeholder="Pass123!" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Billing & Router Assignment */}
                        <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                            <h3 className="text-xs font-black uppercase text-sky-600 tracking-wider">3. Billing, Router & Wallet Setup</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Assign Package</label>
                                    <select value={addForm.packageId} onChange={e => setAddForm({ ...addForm, packageId: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                        <option value="">No Initial Package</option>
                                        {packages.map(p => <option key={p.id} value={p.id}>{p.name} (KES {p.price})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Assign Router</label>
                                    <select value={addForm.routerId} onChange={e => setAddForm({ ...addForm, routerId: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                        <option value="">Unassigned</option>
                                        {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host || r.ipAddress || 'Router'})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Customer Group</label>
                                    <select value={addForm.customerGroupId} onChange={e => setAddForm({ ...addForm, customerGroupId: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500">
                                        <option value="">Default Group</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Initial Wallet Deposit (KES)</label>
                                    <input type="number" placeholder="500" value={addForm.initialBalanceKES} onChange={e => setAddForm({ ...addForm, initialBalanceKES: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 flex items-center justify-between">
                                        Device Binding (MAC Address)
                                        <button type="button" onClick={handleDiscoverDevices} disabled={discovering || !addForm.routerId} className="text-sky-400 font-bold text-[10px] hover:underline disabled:opacity-50">
                                            {discovering ? 'SCANNING...' : 'DISCOVER ON ROUTER'}
                                        </button>
                                    </label>
                                    <input type="text" placeholder="AA:BB:CC:DD:EE:FF" value={addForm.macAddress || ''} onChange={e => setAddForm({ ...addForm, macAddress: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold focus:outline-none focus:border-sky-500" />
                                    
                                    {discoveredDevices.length > 0 && (
                                        <div className="mt-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-2 max-h-40 overflow-y-auto">
                                            <div className="text-[10px] font-black uppercase text-[var(--text-muted)] mb-1 px-2">Select Discovered Device</div>
                                            {discoveredDevices.map(d => (
                                                <div key={d.macAddress} onClick={() => { setAddForm({ ...addForm, macAddress: d.macAddress }); setDiscoveredDevices([]); }} className="flex justify-between items-center p-2 hover:bg-sky-500/10 rounded-lg cursor-pointer transition-colors text-xs">
                                                    <span className="font-mono text-sky-500 font-bold">{d.macAddress}</span>
                                                    <span className="text-[var(--text-secondary)]">{d.address} {d.hostname && `(${d.hostname})`}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-6 pt-2 flex-wrap">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={addForm.notificationsEnabled} onChange={e => setAddForm({ ...addForm, notificationsEnabled: e.target.checked })} className="w-4 h-4 accent-sky-500 rounded" />
                                    <span className="text-xs font-bold text-[var(--text-secondary)]">Send Welcome Notifications (SMS/Email)</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={addForm.autoRenewal} onChange={e => setAddForm({ ...addForm, autoRenewal: e.target.checked })} className="w-4 h-4 accent-sky-500 rounded" />
                                    <span className="text-xs font-bold text-[var(--text-secondary)]">Enable Auto Renewal</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={addForm.isDraft} onChange={e => setAddForm({ ...addForm, isDraft: e.target.checked })} className="w-4 h-4 accent-sky-500 rounded" />
                                    <span className="text-xs font-bold text-[var(--text-secondary)]">Save as Draft</span>
                                </label>
                            </div>
                        </div>

                        <button type="submit" disabled={formLoading} className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl text-sm shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                            {formLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                            Create & Synchronise Subscriber
                        </button>
                    </form>
                </div>
            )}

            {/* ── VIEW 3: BULK IMPORT ── */}
            {activeTab === 'import' && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-8 shadow-md text-center space-y-4">
                        <Upload className="w-12 h-12 text-sky-500 mx-auto opacity-80" />
                        <h2 className="text-lg font-black text-[var(--text-primary)]">Bulk Import Subscribers via CSV / Excel</h2>
                        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">Upload a structured CSV file to import multiple subscribers. Dry-run validation and atomic database rollback ensure zero partial failures.</p>

                        <div className="flex items-center justify-center gap-4 pt-2">
                            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-sky-500 rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all">
                                <Download className="w-4 h-4" /> Download CSV Template
                            </button>
                            <label className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md">
                                <Upload className="w-4 h-4" /> Select CSV File
                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    </div>

                    {importSuccessMsg && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-2xl flex items-center gap-3 text-sm font-semibold">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> {importSuccessMsg}
                        </div>
                    )}

                    {importErrors.length > 0 && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 rounded-2xl space-y-2">
                            <div className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Import Errors Detected (Atomic Rollback Active)</div>
                            <ul className="text-xs list-disc pl-5 space-y-1">
                                {importErrors.map((err, idx) => (
                                    <li key={idx}>Row {err.row}: {err.field} — {err.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {csvRows.length > 0 && (
                        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-[var(--text-primary)] text-sm">Dry-Run Preview ({csvRows.length} Rows Detected)</h3>
                                <button onClick={handleExecuteImport} disabled={importing} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2">
                                    {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Execute Import Batch
                                </button>
                            </div>
                            <div className="overflow-x-auto max-h-80">
                                <table className="w-full text-xs font-mono">
                                    <thead>
                                        <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-left">
                                            <th className="py-2 px-3">#</th>
                                            <th className="py-2 px-3">Name</th>
                                            <th className="py-2 px-3">Phone</th>
                                            <th className="py-2 px-3">Username</th>
                                            <th className="py-2 px-3">Type</th>
                                            <th className="py-2 px-3">Deposit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvRows.map((r, i) => (
                                            <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                                                <td className="py-2 px-3 text-[var(--text-muted)]">{i + 1}</td>
                                                <td className="py-2 px-3 font-bold text-[var(--text-primary)]">{r.firstName || r.name || 'N/A'}</td>
                                                <td className="py-2 px-3">{r.phoneNumber || r.phone}</td>
                                                <td className="py-2 px-3">{r.username}</td>
                                                <td className="py-2 px-3">{r.customerType || 'RESIDENTIAL'}</td>
                                                <td className="py-2 px-3 font-bold text-emerald-600">KES {r.initialBalanceKES || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── VIEW 4: SUBSCRIBER GROUPS ── */}
            {activeTab === 'groups' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--text-muted)]">Group subscribers for bulk discounts and collective policy management</p>
                        <button onClick={() => setShowGroupModal(true)} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all shadow-md">
                            <Plus className="w-4 h-4" /> Create Group
                        </button>
                    </div>

                    {groups.length === 0 ? (
                        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                            <Layers className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                            <p className="text-[var(--text-muted)] font-semibold">No subscriber groups created yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {groups.map(g => (
                                <div key={g.id} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-black text-[var(--text-primary)] text-base">{g.name}</h3>
                                        <span className="px-2 py-0.5 bg-sky-500/10 text-sky-600 rounded-md text-xs font-bold">{g.discountPercentage}% Discount</span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)]">{g.description || 'No description provided'}</p>
                                    <div className="text-xs font-bold text-[var(--text-secondary)] pt-2">
                                        {(g as any).subscribers?.length || 0} Subscribers Assigned
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Group Modal */}
                    {showGroupModal && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 max-w-md w-full space-y-4 shadow-2xl">
                                <h3 className="font-black text-[var(--text-primary)] text-base">Create Subscriber Group</h3>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Group Name</label>
                                    <input type="text" placeholder="e.g. VIP Corporate" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Description</label>
                                    <textarea rows={2} placeholder="Group purpose..." value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Group Discount (%)</label>
                                    <input type="number" value={groupForm.discountPercentage} onChange={e => setGroupForm({ ...groupForm, discountPercentage: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold" />
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 text-xs font-bold text-[var(--text-muted)]">Cancel</button>
                                    <button onClick={handleSaveGroup} className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-bold">Save Group</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── SUBSCRIBER DETAIL DRAWER / MODAL ── */}
            {viewSub && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end p-4">
                    <div className="bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] h-full max-w-xl w-full p-6 overflow-y-auto space-y-6 shadow-2xl rounded-l-3xl">
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                            <div>
                                <h2 className="text-lg font-black text-[var(--text-primary)]">{viewSub.name || 'Subscriber'}</h2>
                                <div className="text-xs text-[var(--text-muted)] font-mono">@{viewSub.username || viewSub.phoneNumber}</div>
                            </div>
                            <button onClick={() => setViewSub(null)} className="p-2 hover:bg-[var(--bg-surface-elevated)] rounded-xl text-[var(--text-muted)]">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Wallet Section */}
                        <div className="bg-[var(--bg-surface-elevated)] rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-black uppercase text-[var(--text-muted)]">Customer Wallet Balance</div>
                                <div className="text-xl font-black text-emerald-600">KES {subDetails?.wallet?.balanceKES?.toFixed(2) || '0.00'}</div>
                            </div>
                            <form onSubmit={handleWalletSubmit} className="flex gap-2 pt-2">
                                <select value={walletAction.action} onChange={e => setWalletAction({ ...walletAction, action: e.target.value as any })}
                                    className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold px-2 py-1.5 rounded-xl">
                                    <option value="CREDIT">Credit (+)</option>
                                    <option value="DEBIT">Debit (-)</option>
                                </select>
                                <input type="number" placeholder="Amount KES" value={walletAction.amount} onChange={e => setWalletAction({ ...walletAction, amount: e.target.value })}
                                    className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold px-3 py-1.5 rounded-xl" />
                                <button type="submit" className="px-3 py-1.5 bg-sky-500 text-white rounded-xl text-xs font-bold">Apply</button>
                            </form>
                        </div>

                        {/* Account Actions */}
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleStatusAction(viewSub.id, viewSub.status === 'SUSPENDED' ? 'REACTIVATE' : 'SUSPEND')} className="flex-1 py-2 bg-amber-500/10 text-amber-600 rounded-xl text-xs font-bold hover:bg-amber-500/20">
                                {viewSub.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                            </button>
                            <button onClick={() => handleStatusAction(viewSub.id, 'DELETE')} className="flex-1 py-2 bg-rose-500/10 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-500/20">
                                Delete Subscriber
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscribersManagement;
