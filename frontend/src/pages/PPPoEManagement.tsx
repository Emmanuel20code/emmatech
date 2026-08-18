import { useState, useEffect } from 'react';
import { 
    Activity, Users, Shield, Plus, Trash2, Power, 
    Search, RefreshCw, AlertCircle, CheckCircle2,
    Clock, Globe, Lock, Key, CreditCard, ChevronRight,
    Server, Terminal, Settings, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

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
    lastLoggedOut: string;
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

interface PppoeRequestItem {
    id: string;
    fullName: string;
    phone: string;
    email?: string;
    location: string;
    packageName?: string;
    pppoeUsername?: string;
    pppoePassword?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROVISIONED';
    adminNotes?: string;
    createdAt: string;
}

const PPPoEManagement = () => {
    const { routerId } = useParams<{ routerId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'secrets' | 'sessions' | 'profiles' | 'requests'>('secrets');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Data states
    const [secrets, setSecrets] = useState<PPPoESecret[]>([]);
    const [sessions, setSessions] = useState<PPPoESession[]>([]);
    const [profiles, setProfiles] = useState<PPPoEProfile[]>([]);
    const [requests, setRequests] = useState<PppoeRequestItem[]>([]);
    const [routerName, setRouterName] = useState('');

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSecret, setNewSecret] = useState({
        username: '',
        password: '',
        profile: 'default',
        service: 'pppoe',
        comment: 'Manual creation'
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [secretsRes, sessionsRes, profilesRes, requestsRes] = await Promise.all([
                axios.get(`/api/v1/routers/${routerId}/pppoe/secrets`),
                axios.get(`/api/v1/routers/${routerId}/pppoe/sessions`),
                axios.get(`/api/v1/routers/${routerId}/pppoe/profiles`),
                axios.get(`/api/v1/routers/${routerId}/pppoe/requests`)
            ]);
            
            setSecrets(secretsRes.data.secrets || []);
            setSessions(sessionsRes.data.sessions || []);
            setProfiles(profilesRes.data.profiles || []);
            setRequests(requestsRes.data.requests || []);
            
            const routerRes = await axios.get(`/api/v1/routers/${routerId}/resources`).catch(() => ({ data: { resources: { identity: 'MikroTik' } } }));
            setRouterName(routerRes.data?.resources?.identity || 'MikroTik Router');
            
        } catch (error) {
            setFeedback({ type: 'error', message: 'Failed to connect to router. Ensure it is online and API is enabled.' });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveRequest = async (reqId: string) => {
        setActionLoading(true);
        try {
            await axios.put(`/api/v1/routers/${routerId}/pppoe/requests/${reqId}/approve`);
            setFeedback({ type: 'success', message: 'PPPoE connection request approved and auto-provisioned successfully on MikroTik!' });
            fetchData();
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to approve request' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectRequest = async (reqId: string) => {
        setActionLoading(true);
        try {
            await axios.put(`/api/v1/routers/${routerId}/pppoe/requests/${reqId}/reject`, { reason: 'Application rejected' });
            setFeedback({ type: 'success', message: 'PPPoE connection request rejected.' });
            fetchData();
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to reject request' });
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [routerId]);

    const handleCreateSecret = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await axios.post(`/api/v1/routers/${routerId}/pppoe/secrets`, newSecret);
            setFeedback({ type: 'success', message: `PPPoE secret ${newSecret.username} created successfully!` });
            setShowCreateModal(false);
            setNewSecret({ username: '', password: '', profile: 'default', service: 'pppoe', comment: 'Manual creation' });
            fetchData();
        } catch (error: any) {
            setFeedback({ type: 'error', message: error.response?.data?.error || 'Failed to create secret' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleSecret = async (username: string, currentStatus: boolean) => {
        setActionLoading(true);
        try {
            await axios.put(`/api/v1/routers/${routerId}/pppoe/secrets/${username}`, { enabled: currentStatus });
            setFeedback({ type: 'success', message: `Secret ${username} ${currentStatus ? 'enabled' : 'disabled'} successfully` });
            fetchData();
        } catch (error) {
            setFeedback({ type: 'error', message: 'Failed to update secret' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteSecret = async (username: string) => {
        if (!window.confirm(`Are you sure you want to delete PPPoE secret: ${username}?`)) return;
        setActionLoading(true);
        try {
            await axios.delete(`/api/v1/routers/${routerId}/pppoe/secrets/${username}`);
            setFeedback({ type: 'success', message: `Secret ${username} removed successfully` });
            fetchData();
        } catch (error) {
            setFeedback({ type: 'error', message: 'Failed to delete secret' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisconnectSession = async (username: string) => {
        setActionLoading(true);
        try {
            await axios.post(`/api/v1/routers/${routerId}/pppoe/sessions/${username}/disconnect`);
            setFeedback({ type: 'success', message: `Session for ${username} disconnected` });
            fetchData();
        } catch (error) {
            setFeedback({ type: 'error', message: 'Failed to disconnect session' });
        } finally {
            setActionLoading(false);
        }
    };

    const filteredSecrets = secrets.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.comment.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSessions = sessions.filter(s => 
        s.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans min-h-screen text-slate-200">
            {/* Back Button & Breadcrumbs */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <button onClick={() => navigate('/routers')} className="hover:text-sky-400 transition">Routers</button>
                    <ChevronRight size={14} />
                    <button onClick={() => navigate(`/routers/${routerId}`)} className="hover:text-sky-400 transition">{routerName}</button>
                    <ChevronRight size={14} />
                    <span className="text-white">PPPoE Logic</span>
                </div>
                <button
                    onClick={() => navigate(`/routers/${routerId}`)}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition flex items-center gap-2 text-xs font-black uppercase tracking-wider"
                >
                    <ArrowLeft size={14} /> Back to Router
                </button>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Globe className="w-8 h-8 text-sky-400" /> PPPoE Management Center
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Control residential PPPoE secrets, monitor active broadband sessions, and manage service profiles.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchData}
                        className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
                    </button>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-black rounded-xl transition shadow-lg shadow-sky-900/20 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> New Secret
                    </button>
                </div>
            </div>

            {feedback && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold ${
                        feedback.type === 'success' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                >
                    {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {feedback.message}
                </motion.div>
            )}

            {/* Tabs */}
            <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
                {[
                    { id: 'secrets', label: 'PPP Secrets', icon: Lock },
                    { id: 'sessions', label: 'Active Sessions', icon: Activity },
                    { id: 'profiles', label: 'Profiles', icon: Settings },
                    { id: 'requests', label: 'Connection Requests', icon: Users }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
                            activeTab === tab.id 
                            ? 'bg-slate-800 text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        {tab.id === 'sessions' && sessions.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-sky-500 text-slate-950 rounded-md text-[10px]">{sessions.length}</span>
                        )}
                        {tab.id === 'requests' && requests.filter(r => r.status === 'PENDING').length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-md text-[10px]">{requests.filter(r => r.status === 'PENDING').length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400 transition" size={18} />
                    <input 
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                </div>

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="p-20 text-center space-y-4"
                        >
                            <RefreshCw className="w-10 h-10 text-sky-500 animate-spin mx-auto" />
                            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Communicating with RouterOS...</p>
                        </motion.div>
                    ) : activeTab === 'secrets' ? (
                        <motion.div 
                            key="secrets"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {filteredSecrets.map(secret => (
                                <div key={secret.id} className={`bg-slate-900 border ${secret.disabled ? 'border-slate-800 opacity-60' : 'border-slate-800'} p-5 rounded-3xl space-y-4 hover:border-slate-700 transition group`}>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="font-black text-white text-lg flex items-center gap-2">
                                                <Users size={16} className="text-sky-400" />
                                                {secret.name}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-black rounded uppercase tracking-wider">{secret.profile}</span>
                                                {secret.remoteAddress && <span className="text-[10px] text-slate-500 font-mono">{secret.remoteAddress}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleToggleSecret(secret.name, secret.disabled)}
                                                className={`p-2 rounded-xl transition ${secret.disabled ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'}`}
                                                title={secret.disabled ? 'Enable' : 'Disable'}
                                            >
                                                <Power size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteSecret(secret.name)}
                                                className="p-2 text-rose-500 bg-rose-500/10 rounded-xl transition"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {secret.comment && (
                                        <p className="text-xs text-slate-500 italic">"{secret.comment}"</p>
                                    )}

                                    <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500">
                                        <div className="flex items-center gap-1.5 uppercase tracking-tighter">
                                            <Shield size={12} className="text-sky-500" /> {secret.service}
                                        </div>
                                        <div className="flex items-center gap-1.5 uppercase tracking-tighter">
                                            <Clock size={12} className="text-amber-500" /> {secret.lastLoggedOut || 'Never'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    ) : activeTab === 'sessions' ? (
                        <motion.div 
                            key="sessions"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-950 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subscriber</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">IP Address</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Uptime</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Caller ID</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredSessions.map(session => (
                                        <tr key={session.id} className="hover:bg-slate-800/30 transition group">
                                            <td className="px-6 py-4">
                                                <div className="font-black text-white flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                                    {session.user}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase">{session.service}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-sky-400">{session.address}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-300">{session.uptime}</td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">{session.callerId || 'N/A'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => handleDisconnectSession(session.user)}
                                                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[10px] font-black uppercase transition"
                                                >
                                                    Kill Session
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSessions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold italic">No active PPPoE sessions found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </motion.div>
                    ) : activeTab === 'profiles' ? (
                        <motion.div 
                            key="profiles"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                            {profiles.map(profile => (
                                <div key={profile.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 hover:border-sky-500/30 transition">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="font-black text-white text-lg">{profile.name}</h3>
                                            <p className="text-xs text-slate-500">{profile.comment || 'No description'}</p>
                                        </div>
                                        <div className="p-3 bg-sky-500/10 rounded-2xl">
                                            <Settings className="text-sky-400" size={20} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rate Limit</span>
                                            <p className="text-sm font-black text-white">{profile.rateLimit || 'Unlimited'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DNS Server</span>
                                            <p className="text-sm font-black text-white">{profile.dnsServer || 'Dynamic'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Local Address</span>
                                            <p className="text-sm font-black text-white">{profile.localAddress || 'Auto'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Remote Address</span>
                                            <p className="text-sm font-black text-white">{profile.remoteAddress || 'Pool Default'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="requests"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-white text-lg">PPPoE Connection Requests & Applications</h3>
                                    <p className="text-xs text-slate-400">Approve pending applications to auto-provision PPPoE secrets on MikroTik</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const name = prompt("Enter customer full name:");
                                        const phone = prompt("Enter phone number:");
                                        const location = prompt("Enter home address / location:");
                                        if (name && phone && location) {
                                            axios.post('/api/v1/pppoe/requests', { routerId, fullName: name, phone, location, packageName: 'Fiber Home Standard' })
                                                .then(() => { setFeedback({ type: 'success', message: 'Test PPPoE request created!' }); fetchData(); })
                                                .catch(err => setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed' }));
                                        }
                                    }}
                                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black transition cursor-pointer"
                                >
                                    + Submit Test Request
                                </button>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-950 border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location / Contact</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Package</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {requests.map(req => (
                                        <tr key={req.id} className="hover:bg-slate-800/30 transition group">
                                            <td className="px-6 py-4">
                                                <div className="font-black text-white">{req.fullName}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">ID: {req.id.slice(0, 8)}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-bold text-slate-300">{req.location}</div>
                                                <div className="text-[10px] text-sky-400 font-mono">{req.phone} {req.email ? `• ${req.email}` : ''}</div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-emerald-400">{req.packageName || 'PPPoE Standard'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    req.status === 'PROVISIONED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    req.status === 'APPROVED' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                                    req.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                {req.status === 'PENDING' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApproveRequest(req.id)}
                                                            disabled={actionLoading}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase transition cursor-pointer shadow-lg shadow-emerald-600/20"
                                                        >
                                                            Approve & Provision
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectRequest(req.id)}
                                                            disabled={actionLoading}
                                                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-[10px] font-black uppercase transition cursor-pointer"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {req.status === 'PROVISIONED' && (
                                                    <span className="text-xs text-slate-500 font-mono">User: {req.pppoeUsername}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {requests.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold italic">No PPPoE connection requests found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Create Secret Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <form onSubmit={handleCreateSecret}>
                                <div className="p-6 border-b border-slate-800">
                                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                                        <Plus className="text-sky-400" /> Create PPPoE Secret
                                    </h2>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username / User ID</label>
                                        <div className="relative">
                                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                            <input 
                                                required
                                                type="text"
                                                value={newSecret.username}
                                                onChange={e => setNewSecret({...newSecret, username: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-sky-500 outline-none transition"
                                                placeholder="e.g. USER-001"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                            <input 
                                                required
                                                type="password"
                                                value={newSecret.password}
                                                onChange={e => setNewSecret({...newSecret, password: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-sky-500 outline-none transition"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Profile</label>
                                            <select 
                                                value={newSecret.profile}
                                                onChange={e => setNewSecret({...newSecret, profile: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:border-sky-500 outline-none transition"
                                            >
                                                {profiles.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Type</label>
                                            <select 
                                                value={newSecret.service}
                                                onChange={e => setNewSecret({...newSecret, service: e.target.value})}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:border-sky-500 outline-none transition"
                                            >
                                                <option value="pppoe">PPPoE</option>
                                                <option value="any">Any (PPP)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comment / Metadata</label>
                                        <textarea 
                                            value={newSecret.comment}
                                            onChange={e => setNewSecret({...newSecret, comment: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none transition resize-none"
                                            rows={2}
                                            placeholder="Notes about this subscriber..."
                                        />
                                    </div>
                                </div>
                                <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 py-3 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={actionLoading}
                                        className="flex-2 px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black uppercase transition flex items-center justify-center gap-2"
                                    >
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        Save Secret
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PPPoEManagement;
