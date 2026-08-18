import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Activity, Cpu, HardDrive, Wifi, RefreshCw, Router, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RouterRecord { id: string; name: string; host: string; isOnline: boolean; }

interface Resources {
    cpuLoad: number;
    ramUsedPercent: number;
    diskUsedPercent: number;
    freeMemory: number;
    totalMemory: number;
    uptime: string;
    version: string;
    boardName: string;
    architecture: string;
}

interface CpuPoint { time: string; cpu: number; ram: number; }

const Gauge: React.FC<{ value: number; label: string; color: string; icon: React.ReactNode }> = ({ value, label, color, icon }) => {
    const clamp = Math.min(100, Math.max(0, value));
    const r = 36; const circ = 2 * Math.PI * r;
    const offset = circ - (clamp / 100) * circ;
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative">
                <svg width="96" height="96" className="rotate-[-90deg]">
                    <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
                    <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="10"
                        strokeDasharray={circ} strokeDashoffset={offset}
                        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
                    <span className="text-xs font-black text-[var(--text-primary)]">{clamp}%</span>
                </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                {icon} {label}
            </div>
        </div>
    );
};

const NetworkMonitoring: React.FC = () => {
    const [routers, setRouters] = useState<RouterRecord[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [resources, setResources] = useState<Resources | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [cpuHistory, setCpuHistory] = useState<CpuPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        axios.get('/api/v1/routers').then(res => {
            const list = Array.isArray(res.data) ? res.data : (res.data?.routers || []);
            setRouters(list);
            if (list.length > 0) setSelectedId(list[0].id);
        }).catch(e => { console.error('[Monitoring] Routers load failed:', e); setRouters([]); });
    }, []);

    const poll = useCallback(async () => {
        if (!selectedId) return;
        setLoading(true);
        try {
            const [resResult, sessResult] = await Promise.allSettled([
                axios.get<{ resources: Resources }>(`/api/v1/routers/${selectedId}/resources`),
                axios.get<{ sessions: any[] }>(`/api/v1/routers/${selectedId}/sessions`),
            ]);

            if (resResult.status === 'fulfilled' && resResult.value.data.resources) {
                const r = resResult.value.data.resources;
                setResources(r);
                const time = new Date().toLocaleTimeString();
                setCpuHistory(prev => [...prev.slice(-29), { time, cpu: r.cpuLoad, ram: r.ramUsedPercent }]);
            }
            if (sessResult.status === 'fulfilled') setSessions(sessResult.value.data.sessions || []);
        } catch (e) {
            console.error('[Monitoring] Poll failed:', e);
        } finally { setLoading(false); }
    }, [selectedId]);

    useEffect(() => {
        if (selectedId) {
            poll();
            if (autoRefresh) {
                intervalRef.current = setInterval(poll, 5_000);
            }
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [selectedId, autoRefresh, poll]);

    const selected = routers.find(r => r.id === selectedId);

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Activity className="w-5 h-5 text-sky-500" /> Network Monitoring
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Live router metrics — polls every 10 seconds</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Router Selector */}
                    <div className="relative">
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                            className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] py-2 pl-4 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:border-sky-500 cursor-pointer">
                            <option value="">Select Router</option>
                            {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.isOnline ? '✓' : '✗'})</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] cursor-pointer">
                        <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-sky-500" />
                        Auto-refresh
                    </label>
                    <button onClick={poll} disabled={loading || !selectedId}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {!selectedId ? (
                <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                    <Router className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-[var(--text-muted)] font-semibold">Select a router to start monitoring</p>
                </div>
            ) : resources ? (
                <>
                    {/* Router Info */}
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="font-black text-[var(--text-primary)] text-lg">{selected?.name || 'Router'}</h2>
                                <p className="text-sm text-[var(--text-muted)]">{resources.boardName} · {resources.architecture} · RouterOS {resources.version}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-center">
                                    <div className="text-sm font-black text-[var(--text-primary)]">{resources.uptime}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Uptime</div>
                                </div>
                                <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${selected?.isOnline ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${selected?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                    {selected?.isOnline ? 'Online' : 'Offline'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gauges */}
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6">
                        <h3 className="text-sm font-black text-[var(--text-primary)] mb-6">System Resources</h3>
                        <div className="grid grid-cols-3 gap-6 justify-items-center">
                            <Gauge value={resources.cpuLoad} label="CPU Load" color="#38bdf8" icon={<Cpu className="w-3 h-3" />} />
                            <Gauge value={resources.ramUsedPercent} label="RAM Usage" color="#a855f7" icon={<Activity className="w-3 h-3" />} />
                            <Gauge value={resources.diskUsedPercent} label="Disk Usage" color="#f59e0b" icon={<HardDrive className="w-3 h-3" />} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-[var(--border-subtle)]">
                            <div className="text-center">
                                <div className="text-base font-black text-[var(--text-primary)]">
                                    {((resources.totalMemory - resources.freeMemory) / 1024 / 1024).toFixed(0)} MB / {(resources.totalMemory / 1024 / 1024).toFixed(0)} MB
                                </div>
                                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">RAM</div>
                            </div>
                            <div className="text-center">
                                <div className="text-base font-black text-[var(--text-primary)]">{sessions.length}</div>
                                <div className="text-xs text-[var(--text-muted)] font-semibold uppercase">Active Sessions</div>
                            </div>
                        </div>
                    </div>

                    {/* CPU/RAM History Chart */}
                    {cpuHistory.length > 1 && (
                        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5">
                            <h3 className="text-sm font-black text-[var(--text-primary)] mb-4">Resource Usage Over Time</h3>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={cpuHistory} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={28} unit="%" />
                                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }} />
                                    <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#38bdf8" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="ram" name="RAM %" stroke="#a855f7" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Active Sessions Table */}
                    {sessions.length > 0 && (
                        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5">
                            <h3 className="text-sm font-black text-[var(--text-primary)] mb-4">
                                Active Sessions <span className="text-sky-500 ml-1">({sessions.length})</span>
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[var(--text-muted)] text-xs font-bold uppercase border-b border-[var(--border-subtle)]">
                                            <th className="text-left py-2 pr-4">User</th>
                                            <th className="text-left py-2 pr-4">IP Address</th>
                                            <th className="text-left py-2 pr-4">MAC</th>
                                            <th className="text-left py-2 pr-4">Uptime</th>
                                            <th className="text-left py-2">Login</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((s, i) => (
                                            <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-elevated)] transition-colors">
                                                <td className="py-2.5 pr-4 font-semibold text-[var(--text-primary)]">{s.user}</td>
                                                <td className="py-2.5 pr-4 text-[var(--text-secondary)] font-mono text-xs">{s.address}</td>
                                                <td className="py-2.5 pr-4 text-[var(--text-secondary)] font-mono text-xs">{s.macAddress}</td>
                                                <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{s.uptime}</td>
                                                <td className="py-2.5 text-[var(--text-muted)] text-xs">{s.loginBy}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                    <Wifi className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-[var(--text-muted)] font-semibold">Cannot connect to this router</p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Ensure the router is online and the API credentials are correct</p>
                </div>
            )}
        </div>
    );
};

export default NetworkMonitoring;
