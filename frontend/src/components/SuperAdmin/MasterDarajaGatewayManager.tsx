import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle, RefreshCw, Zap, Shield, Key, Lock, Eye, EyeOff, Radio, CheckCircle2, DollarSign } from 'lucide-react';

interface MasterDarajaStatus {
    isConfigured: boolean;
    isMasterInitiatorActive: boolean;
    consumerKeyMasked: string;
    hasConsumerSecret: boolean;
    shortcode: string;
    tillNumber: string;
    paybillNumber: string;
    hasPasskey: boolean;
    initiatorName: string;
    hasInitiatorPassword: boolean;
    env: string;
    gatewayRole: string;
}

const MasterDarajaGatewayManager: React.FC = () => {
    const [status, setStatus] = useState<MasterDarajaStatus | null>(null);
    const [consumerKey, setConsumerKey] = useState('');
    const [consumerSecret, setConsumerSecret] = useState('');
    const [shortcode, setShortcode] = useState('');
    const [passkey, setPasskey] = useState('');
    const [tillNumber, setTillNumber] = useState('');
    const [paybillNumber, setPaybillNumber] = useState('');
    const [initiatorName, setInitiatorName] = useState('');
    const [initiatorPassword, setInitiatorPassword] = useState('');
    const [env, setEnv] = useState('production');

    const [showConsumerSecret, setShowConsumerSecret] = useState(false);
    const [showPasskey, setShowPasskey] = useState(false);
    const [showInitiatorPassword, setShowInitiatorPassword] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [simulatedResult, setSimulatedResult] = useState<any>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/v1/superadmin/master-daraja');
            if (res.data) {
                setStatus(res.data);
                if (res.data.shortcode) setShortcode(res.data.shortcode);
                if (res.data.tillNumber) setTillNumber(res.data.tillNumber);
                if (res.data.paybillNumber) setPaybillNumber(res.data.paybillNumber);
                if (res.data.initiatorName) setInitiatorName(res.data.initiatorName);
                if (res.data.env) setEnv(res.data.env);
            }
        } catch (err: any) {
            console.error('Failed to load Master Daraja settings', err);
            setMessage({ type: 'error', text: 'Could not load Master Daraja configuration.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setMessage(null);

            const payload: any = {
                shortcode,
                tillNumber,
                paybillNumber,
                initiatorName,
                env
            };

            if (consumerKey) payload.consumerKey = consumerKey;
            if (consumerSecret) payload.consumerSecret = consumerSecret;
            if (passkey) payload.passkey = passkey;
            if (initiatorPassword) payload.initiatorPassword = initiatorPassword;

            const res = await axios.put('/api/v1/superadmin/master-daraja', payload);
            setMessage({
                type: 'success',
                text: res.data.message || 'Master M-Pesa Daraja API credentials saved and activated as Master Initiator!'
            });

            setConsumerKey('');
            setConsumerSecret('');
            setPasskey('');
            setInitiatorPassword('');

            await fetchStatus();
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Failed to save Master Daraja credentials'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        try {
            setTesting(true);
            setMessage({ type: 'info', text: 'Testing live OAuth connection to Safaricom Daraja...' });

            const res = await axios.post('/api/v1/superadmin/master-daraja/test');
            setMessage({
                type: res.data.success ? 'success' : 'error',
                text: res.data.message || 'Master M-Pesa Daraja API Initiator successfully verified with Safaricom!'
            });
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Master Daraja connection test failed.'
            });
        } finally {
            setTesting(false);
        }
    };

    const handleTestSimulation = async () => {
        try {
            setTesting(true);
            setSimulatedResult(null);
            setMessage({ type: 'info', text: 'Triggering simulated callback request to verify server processes simulated payload data...' });

            const res = await axios.post('/api/v1/superadmin/master-daraja/simulate-callback');
            const callbackUrl = `${window.location.origin}/api/v1/payment-callback/mpesa/stk-push/superadmin`;
            setSimulatedResult({
                ...res.data,
                callbackUrl
            });
            setMessage({
                type: res.data.success ? 'success' : 'error',
                text: res.data.message || 'Simulated callback successfully processed by server!'
            });
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Simulated callback test failed.'
            });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
                <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
                    Loading Master Daraja Status...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header & Master Badge */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-black">
                        <Zap size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-[var(--text-primary)]">
                                Master M-Pesa Daraja API Initiator
                            </h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                status?.isConfigured
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                                {status?.isConfigured ? '● Active Master Initiator' : '○ Configuration Required'}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                            Primary initiator for platform SaaS invoices, customer checkouts, Wi-Fi packages, and B2C disbursements.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                        {testing ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
                        {testing ? 'Testing...' : 'Test Live Connection'}
                    </button>
                    <button
                        type="button"
                        onClick={handleTestSimulation}
                        disabled={testing}
                        className="px-4 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
                    >
                        {testing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                        {testing ? 'Simulating...' : 'Test Connection (Simulate Callback)'}
                    </button>
                </div>
            </div>

            {/* Notification message */}
            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
                    message.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : message.type === 'error'
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        : 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Simulated Callback Details & Callback URL Inspection Card */}
            {simulatedResult && (
                <div className="bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-sky-500/30 space-y-4 animate-fade-in shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sky-400 font-black text-sm uppercase tracking-wider">
                            <Zap size={18} /> M-Pesa Test Callback Inspection
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Receipt: {simulatedResult.receipt}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                            Target Callback URL Called by Safaricom Daraja:
                        </label>
                        <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] font-mono text-xs text-sky-400 select-all break-all flex items-center justify-between">
                            <span>{simulatedResult.callbackUrl}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(simulatedResult.callbackUrl);
                                    alert('Callback URL copied to clipboard!');
                                }}
                                className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-lg text-[10px] font-bold transition-all ml-2 shrink-0"
                            >
                                Copy URL
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                            Simulated STK Push Callback Payload Processed by Server:
                        </label>
                        <pre className="p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-secondary)] overflow-x-auto max-h-64">
                            {JSON.stringify(simulatedResult.simulatedPayload, null, 2)}
                        </pre>
                    </div>
                </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Consumer Key */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <Key size={14} /> Live Consumer Key
                        </label>
                        <input
                            type="text"
                            placeholder={status?.consumerKeyMasked || 'Enter Safaricom Consumer Key'}
                            value={consumerKey}
                            onChange={(e) => setConsumerKey(e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                        />
                    </div>

                    {/* Consumer Secret */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <Lock size={14} /> Live Consumer Secret
                        </label>
                        <div className="relative">
                            <input
                                type={showConsumerSecret ? 'text' : 'password'}
                                placeholder={status?.hasConsumerSecret ? '••••••••••••••••••••••••' : 'Enter Safaricom Consumer Secret'}
                                value={consumerSecret}
                                onChange={(e) => setConsumerSecret(e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 pr-12 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConsumerSecret(!showConsumerSecret)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                {showConsumerSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Business Shortcode (Paybill / Store) */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <Radio size={14} /> Business Shortcode (Paybill / Store / Head Office)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 174379 or 400200"
                            value={shortcode}
                            onChange={(e) => setShortcode(e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                        />
                    </div>

                    {/* Passkey */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <Shield size={14} /> Lipa Na M-Pesa Online Passkey
                        </label>
                        <div className="relative">
                            <input
                                type={showPasskey ? 'text' : 'password'}
                                placeholder={status?.hasPasskey ? '••••••••••••••••••••••••' : 'Enter Online Passkey'}
                                value={passkey}
                                onChange={(e) => setPasskey(e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 pr-12 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasskey(!showPasskey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                {showPasskey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Till Number */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <DollarSign size={14} /> Buy Goods Till Number (Optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 9876543"
                            value={tillNumber}
                            onChange={(e) => setTillNumber(e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                        />
                    </div>

                    {/* Paybill Number */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <DollarSign size={14} /> Paybill Number (Optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 522522"
                            value={paybillNumber}
                            onChange={(e) => setPaybillNumber(e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                        />
                    </div>

                    {/* B2C Initiator Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <Key size={14} /> B2C Payout Initiator Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. initiator_api"
                            value={initiatorName}
                            onChange={(e) => setInitiatorName(e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                        />
                    </div>

                    {/* B2C Initiator Security Credential / Password */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <Lock size={14} /> B2C Security Credential / Password
                        </label>
                        <div className="relative">
                            <input
                                type={showInitiatorPassword ? 'text' : 'password'}
                                placeholder={status?.hasInitiatorPassword ? '••••••••••••••••••••••••' : 'Enter B2C Initiator Security Credential'}
                                value={initiatorPassword}
                                onChange={(e) => setInitiatorPassword(e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 pr-12 outline-none focus:border-sky-500 transition-all font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowInitiatorPassword(!showInitiatorPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                {showInitiatorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Environment */}
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase">
                            Safaricom Daraja Target Environment
                        </label>
                        <select
                            value={env}
                            onChange={(e) => setEnv(e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 outline-none focus:border-sky-500 transition-all font-bold text-sm"
                        >
                            <option value="production">Live Production (https://api.safaricom.co.ke)</option>
                            <option value="sandbox">Sandbox (https://sandbox.safaricom.co.ke)</option>
                        </select>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-8 py-3.5 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all text-xs shadow-lg shadow-sky-500/25 flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save & Activate Master Daraja Initiator'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default MasterDarajaGatewayManager;
