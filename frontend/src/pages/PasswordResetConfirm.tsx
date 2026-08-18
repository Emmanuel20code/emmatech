import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle, ShieldCheck, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import logo from '../assets/logo.png';
import BackButton from '../components/Common/BackButton';

const PasswordResetConfirm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const emailParam = searchParams.get('email');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Missing or invalid reset token. Please request a new link or code.');
        }
    }, [token]);

    // Password Policy Checks
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

    // Strength Meter Calculation
    const getStrengthScore = () => {
        let score = 0;
        if (hasMinLength) score++;
        if (hasUppercase) score++;
        if (hasLowercase) score++;
        if (hasNumber) score++;
        if (hasSpecialChar) score++;
        return score;
    };

    const strengthScore = getStrengthScore();
    const strengthLabel = strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Medium' : 'Strong';
    const strengthColor = strengthScore <= 2 ? 'bg-rose-500' : strengthScore <= 4 ? 'bg-amber-500' : 'bg-emerald-500';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPasswordValid) {
            setError('Password does not meet all security policy requirements.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await axios.post('/api/v1/auth/password-reset/confirm', {
                token,
                email: emailParam,
                newPassword: password
            });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: unknown) {
            let errorMsg = 'Failed to reset password. Token may be expired.';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMsg = err.response.data.error;
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] text-center max-w-md w-full space-y-6"
                >
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="text-emerald-400" size={36} />
                    </div>
                    <h2 className="text-2xl font-black text-white">Password Updated!</h2>
                    <p className="text-slate-400 font-medium text-sm">
                        Your account password has been updated. A security confirmation email has been dispatched. Redirecting to sign in...
                    </p>
                    <motion.button
                        onClick={() => navigate('/login')}
                        className="w-full bg-sky-500 text-white font-black py-4 rounded-2xl hover:bg-sky-400 transition-colors"
                    >
                        Return to Sign In Now
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
            {/* Top Navigation */}
            <div className="absolute top-6 left-6 z-50">
                <BackButton to="/login" label="Cancel" variant="light" />
            </div>

            {/* Ambient Glow */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-sky-600/10 rounded-full blur-[140px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-slate-900/90 border border-slate-800 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl space-y-6">
                    
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <img src={logo} alt="Jevish" className="w-16 h-16 mx-auto mb-2" />
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Set New Password</h1>
                        <p className="text-slate-400 text-xs sm:text-sm">Create a strong, secure password for your account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* New Password Field */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Password</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-11 pr-12 text-white text-sm focus:outline-none focus:border-sky-500 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Password Strength Meter */}
                        {password && (
                            <div className="space-y-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Password Strength:</span>
                                    <strong className={`font-bold ${strengthScore <= 2 ? 'text-rose-400' : strengthScore <= 4 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {strengthLabel}
                                    </strong>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                                    <div className={`h-full transition-all duration-300 ${strengthColor}`} style={{ width: `${(strengthScore / 5) * 100}%` }} />
                                </div>

                                {/* Checklist */}
                                <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px]">
                                    <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {hasMinLength ? <Check size={12} /> : <X size={12} />} 8+ Characters
                                    </div>
                                    <div className={`flex items-center gap-1 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {hasUppercase ? <Check size={12} /> : <X size={12} />} Uppercase (A-Z)
                                    </div>
                                    <div className={`flex items-center gap-1 ${hasLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {hasLowercase ? <Check size={12} /> : <X size={12} />} Lowercase (a-z)
                                    </div>
                                    <div className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {hasNumber ? <Check size={12} /> : <X size={12} />} Number (0-9)
                                    </div>
                                    <div className={`flex items-center gap-1 ${hasSpecialChar ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {hasSpecialChar ? <Check size={12} /> : <X size={12} />} Special (!@#$)
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Confirm Password Field */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirm New Password</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-sky-500 transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading || !isPasswordValid || password !== confirmPassword}
                            className="w-full py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50 min-h-[44px]"
                        >
                            {loading ? 'Updating Password...' : 'Save New Password & Log In'}
                            <ShieldCheck className="w-4 h-4" />
                        </motion.button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default PasswordResetConfirm;
