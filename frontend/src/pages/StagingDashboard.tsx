import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Activity, Shield, Zap, Play, RotateCcw, AlertTriangle,
    Terminal, Eye, Cpu, CheckCircle2, XCircle, RefreshCw, AlertCircle
} from 'lucide-react';
import { CaptivePortalPreview } from '../components/Staging/CaptivePortalPreview';

export const StagingDashboard = () => {
    const [activeTab, setActiveTab] = useState<'health' | 'flags' | 'tests' | 'sandboxes' | 'portal' | 'security' | 'performance' | 'errors' | 'deploy'>('health');
    const [health, setHealth] = useState<any>(null);
    const [flags, setFlags] = useState<any[]>([]);
    const [testReport, setTestReport] = useState<any>(null);
    const [isRunningTests, setIsRunningTests] = useState(false);
    const [capturedMessages, setCapturedMessages] = useState<any[]>([]);
    const [sandboxPayments, setSandboxPayments] = useState<any[]>([]);
    const [simUsers, setSimUsers] = useState<any[]>([]);
    const [securityReport, setSecurityReport] = useState<any>(null);
    const [perfReport, setPerfReport] = useState<any>(null);
    const [errorLogs, setErrorLogs] = useState<any[]>([]);
    const [deployStatus, setDeployStatus] = useState<any>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Initial Fetch
    useEffect(() => {
        fetchHealth();
        fetchFlags();
    }, []);

    const fetchHealth = async () => {
        try {
            const res = await axios.get('/api/v1/staging/health');
            setHealth(res.data);
        } catch { }
    };

    const fetchFlags = async () => {
        try {
            const res = await axios.get('/api/v1/staging/feature-flags');
            setFlags(res.data);
        } catch { }
    };

    const handleRunTests = async () => {
        try {
            setIsRunningTests(true);
            setMessage('Executing 18 automated staging test suites...');
            const res = await axios.post('/api/v1/staging/run-tests');
            setTestReport(res.data);
            setMessage(null);
        } catch (err: any) {
            setMessage(`Test execution failed: ${err.message}`);
        } finally {
            setIsRunningTests(false);
        }
    };

    const handleToggleFlag = async (key: string, current: boolean) => {
        try {
            await axios.put(`/api/v1/staging/feature-flags/${key}`, { isEnabledStaging: !current });
            fetchFlags();
        } catch { }
    };

    const fetchSandboxes = async () => {
        try {
            const [msgRes, payRes, simRes] = await Promise.all([
                axios.get('/api/v1/staging/sandboxes/messages'),
                axios.get('/api/v1/staging/sandboxes/payments'),
                axios.get('/api/v1/staging/mikrotik-simulator/hotspot-users')
            ]);
            setCapturedMessages(msgRes.data);
            setSandboxPayments(payRes.data);
            setSimUsers(simRes.data);
        } catch { }
    };

    const handleSimulatePayment = async (scenario: 'SUCCESS' | 'FAILED' | 'TIMEOUT') => {
        try {
            await axios.post('/api/v1/staging/sandboxes/payments/simulate', {
                provider: 'MPESA',
                transactionType: 'PAYMENT',
                amount: 10000,
                scenario,
            });
            fetchSandboxes();
        } catch { }
    };

    const fetchSecurityScan = async () => {
        try {
            const res = await axios.get('/api/v1/staging/security-audit');
            setSecurityReport(res.data);
        } catch { }
    };

    const fetchPerformance = async () => {
        try {
            const res = await axios.get('/api/v1/staging/performance');
            setPerfReport(res.data);
        } catch { }
    };

    const fetchErrorLogs = async () => {
        try {
            const res = await axios.get('/api/v1/staging/errors');
            setErrorLogs(res.data);
        } catch { }
    };

    const fetchDeployStatus = async () => {
        try {
            const res = await axios.get('/api/v1/staging/deploy/status');
            setDeployStatus(res.data);
        } catch { }
    };

    useEffect(() => {
        if (activeTab === 'sandboxes') fetchSandboxes();
        if (activeTab === 'security') fetchSecurityScan();
        if (activeTab === 'performance') fetchPerformance();
        if (activeTab === 'errors') fetchErrorLogs();
        if (activeTab === 'deploy') fetchDeployStatus();
    }, [activeTab]);

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest">
                                STAGING ENVIRONMENT
                            </span>
                            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                        </div>
                        <h1 className="text-3xl font-black">Staging &amp; Testing Command Center</h1>
                        <p className="text-white/80 font-bold text-sm mt-1">Isolated sandbox environment for database migrations, router simulation &amp; security verification.</p>
                    </div>
                    <button
                        onClick={handleRunTests}
                        disabled={isRunningTests}
                        className="px-6 py-3.5 bg-white text-slate-900 font-black rounded-2xl shadow-lg hover:bg-slate-100 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                        {isRunningTests ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                        {isRunningTests ? 'Running Automated Tests...' : 'Run 18 Automated Test Suites'}
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[var(--border-subtle)]">
                {[
                    { id: 'health', label: 'System Health', icon: Activity },
                    { id: 'flags', label: 'Feature Flags', icon: Zap },
                    { id: 'tests', label: 'Automated Tests', icon: Play },
                    { id: 'sandboxes', label: 'Sandboxes & Simulators', icon: Terminal },
                    { id: 'portal', label: 'Captive Portal Preview', icon: Eye },
                    { id: 'security', label: 'Security Scanner', icon: Shield },
                    { id: 'performance', label: 'Performance & Vitals', icon: Cpu },
                    { id: 'errors', label: 'Central Error Logs', icon: AlertTriangle },
                    { id: 'deploy', label: 'Deploy & Rollback', icon: RotateCcw },
                ].map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${activeTab === t.id
                                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                                : 'text-[var(--text-secondary)] bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <Icon size={14} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {message && (
                <div className="p-4 bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold rounded-2xl text-xs flex items-center gap-3">
                    <AlertCircle size={16} /> {message}
                </div>
            )}

            {/* TAB CONTENT */}

            {/* 1. HEALTH */}
            {activeTab === 'health' && health && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                            <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">Overall Status</p>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                                <h3 className="text-2xl font-black text-emerald-500">{health.systemStatus}</h3>
                            </div>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                            <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">CPU Usage</p>
                            <h3 className="text-2xl font-black">{health.metrics.cpuUsagePercentage}%</h3>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                            <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">RAM Usage</p>
                            <h3 className="text-2xl font-black">{health.metrics.ramUsageMB.used} MB / {health.metrics.ramUsageMB.total} MB</h3>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                            <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">Uptime</p>
                            <h3 className="text-2xl font-black">{Math.floor(health.metrics.uptimeSeconds / 60)} mins</h3>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                        <h3 className="text-lg font-black mb-4">Running Services Status</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
                            {Object.entries(health.services).map(([key, val]) => (
                                <div key={key} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl flex items-center justify-between">
                                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-500 rounded-full font-black text-[10px]">{String(val)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. FEATURE FLAGS */}
            {activeTab === 'flags' && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                    <h3 className="text-lg font-black">Feature Flag Management</h3>
                    <p className="text-xs text-[var(--text-secondary)] font-medium">Enable new features selectively on Staging, per Tenant, or per Admin before Global deployment.</p>

                    <div className="space-y-3">
                        {flags.map(flag => (
                            <div key={flag.key} className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl flex items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-black text-sm">{flag.key}</h4>
                                    <p className="text-xs text-[var(--text-muted)]">{flag.description}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleToggleFlag(flag.key, flag.isEnabledStaging)}
                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${flag.isEnabledStaging ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}
                                    >
                                        Staging: {flag.isEnabledStaging ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. AUTOMATED TESTS */}
            {activeTab === 'tests' && (
                <div className="space-y-6">
                    {testReport ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] text-center">
                                    <p className="text-xs font-black uppercase text-[var(--text-muted)]">Pass Rate</p>
                                    <h2 className="text-4xl font-black text-emerald-500">{testReport.summary.passPercentage}%</h2>
                                </div>
                                <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] text-center">
                                    <p className="text-xs font-black uppercase text-[var(--text-muted)]">Passed / Total</p>
                                    <h2 className="text-4xl font-black">{testReport.summary.passedCount} / {testReport.summary.totalTests}</h2>
                                </div>
                                <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] text-center">
                                    <p className="text-xs font-black uppercase text-[var(--text-muted)]">Execution Duration</p>
                                    <h2 className="text-4xl font-black text-sky-500">{testReport.summary.totalDurationMs} ms</h2>
                                </div>
                            </div>

                            <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-3">
                                <h3 className="text-lg font-black">Test Execution Details</h3>
                                <div className="space-y-2">
                                    {testReport.results.map((r: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl flex items-center justify-between text-xs font-bold">
                                            <div className="flex items-center gap-3">
                                                {r.passed ? <CheckCircle2 className="text-emerald-500" size={16} /> : <XCircle className="text-rose-500" size={16} />}
                                                <div>
                                                    <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-md text-[10px] uppercase font-black mr-2">{r.category}</span>
                                                    <span>{r.testName}</span>
                                                </div>
                                            </div>
                                            <span className="text-[var(--text-muted)]">{r.durationMs}ms</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-12 text-center bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)]">
                            <Play size={48} className="mx-auto mb-4 text-sky-500 opacity-50" />
                            <h3 className="text-xl font-black mb-2">No Automated Tests Executed Yet</h3>
                            <p className="text-xs text-[var(--text-secondary)] font-bold mb-6">Click the button below to run all 18 automated staging test suites.</p>
                            <button onClick={handleRunTests} className="px-6 py-3 bg-sky-500 text-white font-black rounded-2xl shadow-lg hover:bg-sky-600 transition-all text-sm">
                                Execute Test Suite
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 4. SANDBOXES & SIMULATORS */}
            {activeTab === 'sandboxes' && (
                <div className="space-y-6">
                    {/* Payment Sandbox Controller */}
                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                        <h3 className="text-lg font-black">Payment Test Controller</h3>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={() => handleSimulatePayment('SUCCESS')} className="px-4 py-2 bg-emerald-500 text-white font-black rounded-xl text-xs">
                                Test Success STK Push
                            </button>
                            <button onClick={() => handleSimulatePayment('FAILED')} className="px-4 py-2 bg-rose-500 text-white font-black rounded-xl text-xs">
                                Test Rejected Payment
                            </button>
                            <button onClick={() => handleSimulatePayment('TIMEOUT')} className="px-4 py-2 bg-amber-500 text-white font-black rounded-xl text-xs">
                                Test Callback Timeout
                            </button>
                        </div>

                        {/* Payment Test Logs */}
                        <div className="space-y-2 pt-2">
                            {sandboxPayments.length === 0 ? (
                                <p className="text-xs text-[var(--text-muted)] font-bold">No test payments logged yet.</p>
                            ) : (
                                sandboxPayments.slice(0, 5).map((p: any) => (
                                    <div key={p.id} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl text-xs font-bold flex items-center justify-between">
                                        <div>
                                            <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-md font-black mr-2">{p.provider}</span>
                                            <span className="font-mono text-[var(--text-muted)] mr-2">{p.reference}</span>
                                            <span>KES {(p.amount / 100).toLocaleString()}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${p.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Router Active Users */}
                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                        <h3 className="text-lg font-black">MikroTik RouterOS Active Test Users</h3>
                        <div className="space-y-2">
                            {simUsers.length === 0 ? (
                                <p className="text-xs text-[var(--text-muted)] font-bold">No active test Hotspot users.</p>
                            ) : (
                                simUsers.map((u: any) => (
                                    <div key={u.id} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl text-xs font-bold flex items-center justify-between">
                                        <div>
                                            <span className="font-black text-sky-400 mr-2">{u.username}</span>
                                            <span className="text-[var(--text-muted)] text-[10px] mr-2">({u.ipAddress} | {u.macAddress})</span>
                                        </div>
                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-md font-black text-[10px]">
                                            {u.profile}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Captured Messages Trap */}
                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                        <h3 className="text-lg font-black">Captured Messages Trap (Email / SMS / WhatsApp)</h3>
                        <div className="space-y-2">
                            {capturedMessages.length === 0 ? (
                                <p className="text-xs text-[var(--text-muted)] font-bold">No messages captured in trap yet.</p>
                            ) : (
                                capturedMessages.map((m: any) => (
                                    <div key={m.id} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl text-xs font-bold flex items-center justify-between">
                                        <div>
                                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md font-black mr-2">{m.channel}</span>
                                            <span className="text-[var(--text-muted)] mr-2">To: {m.recipient}</span>
                                            <span>"{m.content}"</span>
                                        </div>
                                        <span className="text-emerald-400 text-[10px]">TRAPPED ({m.status})</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. CAPTIVE PORTAL PREVIEW */}
            {activeTab === 'portal' && <CaptivePortalPreview />}

            {/* 6. SECURITY SCANNER */}
            {activeTab === 'security' && securityReport && (
                <div className="space-y-6">
                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black uppercase text-[var(--text-muted)]">Security Score</p>
                            <h2 className="text-4xl font-black text-emerald-500">{securityReport.score} / 100</h2>
                        </div>
                        <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 font-black text-sm rounded-2xl uppercase">
                            Rating: {securityReport.overallRating}
                        </span>
                    </div>

                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-3">
                        <h3 className="text-lg font-black">Automated Vulnerability Audit</h3>
                        <div className="space-y-2">
                            {securityReport.vulnerabilities.map((v: any) => (
                                <div key={v.id} className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl flex items-center justify-between text-xs font-bold">
                                    <div>
                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-md font-black mr-2">{v.category}</span>
                                        <span className="font-black text-sm">{v.name}</span>
                                        <p className="text-[var(--text-muted)] mt-1">{v.recommendation}</p>
                                    </div>
                                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-black text-[10px]">{v.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 7. PERFORMANCE */}
            {activeTab === 'performance' && perfReport && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                            <p className="text-xs font-black uppercase text-[var(--text-muted)]">Avg API Latency</p>
                            <h3 className="text-2xl font-black text-sky-500">{perfReport.metrics.averageApiResponseTimeMs} ms</h3>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                            <p className="text-xs font-black uppercase text-[var(--text-muted)]">DB Query Speed</p>
                            <h3 className="text-2xl font-black text-emerald-500">{perfReport.metrics.databaseQueryLatencyMs} ms</h3>
                        </div>
                        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                            <p className="text-xs font-black uppercase text-[var(--text-muted)]">LCP (Web Vitals)</p>
                            <h3 className="text-2xl font-black">{perfReport.metrics.largestContentfulPaintMs} ms</h3>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. CENTRAL ERRORS */}
            {activeTab === 'errors' && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-4">
                    <h3 className="text-lg font-black">Centralized Error Logs &amp; AI Suggested Fixes</h3>
                    <div className="space-y-3">
                        {errorLogs.length === 0 ? (
                            <p className="text-xs text-[var(--text-muted)] font-bold">No staging runtime errors captured.</p>
                        ) : (
                            errorLogs.map((e: any) => (
                                <div key={e.id} className="p-4 bg-[var(--bg-surface-elevated)] rounded-2xl space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 font-black rounded-md">{e.source}</span>
                                        <span className="text-[var(--text-muted)] font-bold">{new Date(e.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="font-bold text-sm">{e.message}</p>
                                    {e.suggestedFix && (
                                        <div className="p-3 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-xl text-xs font-bold">
                                            💡 Suggested Fix: {e.suggestedFix}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 9. DEPLOYMENT & ROLLBACK */}
            {activeTab === 'deploy' && deployStatus && (
                <div className="space-y-6">
                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)] space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase text-[var(--text-muted)]">Target Production Server IP</p>
                                <h3 className="text-2xl font-black text-emerald-400 font-mono">154.154.252.228</h3>
                            </div>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-black text-xs">
                                Production Server Active
                            </span>
                        </div>
                    </div>

                    <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                        <h3 className="text-lg font-black mb-2">Pre-Deployment Automated Backups &amp; Rollback</h3>
                        <p className="text-xs text-[var(--text-secondary)] font-bold mb-4">Every deployment creates a timestamped database backup. Click to restore anytime.</p>

                        <div className="space-y-2">
                            {deployStatus.backupsList.map((b: any) => (
                                <div key={b.name} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl flex items-center justify-between text-xs font-bold">
                                    <div>
                                        <p className="font-black">{b.name}</p>
                                        <span className="text-[var(--text-muted)] text-[10px]">{new Date(b.createdAt).toLocaleString()}</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await axios.post('/api/v1/staging/deploy/rollback', { backupFileName: b.name });
                                                fetchDeployStatus();
                                            } catch { }
                                        }}
                                        className="px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded-xl font-bold hover:bg-rose-500 hover:text-white transition-all"
                                    >
                                        One-Click Rollback
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
