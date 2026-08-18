import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    Search,
    UserCheck,
    Wifi,
    DollarSign,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    UserCircle2,
    ExternalLink
} from 'lucide-react';

interface TenantData {
    id: string;
    name: string;
    subdomain: string;
    status: 'ACTIVE' | 'SUSPENDED';
    businessEmail: string;
    contactPhone: string;
    commissionPercentage: number;
    baseMonthlyFee: number;
    createdAt: string;
    subscriberCount: number;
    activeSubscriberCount: number;
    routerCount: number;
    onlineRouterCount: number;
    totalRevenue: number;
    platformCommission: number;
    tenantNetRevenue: number;
    walletBalance: number;
    activeSessionsCount: number;
}

interface TenantsTabProps {
    tenants: TenantData[];
    loading: boolean;
    onRefresh: () => void;
}

const TenantsTab: React.FC<TenantsTabProps> = ({ tenants, loading, onRefresh }) => {
    const { startImpersonation } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const filteredTenants = tenants.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.subdomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.contactPhone && t.contactPhone.includes(searchTerm));
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleToggleStatus = async (tenant: TenantData) => {
        const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        if (!confirm(`Are you sure you want to change tenant status for "${tenant.name}" to ${newStatus}?`)) {
            return;
        }

        try {
            setProcessingId(tenant.id);
            await axios.put(`/api/v1/platform-owner/tenants/${tenant.id}/status`, {
                status: newStatus
            });
            onRefresh();
        } catch (error: any) {
            alert(`Failed to update tenant status: ${error.response?.data?.error || error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleImpersonate = async (tenant: TenantData) => {
        try {
            setProcessingId(tenant.id);
            const response = await axios.post(`/api/v1/platform-owner/impersonate/${tenant.id}`);
            const { token } = response.data;
            startImpersonation(token, tenant.name);
            navigate('/tenant');
        } catch (error: any) {
            alert(`Impersonation failed: ${error.response?.data?.error || error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--border-subtle)] border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-medium">Loading Tenants Directory...</p>
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
                        <Building2 className="text-amber-500" size={24} /> Platform Tenant Directory
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Real-time revenue, subscriber counts, and router statistics for all registered tenants.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 sm:w-64">
                        <Search size={16} className="absolute left-3 top-3 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Search tenant name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-surface-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--bg-surface-elevated)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                    >
                        <option value="ALL">All Statuses ({tenants.length})</option>
                        <option value="ACTIVE">Active Only ({tenants.filter(t => t.status === 'ACTIVE').length})</option>
                        <option value="SUSPENDED">Suspended Only ({tenants.filter(t => t.status === 'SUSPENDED').length})</option>
                    </select>
                </div>
            </div>

            {/* Tenant Table */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] uppercase text-[10px] font-black tracking-wider border-b border-[var(--border-subtle)]">
                            <tr>
                                <th className="py-4 px-6">Tenant Name</th>
                                <th className="py-4 px-4">Status</th>
                                <th className="py-4 px-4 text-right">Subscribers</th>
                                <th className="py-4 px-4 text-right">Gross Revenue</th>
                                <th className="py-4 px-4 text-right">Platform Fee</th>
                                <th className="py-4 px-4 text-center">Routers</th>
                                <th className="py-4 px-4 text-center">Active Sessions</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {filteredTenants.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)] font-medium">
                                        No tenants found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredTenants.map((t) => (
                                    <tr key={t.id} className="hover:bg-[var(--bg-surface-elevated)]/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                                                {t.name}
                                                <span className="text-[10px] px-2 py-0.5 bg-[var(--bg-surface-elevated)] font-mono text-amber-400 border border-amber-500/20 rounded">
                                                    .{t.subdomain}
                                                </span>
                                            </div>
                                            <div className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">
                                                ID: {t.id.substring(0, 8)}... | Joined: {new Date(t.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            {t.status === 'ACTIVE' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
                                                    <CheckCircle2 size={12} /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-bold">
                                                    <XCircle size={12} /> Suspended
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="font-extrabold text-[var(--text-primary)]">
                                                {t.subscriberCount.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-emerald-400 font-semibold">
                                                {t.activeSubscriberCount} Active
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-right font-mono font-bold text-[var(--text-primary)]">
                                            KES {t.totalRevenue.toLocaleString()}
                                        </td>
                                        <td className="py-4 px-4 text-right font-mono font-bold text-amber-400">
                                            KES {t.platformCommission.toLocaleString()}
                                            <div className="text-[10px] text-[var(--text-secondary)] font-sans">
                                                ({t.commissionPercentage}%)
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-bold">
                                                <Wifi size={12} /> {t.onlineRouterCount} / {t.routerCount}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center font-bold text-[var(--text-primary)]">
                                            {t.activeSessionsCount}
                                        </td>
                                        <td className="py-4 px-6 text-right space-x-2">
                                            {/* Impersonate Tenant */}
                                            <button
                                                onClick={() => handleImpersonate(t)}
                                                disabled={processingId === t.id}
                                                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/20 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                                                title="Troubleshoot and view tenant dashboard"
                                            >
                                                <UserCircle2 size={14} /> Impersonate
                                            </button>

                                            {/* Suspend / Activate Toggle */}
                                            <button
                                                onClick={() => handleToggleStatus(t)}
                                                disabled={processingId === t.id}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border ${t.status === 'ACTIVE'
                                                        ? 'bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border-rose-500/20'
                                                        : 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border-emerald-500/20'
                                                    }`}
                                            >
                                                {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TenantsTab;
