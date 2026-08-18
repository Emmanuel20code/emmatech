import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Smartphone, Monitor, Laptop, HelpCircle, Trash2, Shield, ShieldOff,
    CheckCircle, Sparkles, RefreshCw, Power, Plus, Copy, Check, Tv
} from 'lucide-react';

export default function DeviceBindingsView({ routers, subscribers }: { routers: any[], subscribers: any[] }) {
    const [bindings, setBindings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
    const [showDiscovery, setShowDiscovery] = useState(false);
    const [copiedMac, setCopiedMac] = useState<string | null>(null);

    const [form, setForm] = useState({
        macAddress: '',
        deviceType: 'TV',
        bindingType: 'BYPASSED',
        routerId: routers[0]?.id || '',
        subscriberId: '',
        comments: ''
    });

    const fetchBindings = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/v1/admin/device-bindings');
            setBindings(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const scanRouter = async () => {
        try {
            setScanning(true);
            const targetRouter = form.routerId || routers[0]?.id;
            const res = await axios.get(`/api/v1/admin/device-bindings/discover${targetRouter ? `?routerId=${targetRouter}` : ''}`);
            setDiscoveredDevices(res.data.devices || []);
            setShowDiscovery(true);
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to scan router');
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        fetchBindings();
    }, []);

    const handleMacChange = (value: string) => {
        const clean = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        let formatted = clean;
        if (clean.length > 0) {
            const parts = clean.match(/.{1,2}/g);
            if (parts) formatted = parts.slice(0, 6).join(':');
        }
        setForm(prev => ({ ...prev, macAddress: formatted }));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/v1/admin/device-bindings', form);
            setForm(prev => ({ ...prev, macAddress: '', comments: '' }));
            fetchBindings();
            setShowDiscovery(false);
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to bind device');
        }
    };

    const handleToggleSuspend = async (b: any) => {
        try {
            await axios.patch(`/api/v1/admin/device-bindings/${b.id}/status`, { action: 'toggle' });
            fetchBindings();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to toggle status');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Remove this device binding?')) return;
        try {
            await axios.delete(`/api/v1/admin/device-bindings/${id}`);
            fetchBindings();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to remove binding');
        }
    };

    const handlePickDiscovered = (d: any) => {
        setForm({
            macAddress: d.macAddress,
            deviceType: d.deviceType || 'TV',
            bindingType: 'BYPASSED',
            routerId: d.routerId || form.routerId || routers[0]?.id || '',
            subscriberId: '',
            comments: `${d.hostName || d.deviceType} (${d.ipAddress})`
        });
        setShowDiscovery(false);
    };

    const copyMac = (mac: string) => {
        navigator.clipboard.writeText(mac);
        setCopiedMac(mac);
        setTimeout(() => setCopiedMac(null), 2000);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'SMARTPHONE': return <Smartphone className="w-5 h-5 text-sky-500" />;
            case 'TV': return <Tv className="w-5 h-5 text-purple-500" />;
            case 'LAPTOP': return <Laptop className="w-5 h-5 text-emerald-500" />;
            default: return <HelpCircle className="w-5 h-5 text-slate-500" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Form Section */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Hotspot Device & TV MAC Binding</h3>
                        <p className="text-xs text-[var(--text-muted)]">
                            Bind Smart TVs, consoles, and mobile devices by MAC address to bypass captive login or block access.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={scanRouter}
                        disabled={scanning}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all self-start"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{scanning ? 'Scanning Router...' : 'Find MAC / Connected TVs'}</span>
                    </button>
                </div>

                {/* Discovered devices drawer */}
                {showDiscovery && (
                    <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" /> Discovered Connected Devices
                            </span>
                            <button onClick={() => setShowDiscovery(false)} className="text-xs text-[var(--text-muted)] hover:text-white">
                                Close
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {discoveredDevices.map(d => (
                                <div key={d.macAddress} className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-2">
                                    <div className="truncate">
                                        <div className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1">
                                            {getIcon(d.deviceType)}
                                            <span className="truncate">{d.hostName || d.deviceType}</span>
                                        </div>
                                        <div className="font-mono text-[11px] text-[var(--text-muted)]">{d.macAddress}</div>
                                    </div>
                                    <button
                                        onClick={() => handlePickDiscovered(d)}
                                        className="text-xs bg-sky-500 hover:bg-sky-400 text-white font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                                    >
                                        Use MAC
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
                    <div className="col-span-1 md:col-span-2 lg:col-span-1 xl:col-span-1">
                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">MAC Address</label>
                        <input
                            required
                            type="text"
                            placeholder="AA:BB:CC:DD:EE:FF"
                            value={form.macAddress}
                            onChange={e => handleMacChange(e.target.value)}
                            maxLength={17}
                            className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono uppercase rounded-xl px-4 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Device</label>
                        <select value={form.deviceType} onChange={e => setForm({...form, deviceType: e.target.value})} className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm">
                            <option value="TV">📺 Smart TV</option>
                            <option value="SMARTPHONE">📱 Smartphone</option>
                            <option value="LAPTOP">💻 Laptop/PC</option>
                            <option value="OTHER">🔌 Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Action / Policy</label>
                        <select value={form.bindingType} onChange={e => setForm({...form, bindingType: e.target.value})} className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm font-bold">
                            <option value="BYPASSED">Bypassed (Free Internet)</option>
                            <option value="BLOCKED">Blocked (Suspended)</option>
                            <option value="REGULAR">Regular (Requires Login)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Router</label>
                        <select required value={form.routerId} onChange={e => setForm({...form, routerId: e.target.value})} className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm">
                            <option value="">Select Router...</option>
                            {routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Subscriber (Optional)</label>
                        <select value={form.subscriberId} onChange={e => setForm({...form, subscriberId: e.target.value})} className="w-full bg-[var(--bg-background)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm">
                            <option value="">Standalone Device</option>
                            {subscribers.map(s => <option key={s.id} value={s.id}>{s.name || s.username || s.phoneNumber}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-2 px-4 rounded-xl transition-colors h-10 text-sm">
                        Bind Device
                    </button>
                </form>
            </div>

            {/* Bindings Table */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--bg-background)] border-b border-[var(--border-subtle)]">
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Device</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">MAC Address</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Type / Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Subscriber / Router</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-xs text-[var(--text-muted)]">Loading bindings...</td></tr>
                        ) : bindings.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No device bindings found.</td></tr>
                        ) : bindings.map(b => (
                            <tr key={b.id} className="hover:bg-[var(--bg-background)]/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-background)] flex items-center justify-center border border-[var(--border-subtle)]">
                                            {getIcon(b.deviceType)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-[var(--text-primary)]">{b.deviceType === 'TV' ? 'Smart TV' : b.deviceType}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{b.comments || 'No comment'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-sm font-bold text-[var(--text-primary)]">
                                    <div className="flex items-center gap-2">
                                        <span>{b.macAddress}</span>
                                        <button onClick={() => copyMac(b.macAddress)} className="text-[var(--text-muted)] hover:text-sky-400">
                                            {copiedMac === b.macAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {b.bindingType === 'BYPASSED' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            <CheckCircle className="w-3 h-3"/> Bypassed
                                        </span>
                                    ) : b.bindingType === 'BLOCKED' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                            <ShieldOff className="w-3 h-3"/> Suspended
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                            <Shield className="w-3 h-3"/> Regular
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-[var(--text-primary)]">{b.subscriber ? (b.subscriber.name || b.subscriber.username || b.subscriber.phoneNumber) : 'Standalone Device'}</div>
                                    <div className="text-xs text-[var(--text-muted)]">{b.router?.name}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleToggleSuspend(b)}
                                            className={`p-2 rounded-lg text-xs font-bold transition-colors ${
                                                b.bindingType === 'BLOCKED'
                                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                            }`}
                                            title={b.bindingType === 'BLOCKED' ? 'Unsuspend' : 'Suspend'}
                                        >
                                            <Power className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(b.id)}
                                            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                            title="Delete Binding"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
