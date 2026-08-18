import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle, ExternalLink, RefreshCw, CreditCard, Play, Copy, ArrowRight } from 'lucide-react';

interface PayHeroConfigState {
    accountId: string;
    basicAuthToken: string;
    environment: 'live' | 'sandbox';
    callbackUrl: string;
    isEnabled: boolean;
    directPayoutEnabled: boolean;
}

const PayHeroGatewayManager: React.FC = () => {
    const [config, setConfig] = useState<PayHeroConfigState>({
        accountId: '',
        basicAuthToken: '',
        environment: 'sandbox',
        callbackUrl: '',
        isEnabled: false,
        directPayoutEnabled: true
    });
    
    const [stats, setStats] = useState({
        totalCount: 0,
        successfulCount: 0,
        totalVolume: 0,
        successRate: 0
    });
    const [recentTx, setRecentTx] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const [copiedUrl, setCopiedUrl] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/v1/payhero/superadmin/config');
            if (res.data && res.data.config) {
                setConfig({
                    accountId: res.data.config.rawAccountId || res.data.config.accountId || '',
                    basicAuthToken: res.data.config.rawBasicAuthToken || res.data.config.basicAuthToken || '',
                    environment: res.data.config.environment || 'sandbox',
                    callbackUrl: res.data.config.callbackUrl || `${window.location.origin}/api/v1/payments/payhero-callback`,
                    isEnabled: res.data.config.isEnabled !== undefined ? res.data.config.isEnabled : false,
                    directPayoutEnabled: res.data.config.directPayoutEnabled !== undefined ? res.data.config.directPayoutEnabled : true
                });
            }
            if (res.data && res.data.stats) setStats(res.data.stats);
            if (res.data && res.data.recentTransactions) setRecentTx(res.data.recentTransactions);
        } catch (err) {
            console.error('Failed to fetch PayHero gateway data', err);
            setMessage({ type: 'error', text: 'Could not load PayHero configuration.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setMessage(null);
            const res = await axios.put('/api/v1/payhero/superadmin/config', config);
            setMessage({ type: 'success', text: res.data.message || 'PayHero Master Gateway settings updated!' });
            
            // Refresh to get potentially masked values
            await fetchConfig();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        try {
            setTesting(true);
            setMessage(null);
            const res = await axios.post('/api/v1/payhero/superadmin/test-connection', {
                accountId: config.accountId,
                basicAuthToken: config.basicAuthToken
            });
            
            setMessage({ 
                type: res.data.success ? 'success' : 'error', 
                text: res.data.message || (res.data.success ? 'Connected successfully to PayHero!' : 'Connection test failed')
            });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Test connection failed' });
        } finally {
            setTesting(false);
        }
    };

    const copyCallback = () => {
        const url = config.callbackUrl || `${window.location.origin}/api/v1/payments/payhero-callback`;
        navigator.clipboard.writeText(url);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold text-slate-500">Loading PayHero Payment Gateway Control...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Stats Container */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Brand Card */}
                <div className="col-span-1 xl:col-span-2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
                    <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-sky-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                    <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xl border border-white/10">
                                    <CreditCard className="text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">PayHero Gateway Engine</h2>
                                    <p className="text-sm font-bold text-sky-200/70">Master M-Pesa STK Push Controller</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
                                Control the central payment gateway. When enabled, all tenant captive portals will securely route M-Pesa STK push payments through this master configuration to individual tenant accounts.
                            </p>
                        </div>
                        
                        <div className="mt-8 flex gap-3">
                            <a 
                                href="https://payhero.co.ke" 
                                target="_blank" 
                                rel="noreferrer"
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl backdrop-blur-md transition flex items-center gap-2 border border-white/5"
                            >
                                PayHero Dashboard <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Gateway Stats */}
                <div className="col-span-1 grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Volume</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            <span className="text-sm text-slate-400 mr-1">KES</span>
                            {stats.totalVolume.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Success Rate</div>
                        <div className="text-2xl font-black text-emerald-500">
                            {stats.successRate}%
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Successful TX</div>
                        <div className="text-2xl font-black text-sky-500">
                            {stats.successfulCount}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Total TX</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {stats.totalCount}
                        </div>
                    </div>
                </div>
            </div>

            {/* Alert Message */}
            {message && (
                <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' 
                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <p className="text-sm font-bold">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">PayHero Master API Credentials</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Enter your PayHero API key, secret, and default channel ID</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                type="button"
                                onClick={handleTestConnection}
                                disabled={testing || !config.accountId}
                                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                            >
                                <Play className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                                {testing ? 'Testing...' : 'Test Connection'}
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* API Key */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                                    PayHero Account ID <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={config.accountId}
                                        onChange={(e) => setConfig({ ...config, accountId: e.target.value })}
                                        placeholder="e.g. jdoe-123"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                                    />
                                </div>
                            </div>
                            
                            {/* API Secret */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                                    PayHero Basic Auth Token
                                </label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        value={config.basicAuthToken}
                                        onChange={(e) => setConfig({ ...config, basicAuthToken: e.target.value })}
                                        placeholder="Enter token (leave blank to keep unchanged)"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                                    />
                                </div>
                            </div>

                            {/* Environment */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                                    Gateway Environment
                                </label>
                                <select 
                                    value={config.environment}
                                    onChange={(e) => setConfig({ ...config, environment: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                                >
                                    <option value="sandbox">Sandbox (Development / Test)</option>
                                    <option value="live">Live (Production PayHero Gateway)</option>
                                </select>
                            </div>
                        </div>

                        {/* Callback URL */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                                    Master Callback URL
                                </label>
                                <button 
                                    type="button" 
                                    onClick={copyCallback}
                                    className="text-[10px] font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-50 dark:bg-sky-500/10 px-2 py-1 rounded"
                                >
                                    <Copy className="w-3 h-3" /> 
                                    {copiedUrl ? 'Copied' : 'Copy URL'}
                                </button>
                            </div>
                            <input 
                                type="text" 
                                value={config.callbackUrl}
                                onChange={(e) => setConfig({ ...config, callbackUrl: e.target.value })}
                                placeholder="https://your-domain.com/api/v1/payments/payhero-callback"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-600 dark:text-slate-300 focus:outline-none focus:border-sky-500"
                            />
                            <p className="text-[11px] text-slate-400">
                                Paste this exact callback URL into your PayHero Account Settings under Webhook / Callback settings.
                            </p>
                        </div>

                        {/* Toggles */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={config.isEnabled}
                                    onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                                    className="mt-1 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                                />
                                <div>
                                    <div className="text-xs font-black text-slate-900 dark:text-white">Enable PayHero Gateway</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">Activate PayHero as the primary M-Pesa STK push gateway for all captive portals.</div>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={config.directPayoutEnabled}
                                    onChange={(e) => setConfig({ ...config, directPayoutEnabled: e.target.checked })}
                                    className="mt-1 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                                />
                                <div>
                                    <div className="text-xs font-black text-slate-900 dark:text-white">Direct Tenant Account Routing</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">Customer payments automatically disburse directly to tenant Tills, Paybills, or Bank accounts.</div>
                                </div>
                            </label>
                        </div>

                        <div className="pt-2">
                            <button 
                                type="submit" 
                                disabled={saving}
                                className="w-full md:w-auto px-8 py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-2xl shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" /> 
                                {saving ? 'Saving Master Settings...' : 'Save PayHero Master Gateway'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Tenant Experience Architecture Card */}
                <div className="col-span-1 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit sticky top-6">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6 uppercase tracking-wider">How Direct Routing Works</h3>
                    
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 shrink-0 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-black text-slate-500">1</div>
                            <div>
                                <strong className="text-slate-900 dark:text-white block text-sm">Customer Connects</strong>
                                <p className="text-slate-500 text-[11px] mt-1">A hotspot user selects a package and enters their M-Pesa number.</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <div className="w-8 h-8 shrink-0 bg-sky-500 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg shadow-sky-500/30">2</div>
                            <div>
                                <strong className="text-slate-900 dark:text-white block text-sm">PayHero Gateway Processes</strong>
                                <p className="text-slate-500 text-[11px] mt-1">Your master PayHero credentials authorize the transaction push.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-8 h-8 shrink-0 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg shadow-emerald-500/30">3</div>
                            <div>
                                <strong className="text-slate-900 dark:text-white block text-sm">Direct Disbursal</strong>
                                <p className="text-slate-500 text-[11px] mt-1">Funds bypass the platform wallet and settle directly into the individual Tenant's configured Till or Paybill.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                        <strong className="text-slate-900 dark:text-white block">Webhook Configuration in PayHero</strong>
                        <ul className="text-slate-600 dark:text-slate-300 text-[11px] mt-2 space-y-1 list-disc pl-4">
                            <li>Log in to your <strong>payhero.co.ke</strong> account</li>
                            <li>Navigate to Webhooks/Endpoints</li>
                            <li>Set URL to <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-[10px] text-sky-600 dark:text-sky-400">{config.callbackUrl || '/api/v1/payments/payhero-callback'}</code></li>
                            <li>Ensure it handles POST requests</li>
                        </ul>
                    </div>
                </div>
            </div>
            
        </div>
    );
};

export default PayHeroGatewayManager;
