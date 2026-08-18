import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import JevishLogo from '../components/Common/JevishLogo';
import ThemeToggle from '../components/Common/ThemeToggle';
import PageRefreshButton from '../components/Common/PageRefreshButton';
import OverviewTab from './PlatformOwner/OverviewTab';
import TenantsTab from './PlatformOwner/TenantsTab';
import RoutersTab from './PlatformOwner/RoutersTab';
import DormantAutomationTab from './PlatformOwner/DormantAutomationTab';
import AnalyticsTab from './PlatformOwner/AnalyticsTab';
import SecurityTab from './PlatformOwner/SecurityTab';
import ReportsTab from './PlatformOwner/ReportsTab';
import QuickActionsTab from './PlatformOwner/QuickActionsTab';
import {
    Crown,
    Building2,
    Wifi,
    AlertTriangle,
    TrendingUp,
    ShieldCheck,
    FileText,
    Zap,
    LogOut
} from 'lucide-react';

const PlatformOwnerPortal: React.FC = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'routers' | 'dormant' | 'analytics' | 'security' | 'reports' | 'quick_actions'>('overview');

    const [overviewData, setOverviewData] = useState<any | null>(null);
    const [tenantsData, setTenantsData] = useState<any[]>([]);
    const [routersData, setRoutersData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadPlatformData = async () => {
        try {
            setLoading(true);
            const [overviewRes, tenantsRes, routersRes] = await Promise.all([
                axios.get('/api/v1/platform-owner/overview'),
                axios.get('/api/v1/platform-owner/tenants'),
                axios.get('/api/v1/platform-owner/routers')
            ]);
            setOverviewData(overviewRes.data);
            setTenantsData(tenantsRes.data);
            setRoutersData(routersRes.data);
        } catch (error: any) {
            console.error('Failed to load platform owner data:', error);
            if (error.response?.status === 401) {
                navigate('/superadmin/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlatformData();
    }, []);

    return (
        <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300">
            {/* Platform Owner Header */}
            <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-0 z-50 shadow-sm transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between gap-6 flex-wrap">
                        <div className="flex items-center gap-3">
                            <JevishLogo size="sm" showText={true} />
                            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-amber-500/20 flex items-center gap-1">
                                <Crown size={12} /> PLATFORM OWNER
                            </span>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-subtle)] overflow-x-auto max-w-full">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'overview'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <Crown size={14} /> Overview
                            </button>

                            <button
                                onClick={() => setActiveTab('tenants')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'tenants'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <Building2 size={14} /> Tenants ({tenantsData.length})
                            </button>

                            <button
                                onClick={() => setActiveTab('routers')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'routers'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <Wifi size={14} /> MikroTik Fleet ({routersData.length})
                            </button>

                            <button
                                onClick={() => setActiveTab('dormant')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'dormant'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <AlertTriangle size={14} /> Dormant Rules
                            </button>

                            <button
                                onClick={() => setActiveTab('analytics')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'analytics'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <TrendingUp size={14} /> Revenue Analytics
                            </button>

                            <button
                                onClick={() => setActiveTab('security')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'security'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <ShieldCheck size={14} /> Security Stream
                            </button>

                            <button
                                onClick={() => setActiveTab('reports')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'reports'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <FileText size={14} /> Reports Hub
                            </button>

                            <button
                                onClick={() => setActiveTab('quick_actions')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'quick_actions'
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <Zap size={14} /> Quick Actions
                            </button>
                        </div>

                        {/* Top Actions */}
                        <div className="flex items-center gap-3">
                            <PageRefreshButton label="Refresh" />
                            <ThemeToggle />

                            <button
                                onClick={logout}
                                className="px-3.5 py-1.5 bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition-all hover:text-[var(--text-primary)] text-xs flex items-center gap-1.5"
                            >
                                <LogOut size={14} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto p-8">
                {activeTab === 'overview' && (
                    <OverviewTab
                        data={overviewData}
                        loading={loading}
                        onTabSwitch={(tab: any) => setActiveTab(tab)}
                    />
                )}

                {activeTab === 'tenants' && (
                    <TenantsTab
                        tenants={tenantsData}
                        loading={loading}
                        onRefresh={loadPlatformData}
                    />
                )}

                {activeTab === 'routers' && (
                    <RoutersTab
                        routers={routersData}
                        loading={loading}
                        onRefresh={loadPlatformData}
                    />
                )}

                {activeTab === 'dormant' && (
                    <DormantAutomationTab />
                )}

                {activeTab === 'analytics' && (
                    <AnalyticsTab />
                )}

                {activeTab === 'security' && (
                    <SecurityTab />
                )}

                {activeTab === 'reports' && (
                    <ReportsTab />
                )}

                {activeTab === 'quick_actions' && (
                    <QuickActionsTab />
                )}
            </div>
        </div>
    );
};

export default PlatformOwnerPortal;
