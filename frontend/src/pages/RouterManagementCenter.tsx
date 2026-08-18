import { useState, useEffect } from 'react';
import {
    Activity, Server, Zap, AlertTriangle, ShieldCheck, Clock, RefreshCw, Power,
    Radio, Settings, Cpu, HardDrive, Wifi, MessageSquare, Wrench, CheckCircle,
    XCircle, Terminal, FileText, CheckCircle2, AlertOctagon, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface RouterItem {
    id: string;
    name: string;
    host: string;
    port: number;
    location: string;
    isOnline: boolean;
    lastSeen: string | null;
    powerStatus: 'GRID' | 'UPS_BATTERY' | 'OFFLINE' | 'UNKNOWN';
    maintenanceStatus: 'OPERATIONAL' | 'MAINTENANCE' | 'POWER_OUTAGE' | 'BLACKOUT' | 'NETWORK_FAILURE' | 'HARDWARE_FAILURE' | 'UPSTREAM_FAILURE';
    maintenanceNotes: string | null;
    maintenanceStartTime: string | null;
    expectedReturnTime: string | null;
    uptimeSeconds: number;
    subscriberCount: number;
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    bandwidthUsageMbps: number;
    hasSmartPower: boolean;
    smartPowerType: 'SMART_PDU' | 'SMART_UPS' | 'SMART_PLUG' | 'REMOTE_SWITCH' | 'NONE';
    smartPowerHost: string | null;
    smartPowerOutletId: string | null;
    activeIncident: any | null;
}

const RouterManagementCenter = () => {
    const navigate = useNavigate();
    const [routers, setRouters] = useState<RouterItem[]>([]);
    const [stats, setStats] = useState({
        totalRouters: 0,
        operationalCount: 0,
        inMaintenanceCount: 0,
        outageCount: 0,
        totalAffectedSubscribers: 0,
        uptimePercentage: 100
    });
    const [loading, setLoading] = useState(true);
    const [selectedRouter, setSelectedRouter] = useState<RouterItem | null>(null);

    // Modal Controls
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
    const [showRemoteControlModal, setShowRemoteControlModal] = useState(false);
    const [showPowerModal, setShowPowerModal] = useState(false);
    const [showCompensateModal, setShowCompensateModal] = useState(false);

    // Form States
    const [maintReason, setMaintReason] = useState<'MAINTENANCE' | 'POWER_OUTAGE' | 'BLACKOUT' | 'NETWORK_FAILURE' | 'HARDWARE_FAILURE' | 'UPSTREAM_FAILURE'>('MAINTENANCE');
    const [maintNotes, setMaintNotes] = useState('');
    const [maintReturnTime, setMaintReturnTime] = useState('');
    const [notifyChannels, setNotifyChannels] = useState<string[]>(['SMS', 'DASHBOARD']);
    const [extraMinutes, setExtraMinutes] = useState(60);

    const [diagResults, setDiagResults] = useState<any | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchRouters = async () => {
        try {
            const res = await axios.get('/api/v1/routers/management');
            if (res.data) {
                setRouters(res.data.routers || []);
                setStats(res.data.stats || {
                    totalRouters: 0,
                    operationalCount: 0,
                    inMaintenanceCount: 0,
                    outageCount: 0,
                    totalAffectedSubscribers: 0,
                    uptimePercentage: 100
                });
            }
        } catch (_) {
            setFeedbackMsg({ type: 'error', message: 'Failed to fetch router power management states.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRouters();
        const interval = setInterval(fetchRouters, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleMaintenanceMode = async (enabled: boolean) => {
        if (!selectedRouter) return;
        setActionLoading(true);
        setFeedbackMsg(null);
        try {
            await axios.post(`/api/v1/routers/${selectedRouter.id}/maintenance`, {
                enabled,
                reason: maintReason,
                notes: maintNotes,
                expectedReturnTime: maintReturnTime,
                channels: notifyChannels,
                notifySubscribers: true
            });
            setFeedbackMsg({
                type: 'success',
                message: enabled ? `${selectedRouter.name} entered ${maintReason} mode. Affected subscribers notified.` : `${selectedRouter.name} restored to operational status!`
            });
            setShowMaintenanceModal(false);
            fetchRouters();
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', message: err.response?.data?.error || 'Failed to update maintenance state.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoteControl = async (command: string, params: any = {}) => {
        if (!selectedRouter) return;
        setActionLoading(true);
        setFeedbackMsg(null);
        try {
            const res = await axios.post(`/api/v1/routers/${selectedRouter.id}/control`, { command, params });
            if (command === 'RUN_DIAGNOSTICS') {
                setDiagResults(res.data.diagnostics);
            } else {
                setFeedbackMsg({ type: 'success', message: res.data.message || 'Remote control command executed successfully!' });
            }
            fetchRouters();
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', message: err.response?.data?.error || 'Remote command failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handlePowerControl = async (action: 'POWER_ON' | 'POWER_OFF' | 'REBOOT') => {
        if (!selectedRouter) return;
        setActionLoading(true);
        setFeedbackMsg(null);
        try {
            const res = await axios.post(`/api/v1/routers/${selectedRouter.id}/power`, { action });
            setFeedbackMsg({ type: 'success', message: res.data.message || `Smart power action ${action} executed.` });
            setShowPowerModal(false);
            fetchRouters();
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', message: err.response?.data?.error || 'Power control action failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCompensation = async () => {
        if (!selectedRouter) return;
        setActionLoading(true);
        setFeedbackMsg(null);
        try {
            const res = await axios.post(`/api/v1/routers/${selectedRouter.id}/compensate`, {
                extraMinutes,
                incidentId: selectedRouter.activeIncident?.id
            });
            setFeedbackMsg({
                type: 'success',
                message: `Downtime compensated! Extended ${res.data.result.updatedCount} subscriber sessions by ${extraMinutes} minutes.`
            });
            setShowCompensateModal(false);
            fetchRouters();
        } catch (err: any) {
            setFeedbackMsg({ type: 'error', message: err.response?.data?.error || 'Compensation failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const toggleChannel = (channel: string) => {
        setNotifyChannels(prev =>
            prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
        );
    };

    if (loading) {
        return (
            <div className="p-8 text-white text-center font-bold font-sans">
                Loading Router Power & Maintenance Management System...
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Zap className="w-8 h-8 text-amber-400" /> Router Power & Outage Control Center
                    </h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">
                        Manage power outages, blackouts, maintenance windows, remote MikroTik control, and downtime compensation.
                    </p>
                </div>

                <button
                    onClick={fetchRouters}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh Status
                </button>
            </div>

            {feedbackMsg && (
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertOctagon className="w-5 h-5 shrink-0" />}
                    <span>{feedbackMsg.message}</span>
                </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Routers</span>
                    <div className="text-xl font-black text-white">{stats.totalRouters}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operational</span>
                    <div className="text-xl font-black text-emerald-400">{stats.operationalCount}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Maintenance</span>
                    <div className="text-xl font-black text-amber-400">{stats.inMaintenanceCount}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Outages</span>
                    <div className="text-xl font-black text-rose-400">{stats.outageCount}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Affected Subs</span>
                    <div className="text-xl font-black text-sky-400">{stats.totalAffectedSubscribers}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Network Uptime</span>
                    <div className="text-xl font-black text-emerald-400">{stats.uptimePercentage}%</div>
                </div>
            </div>

            {/* Routers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Array.isArray(routers) ? routers : []).map((r) => {
                    const isMaint = r.maintenanceStatus !== 'OPERATIONAL';
                    return (
                        <motion.div
                            key={r.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-slate-900 border p-6 rounded-3xl space-y-5 relative overflow-hidden ${isMaint ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800'}`}
                        >
                            {/* Top Badges */}
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    <h3 className="text-base font-black text-white flex items-center gap-2">
                                        <Server className="w-4 h-4 text-sky-400" /> {r.name}
                                    </h3>
                                    <p className="text-xs font-mono text-slate-400">{r.host}:{r.port} • {r.location}</p>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isMaint ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : r.isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                        {r.maintenanceStatus}
                                    </span>
                                    <span className={`text-[10px] font-bold flex items-center gap-1 ${r.powerStatus === 'GRID' ? 'text-emerald-400' : r.powerStatus === 'UPS_BATTERY' ? 'text-amber-400' : 'text-rose-400'}`}>
                                        <Zap size={12} /> Power: {r.powerStatus}
                                    </span>
                                </div>
                            </div>

                            {/* Resource Metrics */}
                            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-center">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">
                                        <Cpu size={10} /> CPU
                                    </div>
                                    <div className="text-xs font-black text-white">{r.cpuUsagePercent}%</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">
                                        <HardDrive size={10} /> RAM
                                    </div>
                                    <div className="text-xs font-black text-white">{r.memoryUsagePercent}%</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1">
                                        <Wifi size={10} /> Traffic
                                    </div>
                                    <div className="text-xs font-black text-sky-400">{r.bandwidthUsageMbps} M</div>
                                </div>
                            </div>

                            {/* Active Subs Info */}
                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>Active Subscribers: <strong className="text-white">{r.subscriberCount}</strong></span>
                                {r.hasSmartPower && (
                                    <span className="text-amber-400 text-[11px] font-bold flex items-center gap-1">
                                        <Power size={12} /> Smart PDU Active
                                    </span>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                                <button
                                    onClick={() => {
                                        setSelectedRouter(r);
                                        setShowMaintenanceModal(true);
                                    }}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${isMaint ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                                >
                                    <Wrench size={14} /> {isMaint ? 'Manage Outage' : 'Set Maintenance'}
                                </button>

                                <button
                                    onClick={() => navigate(`/tenant/routers/${r.id}/pppoe`)}
                                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                                >
                                    <Globe size={14} /> Manage PPPoE
                                </button>

                                <button
                                    onClick={() => {
                                        setSelectedRouter(r);
                                        setShowRemoteControlModal(true);
                                    }}
                                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                                >
                                    <Terminal size={14} /> Control & Diag
                                </button>

                                {r.hasSmartPower && (
                                    <button
                                        onClick={() => {
                                            setSelectedRouter(r);
                                            setShowPowerModal(true);
                                        }}
                                        className="py-2 px-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                                    >
                                        <Power size={14} /> PDU Power
                                    </button>
                                )}

                                {isMaint && (
                                    <button
                                        onClick={() => {
                                            setSelectedRouter(r);
                                            setShowCompensateModal(true);
                                        }}
                                        className="py-2 px-3 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 col-span-2"
                                    >
                                        <Clock size={14} /> Compensate Downtime
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Maintenance & Blackout Control Modal */}
            <AnimatePresence>
                {showMaintenanceModal && selectedRouter && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-lg w-full space-y-6 text-white"
                        >
                            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    <Wrench className="text-amber-400" /> Maintenance & Outage Control - {selectedRouter.name}
                                </h3>
                                <button onClick={() => setShowMaintenanceModal(false)} className="text-slate-400 hover:text-white">
                                    <XCircle size={20} />
                                </button>
                            </div>

                            {selectedRouter.maintenanceStatus !== 'OPERATIONAL' ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-2">
                                        <p className="font-bold text-amber-400">Currently In {selectedRouter.maintenanceStatus} Mode</p>
                                        <p className="text-slate-300">Started: {selectedRouter.maintenanceStartTime ? new Date(selectedRouter.maintenanceStartTime).toLocaleString() : 'N/A'}</p>
                                        <p className="text-slate-300">Expected Return: {selectedRouter.expectedReturnTime ? new Date(selectedRouter.expectedReturnTime).toLocaleString() : 'N/A'}</p>
                                    </div>

                                    <button
                                        onClick={() => toggleMaintenanceMode(false)}
                                        disabled={actionLoading}
                                        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl uppercase tracking-wider text-xs transition"
                                    >
                                        {actionLoading ? 'Restoring Service...' : 'Restore Operational Status & Notify Users'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Outage Reason / Type</label>
                                        <select
                                            value={maintReason}
                                            onChange={(e) => setMaintReason(e.target.value as any)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                        >
                                            <option value="MAINTENANCE">Scheduled Maintenance</option>
                                            <option value="POWER_OUTAGE">Power Failure / Grid Blackout</option>
                                            <option value="BLACKOUT">Complete Area Blackout</option>
                                            <option value="NETWORK_FAILURE">Fiber Cut / Upstream Failure</option>
                                            <option value="HARDWARE_FAILURE">Hardware Failure</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Expected Return Time</label>
                                        <input
                                            type="datetime-local"
                                            value={maintReturnTime}
                                            onChange={(e) => setMaintReturnTime(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Incident Notes / Summary</label>
                                        <textarea
                                            rows={2}
                                            placeholder="e.g. Kenya Power blackout in Westlands POP. Operating on UPS."
                                            value={maintNotes}
                                            onChange={(e) => setMaintNotes(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white resize-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Automated Customer Dispatch Channels</label>
                                        <div className="flex gap-3 text-xs">
                                            {['SMS', 'EMAIL', 'DASHBOARD'].map((ch) => (
                                                <button
                                                    key={ch}
                                                    type="button"
                                                    onClick={() => toggleChannel(ch)}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${notifyChannels.includes(ch) ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'border-slate-800 text-slate-500'}`}
                                                >
                                                    {ch}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => toggleMaintenanceMode(true)}
                                        disabled={actionLoading}
                                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl uppercase tracking-wider text-xs transition"
                                    >
                                        {actionLoading ? 'Activating Mode...' : `Activate ${maintReason} Mode`}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Remote Control & Diagnostics Modal */}
            <AnimatePresence>
                {showRemoteControlModal && selectedRouter && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-lg w-full space-y-6 text-white"
                        >
                            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    <Terminal className="text-sky-400" /> Remote MikroTik Control - {selectedRouter.name}
                                </h3>
                                <button onClick={() => setShowRemoteControlModal(false)} className="text-slate-400 hover:text-white">
                                    <XCircle size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleRemoteControl('TOGGLE_HOTSPOT', { enable: true })}
                                    disabled={actionLoading}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold hover:border-sky-500 transition text-left"
                                >
                                    Enable Hotspot
                                </button>
                                <button
                                    onClick={() => handleRemoteControl('TOGGLE_HOTSPOT', { enable: false })}
                                    disabled={actionLoading}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold hover:border-rose-500 transition text-left"
                                >
                                    Disable Hotspot
                                </button>

                                <button
                                    onClick={() => handleRemoteControl('TOGGLE_PPPOE', { enable: true })}
                                    disabled={actionLoading}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold hover:border-sky-500 transition text-left"
                                >
                                    Enable PPPoE
                                </button>
                                <button
                                    onClick={() => handleRemoteControl('TOGGLE_PPPOE', { enable: false })}
                                    disabled={actionLoading}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold hover:border-rose-500 transition text-left"
                                >
                                    Disable PPPoE
                                </button>

                                <button
                                    onClick={() => handleRemoteControl('BACKUP_CONFIG')}
                                    disabled={actionLoading}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold hover:border-sky-500 transition text-left"
                                >
                                    Backup Config (.rsc)
                                </button>
                                <button
                                    onClick={() => handleRemoteControl('RUN_DIAGNOSTICS')}
                                    disabled={actionLoading}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold hover:border-emerald-500 transition text-left"
                                >
                                    Run Diagnostics
                                </button>
                            </div>

                            {diagResults && (
                                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono space-y-1">
                                    <p className="text-emerald-400 font-bold">Diagnostic Results:</p>
                                    <p>Ping: {diagResults.ping}</p>
                                    <p>Gateway: {diagResults.gateway}</p>
                                    <p>CPU Load: {diagResults.cpuLoad}</p>
                                    <p>Free RAM: {diagResults.freeMemory}</p>
                                </div>
                            )}

                            <button
                                onClick={() => handleRemoteControl('REBOOT')}
                                disabled={actionLoading}
                                className="w-full py-3 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-black rounded-2xl text-xs uppercase tracking-wider transition"
                            >
                                Reboot RouterOS Device
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Smart Power Device Modal */}
            <AnimatePresence>
                {showPowerModal && selectedRouter && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-6 text-white text-center"
                        >
                            <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400">
                                <Power size={28} />
                            </div>

                            <h3 className="text-lg font-black">Smart Power Control ({selectedRouter.smartPowerType})</h3>
                            <p className="text-xs text-slate-400">Execute physical power control command on attached PDU outlet for {selectedRouter.name}.</p>

                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => handlePowerControl('POWER_ON')}
                                    disabled={actionLoading}
                                    className="py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase transition"
                                >
                                    Power On
                                </button>
                                <button
                                    onClick={() => handlePowerControl('REBOOT')}
                                    disabled={actionLoading}
                                    className="py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase transition"
                                >
                                    Cycle Outlet
                                </button>
                                <button
                                    onClick={() => handlePowerControl('POWER_OFF')}
                                    disabled={actionLoading}
                                    className="py-3 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl text-xs uppercase transition"
                                >
                                    Power Off
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Downtime Compensation Modal */}
            <AnimatePresence>
                {showCompensateModal && selectedRouter && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-6 text-white"
                        >
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Clock className="text-sky-400" /> Issue Downtime Compensation
                            </h3>
                            <p className="text-xs text-slate-400">
                                Extend active subscriber expiry dates to compensate for downtime on <strong>{selectedRouter.name}</strong>.
                            </p>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Compensation Minutes to Add</label>
                                <input
                                    type="number"
                                    value={extraMinutes}
                                    onChange={(e) => setExtraMinutes(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                />
                            </div>

                            <button
                                onClick={handleCompensation}
                                disabled={actionLoading}
                                className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider transition"
                            >
                                {actionLoading ? 'Applying Compensation...' : `Extend Expiry by ${extraMinutes} Mins`}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default RouterManagementCenter;
