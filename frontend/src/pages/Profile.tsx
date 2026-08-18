import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    User,
    Building2,
    CreditCard,
    Shield,
    Bell,
    Palette,
    FileText,
    Plug,
    Activity,
    CheckCircle2,
    AlertCircle,
    Save,
    RefreshCw,
    Download,
    Upload,
    Lock,
    KeyRound,
    Smartphone,
    Sparkles,
    X,
    Eye,
    EyeOff,
    Settings,
    Copy,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../components/Common/BackButton';
import ThemeToggle from '../components/Common/ThemeToggle';
import TenantPayoutSettings from '../components/Tenant/TenantPayoutSettings';

interface PersonalInfo {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    username: string;
    email: string;
    phone: string;
    altPhone: string;
    dateJoined: string;
    preferredLanguage: string;
    timeZone: string;
    country: string;
    countyState: string;
    city: string;
    postalCode: string;
    physicalAddress: string;
    profilePhotoUrl: string;
    role: string;
}

interface BusinessInfo {
    id: string;
    name: string;
    tradingName: string;
    businessLogoUrl: string;
    businessRegistrationNumber: string;
    taxPin: string;
    vatNumber: string;
    website: string;
    businessEmail: string;
    businessPhone: string;
    supportEmail: string;
    supportPhone: string;
    businessAddress: string;
}

interface PaymentWithdrawalInfo {
    mpesaName: string;
    mpesaNumber: string;
    bankName: string;
    bankBranch: string;
    bankAccountName: string;
    bankAccountNumber: string;
    maskedBankAccount: string;
    bankSwiftCode: string;
    bankIban: string;
    defaultWithdrawalMethod: 'MPESA' | 'BANK';
    minimumWithdrawalAmount: number;
}

interface WithdrawalBalances {
    totalBalance: number;
    totalBalanceFormatted: string;
    pendingBalance: number;
    pendingBalanceFormatted: string;
    availableBalance: number;
    availableBalanceFormatted: string;
    withdrawableBalance: number;
    withdrawableBalanceFormatted: string;
    minimumWithdrawalCents: number;
    minimumWithdrawalFormatted: string;
}

interface WithdrawalRecord {
    id: string;
    referenceId: string;
    amount: number;
    method: 'MPESA' | 'BANK';
    status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
    recipientDetails: string;
    requestedAt: string;
    completedAt?: string;
    failureReason?: string;
}

interface SecurityInfo {
    twoFactorEnabled: boolean;
    twoFactorMethod: 'EMAIL' | 'SMS' | 'AUTHENTICATOR';
    lastPasswordChange: string;
    activeSessionsCount: number;
}

interface NotificationPrefs {
    emailNotifications: boolean;
    smsNotifications: boolean;
    whatsappNotifications: boolean;
    pushNotifications: boolean;
    securityAlerts: boolean;
    paymentAlerts: boolean;
    campaignAlerts: boolean;
}

interface BrandingInfo {
    logoUrl: string;
    loginLogoUrl: string;
    portalLogoUrl: string;
    faviconUrl: string;
    themeColor: string;
    primaryColor: string;
    secondaryColor: string;
    themePreference: 'light' | 'dark' | 'system';
}

interface TenantDoc {
    id: string;
    docType: 'BUSINESS_CERT' | 'TAX_PIN_CERT' | 'NATIONAL_ID' | 'BANK_LETTER' | 'UTILITY_BILL';
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

interface IntegrationItem {
    id: string;
    name: string;
    category: string;
    status: 'CONNECTED' | 'DISCONNECTED';
    lastSync: string;
    details: string;
}

interface ActivityLogItem {
    id: string;
    date: string;
    action: string;
    details: string;
    ipAddress: string;
    browser: string;
}

interface ProfileDashboard {
    profileCompletionPercentage: number;
    missingInformation: string[];
    currentWalletBalance: number;
    currentWalletBalanceFormatted: string;
    currentSmsBalance: number;
    activePackages: number;
    subscribers: number;
    routersConnected: number;
    lastLogin: string;
    lastPasswordChange: string;
    pendingWithdrawalsCount: number;
}

const ProfilePage = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();

    const getInitialTab = (): 'personal' | 'business' | 'payment' | 'security' | 'notifications' | 'branding' | 'documents' | 'integrations' | 'activity' => {
        const param = searchParams.get('tab') || (location.state as any)?.tab;
        if (param && ['personal', 'business', 'payment', 'security', 'notifications', 'branding', 'documents', 'integrations', 'activity'].includes(param)) {
            return param as any;
        }
        if (location.pathname.includes('payout') || location.pathname.includes('payment')) {
            return 'payment';
        }
        return 'personal';
    };

    const [activeTab, setActiveTab] = useState<
        'personal' | 'business' | 'payment' | 'security' | 'notifications' | 'branding' | 'documents' | 'integrations' | 'activity'
    >(getInitialTab);

    useEffect(() => {
        const tabParam = searchParams.get('tab') || (location.state as any)?.tab;
        if (tabParam && ['personal', 'business', 'payment', 'security', 'notifications', 'branding', 'documents', 'integrations', 'activity'].includes(tabParam)) {
            setActiveTab(tabParam as any);
        } else if (location.pathname.includes('payout') || location.pathname.includes('payment')) {
            setActiveTab('payment');
        }
    }, [searchParams, location]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Data States
    const [personal, setPersonal] = useState<PersonalInfo | null>(null);
    const [business, setBusiness] = useState<BusinessInfo | null>(null);
    const [payment, setPayment] = useState<PaymentWithdrawalInfo | null>(null);
    const [balances, setBalances] = useState<WithdrawalBalances | null>(null);
    const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
    const [security, setSecurity] = useState<SecurityInfo | null>(null);
    const [notifications, setNotifications] = useState<NotificationPrefs | null>(null);
    const [branding, setBranding] = useState<BrandingInfo | null>(null);
    const [documents, setDocuments] = useState<TenantDoc[]>([]);
    const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
    const [dashboard, setDashboard] = useState<ProfileDashboard | null>(null);

    // Modals
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawMethod, setWithdrawMethod] = useState<'MPESA' | 'BANK'>('MPESA');
    const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswordText, setShowPasswordText] = useState(false);

    // Receipt Modal
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
    const [testingIntegrationId, setTestingIntegrationId] = useState<string | null>(null);

    // M-Pesa Modal and Configuration States
    const [showMpesaModal, setShowMpesaModal] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);
    const [mpesaConfig, setMpesaConfig] = useState({
        mpesaShortcode: '',
        mpesaTillNumber: '',
        mpesaPaybillNumber: '',
        mpesaEnvironment: 'sandbox',
        mpesaConsumerKeyMasked: '',
        mpesaConsumerSecretMasked: '',
        mpesaPasskeyMasked: '',
        mpesaInitiatorName: '',
        mpesaInitiatorPasswordMasked: '',
        webhookUrl: ''
    });
    const [savingMpesa, setSavingMpesa] = useState(false);
    const [testingMpesa, setTestingMpesa] = useState(false);
    const [mpesaModalMsg, setMpesaModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleConfigureMpesa = async () => {
        try {
            setMpesaModalMsg(null);
            setCopiedWebhook(false);
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/v1/admin/profile/integrations/mpesa', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMpesaConfig(res.data);
            setShowMpesaModal(true);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to fetch M-Pesa configuration settings');
        }
    };

    const handleSaveMpesaConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSavingMpesa(true);
            setMpesaModalMsg(null);
            const token = localStorage.getItem('token');
            
            const payload = {
                mpesaShortcode: mpesaConfig.mpesaShortcode,
                mpesaTillNumber: mpesaConfig.mpesaTillNumber,
                mpesaPaybillNumber: mpesaConfig.mpesaPaybillNumber,
                mpesaEnvironment: mpesaConfig.mpesaEnvironment,
                mpesaConsumerKey: mpesaConfig.mpesaConsumerKeyMasked,
                mpesaConsumerSecret: mpesaConfig.mpesaConsumerSecretMasked,
                mpesaPasskey: mpesaConfig.mpesaPasskeyMasked,
                mpesaInitiatorName: mpesaConfig.mpesaInitiatorName,
                mpesaInitiatorPassword: mpesaConfig.mpesaInitiatorPasswordMasked
            };

            const res = await axios.put('/api/v1/admin/profile/integrations/mpesa', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMpesaModalMsg({ type: 'success', text: res.data.message || 'M-Pesa credentials updated and securely encrypted!' });
            
            // Refresh integrations status list
            const intRes = await axios.get('/api/v1/admin/profile/integrations', { headers: { Authorization: `Bearer ${token}` } });
            setIntegrations(intRes.data.integrations || []);
        } catch (err: any) {
            setMpesaModalMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save configuration.' });
        } finally {
            setSavingMpesa(false);
        }
    };

    const handleTestMpesaCredentials = async () => {
        try {
            setTestingMpesa(true);
            setMpesaModalMsg(null);
            const token = localStorage.getItem('token');
            
            // Auto-save before testing to avoid testing stale/empty DB credentials
            const payload = {
                mpesaShortcode: mpesaConfig.mpesaShortcode,
                mpesaTillNumber: mpesaConfig.mpesaTillNumber,
                mpesaPaybillNumber: mpesaConfig.mpesaPaybillNumber,
                mpesaEnvironment: mpesaConfig.mpesaEnvironment,
                mpesaConsumerKey: mpesaConfig.mpesaConsumerKeyMasked,
                mpesaConsumerSecret: mpesaConfig.mpesaConsumerSecretMasked,
                mpesaPasskey: mpesaConfig.mpesaPasskeyMasked,
                mpesaInitiatorName: mpesaConfig.mpesaInitiatorName,
                mpesaInitiatorPassword: mpesaConfig.mpesaInitiatorPasswordMasked
            };
            await axios.put('/api/v1/admin/profile/integrations/mpesa', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Now perform the test
            const res = await axios.post('/api/v1/admin/profile/integrations/mpesa/test', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMpesaModalMsg({ type: 'success', text: res.data.message || 'Saved and OAuth validation test passed successfully!' });
        } catch (err: any) {
            setMpesaModalMsg({ type: 'error', text: err.response?.data?.error || 'Connection test failed. Please check your credentials.' });
        } finally {
            setTestingMpesa(false);
        }
    };

    // Fetch Profile Data
    const fetchProfileData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/v1/admin/profile', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setPersonal(res.data.personal);
            setBusiness(res.data.business);
            setPayment(res.data.paymentWithdrawal);
            setBalances(res.data.withdrawalBalances);
            setWithdrawals(res.data.withdrawals || []);
            setSecurity(res.data.security);
            setNotifications(res.data.notifications);
            setBranding(res.data.branding);
            setDocuments(res.data.documents || []);
            setDashboard(res.data.dashboard);

            // Fetch Integrations & Activity
            const intRes = await axios.get('/api/v1/admin/profile/integrations', { headers: { Authorization: `Bearer ${token}` } });
            setIntegrations(intRes.data.integrations || []);

            const actRes = await axios.get('/api/v1/admin/profile/activity', { headers: { Authorization: `Bearer ${token}` } });
            setActivityLogs(actRes.data.logs || []);

            setHasUnsavedChanges(false);
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to load profile data' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfileData();
    }, []);

    const showNotification = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    // Save Handlers per section
    const handleSavePersonal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!personal) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/v1/admin/profile/personal', personal, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showNotification('success', 'Personal information updated successfully');
            setHasUnsavedChanges(false);
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Failed to save personal information');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!business) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/v1/admin/profile/business', business, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showNotification('success', 'Business information updated successfully');
            setHasUnsavedChanges(false);
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Failed to save business information');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payment) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/v1/admin/profile/payment', payment, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showNotification('success', 'Payment & Withdrawal details saved securely');
            setHasUnsavedChanges(false);
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Failed to save payment settings');
        } finally {
            setSaving(false);
        }
    };

    const handleRequestWithdrawalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingWithdraw(true);
        try {
            const token = localStorage.getItem('token');
            const amountCents = Math.round(parseFloat(withdrawAmount) * 100);
            await axios.post(
                '/api/v1/admin/profile/withdrawals/request',
                { amount: amountCents, method: withdrawMethod },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showNotification('success', `Withdrawal request of KES ${withdrawAmount} submitted successfully`);
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            fetchProfileData();
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Withdrawal request failed');
        } finally {
            setSubmittingWithdraw(false);
        }
    };

    const handleCancelWithdrawal = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/v1/admin/profile/withdrawals/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
            showNotification('success', 'Withdrawal request cancelled successfully');
            fetchProfileData();
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Failed to cancel withdrawal');
        }
    };

    const handleDownloadReceipt = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/api/v1/admin/profile/withdrawals/${id}/receipt`, { headers: { Authorization: `Bearer ${token}` } });
            setSelectedReceipt(res.data);
        } catch (e: any) {
            showNotification('error', 'Failed to fetch withdrawal receipt');
        }
    };

    const handleChangePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showNotification('error', 'New password and confirm password do not match');
            return;
        }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/v1/admin/profile/security/password', { currentPassword, newPassword }, { headers: { Authorization: `Bearer ${token}` } });
            showNotification('success', 'Password updated successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e: any) {
            showNotification('error', e.response?.data?.error || 'Password update failed');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle2FA = async (enabled: boolean) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/v1/admin/profile/security/two-factor', { enabled, method: security?.twoFactorMethod || 'EMAIL' }, { headers: { Authorization: `Bearer ${token}` } });
            setSecurity(prev => prev ? { ...prev, twoFactorEnabled: enabled } : null);
            showNotification('success', `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`);
        } catch (e: any) {
            showNotification('error', 'Failed to update 2FA settings');
        }
    };

    const handleLogoutOtherDevices = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/v1/admin/profile/security/logout-other-devices', {}, { headers: { Authorization: `Bearer ${token}` } });
            showNotification('success', 'Logged out all other active sessions successfully');
        } catch (e: any) {
            showNotification('error', 'Failed to logout other devices');
        }
    };

    const handleSaveNotifications = async (updated: NotificationPrefs) => {
        setNotifications(updated);
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/v1/admin/profile/notifications', updated, { headers: { Authorization: `Bearer ${token}` } });
            showNotification('success', 'Notification preferences saved');
        } catch (e: any) {
            showNotification('error', 'Failed to save notifications');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBranding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branding) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/v1/admin/profile/branding', branding, { headers: { Authorization: `Bearer ${token}` } });
            showNotification('success', 'Branding customization updated');
            setHasUnsavedChanges(false);
        } catch (e: any) {
            showNotification('error', 'Failed to update branding settings');
        } finally {
            setSaving(false);
        }
    };

    const handleDocumentUpload = async (docType: any, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            showNotification('error', 'File size exceeds maximum 10MB limit');
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const fileUrl = reader.result as string;
            try {
                const token = localStorage.getItem('token');
                await axios.post('/api/v1/admin/profile/documents', {
                    docType,
                    fileName: file.name,
                    fileUrl,
                    fileType: file.type,
                    fileSize: file.size
                }, { headers: { Authorization: `Bearer ${token}` } });
                showNotification('success', `Uploaded document: ${file.name}`);
                fetchProfileData();
            } catch (err: any) {
                showNotification('error', 'Document upload failed');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleTestIntegration = async (id: string) => {
        setTestingIntegrationId(id);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/v1/admin/profile/integrations/test', { integrationId: id }, { headers: { Authorization: `Bearer ${token}` } });
            showNotification('success', res.data.message);
        } catch (e: any) {
            showNotification('error', 'Integration test failed');
        } finally {
            setTestingIntegrationId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <RefreshCw size={40} className="animate-spin mx-auto text-sky-500" />
                    <p className="text-sm font-bold text-[var(--text-secondary)]">Loading Tenant Profile & Account Settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header Controls */}
            <div className="space-y-8">
                {/* Toast Notification */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`p-4 rounded-2xl flex items-center justify-between shadow-xl ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                }`}
                        >
                            <div className="flex items-center gap-3 font-bold text-sm">
                                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                                <span>{message.text}</span>
                            </div>
                            <button onClick={() => setMessage(null)} className="hover:opacity-70">
                                <X size={18} />
                            </button>
                        </motion.div>
                    )}
                    {hasUnsavedChanges && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-between shadow-lg"
                        >
                            <div className="flex items-center gap-3 font-bold text-xs">
                                <AlertCircle size={18} />
                                <span>You have unsaved profile changes. Be sure to click "Save Changes" before leaving this section.</span>
                            </div>
                            <button
                                onClick={fetchProfileData}
                                className="text-[11px] font-black uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 rounded-xl border border-amber-500/30 transition-all text-amber-300"
                            >
                                Discard Changes
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Profile Overview Header Card */}
                <div className="bg-[var(--bg-surface)] backdrop-blur-3xl border border-[var(--border-subtle)] rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-sky-500/30 bg-slate-800 shadow-xl flex items-center justify-center text-3xl font-black text-sky-400">
                                    {personal?.profilePhotoUrl ? (
                                        <img src={personal.profilePhotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        business?.name.slice(0, 2).toUpperCase() || 'TB'
                                    )}
                                </div>
                                <label className="absolute bottom-[-6px] right-[-6px] bg-sky-500 hover:bg-sky-400 text-white p-2 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110">
                                    <Upload size={14} />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    setPersonal(prev => prev ? { ...prev, profilePhotoUrl: reader.result as string } : null);
                                                    setHasUnsavedChanges(true);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            </div>

                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                                        {business?.name || 'Tenant Workspace'}
                                    </h1>
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                                        <Sparkles size={12} /> Verified Tenant
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1">
                                    Subdomain: <span className="text-sky-400 font-mono">{business?.name.toLowerCase().replace(/\s+/g, '')}.jevish.site</span> • Role: <span className="uppercase text-slate-300 font-bold">{personal?.role || 'TENANT'}</span>
                                </p>
                            </div>
                        </div>

                        {/* Profile Completion Bar */}
                        <div className="w-full md:w-80 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-5 rounded-2xl space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-sky-400" /> Profile Completion
                                </span>
                                <span className="text-sky-400 font-black text-sm">{dashboard?.profileCompletionPercentage || 85}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${dashboard?.profileCompletionPercentage || 85}%` }}
                                ></div>
                            </div>
                            {dashboard?.missingInformation && dashboard.missingInformation.length > 0 && (
                                <p className="text-[10px] font-medium text-[var(--text-muted)] truncate">
                                    Missing: {dashboard.missingInformation.join(', ')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Summary Cards Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-[var(--border-subtle)]">
                        <div className="bg-[var(--bg-surface-elevated)] p-4 rounded-2xl border border-[var(--border-subtle)]">
                            <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">SMS Balance</p>
                            <p className="text-lg font-black text-sky-400 mt-1">{dashboard?.currentSmsBalance || 1500} Credits</p>
                        </div>
                        <div className="bg-[var(--bg-surface-elevated)] p-4 rounded-2xl border border-[var(--border-subtle)]">
                            <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">Subscribers</p>
                            <p className="text-lg font-black text-indigo-400 mt-1">{dashboard?.subscribers || 0} Active</p>
                        </div>
                        <div className="bg-[var(--bg-surface-elevated)] p-4 rounded-2xl border border-[var(--border-subtle)]">
                            <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">Routers</p>
                            <p className="text-lg font-black text-purple-400 mt-1">{dashboard?.routersConnected || 0} Gateways</p>
                        </div>
                    </div>
                </div>

                {/* Profile Navigation Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[var(--border-subtle)] scrollbar-none">
                    {[
                        { id: 'personal', label: 'Personal Info', icon: User },
                        { id: 'business', label: 'Business Info', icon: Building2 },
                        { id: 'payment', label: 'Payment & Withdrawal', icon: CreditCard },
                        { id: 'security', label: 'Security', icon: Shield },
                        { id: 'notifications', label: 'Notifications', icon: Bell },
                        { id: 'branding', label: 'Branding', icon: Palette },
                        { id: 'documents', label: 'Documents', icon: FileText },
                        { id: 'integrations', label: 'Connected Accounts', icon: Plug },
                        { id: 'activity', label: 'Activity Log', icon: Activity },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${isActive
                                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                                    }`}
                            >
                                <Icon size={16} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content Body */}
                <div className="bg-[var(--bg-surface)] backdrop-blur-3xl border border-[var(--border-subtle)] rounded-[2.5rem] p-8 shadow-2xl">
                    {/* TAB 1: PERSONAL INFORMATION */}
                    {activeTab === 'personal' && personal && (
                        <form onSubmit={handleSavePersonal} className="space-y-8">
                            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-5">
                                <div>
                                    <h2 className="text-xl font-black text-[var(--text-primary)]">Personal Information</h2>
                                    <p className="text-xs text-[var(--text-secondary)]">Manage your personal account profile, contact info, and preferences</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-sky-500 text-white text-xs font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    <span>{saving ? 'Saving...' : 'Save Personal Details'}</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">First Name</label>
                                    <input
                                        type="text"
                                        value={personal.firstName}
                                        onChange={e => { setPersonal({ ...personal, firstName: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. John"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        value={personal.lastName}
                                        onChange={e => { setPersonal({ ...personal, lastName: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        value={personal.displayName}
                                        onChange={e => { setPersonal({ ...personal, displayName: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Username</label>
                                    <input
                                        type="text"
                                        value={personal.username}
                                        onChange={e => { setPersonal({ ...personal, username: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="johndoe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Account Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={personal.email}
                                        onChange={e => { setPersonal({ ...personal, email: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Primary Phone Number</label>
                                    <input
                                        type="text"
                                        value={personal.phone}
                                        onChange={e => { setPersonal({ ...personal, phone: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="+254712345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Alternative Phone Number</label>
                                    <input
                                        type="text"
                                        value={personal.altPhone}
                                        onChange={e => { setPersonal({ ...personal, altPhone: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="+254789012345"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Preferred Language</label>
                                    <select
                                        value={personal.preferredLanguage}
                                        onChange={e => { setPersonal({ ...personal, preferredLanguage: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                    >
                                        <option value="en">English (US)</option>
                                        <option value="sw">Swahili</option>
                                        <option value="fr">French</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Time Zone</label>
                                    <select
                                        value={personal.timeZone}
                                        onChange={e => { setPersonal({ ...personal, timeZone: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                    >
                                        <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
                                        <option value="UTC">UTC</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Country</label>
                                    <input
                                        type="text"
                                        value={personal.country}
                                        onChange={e => { setPersonal({ ...personal, country: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">County / State</label>
                                    <input
                                        type="text"
                                        value={personal.countyState}
                                        onChange={e => { setPersonal({ ...personal, countyState: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. Nairobi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">City</label>
                                    <input
                                        type="text"
                                        value={personal.city}
                                        onChange={e => { setPersonal({ ...personal, city: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. Westlands"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Postal Code</label>
                                    <input
                                        type="text"
                                        value={personal.postalCode}
                                        onChange={e => { setPersonal({ ...personal, postalCode: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="00100"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Physical Address</label>
                                    <input
                                        type="text"
                                        value={personal.physicalAddress}
                                        onChange={e => { setPersonal({ ...personal, physicalAddress: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="Building, Street, Office Suite"
                                    />
                                </div>
                            </div>
                        </form>
                    )}

                    {/* TAB 2: BUSINESS INFORMATION */}
                    {activeTab === 'business' && business && (
                        <form onSubmit={handleSaveBusiness} className="space-y-8">
                            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-5">
                                <div>
                                    <h2 className="text-xl font-black text-[var(--text-primary)]">Business Information</h2>
                                    <p className="text-xs text-[var(--text-secondary)]">Manage legal company identity, registration details, tax numbers, and contact channels</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-sky-500 text-white text-xs font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    <span>{saving ? 'Saving...' : 'Save Business Info'}</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Registered Business Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={business.name}
                                        onChange={e => { setBusiness({ ...business, name: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. Jevish Networks Ltd"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Trading Name (DBA)</label>
                                    <input
                                        type="text"
                                        value={business.tradingName}
                                        onChange={e => { setBusiness({ ...business, tradingName: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. Jevish HighSpeed Internet"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Business Registration Number</label>
                                    <input
                                        type="text"
                                        value={business.businessRegistrationNumber}
                                        onChange={e => { setBusiness({ ...business, businessRegistrationNumber: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. PVT-12345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Tax PIN (KRA PIN)</label>
                                    <input
                                        type="text"
                                        value={business.taxPin}
                                        onChange={e => { setBusiness({ ...business, taxPin: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. P051234567Z"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">VAT Number</label>
                                    <input
                                        type="text"
                                        value={business.vatNumber}
                                        onChange={e => { setBusiness({ ...business, vatNumber: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="e.g. VAT-9876543"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Official Website</label>
                                    <input
                                        type="url"
                                        value={business.website}
                                        onChange={e => { setBusiness({ ...business, website: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="https://myjevishisp.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Business Email</label>
                                    <input
                                        type="email"
                                        value={business.businessEmail}
                                        onChange={e => { setBusiness({ ...business, businessEmail: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="info@myjevishisp.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Business Phone</label>
                                    <input
                                        type="text"
                                        value={business.businessPhone}
                                        onChange={e => { setBusiness({ ...business, businessPhone: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="+254700000000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Customer Support Email</label>
                                    <input
                                        type="email"
                                        value={business.supportEmail}
                                        onChange={e => { setBusiness({ ...business, supportEmail: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="support@myjevishisp.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Customer Support Phone</label>
                                    <input
                                        type="text"
                                        value={business.supportPhone}
                                        onChange={e => { setBusiness({ ...business, supportPhone: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="+254711223344"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Headquarters Address</label>
                                    <input
                                        type="text"
                                        value={business.businessAddress}
                                        onChange={e => { setBusiness({ ...business, businessAddress: e.target.value }); setHasUnsavedChanges(true); }}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        placeholder="Tower 2, Commercial Center, Nairobi"
                                    />
                                </div>
                            </div>
                        </form>
                    )}
                    {/* TAB 3: PAYMENT & WITHDRAWAL */}
                    {activeTab === 'payment' && (
                        <div className="space-y-10">
                            <TenantPayoutSettings />
                        </div>
                    )}


                    {/* TAB 4: SECURITY */}
                    {activeTab === 'security' && security && (
                        <div className="space-y-10">
                            {/* Change Password */}
                            <form onSubmit={handleChangePasswordSubmit} className="space-y-6">
                                <div className="border-b border-[var(--border-subtle)] pb-5">
                                    <h2 className="text-xl font-black text-[var(--text-primary)]">Security & Password Management</h2>
                                    <p className="text-xs text-[var(--text-secondary)]">Update your administrative credentials, enforce two-factor security, and manage active device sessions</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Current Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPasswordText ? 'text' : 'password'}
                                                required
                                                value={currentPassword}
                                                onChange={e => setCurrentPassword(e.target.value)}
                                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 pr-12 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswordText(!showPasswordText)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                            >
                                                {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPasswordText ? 'text' : 'password'}
                                                required
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 pr-12 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                                placeholder="At least 8 characters"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswordText(!showPasswordText)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                            >
                                                {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Confirm New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPasswordText ? 'text' : 'password'}
                                                required
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 pr-12 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswordText(!showPasswordText)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                            >
                                                {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-sky-500 text-white text-xs font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
                                >
                                    <KeyRound size={16} />
                                    <span>{saving ? 'Updating Password...' : 'Update Password'}</span>
                                </button>
                            </form>

                            {/* Two-Factor Authentication & Active Sessions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-[var(--border-subtle)]">
                                <div className="bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-sm text-[var(--text-primary)]">Two-Factor Authentication (2FA)</h3>
                                            <p className="text-xs text-[var(--text-secondary)]">Require an email OTP challenge during administrator sign-in</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleToggle2FA(!security.twoFactorEnabled)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${security.twoFactorEnabled
                                                    ? 'bg-emerald-500 text-white border-emerald-400'
                                                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                                                }`}
                                        >
                                            {security.twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-[var(--text-muted)]">
                                        Last Password Change: <span className="text-[var(--text-primary)] font-semibold">{new Date(security.lastPasswordChange).toLocaleDateString()}</span>
                                    </p>
                                </div>

                                <div className="bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                                    <div>
                                        <h3 className="font-bold text-sm text-[var(--text-primary)]">Active Device Sessions</h3>
                                        <p className="text-xs text-[var(--text-secondary)]">Revoke access for all other active logged-in devices</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleLogoutOtherDevices}
                                        className="bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-xs font-black px-5 py-3 rounded-2xl transition-all flex items-center gap-2"
                                    >
                                        <Lock size={16} /> Logout Other Devices
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: NOTIFICATIONS */}
                    {activeTab === 'notifications' && notifications && (
                        <div className="space-y-8">
                            <div className="border-b border-[var(--border-subtle)] pb-5">
                                <h2 className="text-xl font-black text-[var(--text-primary)]">Notification Preferences</h2>
                                <p className="text-xs text-[var(--text-secondary)]">Choose how and when you receive automated billing alerts, security notifications, and campaign updates</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                                {[
                                    { key: 'emailNotifications', title: 'Email Notifications', desc: 'Receive daily settlement summaries and system reports via email' },
                                    { key: 'smsNotifications', title: 'SMS Notifications', desc: 'Receive instant SMS alerts when withdrawals or payouts occur' },
                                    { key: 'whatsappNotifications', title: 'WhatsApp Notifications', desc: 'Receive automated WhatsApp alerts for subscriber activations' },
                                    { key: 'securityAlerts', title: 'Security Alerts', desc: 'Get notified immediately on unauthorized or failed admin logins' },
                                    { key: 'paymentAlerts', title: 'Payment Alerts', desc: 'Real-time notifications on M-Pesa payments and subscriber renewals' },
                                    { key: 'campaignAlerts', title: 'Campaign Alerts', desc: 'Notifications on SMS campaign delivery completion' },
                                ].map(item => {
                                    const isEnabled = (notifications as any)[item.key];
                                    return (
                                        <div key={item.key} className="bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-sm text-[var(--text-primary)]">{item.title}</h3>
                                                <p className="text-xs text-[var(--text-secondary)] mt-1">{item.desc}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSaveNotifications({ ...notifications, [item.key]: !isEnabled })}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${isEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 6: BRANDING */}
                    {activeTab === 'branding' && branding && (
                        <form onSubmit={handleSaveBranding} className="space-y-8">
                            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-5">
                                <div>
                                    <h2 className="text-xl font-black text-[var(--text-primary)]">Branding & White-Label Customization</h2>
                                    <p className="text-xs text-[var(--text-secondary)]">Customize white-label portal logos, captive page theme colors, and favicon icons</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-sky-500 text-white text-xs font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    <span>{saving ? 'Saving...' : 'Save Branding'}</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Main Business Logo URL</label>
                                        <input
                                            type="text"
                                            value={branding.logoUrl}
                                            onChange={e => { setBranding({ ...branding, logoUrl: e.target.value }); setHasUnsavedChanges(true); }}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Captive Portal Logo URL</label>
                                        <input
                                            type="text"
                                            value={branding.portalLogoUrl}
                                            onChange={e => { setBranding({ ...branding, portalLogoUrl: e.target.value }); setHasUnsavedChanges(true); }}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Primary Accent Color</label>
                                        <div className="flex gap-4 items-center">
                                            <input
                                                type="color"
                                                value={branding.primaryColor}
                                                onChange={e => { setBranding({ ...branding, primaryColor: e.target.value }); setHasUnsavedChanges(true); }}
                                                className="w-12 h-12 rounded-2xl cursor-pointer bg-transparent border-0"
                                            />
                                            <input
                                                type="text"
                                                value={branding.primaryColor}
                                                onChange={e => { setBranding({ ...branding, primaryColor: e.target.value }); setHasUnsavedChanges(true); }}
                                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-mono font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Theme Mode Preference</label>
                                        <select
                                            value={branding.themePreference}
                                            onChange={e => { setBranding({ ...branding, themePreference: e.target.value as any }); setHasUnsavedChanges(true); }}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-semibold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                        >
                                            <option value="light">Light Mode</option>
                                            <option value="dark">Dark Mode (Recommended)</option>
                                            <option value="system">System Default</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* TAB 7: DOCUMENTS */}
                    {activeTab === 'documents' && (
                        <div className="space-y-8">
                            <div className="border-b border-[var(--border-subtle)] pb-5">
                                <h2 className="text-xl font-black text-[var(--text-primary)]">KYC & Legal Compliance Documents</h2>
                                <p className="text-xs text-[var(--text-secondary)]">Upload your official registration, Tax PIN certificate, bank letters, and ID documents for verification</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { type: 'BUSINESS_CERT', title: 'Business Registration Certificate', desc: 'Upload Certificate of Incorporation / Business Name Registration' },
                                    { type: 'TAX_PIN_CERT', title: 'KRA Tax PIN Certificate', desc: 'Upload KRA Tax PIN Certificate document' },
                                    { type: 'NATIONAL_ID', title: 'National ID / Passport Document', desc: 'Upload Director / Proprietor ID or Passport' },
                                    { type: 'BANK_LETTER', title: 'Bank Account Confirmation Letter', desc: 'Upload Bank Statement or Account Confirmation Letter' },
                                    { type: 'UTILITY_BILL', title: 'Utility Bill (Address Verification)', desc: 'Upload recent Electricity / Water bill for physical address proof' },
                                ].map(item => {
                                    const existingDoc = documents.find(d => d.docType === item.type);
                                    return (
                                        <div key={item.type} className="bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-sm text-[var(--text-primary)]">{item.title}</h3>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-1">{item.desc}</p>
                                                </div>
                                                {existingDoc && (
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${existingDoc.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                        }`}>
                                                        {existingDoc.status}
                                                    </span>
                                                )}
                                            </div>

                                            {existingDoc ? (
                                                <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                                                    <div className="flex items-center gap-3">
                                                        <FileText size={20} className="text-sky-400" />
                                                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{existingDoc.fileName}</span>
                                                    </div>
                                                    <a href={existingDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline text-xs font-bold">
                                                        View Document
                                                    </a>
                                                </div>
                                            ) : (
                                                <label className="border-2 border-dashed border-[var(--border-subtle)] hover:border-sky-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                                                    <Upload size={24} className="text-[var(--text-muted)] mb-2" />
                                                    <span className="text-xs font-bold text-sky-400">Click to Upload PDF, JPG, PNG</span>
                                                    <span className="text-[10px] text-[var(--text-muted)] mt-1">Maximum file size: 10MB</span>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.png,.jpg,.jpeg"
                                                        className="hidden"
                                                        onChange={(e) => handleDocumentUpload(item.type, e)}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 8: CONNECTED ACCOUNTS */}
                    {activeTab === 'integrations' && (
                        <div className="space-y-8">
                            <div className="border-b border-[var(--border-subtle)] pb-5">
                                <h2 className="text-xl font-black text-[var(--text-primary)]">Connected System Integrations</h2>
                                <p className="text-xs text-[var(--text-secondary)]">Monitor real-time status of connected payment gateways, SMS gateways, WhatsApp Cloud API, and MikroTik routers</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {integrations.map(item => (
                                    <div key={item.id} className="bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-bold text-sm text-[var(--text-primary)]">{item.name}</h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${item.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">{item.details}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {item.id === 'mpesa' && (
                                                <button
                                                    onClick={handleConfigureMpesa}
                                                    className="bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-400 px-4 py-2 rounded-xl text-xs font-bold border border-amber-500/20 transition-all flex items-center gap-1.5"
                                                >
                                                    <Settings size={14} />
                                                    <span>Configure</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleTestIntegration(item.id)}
                                                disabled={testingIntegrationId === item.id}
                                                className="bg-sky-500/10 hover:bg-sky-500 hover:text-white text-sky-400 px-4 py-2 rounded-xl text-xs font-bold border border-sky-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {testingIntegrationId === item.id ? <RefreshCw size={14} className="animate-spin" /> : <Plug size={14} />}
                                                <span>Test</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 9: ACTIVITY LOG */}
                    {activeTab === 'activity' && (
                        <div className="space-y-8">
                            <div className="border-b border-[var(--border-subtle)] pb-5">
                                <h2 className="text-xl font-black text-[var(--text-primary)]">Tenant Activity & Audit History</h2>
                                <p className="text-xs text-[var(--text-secondary)]">Immutable security audit record of profile changes, password updates, withdrawal requests, and login events</p>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] uppercase font-black tracking-wider bg-[var(--bg-surface)]">
                                            <th className="p-4">Timestamp</th>
                                            <th className="p-4">Action</th>
                                            <th className="p-4">Details</th>
                                            <th className="p-4">IP Address</th>
                                            <th className="p-4">Device / Agent</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-subtle)] font-medium text-[var(--text-primary)]">
                                        {activityLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-[var(--text-secondary)]">No audit activity recorded yet.</td>
                                            </tr>
                                        ) : (
                                            activityLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-[var(--bg-surface)] transition-colors">
                                                    <td className="p-4 text-[var(--text-secondary)]">{new Date(log.date).toLocaleString()}</td>
                                                    <td className="p-4 font-mono font-bold text-sky-400">{log.action}</td>
                                                    <td className="p-4">{log.details}</td>
                                                    <td className="p-4 font-mono text-[11px]">{log.ipAddress}</td>
                                                    <td className="p-4 text-[var(--text-muted)] text-[11px] truncate max-w-[200px]">{log.browser}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: WITHDRAWAL REQUEST */}
            {showWithdrawModal && balances && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-[var(--text-primary)]">Request Revenue Withdrawal</h3>
                            <button onClick={() => setShowWithdrawModal(false)} className="text-[var(--text-muted)] hover:text-white"><X size={20} /></button>
                        </div>

                        <div className="bg-[var(--bg-surface-elevated)] p-4 rounded-2xl border border-[var(--border-subtle)] space-y-1 text-xs">
                            <div className="flex justify-between font-bold">
                                <span className="text-[var(--text-secondary)]">Available Balance:</span>
                                <span className="text-emerald-400 font-black">{balances.availableBalanceFormatted}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span className="text-[var(--text-secondary)]">Minimum Withdrawal:</span>
                                <span className="text-[var(--text-primary)] font-mono">{balances.minimumWithdrawalFormatted}</span>
                            </div>
                        </div>

                        <form onSubmit={handleRequestWithdrawalSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Withdrawal Method</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setWithdrawMethod('MPESA')}
                                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${withdrawMethod === 'MPESA' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]'}`}
                                    >
                                        M-Pesa
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWithdrawMethod('BANK')}
                                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${withdrawMethod === 'BANK' ? 'bg-sky-500 text-white border-sky-400' : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]'}`}
                                    >
                                        Bank Account
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">Withdrawal Amount (KES)</label>
                                <input
                                    type="number"
                                    required
                                    min="100"
                                    step="10"
                                    value={withdrawAmount}
                                    onChange={e => setWithdrawAmount(e.target.value)}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-sky-500"
                                    placeholder="e.g. 500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submittingWithdraw}
                                className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 text-xs disabled:opacity-50"
                            >
                                {submittingWithdraw ? 'Processing Withdrawal...' : 'Confirm & Request Withdrawal'}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* MODAL: RECEIPT VIEW */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-[2.5rem] max-w-lg w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-4">
                            <div>
                                <h3 className="text-xl font-black text-[var(--text-primary)]">Withdrawal Receipt</h3>
                                <p className="text-xs text-sky-400 font-mono font-bold">{selectedReceipt.receiptNumber}</p>
                            </div>
                            <button onClick={() => setSelectedReceipt(null)} className="text-[var(--text-muted)] hover:text-white"><X size={20} /></button>
                        </div>

                        <div className="bg-[var(--bg-surface-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-3 text-xs">
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span className="text-[var(--text-secondary)] font-bold">Tenant Name:</span>
                                <span className="font-bold text-[var(--text-primary)]">{selectedReceipt.tenantName}</span>
                            </div>
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span className="text-[var(--text-secondary)] font-bold">Amount Transferred:</span>
                                <span className="font-black text-emerald-400 text-sm">{selectedReceipt.amountFormatted}</span>
                            </div>
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span className="text-[var(--text-secondary)] font-bold">Channel Method:</span>
                                <span className="font-bold text-[var(--text-primary)]">{selectedReceipt.method}</span>
                            </div>
                            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                                <span className="text-[var(--text-secondary)] font-bold">Status:</span>
                                <span className="font-black text-amber-400 uppercase">{selectedReceipt.status}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--text-secondary)] font-bold">Digital Signature:</span>
                                <span className="font-mono text-[10px] text-sky-400">{selectedReceipt.systemSignature}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => window.print()}
                                className="bg-sky-500 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20"
                            >
                                <Download size={14} /> Print Receipt
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* MODAL: MPESA CONFIGURATION */}
            {showMpesaModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6 overflow-y-auto">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-[2.5rem] max-w-2xl w-full shadow-2xl space-y-6 my-8">
                        <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-4">
                            <div>
                                <h3 className="text-xl font-black text-[var(--text-primary)]">
                                    {(mpesaConfig as any).isSuperAdmin ? 'Super Admin / Platform M-Pesa Integration' : 'M-Pesa Integration Settings'}
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    {(mpesaConfig as any).isSuperAdmin
                                        ? 'Configure platform-wide Safaricom Daraja API credentials linked to all tenant monthly subscriptions and Super Admin Wi-Fi hotspot payments'
                                        : 'Securely configure your independent Safaricom Daraja API credentials per tenant'}
                                </p>
                            </div>
                            <button onClick={() => setShowMpesaModal(false)} className="text-[var(--text-muted)] hover:text-white"><X size={20} /></button>
                        </div>

                        {mpesaModalMsg && (
                            <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
                                mpesaModalMsg.type === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                                {mpesaModalMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                <span>{mpesaModalMsg.text}</span>
                            </div>
                        )}

                        <form onSubmit={handleSaveMpesaConfig} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Environment</label>
                                    <select
                                        value={mpesaConfig.mpesaEnvironment}
                                        onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaEnvironment: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                    >
                                        <option value="sandbox">Sandbox (Development / Testing)</option>
                                        <option value="production">Production (Live Payments)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Business Short Code (Head Office / Shortcode)</label>
                                    <input
                                        type="text"
                                        required
                                        value={mpesaConfig.mpesaShortcode}
                                        onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaShortcode: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                        placeholder="e.g. 5522478 or 174379"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Till Number / Buy Goods Store (Party B)</label>
                                    <input
                                        type="text"
                                        value={mpesaConfig.mpesaTillNumber}
                                        onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaTillNumber: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                        placeholder="e.g. 5522478 (Leave blank if using Shortcode)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Paybill Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={mpesaConfig.mpesaPaybillNumber}
                                        onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaPaybillNumber: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                        placeholder="e.g. 5522478 (Only if using PayBill)"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Consumer Key</label>
                                    <input
                                        type="text"
                                        required
                                        value={mpesaConfig.mpesaConsumerKeyMasked}
                                        onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaConsumerKeyMasked: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                        placeholder="Enter Consumer Key"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Consumer Secret</label>
                                    <input
                                        type="text"
                                        required
                                        value={mpesaConfig.mpesaConsumerSecretMasked}
                                        onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaConsumerSecretMasked: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                        placeholder="Enter Consumer Secret"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Passkey (Lipa na M-Pesa Online Passkey)</label>
                                    <input
                                        type="text"
                                        required
                                        value={mpesaConfig.mpesaPasskeyMasked}
                                        onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaPasskeyMasked: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                        placeholder="Enter Online Passkey"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-[var(--border-subtle)] pt-4 space-y-4">
                                <h4 className="text-xs font-bold text-sky-400">Initiator & B2C Configurations (Optional)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Initiator Username</label>
                                        <input
                                            type="text"
                                            value={mpesaConfig.mpesaInitiatorName}
                                            onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaInitiatorName: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                            placeholder="e.g. api_operator"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">Initiator Password</label>
                                        <input
                                            type="text"
                                            value={mpesaConfig.mpesaInitiatorPasswordMasked}
                                            onChange={e => setMpesaConfig({ ...mpesaConfig, mpesaInitiatorPasswordMasked: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-3.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-sky-500 transition-colors"
                                            placeholder="Enter Initiator Password"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[var(--bg-surface-elevated)] p-4 rounded-2xl border border-[var(--border-subtle)] space-y-2">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-sky-400">Your Unique Webhook URL</label>
                                <p className="text-[10px] text-[var(--text-secondary)]">Register this URL in your Safaricom Daraja App settings to receive instant payment notifications automatically.</p>
                                <div className="flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-2.5 mt-1.5">
                                    <span className="font-mono text-xs text-[var(--text-primary)] truncate flex-1 select-all">{mpesaConfig.webhookUrl}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(mpesaConfig.webhookUrl);
                                            setCopiedWebhook(true);
                                            setTimeout(() => setCopiedWebhook(false), 2000);
                                        }}
                                        className="text-sky-400 hover:text-white p-1.5 rounded-lg hover:bg-sky-500/10 transition-all"
                                        title="Copy to clipboard"
                                    >
                                        {copiedWebhook ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-between border-t border-[var(--border-subtle)] pt-4">
                                <button
                                    type="button"
                                    onClick={handleTestMpesaCredentials}
                                    disabled={testingMpesa || savingMpesa}
                                    className="bg-sky-500/10 hover:bg-sky-500 hover:text-white text-sky-400 border border-sky-500/20 px-5 py-3.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {testingMpesa ? <RefreshCw size={14} className="animate-spin" /> : <Plug size={14} />}
                                    <span>Test Daraja Connection</span>
                                </button>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowMpesaModal(false)}
                                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-5 py-3.5 rounded-2xl text-xs font-bold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingMpesa || testingMpesa}
                                        className="bg-amber-500 hover:bg-amber-400 text-white font-black px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-amber-500/20 text-xs flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {savingMpesa ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                        <span>Save Encryption Keys</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
