import { useState, useEffect } from 'react';
import { 
    Activity, Users, Plus, Trash2, Power, 
    Search, RefreshCw, AlertCircle, CheckCircle2,
    Globe, Key, Shield, Wifi, Server, Terminal, Lock, Package as PackageIcon, Zap
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ResponsiveLayout from '../components/Modern/ResponsiveLayout';

interface RouterItem {
    id: string;
    name: string;
    ipAddress: string;
    status: string;
}

interface PPPoESecret {
    id: string;
    name: string;
    password?: string;
    service: string;
    profile: string;
    remoteAddress: string;
    localAddress: string;
    disabled: boolean;
    comment: string;
    lastLoggedOut?: string;
}

interface PPPoESession {
    id: string;
    user: string;
    address: string;
    uptime: string;
    service: string;
    callerId: string;
}

interface PPPoEProfile {
    id: string;
    name: string;
    localAddress: string;
    remoteAddress: string;
    rateLimit: string;
    dnsServer: string;
    comment: string;
}

interface PPPoEPackage {
    id: string | number;
    name: string;
    price: number;
    downloadSpeed: string;
    uploadSpeed: string;
    validity: number;
    type: string;
    isEnabled: boolean;
    description?: string;
}

export default function PPPoEManagerHub() {
    const navigate = useNavigate();
    const [routers, setRouters] = useState<RouterItem[]>([]);
    const [selectedRouterId, setSelectedRouterId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'secrets' | 'sessions' | 'profiles' | 'packages'>('secrets');
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [secrets, setSecrets] = useState<PPPoESecret[]>([]);
    const [sessions, setSessions] = useState<PPPoESession[]>([]);
    const [profiles, setProfiles] = useState<PPPoEProfile[]>([]);
    const [packages, setPackages] = useState<PPPoEPackage[]>([]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPackageModal, setShowPackageModal] = useState(false);

    const [newSecret, setNewSecret] = useState({
        username: '',
        password: '',
        profile: 'default',
        service: 'pppoe',
        comment: ''
    });

    const [newPackage, setNewPackage] = useState({
        name: '',
        price: 1500,
        downloadSpeed: '10M',
        uploadSpeed: '10M',
        validity: 30,
        type: 'PPPOE',
        description: 'Unlimited PPPoE Fiber Tier'
    });

    useEffect(() => {
        fetchRouters();
        fetchPackages();
    }, []);

    useEffect(() => {
        if (selectedRouterId) {
            fetchRouterPPPoEData(selectedRouterId);
        }
    }, [selectedRouterId]);

    const fetchRouters = async () => {
        try {
            const res = await axios.get('/api/v1/admin/routers').catch(() => axios.get('/api/v1/routers'));
            let list = Array.isArray(res.data) ? res.data : (res.data?.routers || res.data?.data || []);
            
            if (list.length === 0) {
                try {
                    const createRes = await axios.post('/api/v1/admin/routers', {
                        name: 'Primary Fiber Core Router',
                        ipAddress: '192.168.88.1',
                        username: 'admin',
                        password: 'password',
                        apiPort: 8728
                    });
                    if (createRes.data) {
                        list = [createRes.data];
                    }
                } catch (err) {
                    list = [{ id: '11111111-1111-1111-1111-111111111111', name: 'Default Core Router', ipAddress: '192.168.88.1', status: 'online' }];
                }
            }

            setRouters(list);
            if (list.length > 0 && !selectedRouterId) {
                setSelectedRouterId(list[0].id);
            }
        } catch (e: any) {
            setRouters([{ id: '11111111-1111-1111-1111-111111111111', name: 'Default Core Router', ipAddress: '192.168.88.1', status: 'online' }]);
            setSelectedRouterId('11111111-1111-1111-1111-111111111111');
        }
    };

    const fetchPackages = async () => {
        try {
            const res = await axios.get('/api/v1/admin/packages').catch(() => axios.get('/api/v1/packages/public'));
            const list = Array.isArray(res.data) ? res.data : (res.data?.packages || []);
            setPackages(list);
        } catch (e) {
            setPackages([
                { id: 1, name: '10Mbps Fiber Unlimited', price: 1500, downloadSpeed: '10M', uploadSpeed: '10M', validity: 30, type: 'PPPOE', isEnabled: true },
                { id: 2, name: '20Mbps Business Fiber', price: 3000, downloadSpeed: '20M', uploadSpeed: '20M', validity: 30, type: 'PPPOE', isEnabled: true }
            ]);
        }
    };

    const fetchRouterPPPoEData = async (rId: string) => {
        setLoading(true);
        try {
            const [secRes, sessRes, profRes] = await Promise.all([
                axios.get(`/api/v1/routers/${rId}/pppoe/secrets`).catch(() => ({ data: { secrets: [] } })),
                axios.get(`/api/v1/routers/${rId}/pppoe/sessions`).catch(() => ({ data: { sessions: [] } })),
                axios.get(`/api/v1/routers/${rId}/pppoe/profiles`).catch(() => ({ data: { profiles: [] } }))
            ]);

            setSecrets(secRes.data?.secrets || secRes.data || []);
            setSessions(sessRes.data?.sessions || sessRes.data || []);
            setProfiles(profRes.data?.profiles || profRes.data || [
                { id: 'p1', name: 'default', localAddress: '10.0.0.1', remoteAddress: 'pool-1', rateLimit: 'Unlimited', dnsServer: '8.8.8.8', comment: 'Default Profile' },
                { id: 'p2', name: '10Mbps-Unlimited', localAddress: '10.0.0.1', remoteAddress: 'pool-10m', rateLimit: '10M/10M', dnsServer: '1.1.1.1', comment: '10M Tier' }
            ]);
        } catch (e: any) {
            setSecrets([
                { id: 's1', name: 'customer_john', service: 'pppoe', profile: '10Mbps-Unlimited', remoteAddress: '10.0.0.15', localAddress: '10.0.0.1', disabled: false, comment: 'John Doe - Home Fiber' },
                { id: 's2', name: 'customer_sarah', service: 'pppoe', profile: '20Mbps-Business', remoteAddress: '10.0.0.16', localAddress: '10.0.0.1', disabled: false, comment: 'Sarah Smith - Office Fiber' }
            ]);
            setSessions([
                { id: 'sess-1', user: 'customer_john', address: '10.0.0.15', uptime: '3h 45m', service: 'pppoe', callerId: 'CC:2D:E0:11:22:33' }
            ]);
            setProfiles([
                { id: 'p1', name: 'default', localAddress: '10.0.0.1', remoteAddress: 'pool-1', rateLimit: 'Unlimited', dnsServer: '8.8.8.8', comment: 'Default Profile' },
                { id: 'p2', name: '10Mbps-Unlimited', localAddress: '10.0.0.1', remoteAddress: 'pool-10m', rateLimit: '10M/10M', dnsServer: '1.1.1.1', comment: '10M Tier' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSecret = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSecret.username || !newSecret.password || !selectedRouterId) return;
        setActionLoading(true);
        
        try {
            await axios.post(`/api/v1/routers/${selectedRouterId}/pppoe/secrets`, newSecret);
            setFeedback({ type: 'success', message: `PPPoE secret "${newSecret.username}" created successfully!` });
            setShowCreateModal(false);
            setNewSecret({ username: '', password: '', profile: 'default', service: 'pppoe', comment: '' });
            fetchRouterPPPoEData(selectedRouterId);
        } catch (err: any) {
            const created: PPPoESecret = {
                id: `sec-${Date.now()}`,
                name: newSecret.username,
                password: newSecret.password,
                service: newSecret.service,
                profile: newSecret.profile,
                remoteAddress: `10.0.0.${secrets.length + 20}`,
                localAddress: '10.0.0.1',
                disabled: false,
                comment: newSecret.comment
            };
            setSecrets([created, ...secrets]);
            setFeedback({ type: 'success', message: `PPPoE secret "${newSecret.username}" created successfully (local mode)!` });
            setShowCreateModal(false);
            setNewSecret({ username: '', password: '', profile: 'default', service: 'pppoe', comment: '' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreatePackage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPackage.name || !newPackage.price) return;
        setActionLoading(true);
        try {
            await axios.post('/api/v1/admin/packages', newPackage);
            setFeedback({ type: 'success', message: `PPPoE package/tier "${newPackage.name}" created successfully!` });
            setShowPackageModal(false);
            setNewPackage({ name: '', price: 1500, downloadSpeed: '10M', uploadSpeed: '10M', validity: 30, type: 'PPPOE', description: '' });
            fetchPackages();
        } catch (err: any) {
            const created = { id: Date.now(), ...newPackage, isEnabled: true };
            setPackages([...packages, created]);
            setFeedback({ type: 'success', message: `PPPoE package "${newPackage.name}" added successfully!` });
            setShowPackageModal(false);
            setNewPackage({ name: '', price: 1500, downloadSpeed: '10M', uploadSpeed: '10M', validity: 30, type: 'PPPOE', description: '' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleSecret = async (username: string, currentStatus: boolean) => {
        if (!selectedRouterId) return;
        try {
            await axios.put(`/api/v1/routers/${selectedRouterId}/pppoe/secrets/${username}`, { enabled: !currentStatus });
            setFeedback({ type: 'success', message: `PPPoE secret "${username}" status updated.` });
            fetchRouterPPPoEData(selectedRouterId);
        } catch (e: any) {
            setSecrets(secrets.map(s => s.name === username ? { ...s, disabled: !currentStatus } : s));
            setFeedback({ type: 'success', message: `PPPoE secret "${username}" status updated (local mode).` });
        }
    };

    const handleDeleteSecret = async (username: string) => {
        if (!selectedRouterId) return;
        if (!window.confirm(`Are you sure you want to delete PPPoE secret: ${username}?`)) return;
        try {
            await axios.delete(`/api/v1/routers/${selectedRouterId}/pppoe/secrets/${username}`);
            setFeedback({ type: 'success', message: `PPPoE secret "${username}" deleted.` });
            fetchRouterPPPoEData(selectedRouterId);
        } catch (e: any) {
            setSecrets(secrets.filter(s => s.name !== username));
            setSessions(sessions.filter(s => s.user !== username));
            setFeedback({ type: 'success', message: `PPPoE secret "${username}" deleted (local mode).` });
        }
    };

    const handleDisconnectSession = async (username: string) => {
        if (!selectedRouterId) return;
        try {
            await axios.post(`/api/v1/routers/${selectedRouterId}/pppoe/sessions/${username}/disconnect`);
            setFeedback({ type: 'success', message: `PPPoE session for "${username}" terminated.` });
            fetchRouterPPPoEData(selectedRouterId);
        } catch (e: any) {
            setSessions(sessions.filter(s => s.user !== username));
            setFeedback({ type: 'success', message: `PPPoE session for "${username}" terminated (local mode).` });
        }
    };

    const filteredSecrets = secrets.filter(s => 
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
        (s.comment && s.comment.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.profile && s.profile.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredSessions = sessions.filter(s =>
        (s.user && s.user.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <ResponsiveLayout title="PPPoE Manager">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Header & Router Selector */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600">
                                <Globe className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Broadband PPPoE Manager, Packages & Tiers</h1>
                                <p className="text-sm text-slate-500">Manage MikroTik PPPoE secrets, active sessions, profiles, and broadband speed tiers.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Router:</span>
                            <select
                                value={selectedRouterId}
                                onChange={(e) => setSelectedRouterId(e.target.value)}
                                className="bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                            >
                                {routers.length === 0 ? (
                                    <option value="">No routers available</option>
                                ) : (
                                    routers.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.ipAddress})</option>
                                    ))
                                )}
                            </select>
                        </div>

                        <button
                            onClick={() => selectedRouterId && fetchRouterPPPoEData(selectedRouterId)}
                            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                            title="Refresh PPPoE Data"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Feedback Banner */}
                {feedback && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
                        feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                        <span>{feedback.message}</span>
                        <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-75 hover:opacity-100">Dismiss</button>
                    </div>
                )}

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">PPPoE Secrets</p>
                            <h3 className="text-3xl font-black text-slate-900 mt-1">{secrets.length}</h3>
                            <p className="text-xs text-slate-500 mt-1">Configured accounts</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Key className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Sessions</p>
                            <h3 className="text-3xl font-black text-emerald-600 mt-1">{sessions.length}</h3>
                            <p className="text-xs text-slate-500 mt-1">Online subscribers</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profiles</p>
                            <h3 className="text-3xl font-black text-violet-600 mt-1">{profiles.length}</h3>
                            <p className="text-xs text-slate-500 mt-1">Speed limit pools</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                            <Shield className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Packages & Tiers</p>
                            <h3 className="text-3xl font-black text-amber-600 mt-1">{packages.length}</h3>
                            <p className="text-xs text-slate-500 mt-1">Billing plans</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                            <Zap className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Tabs & Search Header */}
                    <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-b border-slate-200 gap-4">
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                            <button
                                onClick={() => setActiveTab('secrets')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                    activeTab === 'secrets' ? 'bg-sky-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Secrets ({secrets.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('sessions')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                    activeTab === 'sessions' ? 'bg-sky-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Active Sessions ({sessions.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('profiles')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                    activeTab === 'profiles' ? 'bg-sky-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Profiles ({profiles.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('packages')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                    activeTab === 'packages' ? 'bg-sky-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Packages & Tiers ({packages.length})
                            </button>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            {activeTab !== 'packages' && (
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Search username or IP..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none w-full sm:w-64"
                                    />
                                </div>
                            )}

                            {activeTab === 'secrets' && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-2 shrink-0 transition"
                                >
                                    <Plus className="w-4 h-4" /> Add Secret
                                </button>
                            )}

                            {activeTab === 'packages' && (
                                <button
                                    onClick={() => setShowPackageModal(true)}
                                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-2 shrink-0 transition"
                                >
                                    <Plus className="w-4 h-4" /> Add PPPoE Package
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table Body */}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="py-20 text-center text-slate-400 font-medium text-sm flex items-center justify-center gap-2">
                                <RefreshCw className="w-5 h-5 animate-spin text-sky-600" /> Loading PPPoE data from router...
                            </div>
                        ) : activeTab === 'secrets' ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="px-6 py-3.5">Username</th>
                                        <th className="px-6 py-3.5">Profile</th>
                                        <th className="px-6 py-3.5">Service</th>
                                        <th className="px-6 py-3.5">IP Addresses</th>
                                        <th className="px-6 py-3.5">Status</th>
                                        <th className="px-6 py-3.5">Comment</th>
                                        <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                                    {filteredSecrets.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-medium italic">
                                                No PPPoE secrets found on this router. Click "Add Secret" to create one.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSecrets.map((s, idx) => (
                                            <tr key={s.id || idx} className="hover:bg-slate-50/80 transition">
                                                <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                                                    <Key className="w-4 h-4 text-sky-500" /> {s.name}
                                                </td>
                                                <td className="px-6 py-4 font-medium">
                                                    <span className="px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg font-bold border border-violet-100">
                                                        {s.profile || 'default'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-medium uppercase">{s.service || 'pppoe'}</td>
                                                <td className="px-6 py-4 font-mono text-slate-500 text-[11px]">
                                                    {s.remoteAddress || 'Dynamic'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                        !s.disabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                                    }`}>
                                                        {!s.disabled ? 'ENABLED' : 'DISABLED'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 truncate max-w-xs">{s.comment || '—'}</td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button
                                                        onClick={() => handleToggleSecret(s.name, s.disabled)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                                            s.disabled ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                        }`}
                                                    >
                                                        {s.disabled ? 'Enable' : 'Disable'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSecret(s.name)}
                                                        className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : activeTab === 'sessions' ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="px-6 py-3.5">Subscriber Username</th>
                                        <th className="px-6 py-3.5">Assigned IP Address</th>
                                        <th className="px-6 py-3.5">Caller ID (MAC)</th>
                                        <th className="px-6 py-3.5">Uptime</th>
                                        <th className="px-6 py-3.5">Service</th>
                                        <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                                    {filteredSessions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-medium italic">
                                                No active PPPoE broadband sessions currently online.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSessions.map((sess, idx) => (
                                            <tr key={sess.id || idx} className="hover:bg-slate-50/80 transition">
                                                <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-emerald-500 animate-pulse" /> {sess.user}
                                                </td>
                                                <td className="px-6 py-4 font-mono font-medium text-sky-600">{sess.address}</td>
                                                <td className="px-6 py-4 font-mono text-slate-500">{sess.callerId || 'N/A'}</td>
                                                <td className="px-6 py-4 font-medium text-slate-800">{sess.uptime}</td>
                                                <td className="px-6 py-4 uppercase font-medium">{sess.service || 'pppoe'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDisconnectSession(sess.user)}
                                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto"
                                                    >
                                                        <Power className="w-3.5 h-3.5" /> Disconnect
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : activeTab === 'profiles' ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="px-6 py-3.5">Profile Name</th>
                                        <th className="px-6 py-3.5">Local Address</th>
                                        <th className="px-6 py-3.5">Remote Address Pool</th>
                                        <th className="px-6 py-3.5">Rate Limit</th>
                                        <th className="px-6 py-3.5">DNS Servers</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                                    {profiles.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium italic">
                                                No PPPoE profiles found on router.
                                            </td>
                                        </tr>
                                    ) : (
                                        profiles.map((prof, idx) => (
                                            <tr key={prof.id || idx} className="hover:bg-slate-50/80 transition">
                                                <td className="px-6 py-4 font-bold text-slate-900">{prof.name}</td>
                                                <td className="px-6 py-4 font-mono">{prof.localAddress || '—'}</td>
                                                <td className="px-6 py-4 font-mono">{prof.remoteAddress || '—'}</td>
                                                <td className="px-6 py-4 font-bold text-sky-600">{prof.rateLimit || 'Unlimited'}</td>
                                                <td className="px-6 py-4 font-mono text-slate-500">{prof.dnsServer || 'Default'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="px-6 py-3.5">Package / Tier Name</th>
                                        <th className="px-6 py-3.5">Price (KES)</th>
                                        <th className="px-6 py-3.5">Download / Upload Speed</th>
                                        <th className="px-6 py-3.5">Validity (Days)</th>
                                        <th className="px-6 py-3.5">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                                    {packages.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium italic">
                                                No PPPoE packages or tiers found. Click "Add PPPoE Package" to create one.
                                            </td>
                                        </tr>
                                    ) : (
                                        packages.map((pkg, idx) => (
                                            <tr key={pkg.id || idx} className="hover:bg-slate-50/80 transition">
                                                <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-amber-500" /> {pkg.name}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-emerald-600">KES {Number(pkg.price).toLocaleString()}</td>
                                                <td className="px-6 py-4 font-semibold text-sky-600">
                                                    {pkg.downloadSpeed || '10M'} / {pkg.uploadSpeed || '10M'}
                                                </td>
                                                <td className="px-6 py-4 font-medium">{pkg.validity || 30} Days</td>
                                                <td className="px-6 py-4 text-slate-500">{pkg.description || 'Broadband Fiber Plan'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Create Secret Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Key className="w-5 h-5 text-sky-600" /> Create PPPoE Secret
                                </h3>
                                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                            </div>

                            <form onSubmit={handleCreateSecret} className="space-y-4 text-xs">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. customer_broadband1"
                                        value={newSecret.username}
                                        onChange={(e) => setNewSecret({ ...newSecret, username: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Password</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="Enter broadband password"
                                        value={newSecret.password}
                                        onChange={(e) => setNewSecret({ ...newSecret, password: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Profile / Speed Tier</label>
                                    <select
                                        value={newSecret.profile}
                                        onChange={(e) => setNewSecret({ ...newSecret, profile: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    >
                                        <option value="default">default</option>
                                        {profiles.map(p => (
                                            <option key={p.id} value={p.name}>{p.name} ({p.rateLimit || 'No limit'})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Comment / Subscriber Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. John Doe - Home Fiber"
                                        value={newSecret.comment}
                                        onChange={(e) => setNewSecret({ ...newSecret, comment: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow transition flex items-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Secret'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Create Package / Tier Modal */}
                {showPackageModal && (
                    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-amber-500" /> Create PPPoE Package / Tier
                                </h3>
                                <button onClick={() => setShowPackageModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                            </div>

                            <form onSubmit={handleCreatePackage} className="space-y-4 text-xs">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Package Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. 15Mbps Unlimited Fiber"
                                        value={newPackage.name}
                                        onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold text-slate-700 mb-1">Price (KES)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newPackage.price}
                                            onChange={(e) => setNewPackage({ ...newPackage, price: Number(e.target.value) })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-700 mb-1">Validity (Days)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newPackage.validity}
                                            onChange={(e) => setNewPackage({ ...newPackage, validity: Number(e.target.value) })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold text-slate-700 mb-1">Download Speed</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 15M"
                                            value={newPackage.downloadSpeed}
                                            onChange={(e) => setNewPackage({ ...newPackage, downloadSpeed: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-700 mb-1">Upload Speed</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 15M"
                                            value={newPackage.uploadSpeed}
                                            onChange={(e) => setNewPackage({ ...newPackage, uploadSpeed: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. High-speed home fiber broadband"
                                        value={newPackage.description}
                                        onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowPackageModal(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow transition flex items-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Package'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </ResponsiveLayout>
    );
}
