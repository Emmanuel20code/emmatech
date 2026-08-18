import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/Common/BackButton';
import ThemeToggle from '../components/Common/ThemeToggle';
import JevishLogo from '../components/Common/JevishLogo';

const SuperAdminLogin = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await axios.post('/api/v1/auth/superadmin/login', {
                email: email.trim(),
                password: password.trim(),
                ip: window.location.hostname
            });

            const { token, user } = res.data;
            login(token, user);
            navigate('/superadmin');
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || 'Login failed');
            } else {
                setError('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
            {/* Nav Control */}
            <div className="absolute top-8 left-8 right-8 z-50 flex justify-between items-center">
                <BackButton to="/login" label="Back" variant="dark" />
                <ThemeToggle />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-[var(--bg-surface)] backdrop-blur-3xl border border-red-500/20 p-10 rounded-[3rem] shadow-2xl transition-colors duration-300">
                    <div className="text-center mb-10">
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="flex justify-center mb-6"
                        >
                            <JevishLogo size="lg" showText={false} />
                        </motion.div>
                        <motion.h1
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-black text-[var(--text-primary)] tracking-tight"
                        >
                            Super Admin Access
                        </motion.h1>
                        <motion.p
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-red-400 text-sm font-bold mt-2"
                        >
                            Restricted Platform Control
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mt-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center"
                        >
                            <div className="flex items-center justify-center gap-2 text-red-400 font-black text-sm mb-1">
                                <Lock size={16} />
                                <span>PERMANENT SECURE ACCOUNT</span>
                            </div>
                            <p className="text-red-300 text-xs font-bold">
                                Use your custom permanent Super Admin email and master password configured in platform settings.
                            </p>
                        </motion.div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-red-500/60 group-focus-within:text-red-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    placeholder="Super Admin Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-red-500/30 rounded-2xl py-4 pl-12 pr-6 text-[var(--text-primary)] text-sm font-semibold placeholder:text-red-600/60 focus:outline-none focus:border-red-500 focus:bg-[var(--bg-surface)] transition-all"
                                />
                            </div>
                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-red-500/60 group-focus-within:text-red-400 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="Master Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-red-500/30 rounded-2xl py-4 pl-12 pr-12 text-[var(--text-primary)] text-sm font-semibold placeholder:text-red-600/60 focus:outline-none focus:border-red-500 focus:bg-[var(--bg-surface)] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500/60 hover:text-red-400 transition-colors"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="text-red-400 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg"
                            >
                                {error}
                            </motion.p>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Authenticating...' : 'Enter Secure Zone'}
                            {!loading && <ArrowRight size={18} strokeWidth={3} />}
                        </motion.button>
                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/password-reset')}
                                className="text-xs font-bold text-red-400 hover:text-red-300 underline transition-colors"
                            >
                                Forgot Password? Reset via Email
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 text-center text-xs font-bold text-red-500/60">
                        Restricted Platform Access Only
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default SuperAdminLogin;
