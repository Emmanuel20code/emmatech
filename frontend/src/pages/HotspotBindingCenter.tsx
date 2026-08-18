import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Tv, Smartphone, Laptop, HelpCircle, Trash2, Shield, ShieldOff,
    CheckCircle, Search, RefreshCw, Plus, Wifi, Radio,
    Copy, Check, AlertTriangle, Filter, Edit3, X, Sparkles, Layers,
    ChevronRight, ArrowRight, ShieldCheck, Power
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeviceBindingItem {
    id: string;
    tenantId: string;
    routerId: string;
    subscriberId: string | null;
    macAddress: string;
    deviceType: 'TV' | 'SMARTPHONE' | 'LAPTOP' | 'OTHER';
    bindingType: 'BYPASSED' | 'BLOCKED' | 'REGULAR';
    comments: string | null;
    createdAt: string;
    subscriber?: { id: string; name: string; username: string; phoneNumber: string; email?: string };
    router?: { id: string; name: string; ipAddress: string; host: string; isOnline: boolean };
}

interface DiscoveredDevice {
    macAddress: string;
    ipAddress: string;
    hostName: string;
    deviceType: 'TV' | 'SMARTPHONE' | 'LAPTOP' | 'OTHER';
    routerId: string;
    routerName: string;
    uptime: string;
    idleTime: string;
    bytesIn: number;
    bytesOut: number;
    isAuthorized: boolean;
    isBypassed: boolean;
    isBound: boolean;
    bindingId: string | null;
    bindingType: 'BYPASSED' | 'BLOCKED' | 'REGULAR' | null;
    source: string;
}

export default function HotspotBindingCenter() {
    const [bindings, setBindings] = useState<DeviceBindingItem[]>([]);
    const [routers, setRouters] = useState<any[]>([]);
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'TV' | 'SMARTPHONE' | 'BYPASSED' | 'BLOCKED'>('ALL');
    const [selectedRouterId, setSelectedRouterId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'manage' | 'discover' | 'manual'>('manage');
    
    const [copiedMac, setCopiedMac] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Form state for Manual Creation or Pre-filling from Scanner
    const [form, setForm] = useState({
        macAddress: '',
        deviceType: 'TV' as 'TV' | 'SMARTPHONE' | 'LAPTOP' | 'OTHER',
        bindingType: 'BYPASSED' as 'BYPASSED' | 'BLOCKED' | 'REGULAR',
        routerId: '',
        subscriberId: '',
        comments: ''
    });

    // Edit Modal State
    const [editingBinding, setEditingBinding] = useState<DeviceBindingItem | null>(null);
    const [editForm, setEditForm] = useState({
        deviceType: 'TV' as 'TV' | 'SMARTPHONE' | 'LAPTOP' | 'OTHER',
        bindingType: 'BYPASSED' as 'BYPASSED' | 'BLOCKED' | 'REGULAR',
        subscriberId: '',
        comments: '',
        routerId: ''
    });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const fetchRoutersAndSubs = async () => {
        try {
            const [rRes, sRes] = await Promise.allSettled([
                axios.get('/api/v1/routers'),
                axios.get('/api/v1/admin/subscribers?limit=200')
            ]);
            const rList = rRes.status === 'fulfilled' ? (rRes.value.data.routers || rRes.value.data || []) : [];
            const sList = sRes.status === 'fulfilled' ? (sRes.value.data.subscribers || sRes.value.data || []) : [];
            setRouters(rList);
            setSubscribers(sList);
            if (rList.length > 0 && !selectedRouterId) {
                setSelectedRouterId(rList[0].id);
                setForm(prev => ({ ...prev, routerId: rList[0].id }));
            }
        } catch (e) {
            console.error('Failed to load routers/subscribers', e);
        }
    };

    const fetchBindings = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/v1/admin/device-bindings');
            setBindings(res.data);
        } catch (e: any) {
            console.error(e);
            showToast('Failed to fetch device bindings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const scanForDevices = async (routerIdOverride?: string) => {
        try {
            setScanning(true);
            const targetRouter = routerIdOverride || selectedRouterId;
            const res = await axios.get(`/api/v1/admin/device-bindings/discover${targetRouter ? `?routerId=${targetRouter}` : ''}`);
            setDiscoveredDevices(res.data.devices || []);
            showToast(`Found ${res.data.total || 0} connected devices (${res.data.tvCount || 0} Smart TVs)`);
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Failed to scan router for devices', 'error');
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        fetchRoutersAndSubs();
        fetchBindings();
    }, []);

    // Format MAC with colons automatically as the user types
    const handleMacInput = (value: string, isEditing = false) => {
        const clean = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        let formatted = clean;
        if (clean.length > 0) {
            const parts = clean.match(/.{1,2}/g);
            if (parts) {
                formatted = parts.slice(0, 6).join(':');
            }
        }
        if (isEditing) {
            // Read-only MAC on edit
        } else {
            setForm(prev => ({ ...prev, macAddress: formatted }));
        }
    };

    const handleCreateBinding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.macAddress) {
            showToast('Please provide a valid MAC address', 'error');
            return;
        }
        try {
            const res = await axios.post('/api/v1/admin/device-bindings', form);
            showToast(res.data.syncWarning || 'Device bound successfully!', 'success');
            setForm(prev => ({ ...prev, macAddress: '', comments: '' }));
            fetchBindings();
            if (activeTab === 'manual') {
                setActiveTab('manage');
            }
            // Update discovery list state if present
            setDiscoveredDevices(prev => prev.map(d => 
                d.macAddress.toUpperCase() === form.macAddress.toUpperCase() 
                    ? { ...d, isBound: true, bindingType: form.bindingType } 
                    : d
            ));
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to bind device', 'error');
        }
    };

    const handleSelectDiscoveredDevice = (device: DiscoveredDevice) => {
        setForm({
            macAddress: device.macAddress,
            deviceType: device.deviceType,
            bindingType: 'BYPASSED',
            routerId: device.routerId || selectedRouterId || (routers[0]?.id || ''),
            subscriberId: '',
            comments: `${device.hostName || device.deviceType} (${device.ipAddress})`
        });
        setActiveTab('manual');
        showToast(`MAC ${device.macAddress} copied to binding form`);
    };

    const handleQuickBindDiscovered = async (device: DiscoveredDevice, type: 'BYPASSED' | 'BLOCKED' = 'BYPASSED') => {
        try {
            await axios.post('/api/v1/admin/device-bindings', {
                macAddress: device.macAddress,
                deviceType: device.deviceType,
                bindingType: type,
                routerId: device.routerId || selectedRouterId || routers[0]?.id,
                comments: `${device.hostName || device.deviceType} (${device.ipAddress})`
            });
            showToast(`${device.deviceType === 'TV' ? 'Smart TV' : 'Device'} (${device.macAddress}) bound as ${type}!`);
            fetchBindings();
            setDiscoveredDevices(prev => prev.map(d => 
                d.macAddress === device.macAddress 
                    ? { ...d, isBound: true, bindingType: type } 
                    : d
            ));
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Failed to bind device', 'error');
        }
    };

    const handleToggleSuspend = async (binding: DeviceBindingItem) => {
        try {
            const isCurrentlyBlocked = binding.bindingType === 'BLOCKED';
            const newAction = isCurrentlyBlocked ? 'activate' : 'suspend';
            const res = await axios.patch(`/api/v1/admin/device-bindings/${binding.id}/status`, {
                action: newAction
            });
            showToast(res.data.message || (isCurrentlyBlocked ? 'Device access activated' : 'Device access suspended'));
            fetchBindings();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to toggle suspension', 'error');
        }
    };

    const handleDeleteBinding = async (id: string, mac: string) => {
        if (!window.confirm(`Are you sure you want to remove binding for ${mac}? The device will no longer have bypassed/blocked access.`)) {
            return;
        }
        try {
            await axios.delete(`/api/v1/admin/device-bindings/${id}`);
            showToast('Device binding deleted successfully');
            fetchBindings();
            setDiscoveredDevices(prev => prev.map(d => 
                d.macAddress.toUpperCase() === mac.toUpperCase() 
                    ? { ...d, isBound: false, bindingType: null } 
                    : d
            ));
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to remove binding', 'error');
        }
    };

    const handleOpenEdit = (binding: DeviceBindingItem) => {
        setEditingBinding(binding);
        setEditForm({
            deviceType: binding.deviceType,
            bindingType: binding.bindingType,
            subscriberId: binding.subscriberId || '',
            comments: binding.comments || '',
            routerId: binding.routerId
        });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBinding) return;
        try {
            await axios.put(`/api/v1/admin/device-bindings/${editingBinding.id}`, editForm);
            showToast('Device binding updated successfully');
            setEditingBinding(null);
            fetchBindings();
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Failed to update binding', 'error');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMac(text);
        setTimeout(() => setCopiedMac(null), 2000);
    };

    const getDeviceIcon = (type: string) => {
        switch (type) {
            case 'TV': return <Tv className="w-5 h-5 text-purple-400" />;
            case 'SMARTPHONE': return <Smartphone className="w-5 h-5 text-sky-400" />;
            case 'LAPTOP': return <Laptop className="w-5 h-5 text-emerald-400" />;
            default: return <HelpCircle className="w-5 h-5 text-slate-400" />;
        }
    };

    // Filtered bindings
    const filteredBindings = bindings.filter(b => {
        const matchesSearch = 
            b.macAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (b.comments && b.comments.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (b.subscriber && (b.subscriber.name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.subscriber.username?.toLowerCase().includes(searchQuery.toLowerCase()) || b.subscriber.phoneNumber?.includes(searchQuery))) ||
            (b.router && b.router.name.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        if (filterType === 'TV') return b.deviceType === 'TV';
        if (filterType === 'SMARTPHONE') return b.deviceType === 'SMARTPHONE';
        if (filterType === 'BYPASSED') return b.bindingType === 'BYPASSED';
        if (filterType === 'BLOCKED') return b.bindingType === 'BLOCKED';
        return true;
    });

    const tvCount = bindings.filter(b => b.deviceType === 'TV').length;
    const bypassedCount = bindings.filter(b => b.bindingType === 'BYPASSED').length;
    const suspendedCount = bindings.filter(b => b.bindingType === 'BLOCKED').length;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-sky-500/30 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
                            <Wifi className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                                Hotspot Device & TV MAC Binding
                            </h1>
                            <p className="text-sm text-[var(--text-muted)]">
                                Bind Smart TVs, gaming consoles & phones by MAC address for instant bypass or restriction.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => {
                            setActiveTab('discover');
                            scanForDevices();
                        }}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Find Connected MAC / TV</span>
                    </button>
                    <button
                        onClick={() => setActiveTab(activeTab === 'manual' ? 'manage' : 'manual')}
                        className="flex items-center gap-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-background)] text-[var(--text-primary)] font-bold text-sm px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] transition-all"
                    >
                        <Plus className="w-4 h-4 text-sky-400" />
                        <span>Manual MAC Input</span>
                    </button>
                    <button
                        onClick={fetchBindings}
                        className="p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-background)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all"
                        title="Refresh Bindings"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Toast Feedback */}
            <AnimatePresence>
                {feedback && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-xl border flex items-center justify-between shadow-lg text-sm font-semibold ${
                            feedback.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            <span>{feedback.message}</span>
                        </div>
                        <button onClick={() => setFeedback(null)} className="hover:opacity-75">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Bound Devices</div>
                        <div className="text-2xl font-black text-[var(--text-primary)] mt-1">{bindings.length}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                        <Wifi className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Smart TVs Bound</div>
                        <div className="text-2xl font-black text-purple-400 mt-1">{tvCount}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                        <Tv className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Active / Bypassed</div>
                        <div className="text-2xl font-black text-emerald-400 mt-1">{bypassedCount}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Suspended / Blocked</div>
                        <div className="text-2xl font-black text-rose-400 mt-1">{suspendedCount}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
                        <ShieldOff className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('manage')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'manage'
                            ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>All Bindings ({bindings.length})</span>
                </button>
                <button
                    onClick={() => {
                        setActiveTab('discover');
                        if (discoveredDevices.length === 0) scanForDevices();
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'discover'
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                    }`}
                >
                    <Sparkles className="w-4 h-4 text-purple-300" />
                    <span>Find Connected MAC / TV Scanner</span>
                    {discoveredDevices.length > 0 && (
                        <span className="bg-purple-800 text-purple-200 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                            {discoveredDevices.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'manual'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                    }`}
                >
                    <Plus className="w-4 h-4" />
                    <span>Manual MAC Binding Input</span>
                </button>
            </div>

            {/* TAB 1: DEVICE DISCOVERY SCANNER (Find MAC address for binding) */}
            {activeTab === 'discover' && (
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                <span>Live Network Device Discovery</span>
                            </h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Scans router Hotspot Hosts and DHCP Leases to detect Smart TVs and connected devices without needing manual MAC typing.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <select
                                value={selectedRouterId}
                                onChange={e => {
                                    setSelectedRouterId(e.target.value);
                                    scanForDevices(e.target.value);
                                }}
                                className="bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-3 py-2"
                            >
                                <option value="">All Connected Routers</option>
                                {routers.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.ipAddress || r.host})</option>
                                ))}
                            </select>

                            <button
                                onClick={() => scanForDevices()}
                                disabled={scanning}
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-md shadow-purple-600/20"
                            >
                                <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                                <span>{scanning ? 'Scanning Router...' : 'Scan Now'}</span>
                            </button>
                        </div>
                    </div>

                    {scanning ? (
                        <div className="py-16 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mx-auto" />
                            <div className="font-bold text-[var(--text-primary)]">Querying Router for Connected Devices...</div>
                            <div className="text-xs text-[var(--text-muted)]">Scanning Hotspot hosts, Wi-Fi clients, and DHCP leases</div>
                        </div>
                    ) : discoveredDevices.length === 0 ? (
                        <div className="py-12 text-center space-y-3">
                            <Wifi className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
                            <div className="font-bold text-[var(--text-primary)]">No unhandled devices discovered</div>
                            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                                Click "Scan Now" while devices or Smart TVs are connected to your Wi-Fi hotspot to detect their MAC addresses automatically.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {discoveredDevices.map((dev) => (
                                <div
                                    key={dev.macAddress}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        dev.isBound
                                            ? 'bg-[var(--bg-background)]/50 border-[var(--border-subtle)] opacity-75'
                                            : dev.deviceType === 'TV'
                                            ? 'bg-purple-950/20 border-purple-500/30 hover:border-purple-500/60 shadow-lg shadow-purple-500/5'
                                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-sky-500/40'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                                dev.deviceType === 'TV' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                                                dev.deviceType === 'SMARTPHONE' ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' :
                                                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                            }`}>
                                                {getDeviceIcon(dev.deviceType)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                                                    <span>{dev.hostName || (dev.deviceType === 'TV' ? 'Smart TV' : 'Connected Device')}</span>
                                                    {dev.deviceType === 'TV' && (
                                                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">TV</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-[var(--text-muted)] font-mono">{dev.ipAddress || 'Dynamic IP'}</div>
                                            </div>
                                        </div>

                                        {dev.isBound ? (
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                                dev.bindingType === 'BLOCKED' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                                            }`}>
                                                <Check className="w-3 h-3" />
                                                <span>{dev.bindingType === 'BLOCKED' ? 'Suspended' : 'Bound'}</span>
                                            </span>
                                        ) : (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                                                Unbound
                                            </span>
                                        )}
                                    </div>

                                    {/* MAC Address Bar */}
                                    <div className="mt-3 p-2.5 rounded-xl bg-[var(--bg-background)] border border-[var(--border-subtle)] flex items-center justify-between">
                                        <div className="font-mono text-xs font-bold text-[var(--text-primary)]">
                                            {dev.macAddress}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(dev.macAddress)}
                                            className="p-1 text-[var(--text-muted)] hover:text-sky-400 transition-colors"
                                            title="Copy MAC Address"
                                        >
                                            {copiedMac === dev.macAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                                        <span>Router: <strong className="text-[var(--text-secondary)]">{dev.routerName}</strong></span>
                                        <span>Status: <strong className="text-[var(--text-secondary)]">{dev.uptime}</strong></span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
                                        {!dev.isBound ? (
                                            <>
                                                <button
                                                    onClick={() => handleQuickBindDiscovered(dev, 'BYPASSED')}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    <span>1-Click Bypass TV</span>
                                                </button>
                                                <button
                                                    onClick={() => handleSelectDiscoveredDevice(dev)}
                                                    className="bg-[var(--bg-background)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs p-2 rounded-xl transition-all border border-[var(--border-subtle)]"
                                                    title="Custom Configuration"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    const existing = bindings.find(b => b.macAddress.toUpperCase() === dev.macAddress.toUpperCase());
                                                    if (existing) handleToggleSuspend(existing);
                                                }}
                                                className={`w-full font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 border ${
                                                    dev.bindingType === 'BLOCKED'
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                                                }`}
                                            >
                                                {dev.bindingType === 'BLOCKED' ? <Power className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                                                <span>{dev.bindingType === 'BLOCKED' ? 'Unsuspend Access' : 'Suspend Access'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: MANUAL MAC INPUT FORM */}
            {activeTab === 'manual' && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Plus className="w-5 h-5 text-sky-400" />
                            <span>Manual Hotspot Device MAC Binding</span>
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            Type or paste a device MAC address to bypass captive portal login or block network access.
                        </p>
                    </div>

                    <form onSubmit={handleCreateBinding} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* MAC Address */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                    MAC Address *
                                </label>
                                <div className="relative">
                                    <input
                                        required
                                        type="text"
                                        placeholder="AA:BB:CC:DD:EE:FF"
                                        maxLength={17}
                                        value={form.macAddress}
                                        onChange={e => handleMacInput(e.target.value)}
                                        className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-sm rounded-xl px-4 py-2.5 tracking-wider uppercase focus:border-sky-500 focus:outline-none"
                                    />
                                    {form.macAddress.length === 17 && (
                                        <CheckCircle className="w-4 h-4 text-emerald-400 absolute right-3 top-3" />
                                    )}
                                </div>
                                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                                    Auto-formats colons as you type
                                </span>
                            </div>

                            {/* Device Type */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                    Device Type *
                                </label>
                                <select
                                    value={form.deviceType}
                                    onChange={e => setForm({ ...form, deviceType: e.target.value as any })}
                                    className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-sm rounded-xl px-4 py-2.5 focus:border-sky-500 focus:outline-none"
                                >
                                    <option value="TV">📺 Smart TV (Samsung, LG, Sony, Roku, etc.)</option>
                                    <option value="SMARTPHONE">📱 Smartphone (iPhone, Android)</option>
                                    <option value="LAPTOP">💻 Laptop / PC</option>
                                    <option value="OTHER">🔌 Other Device (Console, Camera, POS)</option>
                                </select>
                            </div>

                            {/* Binding Policy */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                    Binding Policy / Action *
                                </label>
                                <select
                                    value={form.bindingType}
                                    onChange={e => setForm({ ...form, bindingType: e.target.value as any })}
                                    className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-sm rounded-xl px-4 py-2.5 focus:border-sky-500 focus:outline-none"
                                >
                                    <option value="BYPASSED">✅ Bypassed (Free Internet / Skip Captive Portal)</option>
                                    <option value="BLOCKED">🚫 Blocked (Suspended from Internet)</option>
                                    <option value="REGULAR">🔒 Regular (Must Login via Portal)</option>
                                </select>
                            </div>

                            {/* Router Selection */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                    Target Router *
                                </label>
                                <select
                                    required
                                    value={form.routerId}
                                    onChange={e => setForm({ ...form, routerId: e.target.value })}
                                    className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2.5 focus:border-sky-500 focus:outline-none"
                                >
                                    <option value="">Select Router...</option>
                                    {routers.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.ipAddress || r.host})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Optional Subscriber */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                    Attach to Customer (Optional)
                                </label>
                                <select
                                    value={form.subscriberId}
                                    onChange={e => setForm({ ...form, subscriberId: e.target.value })}
                                    className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2.5 focus:border-sky-500 focus:outline-none"
                                >
                                    <option value="">Standalone Device (No Customer)</option>
                                    {subscribers.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name || s.username || s.phoneNumber} ({s.phoneNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Comments / Device Name */}
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                    Device Name / Comment (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Living Room 55'' TV"
                                    value={form.comments}
                                    onChange={e => setForm({ ...form, comments: e.target.value })}
                                    className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2.5 focus:border-sky-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                            <button
                                type="button"
                                onClick={() => setActiveTab('manage')}
                                className="px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold text-sm transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm transition-all shadow-lg shadow-sky-500/20"
                            >
                                Save & Bind Device
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB 3: MANAGE ALL BINDINGS TABLE */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-sm">
                {/* Search & Filter Header */}
                <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
                        <input
                            type="text"
                            placeholder="Search by MAC, device name, or customer..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl focus:border-sky-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5" /> Filter:
                        </span>
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterType === 'ALL' ? 'bg-sky-500 text-white' : 'bg-[var(--bg-background)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            All ({bindings.length})
                        </button>
                        <button
                            onClick={() => setFilterType('TV')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterType === 'TV' ? 'bg-purple-600 text-white' : 'bg-[var(--bg-background)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            Smart TVs ({tvCount})
                        </button>
                        <button
                            onClick={() => setFilterType('BYPASSED')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterType === 'BYPASSED' ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-background)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            Bypassed ({bypassedCount})
                        </button>
                        <button
                            onClick={() => setFilterType('BLOCKED')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filterType === 'BLOCKED' ? 'bg-rose-600 text-white' : 'bg-[var(--bg-background)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            Suspended ({suspendedCount})
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-background)] border-b border-[var(--border-subtle)]">
                                <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Device & Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">MAC Address</th>
                                <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Status / Policy</th>
                                <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Router / Customer</th>
                                <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mx-auto mb-2" />
                                        <div className="text-xs text-[var(--text-muted)]">Loading device bindings...</div>
                                    </td>
                                </tr>
                            ) : filteredBindings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <Tv className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50 mb-2" />
                                        <div className="font-bold text-[var(--text-primary)]">No device bindings found</div>
                                        <div className="text-xs text-[var(--text-muted)] mt-1">
                                            Click "Find Connected MAC / TV" or "Manual MAC Input" above to add your first binding.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBindings.map(b => {
                                    const isBlocked = b.bindingType === 'BLOCKED';
                                    const isBypassed = b.bindingType === 'BYPASSED';

                                    return (
                                        <tr key={b.id} className="hover:bg-[var(--bg-background)]/50 transition-colors">
                                            {/* Device & Name */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                                        b.deviceType === 'TV' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                                                        b.deviceType === 'SMARTPHONE' ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' :
                                                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                    }`}>
                                                        {getDeviceIcon(b.deviceType)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                                                            <span>{b.deviceType === 'TV' ? 'Smart TV' : b.deviceType}</span>
                                                            {b.deviceType === 'TV' && (
                                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase">TV</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-[var(--text-muted)] truncate max-w-xs">
                                                            {b.comments || 'No comment / room tag'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* MAC Address */}
                                            <td className="px-6 py-4 font-mono text-sm font-bold text-[var(--text-primary)]">
                                                <div className="flex items-center gap-2">
                                                    <span>{b.macAddress}</span>
                                                    <button
                                                        onClick={() => copyToClipboard(b.macAddress)}
                                                        className="p-1 text-[var(--text-muted)] hover:text-sky-400 transition-colors"
                                                        title="Copy MAC Address"
                                                    >
                                                        {copiedMac === b.macAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Status / Policy */}
                                            <td className="px-6 py-4">
                                                {isBypassed ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        <span>Bypassed (Active)</span>
                                                    </span>
                                                ) : isBlocked ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        <ShieldOff className="w-3.5 h-3.5" />
                                                        <span>Suspended (Blocked)</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                                        <Shield className="w-3.5 h-3.5" />
                                                        <span>Regular (Login Required)</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Router / Customer */}
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-semibold text-[var(--text-primary)]">
                                                    {b.subscriber ? (b.subscriber.name || b.subscriber.username || b.subscriber.phoneNumber) : 'Standalone Binding'}
                                                </div>
                                                <div className="text-xs text-[var(--text-muted)]">
                                                    {b.router?.name || 'Router'}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Suspend / Unsuspend Button */}
                                                    <button
                                                        onClick={() => handleToggleSuspend(b)}
                                                        className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                            isBlocked
                                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                                                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                                                        }`}
                                                        title={isBlocked ? 'Unsuspend / Activate Device' : 'Suspend / Block Device'}
                                                    >
                                                        {isBlocked ? <Power className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                                                        <span className="hidden sm:inline">{isBlocked ? 'Unsuspend' : 'Suspend'}</span>
                                                    </button>

                                                    {/* Edit Button */}
                                                    <button
                                                        onClick={() => handleOpenEdit(b)}
                                                        className="p-2 rounded-xl bg-[var(--bg-background)] hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all"
                                                        title="Edit Binding"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={() => handleDeleteBinding(b.id, b.macAddress)}
                                                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                                                        title="Delete Binding"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingBinding && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
                        >
                            <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-sky-400" />
                                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Edit Device Binding</h3>
                                </div>
                                <button onClick={() => setEditingBinding(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                        MAC Address (Read-only)
                                    </label>
                                    <input
                                        disabled
                                        type="text"
                                        value={editingBinding.macAddress}
                                        className="w-full bg-[var(--bg-background)]/50 border border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-sm rounded-xl px-4 py-2.5 cursor-not-allowed"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                            Device Type
                                        </label>
                                        <select
                                            value={editForm.deviceType}
                                            onChange={e => setEditForm({ ...editForm, deviceType: e.target.value as any })}
                                            className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2.5"
                                        >
                                            <option value="TV">Smart TV</option>
                                            <option value="SMARTPHONE">Smartphone</option>
                                            <option value="LAPTOP">Laptop / PC</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                            Binding Action
                                        </label>
                                        <select
                                            value={editForm.bindingType}
                                            onChange={e => setEditForm({ ...editForm, bindingType: e.target.value as any })}
                                            className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2.5 font-bold"
                                        >
                                            <option value="BYPASSED">Bypassed (Free Internet)</option>
                                            <option value="BLOCKED">Blocked (Suspended)</option>
                                            <option value="REGULAR">Regular (Requires Login)</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                        Device Name / Room Notes
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.comments}
                                        onChange={e => setEditForm({ ...editForm, comments: e.target.value })}
                                        placeholder="e.g. Master Bedroom Smart TV"
                                        className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2.5"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                                        Attach Customer (Optional)
                                    </label>
                                    <select
                                        value={editForm.subscriberId}
                                        onChange={e => setEditForm({ ...editForm, subscriberId: e.target.value })}
                                        className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-xl px-4 py-2.5"
                                    >
                                        <option value="">Standalone Device</option>
                                        {subscribers.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name || s.username || s.phoneNumber}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                                    <button
                                        type="button"
                                        onClick={() => setEditingBinding(null)}
                                        className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-md"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
