import React, { useState } from 'react';
import axios from 'axios';
import {
    Wifi,
    Search,
    RefreshCw,
    ShieldAlert,
    Download,
    Power,
    CheckCircle2,
    XCircle,
    Cpu,
    HardDrive,
    Radio,
    Terminal,
    Building2,
    Clock
} from 'lucide-react';

interface RouterData {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    tenantId: string;
    tenantName: string;
    tenantSubdomain: string;
    tenantStatus: string;
    location: string | null;
    isOnline: boolean;
    isDormant: boolean;
    lastSeen: string | null;
    identity: string | null;
    validationStatus: string;
    version: string | null;
    model: string | null;
    architecture: string | null;
    activeSessionsCount: number;
    lastLog: any;
}

interface RoutersTabProps {
    routers: RouterData[];
    loading: boolean;
    onRefresh: () => void;
}

const RoutersTab: React.FC<RoutersTabProps> = ({ routers, loading, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'DORMANT'>('ALL');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [selectedRouterResources, setSelectedRouterResources] = useState<any | null>(null);
    const [resourceModalRouter, setResourceModalRouter] = useState<RouterData | null>(null);

    const filteredRouters = routers.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.host.includes(searchTerm) ||
            r.tenantName.toLowerCase().includes(searchTerm.toLowerCase());
        let matchesStatus = true;
        if (statusFilter === 'ONLINE') matchesStatus = r.isOnline;
        if (statusFilter === 'OFFLINE') matchesStatus = !r.isOnline;
        if (statusFilter === 'DORMANT') matchesStatus = r.isDormant;
        return matchesSearch && matchesStatus;
    });

    const handleExecuteAction = async (router: RouterData, action: 'PING' | 'RECONNECT' | 'BACKUP' | 'DISCONNECT_SESSIONS' | 'SUSPEND') => {
        try {
            setActionLoadingId(router.id);
            const response = await axios.post(`/api/v1/platform-owner/routers/${router.id}/action`, { action });

            if (action === 'PING' && response.data.resources) {
                setResourceModalRouter(router);
                setSelectedRouterResources(response.data.resources);
            } else if (action === 'BACKUP') {
                alert(`Backup created successfully for ${router.name}! File: ${response.data.backup?.fileName || 'backup.backup'}`);
            } else {
                alert(`Action ${action} completed successfully.`);
            }

            onRefresh();
        } catch (error: any) {
            alert(`Action failed: ${error.response?.data?.error || error.message}`);
        } finally {
            setActionLoadingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-medium">Scanning MikroTik Router Fleet...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)]">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Wifi className="text-amber-500" size={24} /> Global MikroTik Router Fleet
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Supreme router administration across all tenants: real-time health, ping test, backup, suspend & session management.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 sm:w-64">
                        <Search size={16} className="absolute left-3 top-3 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Search router, host IP, tenant..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-surface-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    {/* Filter Status */}
                    <select
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--bg-surface-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                    >
                        <option value="ALL">All Routers ({routers.length})</option>
                        <option value="ONLINE">Online ({routers.filter(r => r.isOnline).length})</option>
                        <option value="OFFLINE">Offline ({routers.filter(r => !r.isOnline).length})</option>
                        <option value="DORMANT">Dormant (&gt; 30m) ({routers.filter(r => r.isDormant).length})</option>
                    </select>

                    <button
                        onClick={onRefresh}
                        className="p-2.5 bg-[var(--bg-surface-elevated)] hover:bg-amber-500 hover:text-white text-[var(--text-primary)] rounded-xl border border-[var(--border-subtle)] transition-all"
                        title="Refresh router status"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Routers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRouters.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                        No MikroTik routers found matching query.
                    </div>
                ) : (
                    filteredRouters.map((r) => (
                        <div
                            key={r.id}
                            className={`bg-[var(--bg-surface)] p-6 rounded-2xl border transition-all shadow-md relative flex flex-col justify-between ${r.isOnline
                                    ? 'border-[var(--border-subtle)] hover:border-amber-500/40'
                                    : 'border-rose-500/30 bg-rose-500/5'
                                }`}
                        >
                            <div>
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div>
                                        <h4 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                                            {r.name}
                                        </h4>
                                        <p className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1 mt-0.5">
                                            <Building2 size={12} className="text-amber-400" /> {r.tenantName} (.{r.tenantSubdomain})
                                        </p>
                                    </div>

                                    {r.isOnline ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-extrabold shrink-0">
                                            <CheckCircle2 size={12} /> ONLINE
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-extrabold shrink-0">
                                            <XCircle size={12} /> OFFLINE
                                        </span>
                                    )}
                                </div>

                                {/* Network Specs */}
                                <div className="space-y-2 text-xs py-3 border-y border-[var(--border-subtle)] my-3">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Host IP / Port:</span>
                                        <span className="font-mono font-bold text-[var(--text-primary)]">{r.host}:{r.port}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Identity / Model:</span>
                                        <span className="font-medium text-[var(--text-primary)]">{r.identity || 'N/A'} ({r.model || r.architecture || 'MikroTik'})</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">RouterOS Version:</span>
                                        <span className="font-mono text-[var(--text-primary)]">{r.version || 'v7.x'}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Active Hotspot Sessions:</span>
                                        <span className="font-bold text-sky-400">{r.activeSessionsCount} users</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Last Heartbeat:</span>
                                        <span className={`font-mono ${r.isDormant ? 'text-rose-400 font-bold' : 'text-[var(--text-primary)]'}`}>
                                            {r.lastSeen ? new Date(r.lastSeen).toLocaleTimeString() : 'Never'}
                                            {r.isDormant && ' (Dormant)'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Router Direct Actions Toolbar */}
                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleExecuteAction(r, 'PING')}
                                    disabled={actionLoadingId === r.id}
                                    className="py-2 px-3 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Cpu size={14} /> Ping / Health
                                </button>

                                <button
                                    onClick={() => handleExecuteAction(r, 'RECONNECT')}
                                    disabled={actionLoadingId === r.id}
                                    className="py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                    <RefreshCw size={14} /> Reconnect
                                </button>

                                <button
                                    onClick={() => handleExecuteAction(r, 'BACKUP')}
                                    disabled={actionLoadingId === r.id || !r.isOnline}
                                    className="py-2 px-3 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white border border-purple-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    <Download size={14} /> Backup
                                </button>

                                <button
                                    onClick={() => handleExecuteAction(r, 'SUSPEND')}
                                    disabled={actionLoadingId === r.id}
                                    className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Power size={14} /> Suspend
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Live Resources Modal */}
            {selectedRouterResources && resourceModalRouter && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-subtle)] max-w-lg w-full space-y-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                            <div>
                                <h4 className="font-bold text-lg text-[var(--text-primary)]">
                                    Live Router Telemetry: {resourceModalRouter.name}
                                </h4>
                                <p className="text-xs text-[var(--text-secondary)] font-mono">
                                    Host: {resourceModalRouter.host}:{resourceModalRouter.port}
                                </p>
                            </div>
                            <button
                                onClick={() => { setSelectedRouterResources(null); setResourceModalRouter(null); }}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] text-center">
                                <p className="text-xs text-[var(--text-secondary)]">CPU Load</p>
                                <p className="text-2xl font-black text-amber-400 mt-1">{selectedRouterResources.cpuLoad || selectedRouterResources.cpuUsage || 0}%</p>
                            </div>

                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] text-center">
                                <p className="text-xs text-[var(--text-secondary)]">RAM Usage</p>
                                <p className="text-2xl font-black text-sky-400 mt-1">{selectedRouterResources.ramUsedPercent || selectedRouterResources.memoryUsage || 0}%</p>
                            </div>

                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] text-center">
                                <p className="text-xs text-[var(--text-secondary)]">Disk Usage</p>
                                <p className="text-2xl font-black text-emerald-400 mt-1">{selectedRouterResources.diskUsedPercent || selectedRouterResources.diskUsage || 0}%</p>
                            </div>

                            <div className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] text-center">
                                <p className="text-xs text-[var(--text-secondary)]">Uptime</p>
                                <p className="text-sm font-bold font-mono text-[var(--text-primary)] mt-2">{selectedRouterResources.uptime || 'N/A'}</p>
                            </div>
                        </div>

                        <button
                            onClick={() => { setSelectedRouterResources(null); setResourceModalRouter(null); }}
                            className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all"
                        >
                            Close Telemetry
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoutersTab;
