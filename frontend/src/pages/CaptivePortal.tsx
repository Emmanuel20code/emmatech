import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Wifi, Clock, Zap, ShieldCheck, CheckCircle2, AlertTriangle,
    Smartphone, Lock, RefreshCw, Key, HelpCircle, X, Info, Receipt, ArrowRight, Check
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import JevishLogo from '../components/Common/JevishLogo';

import type { Package } from '../types';

interface TenantConfig {
    id: string;
    name: string;
    logo?: string;
    logoUrl?: string;
    primaryColor?: string;
    contactPhone?: string;
    supportPhone?: string;
    supportEmail?: string;
    termsUrl?: string;
    subdomain?: string;
    welcomeMessage?: string;
    backgroundUrl?: string;
    packageCardLayout?: 'GRID_2COL' | 'GRID_3COL' | 'VERTICAL_LIST' | 'COMPACT_TILES' | 'HORIZONTAL_SCROLL';
    packageCardStyle?: 'GLASS' | 'SOLID' | 'OUTLINE' | 'GRADIENT_ACCENT';
    showPackageBadges?: boolean;
    showSpeedBadges?: boolean;
    landingHeroTitle?: string;
    landingHeroSubtitle?: string;
    showLandingHero?: boolean;
}

interface AdItem {
    id: string;
    headline?: string;
    subheading?: string;
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'GIF';
    destinationUrl?: string;
    buttonText?: string;
    placement?: 'TOP_BANNER' | 'SIDE_BANNER' | 'BOTTOM_BANNER' | 'SPONSORED_SECTION';
}

const CaptivePortal: React.FC<{ tenantIdOverride?: string }> = ({ tenantIdOverride }) => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [voucherCode, setVoucherCode] = useState('');
    const [receiptCode, setReceiptCode] = useState('');
    const [activeTab, setActiveTab] = useState<'MPESA' | 'RECEIPT' | 'VOUCHER'>('MPESA');
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'waiting_pin' | 'success' | 'failed'>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [successDetails, setSuccessDetails] = useState<any | null>(null);
    const [countdown, setCountdown] = useState<number>(60);
    const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
    
    // Ad Placement Slots
    const [topAds, setTopAds] = useState<AdItem[]>([]);
    const [sideAds, setSideAds] = useState<AdItem[]>([]);

    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
    const [couponMsg, setCouponMsg] = useState('');

    const params = useParams<{ tenantId?: string }>();
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        const initPortal = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const tenantId = tenantIdOverride || params.tenantId || urlParams.get('tenantId') || localStorage.getItem('tenantId') || 'primary';

            try {
                // 1. Fetch Tenant Configuration & Isolated Captive Portal Branding
                const brandingRes = await axios.get(`/api/v1/branding/tenant/${tenantId}`).catch(() => ({ data: null }));
                if (brandingRes.data) {
                    setTenantConfig(brandingRes.data);
                } else {
                    const configRes = await axios.get(`/api/v1/portal/${tenantId}/config`).catch(() => ({ data: null }));
                    if (configRes.data) setTenantConfig(configRes.data);
                }

                // 2. Fetch Active Packages
                const pkgRes = await axios.get(`/api/v1/portal/${tenantId}/packages`).catch(() => ({ data: [] }));
                const pkgData = Array.isArray(pkgRes.data) ? pkgRes.data : (Array.isArray((pkgRes.data as any)?.packages) ? (pkgRes.data as any).packages : []);
                setPackages(pkgData);
                
                // 3. Fetch Advertisements
                const deviceType = window.innerWidth >= 1024 ? 'DESKTOP' : window.innerWidth >= 768 ? 'TABLET' : 'MOBILE';
                axios.get(`/api/v1/portal/${tenantId}/ads?deviceType=${deviceType}`)
                    .then(adRes => {
                        if (Array.isArray(adRes.data) && adRes.data.length > 0) {
                            const allAds: AdItem[] = adRes.data;
                            setTopAds(allAds.filter(a => a.placement === 'TOP_BANNER' || !a.placement));
                            setSideAds(allAds.filter(a => a.placement === 'SIDE_BANNER'));
                        }
                    })
                    .catch(() => {});

                setLoading(false);
            } catch {
                setErrorMessage('Failed to connect to network portal services');
                setLoading(false);
            }
        };
        initPortal();
    }, [tenantIdOverride, params.tenantId]);

    // Countdown Timer during waiting_pin
    useEffect(() => {
        let timer: any = null;
        if (paymentStatus === 'waiting_pin' && countdown > 0) {
            timer = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        } else if (countdown === 0 && paymentStatus === 'waiting_pin') {
            setPaymentStatus('failed');
            setErrorMessage('STK Push timed out. If you already entered your PIN, you can verify via your M-Pesa SMS receipt code.');
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [paymentStatus, countdown]);

    const handlePackageSelect = (pkg: Package) => {
        setSelectedPackage(pkg);
        setShowPaymentModal(true);
        setPaymentStatus('idle');
        setErrorMessage('');
        setCountdown(60);
        setSuccessDetails(null);
    };

    const handleVerifyCoupon = async () => {
        if (!couponInput.trim()) return;
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tenantId = urlParams.get('tenantId') || localStorage.getItem('tenantId') || 'primary';
            const res = await axios.post(`/api/v1/portal/${tenantId}/verify-coupon`, { couponCode: couponInput });
            if (res.data.valid) {
                setAppliedCoupon(res.data);
                setCouponMsg(res.data.message);
            } else {
                setAppliedCoupon(null);
                setCouponMsg(res.data.message || 'Invalid promo code');
            }
        } catch (e: any) {
            setAppliedCoupon(null);
            setCouponMsg(e.response?.data?.message || 'Invalid promo code');
        }
    };

    const handleMpesaPayment = async () => {
        if (!selectedPackage) {
            setErrorMessage('Please select a package');
            return;
        }

        const rawPhone = phoneNumber.replace(/[^0-9]/g, '');
        if (!rawPhone || rawPhone.length < 9) {
            setErrorMessage('Please enter a valid Kenyan M-Pesa phone number (e.g. 0712345678)');
            return;
        }

        setPaymentStatus('processing');
        setErrorMessage('');
        setCountdown(60);

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tenantId = urlParams.get('tenantId') || localStorage.getItem('tenantId') || 'primary';
            const mac = urlParams.get('mac') || urlParams.get('client_mac') || '00:00:00:00:00:00';
            const ip = urlParams.get('ip') || urlParams.get('client_ip') || '127.0.0.1';
            let routerId = urlParams.get('routerId') || undefined;
            if (routerId === 'unknown') routerId = undefined;

            const response = await axios.post(`/api/v1/portal/${tenantId}/pay`, {
                phone: rawPhone,
                packageId: selectedPackage.id,
                mac,
                ip,
                routerId
            });

            setPaymentStatus('waiting_pin');
            pollPaymentStatus(response.data.paymentId);
        } catch (error: any) {
            const apiError = error.response?.data;
            let errorText = 'Payment initiation failed. Please verify your phone number.';
            if (apiError?.error) {
                errorText = apiError.error;
            }
            setPaymentStatus('failed');
            setErrorMessage(errorText);
        }
    };

    const handleVerifyReceipt = async () => {
        if (!receiptCode.trim() || receiptCode.trim().length < 6) {
            setErrorMessage('Please enter a valid M-Pesa transaction code (e.g. SDF9234K89)');
            return;
        }

        setPaymentStatus('processing');
        setErrorMessage('');

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tenantId = urlParams.get('tenantId') || localStorage.getItem('tenantId') || 'primary';
            const mac = urlParams.get('mac') || urlParams.get('client_mac') || '00:00:00:00:00:00';
            const ip = urlParams.get('ip') || urlParams.get('client_ip') || '127.0.0.1';
            const routerId = urlParams.get('routerId') || undefined;

            const res = await axios.post(`/api/v1/portal/${tenantId}/verify-receipt`, {
                receiptCode: receiptCode.trim().toUpperCase(),
                packageId: selectedPackage?.id,
                phone: phoneNumber,
                mac,
                ip,
                routerId
            });

            if (res.data?.success) {
                setPaymentStatus('success');
                setSuccessDetails({
                    receipt: receiptCode.trim().toUpperCase(),
                    message: res.data.message
                });
                triggerRedirection(res.data.credentials);
            } else {
                setPaymentStatus('failed');
                setErrorMessage(res.data?.error || 'Could not verify M-Pesa receipt code.');
            }
        } catch (err: any) {
            setPaymentStatus('failed');
            setErrorMessage(err.response?.data?.error || 'Verification failed. Please ensure the code is correct.');
        }
    };

    const handleVoucherLogin = async () => {
        if (!voucherCode.trim()) {
            setErrorMessage('Please enter your pre-paid voucher code');
            return;
        }

        setPaymentStatus('processing');
        setErrorMessage('');

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tenantId = urlParams.get('tenantId') || localStorage.getItem('tenantId') || 'primary';
            const res = await axios.post(`/api/v1/portal/${tenantId}/redeem-voucher`, { voucherCode: voucherCode.trim() });
            if (res.data?.success) {
                setPaymentStatus('success');
                setTimeout(() => {
                    window.location.href = res.data?.redirectUrl || 'https://www.google.com';
                }, 2000);
            } else {
                setPaymentStatus('failed');
                setErrorMessage(res.data?.message || 'Voucher invalid or already used.');
            }
        } catch (err: any) {
            setPaymentStatus('failed');
            setErrorMessage(err.response?.data?.message || 'Voucher authentication failed.');
        }
    };

    const triggerRedirection = (credentials?: { username: string; password?: string }) => {
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const linkLogin = urlParams.get('link-login');
            const linkOrig = urlParams.get('link-orig') || urlParams.get('dst') || 'https://www.google.com';

            if (linkLogin && credentials) {
                try {
                    const loginUrl = new URL(linkLogin);
                    loginUrl.searchParams.set('username', credentials.username);
                    if (credentials.password) {
                        loginUrl.searchParams.set('password', credentials.password);
                    }
                    loginUrl.searchParams.set('dst', linkOrig);
                    window.location.href = loginUrl.toString();
                    return;
                } catch {
                    // fallback
                }
            }
            window.location.href = linkOrig;
        }, 3000);
    };

    const pollPaymentStatus = async (currentPaymentId: string) => {
        let attempts = 0;
        const maxAttempts = 30;

        const pollInterval = setInterval(async () => {
            attempts++;
            try {
                const response = await axios.get(`/api/v1/portal/payment-status/${currentPaymentId}`);
                const data = response.data;
                const status = data.status;

                if (status === 'SUCCESS') {
                    clearInterval(pollInterval);
                    setPaymentStatus('success');
                    setSuccessDetails({
                        receipt: data.mpesaReceiptNumber,
                        amount: data.amount,
                        package: data.package
                    });
                    triggerRedirection(data.credentials);
                } else if (status === 'FAILED') {
                    clearInterval(pollInterval);
                    setPaymentStatus('failed');
                    setErrorMessage(data.failureReason || 'Payment was declined or cancelled on mobile.');
                } else if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    setPaymentStatus('failed');
                    setErrorMessage('STK Push timed out. If you paid, click "Verify M-Pesa Code" below.');
                }
            } catch (_) {}
        }, 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 bg-sky-500/20 rounded-3xl border border-sky-500/30 flex items-center justify-center shadow-2xl mb-4"
                >
                    <Wifi size={32} className="text-sky-400" />
                </motion.div>
                <h2 className="text-xl font-black tracking-tight">{tenantConfig?.name || 'Jevish'} Captive Portal</h2>
                <p className="text-xs text-sky-400 font-bold uppercase tracking-widest mt-2 animate-pulse">Initializing Network Access...</p>
            </div>
        );
    }

    const primaryColor = tenantConfig?.primaryColor || '#0284c7';

    return (
        <div
            className="min-h-screen bg-slate-950 text-white font-sans selection:bg-sky-500 relative overflow-x-hidden"
            style={{ '--tenant-primary': primaryColor } as any}
        >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-600/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-8 relative z-10">

                {/* 1. Header & Tenant Branding */}
                <header className="flex flex-col items-center text-center space-y-3">
                    <div className="flex justify-center mb-1">
                        {tenantConfig?.logoUrl ? (
                            <img src={tenantConfig.logoUrl} alt="Logo" className="h-14 sm:h-16 object-contain" />
                        ) : (
                            <JevishLogo variant="captive" size="lg" showText={false} />
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                            {tenantConfig?.name || 'Jevish'} <span className="text-sky-400">High-Speed Wi-Fi</span>
                        </h1>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1">
                            {tenantConfig?.welcomeMessage || 'Select an internet package below for instant network access.'}
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        Hotspot Online & Ready
                    </div>
                </header>

                {/* 2. Top Banner Advertisement Slot */}
                {topAds.length > 0 && (
                    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 text-[9px] font-black uppercase rounded">Sponsored</span>
                            <div>
                                <h4 className="text-xs font-bold text-white">{topAds[0].headline || 'Special Partner Promotion'}</h4>
                                <p className="text-[11px] text-slate-400">{topAds[0].subheading || 'Enjoy high-speed streaming on Jevish Hotspot.'}</p>
                            </div>
                        </div>
                        {topAds[0].destinationUrl && (
                            <a
                                href={topAds[0].destinationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded-xl transition shrink-0"
                            >
                                {topAds[0].buttonText || 'Learn More'}
                            </a>
                        )}
                    </div>
                )}

                {/* 3. Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                    
                    {/* Left 3 Columns: Packages Display Matrix */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-sky-400" /> Internet Packages
                                </h2>
                                <p className="text-xs text-slate-400">Choose a package tailored for your data and speed needs</p>
                            </div>
                            <span className="text-xs font-bold text-slate-500">{packages.length} Packages Available</span>
                        </div>

                        {/* Dynamic Package Grid Layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {packages.map((pkg, idx) => {
                                const isSelected = selectedPackage?.id === pkg.id;
                                const isPopular = idx === 1 || (pkg as any).isPopular;
                                const isRecommended = idx === 0;

                                return (
                                    <motion.div
                                        key={pkg.id}
                                        whileHover={{ y: -4 }}
                                        onClick={() => handlePackageSelect(pkg)}
                                        className={`p-5 rounded-3xl border cursor-pointer transition-all duration-300 relative flex flex-col justify-between overflow-hidden ${isSelected ? 'bg-sky-950/60 border-sky-500 shadow-xl shadow-sky-500/20 ring-2 ring-sky-400' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            {isPopular ? (
                                                <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] font-black uppercase rounded-full">
                                                    Popular Choice
                                                </span>
                                            ) : isRecommended ? (
                                                <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9px] font-black uppercase rounded-full">
                                                    Recommended
                                                </span>
                                            ) : <div />}

                                            {isSelected && <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />}
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <h3 className="text-base font-black text-white">{pkg.name}</h3>
                                            <p className="text-2xl font-black text-white">
                                                KES {pkg.price} <span className="text-xs text-slate-400 font-normal">/ {(pkg.durationMinutes || 60) >= 1440 ? `${Math.round((pkg.durationMinutes || 1440) / 1440)} Days` : `${Math.round((pkg.durationMinutes || 60) / 60)} Hrs`}</span>
                                            </p>

                                            <div className="space-y-1 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Speed Limit:</span>
                                                    <strong className="text-sky-400 font-bold">{pkg.speedLimit || '10 Mbps'}</strong>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Data Volume:</span>
                                                    <strong className="text-white font-bold">{pkg.dataLimitBytes ? `${Math.round(pkg.dataLimitBytes / (1024 * 1024 * 1024))} GB` : 'Unlimited Data'}</strong>
                                                </div>
                                            </div>

                                            {pkg.description && (
                                                <p className="text-[11px] text-slate-400 line-clamp-2 pt-1">{pkg.description}</p>
                                            )}
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePackageSelect(pkg);
                                            }}
                                            className={`w-full py-2.5 min-h-[44px] text-xs font-black uppercase tracking-wider rounded-xl transition ${isSelected ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                        >
                                            {isSelected ? 'Continue' : 'Select Package'}
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right 1 Column: Login & Alternative Connection Modes */}
                    <div className="space-y-6">
                        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
                            
                            {/* Tab Selection */}
                            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                                <button
                                    onClick={() => setActiveTab('MPESA')}
                                    className={`flex-1 py-2 rounded-xl transition ${activeTab === 'MPESA' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400'}`}
                                >
                                    M-Pesa STK
                                </button>
                                <button
                                    onClick={() => setActiveTab('RECEIPT')}
                                    className={`flex-1 py-2 rounded-xl transition ${activeTab === 'RECEIPT' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400'}`}
                                >
                                    Verify Code
                                </button>
                                <button
                                    onClick={() => setActiveTab('VOUCHER')}
                                    className={`flex-1 py-2 rounded-xl transition ${activeTab === 'VOUCHER' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400'}`}
                                >
                                    Voucher
                                </button>
                            </div>

                            {/* Tab 1: M-Pesa Info */}
                            {activeTab === 'MPESA' && (
                                <div className="space-y-4 text-center py-4">
                                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                                        <Smartphone className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white">Instant STK Push</h4>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        Select any package to trigger an automatic M-Pesa PIN prompt directly on your phone.
                                    </p>
                                </div>
                            )}

                            {/* Tab 2: Manual Receipt Code Verification */}
                            {activeTab === 'RECEIPT' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">M-Pesa Transaction Code</label>
                                        <div className="relative">
                                            <Receipt className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                placeholder="e.g. SDF78923KL"
                                                value={receiptCode}
                                                onChange={(e) => setReceiptCode(e.target.value.toUpperCase())}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-sky-500 uppercase"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic">Enter the 10-character code from your Safaricom M-Pesa SMS confirmation.</p>
                                    </div>

                                    {errorMessage && (
                                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold">
                                            {errorMessage}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleVerifyReceipt}
                                        disabled={paymentStatus === 'processing'}
                                        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 min-h-[44px]"
                                    >
                                        {paymentStatus === 'processing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Verify & Connect</>}
                                    </button>
                                </div>
                            )}

                            {/* Tab 3: Voucher Login */}
                            {activeTab === 'VOUCHER' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pre-paid Voucher Code</label>
                                        <div className="relative">
                                            <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                placeholder="Enter voucher code"
                                                value={voucherCode}
                                                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-sky-500 uppercase"
                                            />
                                        </div>
                                    </div>

                                    {errorMessage && (
                                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold">
                                            {errorMessage}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleVoucherLogin}
                                        disabled={paymentStatus === 'processing'}
                                        className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 min-h-[44px]"
                                    >
                                        {paymentStatus === 'processing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Redeem Voucher'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Side Banner Slot */}
                        {sideAds.length > 0 && (
                            <div className="hidden lg:block p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                                <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 text-[9px] font-black uppercase rounded">Featured Partner</span>
                                {sideAds[0].mediaUrl && (
                                    <img src={sideAds[0].mediaUrl} alt="Ad" className="w-full h-32 object-cover rounded-xl" />
                                )}
                                <h4 className="text-xs font-bold text-white">{sideAds[0].headline || 'Partner Promotion'}</h4>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="pt-8 border-t border-slate-900 pb-8 text-center text-xs text-slate-500">
                    <p>© {new Date().getFullYear()} {tenantConfig?.name || 'Jevish'}. All rights reserved.</p>
                </footer>
            </div>

            {/* Payment Modal Popup */}
            <AnimatePresence>
                {showPaymentModal && selectedPackage && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => paymentStatus === 'idle' || paymentStatus === 'failed' ? setShowPaymentModal(false) : null}
                            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl relative z-10"
                        >
                            {/* Modal Header */}
                            <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">M-Pesa STK Express</h3>
                                    <p className="text-xs text-slate-400 mt-1">{selectedPackage.name}</p>
                                </div>
                                <button 
                                    onClick={() => setShowPaymentModal(false)}
                                    disabled={paymentStatus === 'processing' || paymentStatus === 'waiting_pin'}
                                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition disabled:opacity-30"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 sm:p-8 space-y-6">
                                {paymentStatus === 'idle' || paymentStatus === 'failed' ? (
                                    <>
                                        <div className="p-5 bg-slate-950 border border-slate-800 rounded-3xl space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-400">Total Payable:</span>
                                                <span className="text-2xl font-black text-white">KES {selectedPackage.price}</span>
                                            </div>
                                            <div className="h-px bg-slate-800" />
                                            <div className="space-y-1 text-[11px] text-slate-400">
                                                <div className="flex justify-between">
                                                    <span>Duration:</span>
                                                    <span className="text-white font-bold">{(selectedPackage.durationMinutes || 60) >= 1440 ? `${Math.round((selectedPackage.durationMinutes || 1440) / 1440)} Days` : `${Math.round((selectedPackage.durationMinutes || 60) / 60)} Hours`}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Speed:</span>
                                                    <span className="text-sky-400 font-bold">{selectedPackage.speedLimit || '10 Mbps'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">M-Pesa Phone Number</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                                    <span className="text-xs font-black text-slate-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">🇰🇪 +254</span>
                                                </div>
                                                <input
                                                    type="tel"
                                                    autoFocus
                                                    placeholder="712345678 or 0712345678"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                    className="w-full pl-24 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-white text-base font-bold placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500 px-1">Ensure your phone is unlocked to input your M-Pesa PIN prompt.</p>
                                        </div>

                                        {errorMessage && (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3"
                                            >
                                                <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-rose-400 font-medium leading-relaxed">{errorMessage}</p>
                                            </motion.div>
                                        )}

                                        <button
                                            onClick={handleMpesaPayment}
                                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                        >
                                            Send STK Push Prompt
                                            <ArrowRight size={18} />
                                        </button>
                                    </>
                                ) : paymentStatus === 'processing' || paymentStatus === 'waiting_pin' ? (
                                    <div className="py-8 flex flex-col items-center text-center space-y-6">
                                        <div className="relative">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                className="w-24 h-24 rounded-full border-t-2 border-r-2 border-emerald-500"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Smartphone className="w-8 h-8 text-emerald-400 animate-pulse" />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <h4 className="text-lg font-black text-white">Check Your Phone Screen</h4>
                                            <p className="text-xs text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                                                Enter your <strong>M-Pesa PIN</strong> on the prompt sent to <strong>{phoneNumber}</strong> to authorize KES {selectedPackage.price}.
                                            </p>
                                        </div>

                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                            <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                                                Waiting for PIN... ({countdown}s)
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-2 pt-2">
                                            <button
                                                onClick={() => {
                                                    setPaymentStatus('idle');
                                                    setActiveTab('RECEIPT');
                                                }}
                                                className="text-sky-400 text-xs font-bold hover:underline"
                                            >
                                                Already entered PIN? Verify with SMS code
                                            </button>
                                            <button
                                                onClick={() => setPaymentStatus('idle')}
                                                className="text-slate-500 text-[10px] font-bold uppercase hover:text-slate-300 transition"
                                            >
                                                Cancel & Change Number
                                            </button>
                                        </div>
                                    </div>
                                ) : paymentStatus === 'success' ? (
                                    <div className="py-8 flex flex-col items-center text-center space-y-6">
                                        <motion.div
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30"
                                        >
                                            <Check size={40} className="text-slate-950 stroke-[3]" />
                                        </motion.div>
                                        
                                        <div className="space-y-1">
                                            <h4 className="text-2xl font-black text-white tracking-tight">Payment Verified!</h4>
                                            {successDetails?.receipt && (
                                                <p className="text-xs text-emerald-400 font-mono font-bold">M-Pesa Ref: {successDetails.receipt}</p>
                                            )}
                                            <p className="text-xs text-slate-400">Connected to high-speed internet.</p>
                                        </div>

                                        <div className="w-full p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 font-bold flex items-center justify-center gap-2">
                                            <Wifi className="w-4 h-4 animate-bounce" />
                                            Redirecting you to the web...
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CaptivePortal;
