import React, { useState } from 'react';
import {
    Terminal,
    Zap,
    ChevronRight,
    Wifi,
    Shield,
    Copy,
    RefreshCw,
    AlertCircle,
    ChevronLeft,
    Loader2
} from 'lucide-react';
import axios from 'axios';
import SupportFooter from '../components/Common/SupportFooter';
import BackButton from '../components/Common/BackButton';

interface RouterSetupDetails {
    name: string;
    host: string;
    port: string;
    version: string;
}

const MikrotikCenter: React.FC = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [routerDetails, setRouterDetails] = useState<RouterSetupDetails>({
        name: '',
        host: '',
        port: '8728',
        version: 'v7'
    });
    const [generatedScript, setGeneratedScript] = useState('');
    const [verificationStatus, setVerificationStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED'>('IDLE');
    const [verificationError, setVerificationError] = useState('');

    const generateScript = async () => {
        if (!routerDetails.name || !routerDetails.host) {
            alert('Please provide router name and host/IP');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post<{ script: string }>('/api/v1/admin/routers/generate-setup', {
                ...routerDetails
            });
            setGeneratedScript(response.data.script);
            setStep(3);
        } catch (error: unknown) {
            console.error('[Mikrotik] Generation failed', error);
            let errorMsg = 'Failed to generate script';
            if (axios.isAxiosError(error) && error.response?.data?.message) {
                errorMsg = error.response.data.message;
            }
            alert(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const verifyConnection = async () => {
        setVerificationStatus('PENDING');
        setVerificationError('');
        try {
            const response = await axios.post<{ success: boolean; message?: string }>('/api/v1/admin/routers/verify', {
                host: routerDetails.host
            });
            if (response.data.success) {
                setVerificationStatus('SUCCESS');
            } else {
                setVerificationStatus('FAILED');
                setVerificationError(response.data.message || 'Verification failed');
            }
        } catch (error: unknown) {
            setVerificationStatus('FAILED');
            let errorMsg = 'Connection timeout';
            if (axios.isAxiosError(error) && error.response?.data?.message) {
                errorMsg = error.response.data.message;
            }
            setVerificationError(errorMsg);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedScript);
        alert('Script copied to clipboard!');
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Page Header */}
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                    <Zap className="w-5 h-5 text-sky-500" /> MikroTik Setup Wizard
                </h1>
                <p className="text-[var(--text-secondary)] text-sm mt-0.5">Easily connect your router to Jevish in minutes.</p>
            </div>

            <div className="pt-4">
                {/* Progress Bar */}
                <div className="flex items-center justify-between mb-12 relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-[var(--border-subtle)] -translate-y-1/2 -z-10 rounded-full"></div>
                    <div className="absolute top-1/2 left-0 h-1 bg-sky-500 -translate-y-1/2 -z-10 rounded-full transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black transition-all ${step >= s ? 'bg-sky-500 text-white shadow-lg shadow-sky-200' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-2 border-[var(--border-subtle)]'}`}>
                            {s}
                        </div>
                    ))}
                </div>

                <div className="bg-[var(--bg-surface)] rounded-[3rem] border border-[var(--border-subtle)] shadow-xl overflow-hidden transition-colors duration-300">
                    {step === 1 && (
                        <div className="p-12">
                            <h2 className="text-3xl font-black mb-6 text-[var(--text-primary)]">Step 1: Prepare Your Router</h2>
                            <p className="text-[var(--text-secondary)] font-medium mb-8 leading-relaxed">
                                Our automated script transforms your MikroTik into a managed hotspot gateway.
                                It handles firewall rules, API users, and scheduler jobs automatically.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                <div className="p-6 bg-[var(--bg-surface-elevated)] rounded-3xl border border-[var(--border-subtle)] font-bold">
                                    <h4 className="flex items-center gap-2 mb-2 text-[var(--text-primary)]"><Zap className="text-sky-500 w-5 h-5" /> ROS v6 or v7</h4>
                                    <p className="text-xs text-[var(--text-muted)]">Fully compatible with all modern architectures.</p>
                                </div>
                                <div className="p-6 bg-[var(--bg-surface-elevated)] rounded-3xl border border-[var(--border-subtle)] font-bold">
                                    <h4 className="flex items-center gap-2 mb-2 text-[var(--text-primary)]"><Shield className="text-sky-500 w-5 h-5" /> Public IP or VPN</h4>
                                    <p className="text-xs text-[var(--text-muted)]">The billing system must reach your router.</p>
                                </div>
                            </div>
                            <button onClick={() => setStep(2)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                                Let's Get Started <ChevronRight />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-12">
                            <h2 className="text-3xl font-black mb-6">Step 2: Router Details</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">Router Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Downtown Hotspot"
                                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-4 px-6 rounded-2xl font-bold focus:outline-none focus:border-sky-500 transition-colors"
                                        value={routerDetails.name}
                                        onChange={(e) => setRouterDetails({ ...routerDetails, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">Host / IP / Domain</label>
                                    <input
                                        type="text"
                                        placeholder="router.isp.com or 1.2.3.4"
                                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-4 px-6 rounded-2xl font-bold focus:outline-none focus:border-sky-500 transition-colors"
                                        value={routerDetails.host}
                                        onChange={(e) => setRouterDetails({ ...routerDetails, host: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-[var(--text-muted)] mb-2">RouterOS Version</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setRouterDetails({ ...routerDetails, version: 'v7' })}
                                            className={`py-4 rounded-2xl font-bold border transition-all ${routerDetails.version === 'v7' ? 'bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-500/20' : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-sky-500'}`}
                                        >
                                            v7 (Modern)
                                        </button>
                                        <button
                                            onClick={() => setRouterDetails({ ...routerDetails, version: 'v6' })}
                                            className={`py-4 rounded-2xl font-bold border transition-all ${routerDetails.version === 'v6' ? 'bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-500/20' : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-sky-500'}`}
                                        >
                                            v6 (Legacy)
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 mt-10">
                                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-5">
                                    <ChevronLeft /> Back
                                </button>
                                <button onClick={generateScript} disabled={loading} className="flex-[2] bg-sky-500 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20">
                                    {loading ? <Loader2 className="animate-spin" /> : 'Generate Command'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-12">
                            <h2 className="text-3xl font-black mb-6 text-[var(--text-primary)]">Step 3: Run Command</h2>
                            <p className="text-[var(--text-secondary)] font-medium mb-8">
                                Copy the command below and paste it into your MikroTik's <strong>New Terminal</strong>.
                            </p>
                            <div className="relative mb-8 group">
                                <pre className="bg-[#0f172a] text-sky-400 p-8 rounded-3xl overflow-x-auto max-h-[300px] text-xs font-mono leading-relaxed border border-white/5 shadow-2xl">
                                    {generatedScript}
                                </pre>
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={copyToClipboard} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all">
                                        <Copy className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setStep(2)} className="btn-secondary flex-1 py-5">
                                    Edit Details
                                </button>
                                <button onClick={() => setStep(4)} className="flex-[2] bg-sky-500 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20">
                                    I've Done It <ChevronRight />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="p-12 text-center">
                            <div className="mb-10 flex justify-center">
                                {verificationStatus === 'IDLE' && <div className="w-24 h-24 bg-[var(--bg-surface-elevated)] rounded-full flex items-center justify-center text-[var(--text-muted)]"><Wifi className="w-12 h-12" /></div>}
                                {verificationStatus === 'PENDING' && <div className="w-24 h-24 bg-sky-500/10 animate-pulse rounded-full flex items-center justify-center text-sky-500"><RefreshCw className="w-12 h-12 animate-spin" /></div>}
                                {verificationStatus === 'SUCCESS' && <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500"><Zap className="w-12 h-12" /></div>}
                                {verificationStatus === 'FAILED' && <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500"><AlertCircle className="w-12 h-12" /></div>}
                            </div>

                            <h2 className="text-3xl font-black mb-4 text-[var(--text-primary)]">
                                {verificationStatus === 'IDLE' && 'Verify Your Router'}
                                {verificationStatus === 'PENDING' && 'Connecting...'}
                                {verificationStatus === 'SUCCESS' && 'Verified!'}
                                {verificationStatus === 'FAILED' && 'Connection Failed'}
                            </h2>
                            <p className="text-[var(--text-secondary)] font-medium mb-10 max-w-sm mx-auto">
                                {verificationStatus === 'IDLE' && 'Make sure you have pasted the script, then click the button below.'}
                                {verificationStatus === 'PENDING' && 'We are pinging your router to confirm the API connection is active.'}
                                {verificationStatus === 'SUCCESS' && 'Awesome! Your router is now linked. You can start managing packages and users.'}
                                {verificationStatus === 'FAILED' && verificationError}
                            </p>

                            <div className="space-y-4">
                                {verificationStatus !== 'SUCCESS' && (
                                    <button onClick={verifyConnection} disabled={verificationStatus === 'PENDING'} className="w-full bg-sky-500 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50">
                                        Verify Connection
                                    </button>
                                )}
                                {verificationStatus === 'SUCCESS' && (
                                    <button onClick={() => window.location.href = '/tenant'} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">
                                        Go to Dashboard
                                    </button>
                                )}
                                <button onClick={() => setStep(3)} className="w-full py-4 text-[var(--text-muted)] font-bold hover:text-[var(--text-primary)] transition-all">
                                    Show Command Again
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MikrotikCenter;
