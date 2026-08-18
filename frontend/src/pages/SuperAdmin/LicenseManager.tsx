import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, Lock,
    Clock, Zap, FileText, Search, Play, Pause, PlusCircle, Users
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function LicenseManager() {
    const [statusData, setStatusData] = useState<any>(null);
    const [tenants, setTenants] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedTenantId, setSelectedTenantId] = useState<string>('');
    const [extendDays, setExtendDays] = useState<number>(14);
    const [overrideNotes, setOverrideNotes] = useState<string>('');
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isExecuting, setIsExecuting] = useState<boolean>(false);

    useEffect(() => {
        fetchLicenseData();
    }, []);

    const fetchLicenseData = async () => {
        setIsLoading(true);
        try {
            const tenantId = localStorage.getItem('tenantId') || '';
            const res = await axios.get(`/api/v1/subscription/status?tenantId=${tenantId}`).catch(() => ({ data: null }));
            if (res.data) {
                setStatusData(res.data);
                setSelectedTenantId(tenantId);
            }
        } catch (err: any) {
            console.error('Failed to load license data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOverride = async (action: 'EXTEND_TRIAL' | 'FORCE_ACTIVATE' | 'FORCE_SUSPEND') => {
        if (!selectedTenantId) return;

        setIsExecuting(true);
        setActionMessage(null);

        try {
            const res = await axios.post('/api/v1/subscription/superadmin/override', {
                tenantId: selectedTenantId,
                action,
                extendDays,
                notes: overrideNotes
            });

            if (res.data?.success) {
                setActionMessage({ type: 'success', text: res.data.message || 'License override applied successfully!' });
                fetchLicenseData();
            } else {
                setActionMessage({ type: 'error', text: 'Failed to apply license override.' });
            }
        } catch (err: any) {
            setActionMessage({ type: 'error', text: err.response?.data?.error || err.message });
        } finally {
            setIsExecuting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center text-white">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[var(--text-primary)]">License & Subscription Enforcement Control</h2>
                        <p className="text-xs text-[var(--text-muted)]">Manage tenant trials, subscription enforcement, feature gating, and license overrides</p>
                    </div>
                </div>
                <button onClick={fetchLicenseData} className="btn-secondary py-2 px-3 text-sm">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Status</span>
                    <div className="flex items-center justify-between">
                        <p className="text-xl font-black text-white">{statusData?.status || 'ACTIVE'}</p>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                            {statusData?.isAccessAllowed ? 'ACCESS ALLOWED' : 'BLOCKED'}
                        </span>
                    </div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Plan</span>
                    <p className="text-xl font-black text-sky-400">{statusData?.plan?.name || 'Starter ISP'}</p>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Days Remaining</span>
                    <p className="text-xl font-black text-amber-400">{statusData?.daysRemaining || 0} <span className="text-xs font-normal text-slate-400">days</span></p>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usage Restrictions</span>
                    <p className="text-xl font-black text-emerald-400">
                        {statusData?.usage?.routers?.current || 0} / {statusData?.usage?.routers?.max === -1 ? '∞' : statusData?.usage?.routers?.max} <span className="text-xs text-slate-400 font-normal">routers</span>
                    </p>
                </div>
            </div>

            {/* Super Admin Control Actions Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-400" /> Super Admin License Override Actions
                </h3>

                {actionMessage && (
                    <div className={`p-4 rounded-xl border text-xs font-semibold ${actionMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                        {actionMessage.text}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Action 1: Extend Trial */}
                    <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-sm text-white flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" /> Extend Trial Period
                            </h4>
                        </div>
                        <p className="text-xs text-slate-400">Add complimentary trial days to tenant subscription.</p>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Days to Add</label>
                            <input
                                type="number"
                                value={extendDays}
                                onChange={(e) => setExtendDays(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
                            />
                        </div>

                        <button
                            onClick={() => handleOverride('EXTEND_TRIAL')}
                            disabled={isExecuting}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <PlusCircle className="w-4 h-4" /> Extend Trial by {extendDays} Days
                        </button>
                    </div>

                    {/* Action 2: Force Activate */}
                    <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-sm text-white flex items-center gap-2">
                                <Play className="w-4 h-4 text-emerald-400" /> Force Activate Subscription
                            </h4>
                        </div>
                        <p className="text-xs text-slate-400">Override payment checks & grant 30-day full platform access.</p>

                        <button
                            onClick={() => handleOverride('FORCE_ACTIVATE')}
                            disabled={isExecuting}
                            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 mt-10"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Force Activate Tenant
                        </button>
                    </div>

                    {/* Action 3: Force Suspend */}
                    <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-sm text-white flex items-center gap-2">
                                <Pause className="w-4 h-4 text-rose-400" /> Force Suspend Tenant
                            </h4>
                        </div>
                        <p className="text-xs text-slate-400">Immediately block tenant dashboard & API access.</p>

                        <button
                            onClick={() => handleOverride('FORCE_SUSPEND')}
                            disabled={isExecuting}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 mt-10"
                        >
                            <Lock className="w-4 h-4" /> Force Suspend Access
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
