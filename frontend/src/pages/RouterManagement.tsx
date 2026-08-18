import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Router, Plus, RefreshCw, Wifi, WifiOff, Edit, Trash2, Zap,
    CheckCircle, XCircle, Clock, Activity, Play, Square, RotateCcw,
    TestTube, Settings, X, Save, Eye, Sparkles
} from 'lucide-react';
import RouterModal from '../components/Modals/RouterModal';

interface RouterRecord {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    isOnline: boolean;
    validationStatus: string;
    lastSeen?: string;
    identity?: string;
    version?: string;
}

const RouterManagement: React.FC = () => {
    const [routers, setRouters] = useState<RouterRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editRouter, setEditRouter] = useState<RouterRecord | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', host: '', port: '8728', username: 'admin', password: '' });
    const [formLoading, setFormLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/routers');
            const list = Array.isArray(res.data) ? res.data : (res.data?.routers || []);
            setRouters(list);
        } catch (e) {
            console.error('[RouterMgmt] Load failed:', e);
            setRouters([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const testRouter = async (id: string) => {
        setTestingId(id);
        setTestResult(null);
        try {
            const res = await axios.post<{ success: boolean; message: string }>(`/api/v1/admin/routers/${id}/test`);
            setTestResult({ id, ...res.data });
            await load();
        } catch (e: any) {
            setTestResult({ id, success: false, message: e.response?.data?.message || 'Test failed' });
        } finally { setTestingId(null); }
    };

    const deleteRouter = async (id: string) => {
        if (!confirm('Delete this router? This cannot be undone.')) return;
        try {
            await axios.delete(`/api/v1/routers/${id}`);
            await load();
        } catch (e: any) { alert(e.response?.data?.error || 'Delete failed'); }
    };

    const saveRouter = async () => {
        setFormLoading(true);
        try {
            if (editRouter) {
                await axios.put(`/api/v1/routers/${editRouter.id}`, form);
            } else {
                await axios.post('/api/v1/routers', form);
            }
            setShowAdd(false);
            setEditRouter(null);
            setForm({ name: '', host: '', port: '8728', username: 'admin', password: '' });
            await load();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Save failed');
        } finally { setFormLoading(false); }
    };

    const openEdit = (r: RouterRecord) => {
        setEditRouter(r);
        setForm({ name: r.name, host: r.host, port: String(r.port), username: r.username, password: '' });
        setShowAdd(true);
    };

    const statusBadge = (r: RouterRecord) => {
        if (r.isOnline) return (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
            </span>
        );
        return (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-600 rounded-full text-xs font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Offline
            </span>
        );
    };

    const validBadge = (v: string) => {
        const map: Record<string, { color: string; icon: React.ReactNode }> = {
            VALIDATED: { color: 'text-emerald-600 bg-emerald-500/10', icon: <CheckCircle className="w-3 h-3" /> },
            FAILED: { color: 'text-rose-600 bg-rose-500/10', icon: <XCircle className="w-3 h-3" /> },
            PENDING: { color: 'text-amber-600 bg-amber-500/10', icon: <Clock className="w-3 h-3" /> },
        };
        const s = map[v] || map.PENDING;
        return (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${s.color}`}>
                {s.icon} {v}
            </span>
        );
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Router className="w-5 h-5 text-sky-500" /> Router Management
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Manage your MikroTik routers and connections</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={load} className="p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl hover:border-sky-500 transition-all">
                        <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => { setEditRouter(null); setForm({ name: '', host: '', port: '8728', username: 'admin', password: '' }); setShowAdd(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all">
                        <Plus className="w-4 h-4" /> Add Router
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total', value: routers.length, color: 'text-[var(--text-primary)]' },
                    { label: 'Online', value: routers.filter(r => r.isOnline).length, color: 'text-emerald-600' },
                    { label: 'Offline', value: routers.filter(r => !r.isOnline).length, color: 'text-rose-600' },
                ].map(s => (
                    <div key={s.label} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                        <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold uppercase mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`flex items-center gap-3 p-4 rounded-2xl border ${testResult.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700' : 'bg-rose-500/5 border-rose-500/20 text-rose-700'}`}>
                    {testResult.success ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
                    <span className="text-sm font-semibold">{testResult.message}</span>
                    <button onClick={() => setTestResult(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Routers List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : routers.length === 0 ? (
                <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                    <Router className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-[var(--text-muted)] font-semibold">No routers configured yet</p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Click "Add Router" to connect your first MikroTik</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(Array.isArray(routers) ? routers : []).map((r, idx) => (
                        <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                            className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${r.isOnline ? 'bg-emerald-500/10' : 'bg-slate-500/10'}`}>
                                        {r.isOnline ? <Wifi className="w-6 h-6 text-emerald-600" /> : <WifiOff className="w-6 h-6 text-slate-500" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-black text-[var(--text-primary)]">{r.name}</h3>
                                            {statusBadge(r)}
                                            {validBadge(r.validationStatus)}
                                        </div>
                                        <div className="text-sm text-[var(--text-muted)] mt-0.5 flex items-center gap-3 flex-wrap">
                                            <span>{r.host}:{r.port}</span>
                                            {r.identity && <span>· {r.identity}</span>}
                                            {r.version && <span>· v{r.version}</span>}
                                            {r.lastSeen && <span>· Last: {new Date(r.lastSeen).toLocaleString()}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <button onClick={() => testRouter(r.id)} disabled={testingId === r.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 rounded-xl text-xs font-bold transition-all disabled:opacity-60">
                                        {testingId === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                                        Test
                                    </button>
                                    <button onClick={() => openEdit(r)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-sky-500 rounded-xl text-xs font-bold text-[var(--text-secondary)] transition-all">
                                        <Edit className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <button onClick={() => deleteRouter(r.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold transition-all">
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add Router Modal (Automated Location-Based Onboarding) */}
            <RouterModal
                isOpen={showAdd && !editRouter}
                onClose={() => { setShowAdd(false); setEditRouter(null); }}
                onSuccess={load}
            />

            {/* Edit Router Modal */}
            <AnimatePresence>
                {showAdd && editRouter && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-8 w-full max-w-md shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-[var(--text-primary)]">
                                    Edit Router Details
                                </h2>
                                <button onClick={() => { setShowAdd(false); setEditRouter(null); }} className="p-2 hover:bg-[var(--bg-surface-elevated)] rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-[var(--text-muted)]" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { key: 'name', label: 'Router / Location Name', placeholder: 'e.g. Westlands Hub' },
                                    { key: 'host', label: 'Host / IP Address', placeholder: '192.168.1.1' },
                                    { key: 'port', label: 'API Port', placeholder: '8728' },
                                    { key: 'username', label: 'API Username', placeholder: 'jevish-api' },
                                    { key: 'password', label: 'API Password', placeholder: '(leave blank to keep current)' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-1.5">{f.label}</label>
                                        <input
                                            type={f.key === 'password' ? 'password' : 'text'}
                                            placeholder={f.placeholder}
                                            value={form[f.key as keyof typeof form]}
                                            onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-3 px-4 rounded-xl font-semibold focus:outline-none focus:border-sky-500 transition-colors text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => { setShowAdd(false); setEditRouter(null); }} className="flex-1 py-3 border border-[var(--border-subtle)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-all">
                                    Cancel
                                </button>
                                <button onClick={saveRouter} disabled={formLoading || !form.name}
                                    className="flex-[2] py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                                    {formLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Update Router
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RouterManagement;
