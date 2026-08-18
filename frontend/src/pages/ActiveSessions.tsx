import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Wifi, RefreshCw, Search, UserX, ChevronDown } from 'lucide-react';

interface Session {
    id: string;
    user: string;
    address: string;
    macAddress: string;
    uptime: string;
    loginBy: string;
    rxBytes: number;
    txBytes: number;
}

interface RouterRecord { id: string; name: string; host: string; isOnline: boolean; }

const fmtMB = (b: number) => b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;

const ActiveSessions: React.FC = () => {
    const [routers, setRouters] = useState<RouterRecord[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [disconnecting, setDisconnecting] = useState<string | null>(null);

    useEffect(() => {
        axios.get('/api/v1/routers').then(res => {
            const list: RouterRecord[] = Array.isArray(res.data) ? res.data : (res.data?.routers || []);
            const online = list.filter(r => r.isOnline);
            setRouters(list);
            if (online.length > 0) setSelectedId(online[0].id);
            else if (list.length > 0) setSelectedId(list[0].id);
        }).catch(e => { console.error('[Sessions] Routers load failed:', e); setRouters([]); });
    }, []);

    const load = useCallback(async () => {
        if (!selectedId) return;
        setLoading(true);
        try {
            const res = await axios.get<{ sessions: Session[] }>(`/api/v1/routers/${selectedId}/sessions`);
            setSessions(res.data.sessions || []);
        } catch (e) {
            console.error('[Sessions] Load failed:', e);
            setSessions([]);
        } finally { setLoading(false); }
    }, [selectedId]);

    useEffect(() => { if (selectedId) load(); }, [selectedId, load]);

    const disconnect = async (session: Session) => {
        if (!confirm(`Disconnect user "${session.user}"?`)) return;
        setDisconnecting(session.id);
        try {
            await axios.post(`/api/v1/routers/${selectedId}/sessions/${session.id}/disconnect`);
            await load();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Disconnect failed');
        } finally { setDisconnecting(null); }
    };

    const filtered = sessions.filter(s =>
        !search || s.user.toLowerCase().includes(search.toLowerCase()) ||
        s.address.includes(search) || s.macAddress.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Wifi className="w-5 h-5 text-sky-500" /> Active Sessions
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Live hotspot sessions from your router</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                            className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] py-2 pl-4 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500 cursor-pointer">
                            <option value="">Select Router</option>
                            {routers.map(r => <option key={r.id} value={r.id}>{r.name} {r.isOnline ? '(Online)' : '(Offline)'}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                    <button onClick={load} disabled={loading || !selectedId}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {/* Search + Stats */}
            {selectedId && (
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search by username, IP or MAC..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-2.5 pl-10 pr-4 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500 transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm">
                            <span className="font-black text-sky-500">{sessions.length}</span>
                            <span className="text-[var(--text-muted)] font-semibold ml-1">active session{sessions.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
            )}

            {!selectedId ? (
                <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                    <Wifi className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-[var(--text-muted)] font-semibold">Select a router to view sessions</p>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                    <Wifi className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-[var(--text-muted)] font-semibold">{search ? 'No sessions match your search' : 'No active sessions'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((s, idx) => (
                        <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                            className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-all">
                            {/* Status dot */}
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-[var(--text-primary)]">{s.user}</span>
                                    <span className="px-2 py-0.5 bg-sky-500/10 text-sky-600 rounded-full text-xs font-bold">{s.loginBy}</span>
                                </div>
                                <div className="text-xs text-[var(--text-muted)] font-mono mt-1 flex items-center gap-3 flex-wrap">
                                    <span>{s.address}</span>
                                    <span>·</span>
                                    <span>{s.macAddress}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap text-center">
                                <div>
                                    <div className="text-sm font-black text-[var(--text-primary)]">{s.uptime}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Uptime</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black text-emerald-600">{fmtMB(s.rxBytes)}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">↓ Down</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black text-sky-600">{fmtMB(s.txBytes)}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">↑ Up</div>
                                </div>
                                <button onClick={() => disconnect(s)} disabled={disconnecting === s.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold transition-all disabled:opacity-60">
                                    {disconnecting === s.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                                    Disconnect
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ActiveSessions;
