import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Globe, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import BackButton from '../components/Common/BackButton';

const TenantSetup: React.FC = () => {
    const { user, login, token } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'creating' | 'success'>('idle');
    const [formData, setFormData] = useState({
        tenantName: '',
        subdomain: '',
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('creating');
        setError('');

        try {
            // Using /api/v1 prefix as standardized
            const response = await axios.post<{ tenant: { id: string } }>('/api/v1/admin/tenants/setup', formData);
            const { tenant } = response.data;

            // Update user in context with the new tenantId
            if (user && token) {
                login(token, { ...user, tenantId: tenant.id });
                setStatus('success');
                setTimeout(() => {
                    navigate('/tenant');
                }, 1500);
            }
        } catch (err: unknown) {
            let errorMsg = 'Failed to create workspace. Please try again.';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMsg = err.response.data.error;
            }
            setError(errorMsg);
            setStatus('idle');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Nav Control */}
            <div className="absolute top-8 left-8 z-50">
                <BackButton to="/login" label="Back to Login" variant="light" />
            </div>

            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[60%] bg-sky-500/10 rounded-full blur-[100px]"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="w-full max-w-2xl relative z-10"
            >
                <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/50">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="bg-sky-500/10 p-10 text-white flex flex-col justify-between relative border-r border-white/5 order-last md:order-first">
                            <div className="relative z-10">
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="w-20 h-20 mb-8 drop-shadow-2xl"
                                >
                                    <img src={logo} alt="Jevish" className="w-full h-full object-contain" />
                                </motion.div>
                                <h1 className="text-3xl font-black mb-4 tracking-tight">One Last Step</h1>
                                <p className="text-slate-400 text-lg leading-relaxed font-medium">
                                    You don't have an active workspace yet. Let's create your Jevish Command Center.
                                </p>
                            </div>

                            <div className="mt-8 space-y-4 relative z-10">
                                <div className="flex items-center gap-3 text-sm text-sky-400/80 font-bold uppercase tracking-widest">
                                    <Shield className="w-4 h-4" />
                                    <span>Secure Platform</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-sky-400/80 font-bold uppercase tracking-widest">
                                    <Globe className="w-4 h-4" />
                                    <span>Global Network</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 lg:p-12 bg-black/20">
                            <AnimatePresence mode="wait">
                                {status === 'success' ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="h-full flex flex-col items-center justify-center text-center py-8"
                                    >
                                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/30">
                                            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                                        </div>
                                        <h2 className="text-2xl font-black text-white mb-2">Workspace Active!</h2>
                                        <p className="text-slate-400 font-medium text-sm">Synchronizing your dashboard...</p>
                                    </motion.div>
                                ) : (
                                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="mb-8">
                                            <h2 className="text-2xl font-black text-white tracking-tight">Create Workspace</h2>
                                            <p className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-wider">Initialization Flow</p>
                                        </div>

                                        <form onSubmit={handleSubmit} className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Organization Name</label>
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="e.g. Skyline Networks"
                                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-4 px-6 text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                                                    value={formData.tenantName}
                                                    onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Custom Subdomain</label>
                                                <div className="relative group">
                                                    <input
                                                        required
                                                        type="text"
                                                        placeholder="skyline"
                                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-4 pl-6 pr-28 text-white text-sm font-semibold placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                                                        value={formData.subdomain}
                                                        onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-xs uppercase border-l border-slate-700 pl-4">
                                                        .jevish.site
                                                    </div>
                                                </div>
                                            </div>

                                            {error && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center"
                                                >
                                                    {error}
                                                </motion.div>
                                            )}

                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                disabled={loading}
                                                type="submit"
                                                className="w-full bg-sky-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-sky-400 transition-all disabled:opacity-50 group shadow-xl shadow-sky-500/20"
                                            >
                                                {loading ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        Initialize Workspace <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                    </>
                                                )}
                                            </motion.button>
                                        </form>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <p className="text-center text-slate-600 text-[10px] font-black uppercase tracking-widest mt-10">
                    Jevish Production Cloud v3.0 • Automated Provisioning Engine
                </p>
            </motion.div>
        </div>
    );
};

export default TenantSetup;
