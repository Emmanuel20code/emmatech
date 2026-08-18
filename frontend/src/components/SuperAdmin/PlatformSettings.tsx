import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Shield, Globe, RefreshCw, CheckCircle2, AlertTriangle, User, Lock, Eye, EyeOff, GitBranch, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import axios from 'axios';
import MasterDarajaGatewayManager from './MasterDarajaGatewayManager';

interface PlatformSetting {
    key: string;
    value: string;
}

interface SettingsMap {
    [key: string]: string;
}

interface MessageState {
    type: 'success' | 'error' | 'info' | '';
    text: string;
}

interface TabConfig {
    id: string;
    label: string;
    icon: LucideIcon;
}

const PlatformSettings = () => {
    const [activeTab, setActiveTab] = useState('system');
    const [settings, setSettings] = useState<SettingsMap>({});
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<MessageState>({ type: '', text: '' });

    const [superAdminEmail, setSuperAdminEmail] = useState('');
    const [superAdminPassword, setSuperAdminPassword] = useState('');
    const [showMasterPassword, setShowMasterPassword] = useState(false);
    const [accountLoading, setAccountLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchAccount();
    }, []);

    const fetchAccount = async () => {
        try {
            const res = await axios.get('/api/v1/superadmin/account');
            if (res.data.email) {
                setSuperAdminEmail(res.data.email);
            }
        } catch (e) {
            console.error('Failed to fetch superadmin account', e);
        }
    };

    const handleUpdateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setAccountLoading(true);
        try {
            const payload: any = { email: superAdminEmail };
            if (superAdminPassword) {
                if (superAdminPassword.length < 6) {
                    setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
                    setAccountLoading(false);
                    return;
                }
                payload.password = superAdminPassword;
            }
            await axios.put('/api/v1/superadmin/account', payload);
            setMessage({ type: 'success', text: 'Permanent Super Admin account updated successfully!' });
            setSuperAdminPassword('');
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update account' });
        } finally {
            setAccountLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }
            const res = await axios.get<PlatformSetting[]>('/api/v1/superadmin/settings');
            const settingsMap = res.data.reduce((acc: SettingsMap, curr: PlatformSetting) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
            setSettings(settingsMap);
        } catch (error: unknown) {
            console.error('Failed to fetch settings', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (key: string, value: string) => {
        try {
            await axios.put(`/api/v1/superadmin/settings/${key}`, { value });
            setSettings(prev => ({ ...prev, [key]: value }));
            setMessage({ type: 'success', text: `Setting ${key} updated successfully` });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error: unknown) {
            console.error(`Failed to update ${key}`, error);
            setMessage({ type: 'error', text: `Failed to update ${key}` });
        }
    };

    const handleSaveTab = async (keys: string[]) => {
        try {
            const payload: Record<string, string> = {};
            for (const key of keys) {
                payload[key] = settings[key] !== undefined ? settings[key] : '';
            }
            await axios.put('/api/v1/superadmin/settings', { settings: payload });
            setMessage({ type: 'success', text: 'Current settings saved successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (error: unknown) {
            console.error('Failed to save settings tab', error);
            let errorMsg = 'Failed to save settings';
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                errorMsg = error.response.data.error;
            }
            setMessage({ type: 'error', text: errorMsg });
        }
    };

    const testSMTP = async () => {
        try {
            setMessage({ type: 'info', text: 'Sending test email...' });
            await axios.post('/api/v1/superadmin/test-email');
            setMessage({ type: 'success', text: 'Test email sent successfully!' });
        } catch (error: unknown) {
            let errorMsg = 'SMTP Test failed';
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                errorMsg = error.response.data.error;
            }
            setMessage({ type: 'error', text: errorMsg });
        }
    };

    const [pushLoading, setPushLoading] = useState(false);
    const [pushOutput, setPushOutput] = useState('');
    const [pushStep, setPushStep] = useState('');
    const [pushStepIndex, setPushStepIndex] = useState(0);
    const [pushHistory, setPushHistory] = useState<Array<{ timestamp: string; status: 'success' | 'error'; message: string; output: string }>>([]);

    const handlePushGitHub = async () => {
        setPushLoading(true);
        setPushOutput('');
        setPushStepIndex(1);
        setPushStep('Step 1/4: Saving & verifying GitHub configuration settings...');
        try {
            await handleSaveTab(['GITHUB_REPO', 'GITHUB_BRANCH', 'GITHUB_TOKEN']);
            
            setPushStepIndex(2);
            setPushStep('Step 2/4: Configuring git remote repository & branch checkout...');
            await new Promise(r => setTimeout(r, 500));

            setPushStepIndex(3);
            setPushStep('Step 3/4: Staging workspace files (git add .)...');
            await new Promise(r => setTimeout(r, 500));

            setPushStepIndex(4);
            setPushStep('Step 4/4: Committing snapshot & pushing to GitHub remote (git push --force)...');

            const res = await axios.post('/api/v1/superadmin/github/push');
            const successMsg = res.data.message || 'Successfully pushed changes to GitHub!';
            const outputData = res.data.output || 'Push completed successfully.';
            
            setMessage({ type: 'success', text: successMsg });
            setPushOutput(outputData);
            setPushStep('GitHub push completed successfully!');
            setPushStepIndex(5);

            setPushHistory(prev => [{
                timestamp: new Date().toLocaleTimeString(),
                status: 'success',
                message: successMsg,
                output: outputData
            }, ...prev]);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to push changes to GitHub';
            const errorOutput = err.response?.data?.output || err.message || 'Unknown git error';
            setMessage({ type: 'error', text: errorMsg });
            setPushOutput(errorOutput);
            setPushStep('GitHub push failed. See diagnostic error details below.');
            setPushStepIndex(0);

            setPushHistory(prev => [{
                timestamp: new Date().toLocaleTimeString(),
                status: 'error',
                message: errorMsg,
                output: errorOutput
            }, ...prev]);
        } finally {
            setPushLoading(false);
        }
    };

    if (loading) return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
            <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Loading Configurations...</p>
        </div>
    );

    const tabs: TabConfig[] = [
        { id: 'mpesa', label: 'Master Daraja M-Pesa', icon: Zap },
        { id: 'system', label: 'System', icon: Globe },
        { id: 'email', label: 'Email (SMTP)', icon: Mail },
        { id: 'sms', label: 'SMS & WhatsApp', icon: MessageSquare },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'account', label: 'Super Admin Account', icon: User },
        { id: 'github', label: 'GitHub & Push Sync', icon: GitBranch },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {message.text && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                    message.type === 'error' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                        'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    {message.text}
                </div>
            )}

            <div className="flex flex-wrap gap-2 p-2 bg-[var(--bg-surface-elevated)] rounded-2xl border border-[var(--border-subtle)] w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id
                            ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[2.5rem] p-10 shadow-xl min-h-[500px]">
                {activeTab === 'mpesa' && <MasterDarajaGatewayManager />}
                {activeTab === 'system' && (
                    <div className="space-y-8 max-w-2xl">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] mb-6">General Platform Identity</h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Platform Name</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={settings.PLATFORM_NAME !== undefined ? settings.PLATFORM_NAME : 'Jevish Cloud'}
                                            onChange={(e) => setSettings({ ...settings, PLATFORM_NAME: e.target.value })}
                                            className="flex-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Primary Domain</label>
                                    <input
                                        value={settings.PRIMARY_DOMAIN !== undefined ? settings.PRIMARY_DOMAIN : 'jevish.site'}
                                        onChange={(e) => setSettings({ ...settings, PRIMARY_DOMAIN: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-[var(--text-muted)] uppercase">System Currency</label>
                                        <input
                                            value={settings.SYSTEM_CURRENCY !== undefined ? settings.SYSTEM_CURRENCY : 'KES'}
                                            onChange={(e) => setSettings({ ...settings, SYSTEM_CURRENCY: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-[var(--text-muted)] uppercase">Timezone</label>
                                        <select
                                            value={settings.SYSTEM_TIMEZONE !== undefined ? settings.SYSTEM_TIMEZONE : 'Africa/Nairobi'}
                                            onChange={(e) => setSettings({ ...settings, SYSTEM_TIMEZONE: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        >
                                            <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                                            <option value="UTC">UTC</option>
                                            <option value="Europe/London">Europe/London</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveTab(['PLATFORM_NAME', 'PRIMARY_DOMAIN', 'SYSTEM_CURRENCY', 'SYSTEM_TIMEZONE'])}
                                        className="px-6 py-3 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all text-xs shadow-lg shadow-sky-500/25"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'email' && (
                    <div className="space-y-8 max-w-2xl">
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-[var(--text-primary)]">SMTP Relay Configuration</h3>
                                <button
                                    onClick={testSMTP}
                                    className="px-4 py-2 bg-sky-500/10 text-sky-500 rounded-xl font-bold text-xs hover:bg-sky-500 hover:text-white transition-all"
                                >
                                    Send Test Email
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-xs font-black text-[var(--text-muted)] uppercase">SMTP Host</label>
                                        <input
                                            value={settings.SMTP_HOST !== undefined ? settings.SMTP_HOST : 'smtp.gmail.com'}
                                            onChange={(e) => setSettings({ ...settings, SMTP_HOST: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-[var(--text-muted)] uppercase">Port</label>
                                        <input
                                            value={settings.SMTP_PORT !== undefined ? settings.SMTP_PORT : '587'}
                                            onChange={(e) => setSettings({ ...settings, SMTP_PORT: e.target.value })}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Username / Email</label>
                                    <input
                                        value={settings.SMTP_USER !== undefined ? settings.SMTP_USER : ''}
                                        onChange={(e) => setSettings({ ...settings, SMTP_USER: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        placeholder="noreply@jevish.site"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">App Password</label>
                                    <input
                                        type="password"
                                        value={settings.SMTP_PASS !== undefined ? settings.SMTP_PASS : ''}
                                        onChange={(e) => setSettings({ ...settings, SMTP_PASS: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        placeholder="••••••••••••••••"
                                    />
                                </div>
                                <div className="pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveTab(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'])}
                                        className="px-6 py-3 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all text-xs shadow-lg shadow-sky-500/25"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'sms' && (
                    <div className="space-y-8 max-w-2xl">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] mb-6">Communication Gateways</h3>
                            <div className="space-y-6">
                                <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/20 space-y-4">
                                    <div className="flex items-center gap-3 text-amber-600 font-black text-sm">
                                        <MessageSquare size={18} />
                                        Africa's Talking (Primary)
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-amber-600/60 uppercase">API Username</label>
                                            <input
                                                value={settings.SMS_USERNAME !== undefined ? settings.SMS_USERNAME : ''}
                                                onChange={(e) => setSettings({ ...settings, SMS_USERNAME: e.target.value })}
                                                className="w-full bg-white/50 border border-amber-500/20 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition-all font-bold text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-amber-600/60 uppercase">Sender ID</label>
                                            <input
                                                value={settings.SMS_SENDER_ID !== undefined ? settings.SMS_SENDER_ID : ''}
                                                onChange={(e) => setSettings({ ...settings, SMS_SENDER_ID: e.target.value })}
                                                className="w-full bg-white/50 border border-amber-500/20 rounded-xl px-4 py-2 outline-none focus:border-amber-500 transition-all font-bold text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/20 space-y-4">
                                    <div className="flex items-center gap-3 text-emerald-600 font-black text-sm">
                                        <MessageSquare size={18} />
                                        Twilio WhatsApp (Business)
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-emerald-600/60 uppercase">Account SID</label>
                                            <input
                                                value={settings.TWILIO_SID !== undefined ? settings.TWILIO_SID : ''}
                                                onChange={(e) => setSettings({ ...settings, TWILIO_SID: e.target.value })}
                                                className="w-full bg-white/50 border border-emerald-500/20 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 transition-all font-bold text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-emerald-600/60 uppercase">WhastApp From Number</label>
                                            <input
                                                value={settings.TWILIO_WHATSAPP_FROM !== undefined ? settings.TWILIO_WHATSAPP_FROM : ''}
                                                onChange={(e) => setSettings({ ...settings, TWILIO_WHATSAPP_FROM: e.target.value })}
                                                className="w-full bg-white/50 border border-emerald-500/20 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 transition-all font-bold text-sm"
                                                placeholder="whatsapp:+14155238886"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveTab(['SMS_USERNAME', 'SMS_SENDER_ID', 'TWILIO_SID', 'TWILIO_WHATSAPP_FROM'])}
                                        className="px-6 py-3 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all text-xs shadow-lg shadow-sky-500/25"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-8 max-w-2xl">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] mb-6">System Hardening & Access</h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Minimum Password Length</label>
                                    <input
                                        type="number"
                                        value={settings.SECURITY_MIN_PASSWORD !== undefined ? settings.SECURITY_MIN_PASSWORD : '8'}
                                        onChange={(e) => setSettings({ ...settings, SECURITY_MIN_PASSWORD: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Session Timeout (Minutes)</label>
                                    <input
                                        type="number"
                                        value={settings.SECURITY_SESSION_TIMEOUT !== undefined ? settings.SECURITY_SESSION_TIMEOUT : '60'}
                                        onChange={(e) => setSettings({ ...settings, SECURITY_SESSION_TIMEOUT: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                    />
                                </div>
                                <div className="pt-6 flex items-center justify-between p-6 bg-sky-500/5 rounded-3xl border border-sky-500/20">
                                    <div>
                                        <p className="font-black text-sky-600">Force 2FA for Super Admins</p>
                                        <p className="text-xs font-bold text-sky-600/60">Require OTP from email on every login</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, FORCE_2FA: settings.FORCE_2FA === 'true' ? 'false' : 'true' })}
                                        className={`w-12 h-6 rounded-full transition-all relative ${settings.FORCE_2FA === 'true' ? 'bg-sky-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.FORCE_2FA === 'true' ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                                <div className="pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveTab(['SECURITY_MIN_PASSWORD', 'SECURITY_SESSION_TIMEOUT', 'FORCE_2FA'])}
                                        className="px-6 py-3 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all text-xs shadow-lg shadow-sky-500/25"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="space-y-8 max-w-2xl">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Permanent Super Admin Account</h3>
                            <p className="text-xs text-[var(--text-secondary)] mb-6 font-semibold">
                                This is the single permanent Super Admin account for platform control. You can update your login email and master password here, or recover via email if forgotten.
                            </p>
                            <form onSubmit={handleUpdateAccount} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Super Admin Email</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500">
                                            <Mail size={16} />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={superAdminEmail}
                                            onChange={(e) => setSuperAdminEmail(e.target.value)}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl py-3 pl-12 pr-4 outline-none focus:border-sky-500 transition-all font-bold text-sm"
                                        />
                                    </div>
                                    <p className="text-[10px] text-[var(--text-muted)] italic">Only one Super Admin email is permitted across the SaaS platform.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">New Master Password (Leave blank to keep current)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500">
                                            <Lock size={16} />
                                        </div>
                                        <input
                                            type={showMasterPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={superAdminPassword}
                                            onChange={(e) => setSuperAdminPassword(e.target.value)}
                                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl py-3 pl-12 pr-12 outline-none focus:border-sky-500 transition-all font-bold text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowMasterPassword(!showMasterPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--text-primary)] transition-colors"
                                            title={showMasterPassword ? "Hide password" : "Show password"}
                                        >
                                            {showMasterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={accountLoading}
                                    className="px-6 py-3 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all text-xs shadow-lg shadow-sky-500/20 disabled:opacity-50"
                                >
                                    {accountLoading ? 'Updating Account...' : 'Save Permanent Account Changes'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'github' && (
                    <div className="space-y-8 max-w-2xl">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">GitHub Repository & Push Sync</h3>
                            <p className="text-xs text-[var(--text-secondary)] mb-6 font-semibold">
                                Connect your GitHub repository to push any application changes directly from the Super Admin panel. Requires a GitHub Personal Access Token (PAT) with <code className="text-sky-500 font-bold">repo</code> scope permissions.
                            </p>
                            <div className="mb-6 p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl text-xs space-y-2 text-[var(--text-primary)]">
                                <div className="font-bold text-sky-600 dark:text-sky-400">How to get a GitHub Personal Access Token (PAT):</div>
                                <ol className="list-decimal list-inside space-y-1 text-[var(--text-secondary)]">
                                    <li>Go to GitHub Settings &gt; Developer settings &gt; Personal access tokens (Tokens (classic) or Fine-grained tokens).</li>
                                    <li>Create a new token with <code className="bg-black/10 px-1 py-0.5 rounded font-mono">repo</code> permissions (full control of private repositories).</li>
                                    <li>Paste the token above, save settings, and click "Push Changes to GitHub".</li>
                                </ol>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">GitHub Repository (owner/repo)</label>
                                    <input
                                        value={settings.GITHUB_REPO !== undefined ? settings.GITHUB_REPO : ''}
                                        onChange={(e) => setSettings({ ...settings, GITHUB_REPO: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        placeholder="e.g. username/my-app"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Branch Name</label>
                                    <input
                                        value={settings.GITHUB_BRANCH !== undefined ? settings.GITHUB_BRANCH : 'main'}
                                        onChange={(e) => setSettings({ ...settings, GITHUB_BRANCH: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        placeholder="main"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-[var(--text-muted)] uppercase">Personal Access Token (PAT)</label>
                                    <input
                                        type="password"
                                        value={settings.GITHUB_TOKEN !== undefined ? settings.GITHUB_TOKEN : ''}
                                        onChange={(e) => setSettings({ ...settings, GITHUB_TOKEN: e.target.value })}
                                        className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold"
                                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                    />
                                    <p className="text-[10px] text-[var(--text-muted)] italic">Token is securely stored in platform settings database and used solely for git push operations.</p>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveTab(['GITHUB_REPO', 'GITHUB_BRANCH', 'GITHUB_TOKEN'])}
                                        className="px-6 py-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-black rounded-xl hover:bg-[var(--bg-surface)] transition-all text-xs"
                                    >
                                        Save Settings
                                    </button>
                                    <button
                                        type="button"
                                        disabled={pushLoading}
                                        onClick={handlePushGitHub}
                                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition-all text-xs shadow-lg shadow-emerald-600/25 disabled:opacity-50"
                                    >
                                        {pushLoading && <RefreshCw size={14} className="animate-spin" />}
                                        {pushLoading ? 'Executing Git Sync...' : 'Push Changes to GitHub'}
                                    </button>
                                </div>

                                {pushLoading && (
                                    <div className="mt-6 p-5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
                                                <div>
                                                    <div className="text-xs font-black text-[var(--text-primary)]">GitHub Sync Progress</div>
                                                    <div className="text-[11px] text-[var(--text-secondary)]">{pushStep}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs font-mono font-bold text-emerald-500">Step {pushStepIndex}/4</div>
                                        </div>
                                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                                                style={{ width: `${(pushStepIndex / 4) * 100}%` }}
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-[10px] font-bold text-[var(--text-muted)] text-center">
                                            <div className={pushStepIndex >= 1 ? 'text-emerald-500 font-black' : ''}>1. Save Settings</div>
                                            <div className={pushStepIndex >= 2 ? 'text-emerald-500 font-black' : ''}>2. Remote Config</div>
                                            <div className={pushStepIndex >= 3 ? 'text-emerald-500 font-black' : ''}>3. Stage Files</div>
                                            <div className={pushStepIndex >= 4 ? 'text-emerald-500 font-black' : ''}>4. Push Remote</div>
                                        </div>
                                    </div>
                                )}

                                {pushOutput && (
                                    <div className="mt-6 space-y-4">
                                        <div className={`p-4 rounded-2xl border font-mono text-xs overflow-x-auto whitespace-pre-wrap ${
                                            message.type === 'error' 
                                                ? 'bg-rose-950/40 text-rose-300 border-rose-500/30' 
                                                : 'bg-slate-950 text-emerald-400 border-slate-800'
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[10px] uppercase font-black tracking-wider flex items-center gap-2">
                                                    {message.type === 'error' ? <AlertTriangle size={14} className="text-rose-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
                                                    {message.type === 'error' ? 'GitHub Diagnostic Error Log (500 / Git Failure):' : 'Git Push Execution Output:'}
                                                </div>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(pushOutput)}
                                                    className="text-[10px] px-2 py-1 bg-white/10 hover:bg-white/20 rounded font-sans font-bold transition-all"
                                                >
                                                    Copy Output
                                                </button>
                                            </div>
                                            {pushOutput}
                                        </div>

                                        {message.type === 'error' && (
                                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-2 text-[var(--text-primary)]">
                                                <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                                    <AlertTriangle size={14} /> Troubleshooting Guide:
                                                </div>
                                                <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
                                                    <li>Verify your Personal Access Token (PAT) is active and has not expired.</li>
                                                    <li>Ensure the token has the <code className="bg-black/10 px-1 py-0.5 rounded font-mono">repo</code> scope enabled (full control of private/public repositories).</li>
                                                    <li>Confirm the repository format is correct (<code className="bg-black/10 px-1 py-0.5 rounded font-mono">owner/repo-name</code>).</li>
                                                    <li>Ensure the branch name matches your target branch (e.g. <code className="bg-black/10 px-1 py-0.5 rounded font-mono">main</code> or <code className="bg-black/10 px-1 py-0.5 rounded font-mono">master</code>).</li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {pushHistory.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] space-y-4">
                                        <h4 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">GitHub Push Diagnostic Audit History</h4>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {pushHistory.map((item, idx) => (
                                                <div key={idx} className="p-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-3">
                                                        {item.status === 'success' ? (
                                                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                        ) : (
                                                            <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-[var(--text-primary)]">{item.message}</div>
                                                            <div className="text-[10px] text-[var(--text-muted)] font-mono">{item.timestamp}</div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                        item.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center opacity-60">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    All changes are recorded in the system audit logs.
                </p>
            </div>
        </div>
    );
};

export default PlatformSettings;
