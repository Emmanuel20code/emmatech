import { useState } from 'react';
import { Mail, Send, Key, Shield, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from '../assets/logo.png';
import BackButton from '../components/Common/BackButton';

const PasswordResetRequest = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [resetType, setResetType] = useState<'LINK' | 'OTP'>('LINK');
    const [expiryMinutes, setExpiryMinutes] = useState<number>(60);
    const [otpCode, setOtpCode] = useState('');
    const [step, setStep] = useState<'REQUEST' | 'OTP_VERIFY'>('REQUEST');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await axios.post<{ message: string; success: boolean }>('/api/v1/auth/password-reset/request', {
                email,
                resetType,
                expiryMinutes
            });
            setMessage(res.data.message);

            if (resetType === 'OTP') {
                setStep('OTP_VERIFY');
            }
        } catch (err: unknown) {
            let errorMsg = 'Failed to process request. Please try again.';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMsg = err.response.data.error;
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await axios.post<{ valid: boolean; token?: string }>('/api/v1/auth/password-reset/verify-otp', {
                email,
                otpCode
            });

            if (res.data.valid && res.data.token) {
                navigate(`/reset-password?token=${encodeURIComponent(res.data.token)}&email=${encodeURIComponent(email)}`);
            }
        } catch (err: unknown) {
            let errorMsg = 'Invalid verification code. Please check and try again.';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMsg = err.response.data.error;
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
            {/* Top Navigation */}
            <div className="absolute top-6 left-6 z-50">
                <BackButton to="/login" label="Back to Login" variant="light" />
            </div>

            {/* Ambient Lighting */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-sky-600/10 rounded-full blur-[140px]" />
                <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[140px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-slate-900/90 border border-slate-800 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl space-y-8">
                    
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <img src={logo} alt="Jevish" className="w-16 h-16 mx-auto mb-2" />
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Account Recovery</h1>
                        <p className="text-slate-400 text-xs sm:text-sm">
                            {step === 'OTP_VERIFY' ? 'Enter the 6-digit verification code sent to your email' : 'Choose your recovery method to reset your password'}
                        </p>
                    </div>

                    {step === 'REQUEST' && (
                        <form onSubmit={handleRequestSubmit} className="space-y-6">
                            
                            {/* Recovery Type Switch */}
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setResetType('LINK')}
                                    className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${resetType === 'LINK' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                                >
                                    <Mail className="w-3.5 h-3.5" /> Email Link
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setResetType('OTP')}
                                    className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${resetType === 'OTP' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                                >
                                    <Key className="w-3.5 h-3.5" /> Verification Code (OTP)
                                </button>
                            </div>

                            {/* Email Input */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Email Address</label>
                                <div className="relative group">
                                    <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-sky-400 transition-colors" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="admin@yourisp.co.ke"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-white text-xs font-semibold focus:outline-none focus:border-sky-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Expiry Selector */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-sky-400" /> Link/Code Expiration Window
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[15, 30, 60].map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setExpiryMinutes(mins)}
                                            className={`py-2 rounded-xl text-xs font-bold border transition ${expiryMinutes === mins ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                                        >
                                            {mins} Mins
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {message && resetType === 'LINK' && (
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-semibold text-center space-y-1">
                                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                                    <p>{message}</p>
                                    <p className="text-[11px] text-slate-400 font-normal">Check your inbox for further instructions.</p>
                                </div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50 min-h-[44px]"
                            >
                                {loading ? 'Processing...' : resetType === 'OTP' ? 'Send Verification Code' : 'Send Recovery Link'}
                                <Send className="w-4 h-4" />
                            </motion.button>
                        </form>
                    )}

                    {step === 'OTP_VERIFY' && (
                        <form onSubmit={handleOtpVerify} className="space-y-6">
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-1 text-slate-300">
                                <p className="font-bold text-white">Verification Code Sent</p>
                                <p className="text-slate-400">A 6-digit verification code was sent to <strong className="text-sky-400">{email}</strong>.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">6-Digit Verification Code</label>
                                <div className="relative">
                                    <Key className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        placeholder="123456"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-white font-mono text-lg font-bold tracking-[0.4em] focus:outline-none focus:border-sky-500 text-center"
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
                                disabled={loading || otpCode.length < 6}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 min-h-[44px]"
                            >
                                {loading ? 'Verifying...' : 'Verify Code & Proceed'}
                                <ArrowRight className="w-4 h-4" />
                            </motion.button>

                            <button
                                type="button"
                                onClick={() => setStep('REQUEST')}
                                className="w-full text-center text-xs text-slate-400 hover:text-white transition"
                            >
                                Change Email or Request Method
                            </button>
                        </form>
                    )}

                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        <Shield className="w-3.5 h-3.5 text-emerald-500" />
                        Jevish Cryptographic Security
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default PasswordResetRequest;
