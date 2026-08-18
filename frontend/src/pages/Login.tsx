import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth, type User } from '../context/AuthContext';
import JevishLogo from '../components/Common/JevishLogo';
import SupportButton from '../components/Common/SupportButton';
import BackButton from '../components/Common/BackButton';
import ThemeToggle from '../components/Common/ThemeToggle';
import InstallAppButton from '../components/Common/InstallAppButton';

const Login = () => {
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
            const res = await axios.post<{ token: string; user: User }>('/api/v1/auth/login', { email: email.trim().toLowerCase(), password });
            const { token, user } = res.data;

            login(token, user);

            if (user.role === 'SUPER_ADMIN') {
                setError('Security restriction: SuperAdmin accounts are not allowed to log in via the Tenant login portal. Please use the secure administrator endpoint.');
                return;
            } else if (user.role === 'TENANT') {
                navigate('/tenant');
            } else if (user.role === 'STAFF') {
                navigate('/admin');
            } else {
                navigate('/tenant');
            }
        } catch (err: unknown) {
            let errorMsg = 'Invalid credentials. Please try again.';
            if (axios.isAxiosError(err)) {
                if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
                    errorMsg = err.response.data.details.map((d: any) => d.msg).join('. ');
                } else if (err.response?.data?.error) {
                    errorMsg = err.response.data.error;
                }
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
            {/* Nav Control */}
            <div className="absolute top-8 left-8 right-8 z-50 flex justify-between items-center">
                <BackButton to="/" label="Back to Home" variant="dark" />
                <ThemeToggle />
            </div>

            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[60%] bg-sky-500/10 rounded-full blur-[100px]"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-[var(--bg-surface)] backdrop-blur-3xl border border-[var(--border-subtle)] p-10 rounded-[3rem] shadow-2xl transition-colors duration-300">
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
                            Tenant Sign In
                        </motion.h1>
                        <motion.p
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-[var(--text-secondary)] text-sm font-medium mt-2"
                        >
                            Sign in to your WiFi Tenant Workspace
                        </motion.p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    placeholder="Tenant Account Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl py-4 pl-12 pr-6 text-[var(--text-primary)] text-sm font-semibold placeholder:text-[var(--text-muted)] focus:outline-none focus:border-sky-500 focus:bg-[var(--bg-surface)] transition-all"
                                />
                            </div>
                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl py-4 pl-12 pr-12 text-[var(--text-primary)] text-sm font-semibold placeholder:text-[var(--text-muted)] focus:outline-none focus:border-sky-500 focus:bg-[var(--bg-surface)] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--text-primary)] transition-colors"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => navigate('/password-reset')}
                                className="text-sky-400 hover:text-sky-300 text-xs font-bold transition-colors"
                            >
                                Forgot Password?
                            </button>
                        </div>

                        {error && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="text-rose-400 text-xs font-bold text-center bg-rose-500/10 p-3 rounded-xl border border-rose-500/20"
                            >
                                {error}
                            </motion.p>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-sky-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-sky-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 text-sm"
                        >
                            {loading ? 'Authenticating Tenant Account...' : 'Sign In to Tenant Workspace'}
                            {!loading && <ArrowRight size={18} strokeWidth={3} />}
                        </motion.button>
                    </form>

                    <div className="mt-8 text-center space-y-4">
                        <p className="text-[var(--text-secondary)] text-xs font-bold">
                            Don't have a tenant account yet?{' '}
                            <button
                                onClick={() => navigate('/register')}
                                className="text-sky-500 hover:text-sky-400 underline transition-colors"
                            >
                                Register Tenant
                            </button>
                        </p>
                        <p className="text-[var(--text-secondary)] text-xs font-bold mt-2">
                            Platform Owner?{' '}
                            <button
                                onClick={() => navigate('/superadmin/login')}
                                className="text-amber-500 hover:text-amber-400 underline transition-colors"
                            >
                                Super Admin Login
                            </button>
                        </p>

                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest pt-4 mb-4">
                            Jevish Production Cloud v3.0
                        </p>
                        
                        <div className="flex justify-center mt-2">
                            <InstallAppButton />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Floating Contact Toggle */}
            <SupportButton />
        </div>
    );
};

export default Login;
