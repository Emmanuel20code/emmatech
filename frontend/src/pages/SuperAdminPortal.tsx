import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminCommandCenter from './SuperAdmin/SuperAdminCommandCenter';
import UltimateSuperAdminCenter from './SuperAdmin/UltimateSuperAdminCenter';
import PlatformSettings from '../components/SuperAdmin/PlatformSettings';
import SmsGatewayManager from '../components/SuperAdmin/SmsGatewayManager';
import SaaSMonetisationSuite from './SuperAdmin/SaaSMonetisationSuite';
import BrandingCenter from './SuperAdmin/BrandingCenter';
import PayHeroGatewayManager from '../components/SuperAdmin/PayHeroGatewayManager';
import MasterDarajaGatewayManager from '../components/SuperAdmin/MasterDarajaGatewayManager';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/Common/ThemeToggle';
import PageRefreshButton from '../components/Common/PageRefreshButton';
import JevishLogo from '../components/Common/JevishLogo';
import { Settings as SettingsIcon, MessageSquare, DollarSign, Palette, Zap, ShieldCheck, CreditCard, Radio } from 'lucide-react';

const SuperAdminPortal = () => {
    const navigate = useNavigate();
    const { logout, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<'ultimate' | 'command' | 'daraja' | 'payhero' | 'saas' | 'branding' | 'settings' | 'sms'>('ultimate');

    if (authLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center transition-colors duration-300">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[var(--border-subtle)] border-t-sky-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-bold">Authenticating Super Admin...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300">
            {/* Super Admin Header */}
            <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-0 z-50 shadow-sm transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-6">
                        <JevishLogo size="sm" showText={true} />
                        <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-2 bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-subtle)]">
                                <button
                                    onClick={() => setActiveTab('ultimate')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'ultimate'
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <ShieldCheck size={16} />
                                    Ultimate Control
                                </button>
                                <button
                                    onClick={() => setActiveTab('command')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'command'
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <Zap size={16} />
                                    Command Center
                                </button>
                                <button
                                    onClick={() => setActiveTab('daraja')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'daraja'
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <Radio size={16} />
                                    Master Daraja M-Pesa
                                </button>
                                <button
                                    onClick={() => setActiveTab('payhero')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'payhero'
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <CreditCard size={16} />
                                    PayHero Gateway
                                </button>
                                <button
                                    onClick={() => setActiveTab('saas')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'saas'
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <DollarSign size={16} />
                                    SaaS Monetisation
                                </button>
                                <button
                                    onClick={() => setActiveTab('branding')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'branding'
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <Palette size={16} />
                                    Branding Center
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'settings'
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <SettingsIcon size={16} />
                                    Settings
                                </button>
                                <button
                                    onClick={() => setActiveTab('sms')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'sms'
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <MessageSquare size={16} />
                                    SMS Gateway
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/superadmin/enterprise-crm')}
                                    className="px-4 py-2 bg-purple-500/10 text-purple-400 font-bold rounded-xl hover:bg-purple-500 hover:text-white border border-purple-500/20 transition-all text-xs flex items-center gap-2"
                                >
                                    💼 Enterprise Sales CRM
                                </button>
                                <button
                                    onClick={() => navigate('/platform-owner')}
                                    className="px-4 py-2 bg-amber-500/10 text-amber-400 font-bold rounded-xl hover:bg-amber-500 hover:text-white border border-amber-500/20 transition-all text-xs flex items-center gap-2"
                                >
                                    👑 Platform Owner Suite
                                </button>
                                <button
                                    onClick={() => navigate('/tenant')}
                                    className="px-4 py-2 bg-sky-500/10 text-sky-400 font-bold rounded-xl hover:bg-sky-500 hover:text-white border border-sky-500/20 transition-all text-xs flex items-center gap-2"
                                >
                                    🏢 My Tenant Workspace
                                </button>
                                <PageRefreshButton label="Refresh" />
                                <ThemeToggle />
                                <span className="px-3 py-1 bg-sky-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-sky-500/20">
                                    SUPER ADMIN
                                </span>
                                <button
                                    onClick={logout}
                                    className="px-4 py-2 bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition-all hover:text-[var(--text-primary)] text-xs"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8 space-y-8">
                {activeTab === 'ultimate' && <UltimateSuperAdminCenter />}
                {activeTab === 'command' && <SuperAdminCommandCenter />}
                {activeTab === 'daraja' && <MasterDarajaGatewayManager />}
                {activeTab === 'payhero' && <PayHeroGatewayManager />}
                {activeTab === 'saas' && <SaaSMonetisationSuite />}
                {activeTab === 'branding' && <BrandingCenter />}
                {activeTab === 'settings' && <PlatformSettings />}
                {activeTab === 'sms' && <SmsGatewayManager />}
            </div>
        </div>
    );
};

export default SuperAdminPortal;

