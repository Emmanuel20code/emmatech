import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Save, RefreshCw, Download, Trash2, Plus, Shield, ChevronDown,
    CheckCircle, XCircle, Clock, HardDrive, Router
} from 'lucide-react';

interface RouterRecord { id: string; name: string; host: string; isOnline: boolean; }
interface BackupFile { name: string; size: number; creationTime: string; }

const fmtBytes = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;

const RouterBackups: React.FC = () => {
    const [routers, setRouters] = useState<RouterRecord[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        axios.get('/api/v1/routers').then(res => {
            const list = Array.isArray(res.data) ? res.data : (res.data?.routers || []);
            setRouters(list);
            if (list.length > 0) setSelectedId(list[0].id);
        }).catch(e => { console.error('[Backups] Routers load failed:', e); setRouters([]); });
    }, []);

    const loadBackups = useCallback(async () => {
        if (!selectedId) return;
        setLoading(true);
        try {
            const res = await axios.get<{ backups: BackupFile[] }>(`/api/v1/routers/${selectedId}/backup/list`);
            setBackups(res.data.backups || []);
        } catch (e) {
            console.error('[Backups] Load failed:', e);
        } finally { setLoading(false); }
    }, [selectedId]);

    useEffect(() => { if (selectedId) loadBackups(); }, [selectedId, loadBackups]);

    const generate = async () => {
        setGenerating(true);
        setResult(null);
        try {
            const res = await axios.post<{ success: boolean; fileName: string; size: number }>(`/api/v1/routers/${selectedId}/backup/generate`);
            setResult({ success: true, message: `Backup "${res.data.fileName}" created (${fmtBytes(res.data.size)})` });
            await loadBackups();
        } catch (e: any) {
            setResult({ success: false, message: e.response?.data?.error || 'Backup generation failed' });
        } finally { setGenerating(false); }
    };

    const deleteBackup = async (fileName: string) => {
        if (!confirm(`Delete backup "${fileName}"?`)) return;
        try {
            // Find file by name from the file list API
            const filesRes = await axios.get<{ files: any[] }>(`/api/v1/routers/${selectedId}/files`);
            const file = (filesRes.data.files || []).find(f => f.name === fileName);
            if (file) {
                await axios.delete(`/api/v1/routers/${selectedId}/files/${encodeURIComponent(file.id)}`);
                await loadBackups();
            }
        } catch (e: any) {
            alert(e.response?.data?.error || 'Delete failed');
        }
    };

    const selected = routers.find(r => r.id === selectedId);

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-sky-500" /> Router Backups
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Generate and manage MikroTik configuration backups</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                            className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] py-2 pl-4 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500 cursor-pointer">
                            <option value="">Select Router</option>
                            {routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                    <button onClick={loadBackups} disabled={loading || !selectedId}
                        className="p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl hover:border-sky-500 transition-all disabled:opacity-60">
                        <RefreshCw className={`w-4 h-4 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={generate} disabled={generating || !selectedId}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                        {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Generate Backup
                    </button>
                </div>
            </div>

            {/* Result Alert */}
            <AnimatePresence>
                {result && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border ${result.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                        {result.success ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
                        <span className={`text-sm font-semibold ${result.success ? 'text-emerald-700' : 'text-rose-700'}`}>{result.message}</span>
                        <button onClick={() => setResult(null)} className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]">×</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info Card */}
            {selected && (
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selected.isOnline ? 'bg-emerald-500/10' : 'bg-slate-500/10'}`}>
                            <Router className={`w-6 h-6 ${selected.isOnline ? 'text-emerald-600' : 'text-slate-500'}`} />
                        </div>
                        <div>
                            <h3 className="font-black text-[var(--text-primary)]">{selected.name}</h3>
                            <p className="text-sm text-[var(--text-muted)]">{selected.host} · {selected.isOnline ? '🟢 Online' : '🔴 Offline'}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
                            <HardDrive className="w-4 h-4 text-sky-500" />
                            {backups.length} backup{backups.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            )}

            {/* Backups List */}
            {!selectedId ? (
                <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                    <HardDrive className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-[var(--text-muted)] font-semibold">Select a router to view backups</p>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : backups.length === 0 ? (
                <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                    <Shield className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-[var(--text-muted)] font-semibold">No backups found on this router</p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Click "Generate Backup" to create your first backup</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {backups.map((b, idx) => (
                        <motion.div key={b.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                            className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 flex items-center gap-4 hover:shadow-md transition-all">
                            <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <HardDrive className="w-5 h-5 text-sky-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-[var(--text-primary)] truncate">{b.name}</div>
                                <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-3">
                                    <span>{fmtBytes(b.size)}</span>
                                    {b.creationTime && <span>Created: {b.creationTime}</span>}
                                </div>
                            </div>
                            <button onClick={() => deleteBackup(b.name)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold transition-all">
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RouterBackups;
