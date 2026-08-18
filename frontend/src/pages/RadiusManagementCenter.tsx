import { useState, useEffect } from 'react';
import {
    Radio, Server, Shield, Activity, RefreshCw, Cpu, HardDrive, Wifi, Lock,
    CheckCircle2, AlertOctagon, Terminal, UserX, Sliders, Database, Layers, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface NasItem {
    id: string;
    nasname: string;
    shortname: string;
    type: string;
    ports: number;
    secret: string;
    description: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

interface SessionItem {
    radacctid: number;
    acctsessionid: string;
    username: string;
    nasipaddress: string;
    framedipaddress: string | null;
    acctstarttime: string;
    acctsessiontime: number;
    acctinputoctets: number;
    acctoutputoctets: number;
    servicetype: string | null;
}

interface AuthLogItem {
    id: number;
    username: string;
    reply: string;
    authdate: string;
    nasipaddress: string | null;
    reason: string | null;
}

const RadiusManagementCenter = () => {
    const [activeTab, setActiveTab] = useState<'SESSIONS' | 'NAS' | 'LOGS' | 'POLICY'>('SESSIONS');
    const [stats, setStats] = useState({
        activeSessions: 0,
        totalNas: 0,
        authRequestsCount: 0,
        failedAuthsCount: 0,
        serverHealth: 'OPERATIONAL',
        haFailoverStatus: 'ACTIVE_PRIMARY'
    });

    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [nasList, setNasList] = useState<NasItem[]>([]);
    const [authLogs, setAuthLogs] = useState<AuthLogItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showRegisterNasModal, setShowRegisterNasModal] = useState(false);
    const [showCoaModal, setShowCoaModal] = useState(false);
    const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);

    // Form inputs
    const [nasName, setNasName] = useState('');
    const [nasShortname, setNasShortname] = useState('');
    const [nasType, setNasType] = useState('mikrotik');
    const [nasSecret, setNasSecret] = useState('');
    const [nasDesc, setNasDesc] = useState('');

    const [coaRateLimit, setCoaRateLimit] = useState('20M/20M');
    const [actionLoading, setActionLoading] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchData = async () => {
        try {
            const res = await axios.get('/api/v1/radius/overview');
            if (res.data) {
                setStats(res.data.stats || {
                    activeSessions: 0,
                    totalNas: 0,
                    authRequestsCount: 0,
                    failedAuthsCount: 0,
                    serverHealth: 'OPERATIONAL',
                    haFailoverStatus: 'ACTIVE_PRIMARY'
                });
                setSessions(res.data.recentSessions || []);
                setNasList(res.data.nasList || []);
            }

            const logsRes = await axios.get('/api/v1/radius/postauth');
            if (logsRes.data) {
                setAuthLogs(logsRes.data.logs || []);
            }
        } catch (_) {
            setFeedbackMsg({ type: 'error', message: 'Failed to load RADIUS platform data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRegisterNas = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        setFeedbackMsg(null);

        try {
            await axios.post('/api/v1/radius/nas', {
                nasname: nasName,
                shortname: nasShortname,
                type: nasType,
                secret: nasSecret,
                description: nasDesc
            });

            setFeedbackMsg({ type: 'success', message: `NAS Device ${nasShortname} registered successfully!` });
            setShowRegisterNasModal(false);
            setNasName('');
            setNasShortname('');
            setNasSecret('');
            fetchData();
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', message: err.response?.data?.error || 'Failed to register NAS.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisconnectUser = async (session: SessionItem) => {
        if (!confirm(`Are you sure you want to disconnect user ${session.username}?`)) return;
        setActionLoading(true);
        setFeedbackMsg(null);

        try {
            const res = await axios.post(`/api/v1/radius/sessions/${session.acctsessionid}/disconnect`);
            setFeedbackMsg({ type: 'success', message: res.data.message || `Disconnect request sent to ${session.nasipaddress} for ${session.username}` });
            fetchData();
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', message: err.response?.data?.error || 'Disconnect request failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendCoA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSession) return;
        setActionLoading(true);
        setFeedbackMsg(null);

        try {
            const res = await axios.post(`/api/v1/radius/sessions/${selectedSession.acctsessionid}/coa`, {
                rateLimit: coaRateLimit
            });
            setFeedbackMsg({ type: 'success', message: res.data.message || `CoA rate-limit updated to ${coaRateLimit}` });
            setShowCoaModal(false);
            fetchData();
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', message: err.response?.data?.error || 'CoA request failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDuration = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs}h ${mins}m ${secs}s`;
    };

    if (loading) {
        return (
            <div className="p-8 text-white text-center font-bold font-sans">
                Loading RADIUS-First ISP Management Engine...
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Radio className="w-8 h-8 text-sky-400" /> FreeRADIUS ISP Control Engine
                    </h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">
                        Enterprise FreeRADIUS AAA, MikroTik RouterOS Authentication, Packet of Disconnect (PoD), and CoA Rate Limiting.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh RADIUS
                    </button>
                    <button
                        onClick={() => setShowRegisterNasModal(true)}
                        className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-2"
                    >
                        <Server className="w-4 h-4" /> Register NAS
                    </button>
                </div>
            </div>

            {feedbackMsg && (
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertOctagon className="w-5 h-5 shrink-0" />}
                    <span>{feedbackMsg.message}</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Sessions</span>
                    <div className="text-xl font-black text-emerald-400">{stats.activeSessions}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NAS Routers</span>
                    <div className="text-xl font-black text-sky-400">{stats.totalNas}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Auth Requests</span>
                    <div className="text-xl font-black text-white">{stats.authRequestsCount}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Failed Auth</span>
                    <div className="text-xl font-black text-rose-400">{stats.failedAuthsCount}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Server Health</span>
                    <div className="text-xl font-black text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle size={16} /> {stats.serverHealth}
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HA Cluster Status</span>
                    <div className="text-xl font-black text-amber-400">{stats.haFailoverStatus}</div>
                </div>
            </div>

            {/* Tabs Header */}
            <div className="flex border-b border-slate-800 gap-2 sm:gap-6 text-xs sm:text-sm font-bold text-slate-400">
                <button
                    onClick={() => setActiveTab('SESSIONS')}
                    className={`pb-3 px-1 transition border-b-2 flex items-center gap-2 ${activeTab === 'SESSIONS' ? 'border-sky-500 text-sky-400 font-black' : 'border-transparent hover:text-slate-200'}`}
                >
                    <Activity size={16} /> Active RADIUS Sessions ({sessions.length})
                </button>
                <button
                    onClick={() => setActiveTab('NAS')}
                    className={`pb-3 px-1 transition border-b-2 flex items-center gap-2 ${activeTab === 'NAS' ? 'border-sky-500 text-sky-400 font-black' : 'border-transparent hover:text-slate-200'}`}
                >
                    <Server size={16} /> NAS Device Registry ({nasList.length})
                </button>
                <button
                    onClick={() => setActiveTab('LOGS')}
                    className={`pb-3 px-1 transition border-b-2 flex items-center gap-2 ${activeTab === 'LOGS' ? 'border-sky-500 text-sky-400 font-black' : 'border-transparent hover:text-slate-200'}`}
                >
                    <Database size={16} /> AAA Auth Logs ({authLogs.length})
                </button>
            </div>

            {/* Tab 1: Active RADIUS Sessions */}
            {activeTab === 'SESSIONS' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center">
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                            <Activity className="text-emerald-400" /> Active RADIUS Accounting Sessions (radacct)
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs text-slate-300">
                            <thead>
                                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold">
                                    <th className="p-4">User & Device IP</th>
                                    <th className="p-4">Traffic & Duration</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {sessions.map((s) => (
                                    <tr key={s.acctsessionid} className="hover:bg-slate-800/50 transition">
                                        <td className="p-4">
                                            <p className="font-bold text-white font-mono">{s.username}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{s.nasipaddress} / {s.framedipaddress || 'DHCP'}</p>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-mono text-sky-400">{formatBytes(s.acctinputoctets)} ↑ / {formatBytes(s.acctoutputoctets)} ↓</p>
                                            <p className="text-[10px] text-slate-500 font-mono uppercase">{formatDuration(s.acctsessiontime || 0)} active</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedSession(s);
                                                        setShowCoaModal(true);
                                                    }}
                                                    className="px-2 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-bold rounded-lg transition"
                                                >
                                                    CoA
                                                </button>
                                                <button
                                                    onClick={() => handleDisconnectUser(s)}
                                                    className="px-2 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold rounded-lg transition"
                                                >
                                                    Kill
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sessions.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-slate-500 italic">
                                            No active RADIUS accounting sessions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 2: NAS Device Registry */}
            {activeTab === 'NAS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {nasList.map((nas) => (
                        <div key={nas.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-base font-black text-white flex items-center gap-2">
                                        <Server className="w-4 h-4 text-sky-400" /> {nas.shortname}
                                    </h3>
                                    <p className="text-xs font-mono text-slate-400">{nas.nasname}</p>
                                </div>
                                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase rounded-full">
                                    {nas.type}
                                </span>
                            </div>

                            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono space-y-1">
                                <p className="text-slate-400">Secret: <strong className="text-white">••••••••</strong></p>
                                <p className="text-slate-400">Ports: <strong className="text-white">{nas.ports || 'Default'}</strong></p>
                                {nas.description && <p className="text-slate-400 italic">{nas.description}</p>}
                            </div>
                        </div>
                    ))}
                    {nasList.length === 0 && (
                        <div className="col-span-full p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
                            No NAS routers registered yet. Click "Register NAS" to add your MikroTik or FreeRADIUS server.
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: AAA Auth Logs */}
            {activeTab === 'LOGS' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-slate-800">
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                            <Database className="text-sky-400" /> Authentication Attempt Logs (radpostauth)
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs text-slate-300">
                            <thead>
                                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold">
                                    <th className="p-4">User & NAS</th>
                                    <th className="p-4">Status & Details</th>
                                    <th className="p-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {authLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/50 transition">
                                        <td className="p-4">
                                            <p className="font-bold text-white font-mono">{log.username}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{log.nasipaddress || 'Unknown NAS'}</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`w-fit px-2 py-0.5 rounded text-[9px] uppercase font-black ${log.reply === 'Access-Accept' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                    {log.reply}
                                                </span>
                                                <p className="text-[10px] text-slate-400 italic truncate max-w-[150px]">{log.reason || 'No details'}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 text-[10px]">{new Date(log.authdate).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Register NAS Modal */}
            <AnimatePresence>
                {showRegisterNasModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-6 text-white"
                        >
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Server className="text-sky-400" /> Register NAS / RouterOS Device
                            </h3>

                            <form onSubmit={handleRegisterNas} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">NAS IP / Hostname</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 192.168.88.1"
                                        value={nasName}
                                        onChange={(e) => setNasName(e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">NAS Identifier / Short Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Westlands-Mikrotik-Node"
                                        value={nasShortname}
                                        onChange={(e) => setNasShortname(e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">RADIUS Shared Secret</label>
                                    <input
                                        type="password"
                                        placeholder="Shared Secret Key"
                                        value={nasSecret}
                                        onChange={(e) => setNasSecret(e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowRegisterNasModal(false)}
                                        className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="w-1/2 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-2xl text-xs uppercase"
                                    >
                                        Register
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* CoA Change Rate Limit Modal */}
            <AnimatePresence>
                {showCoaModal && selectedSession && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-6 text-white"
                        >
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Sliders className="text-sky-400" /> Instant CoA Rate-Limit Update
                            </h3>
                            <p className="text-xs text-slate-400">
                                Send RADIUS Change-of-Authorization (CoA) packet to update bandwidth for <strong>{selectedSession.username}</strong> without requiring user logout.
                            </p>

                            <form onSubmit={handleSendCoA} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">New Rate Limit (Upload/Download)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 20M/20M or 50M/50M"
                                        value={coaRateLimit}
                                        onChange={(e) => setCoaRateLimit(e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCoaModal(false)}
                                        className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="w-1/2 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-2xl text-xs uppercase"
                                    >
                                        Send CoA
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default RadiusManagementCenter;
