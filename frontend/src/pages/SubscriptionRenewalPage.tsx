import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AlertTriangle, ShieldAlert, CheckCircle2, Lock, ArrowRight,
    RefreshCw, CreditCard, PhoneCall, HelpCircle, Building, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function SubscriptionRenewalPage() {
    const { user } = useAuth();
    const [subStatus, setSubStatus] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
    const [phoneNumber, setPhoneNumber] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchSubscriptionDetails();
    }, [user?.tenantId]);

    const fetchSubscriptionDetails = async () => {
        setIsLoading(true);
        try {
            const tenantId = user?.tenantId || localStorage.getItem('tenantId') || '';
            const statusUrl = tenantId ? `/api/v1/subscription/status?tenantId=${tenantId}` : '/api/v1/tenant/saas/subscription';
            const [statusRes, plansRes] = await Promise.all([
                axios.get(statusUrl).catch(() => ({ data: null })),
                axios.get('/api/v1/superadmin/saas/plans').catch(() => ({ data: [] }))
            ]);

            if (statusRes.data) setSubStatus(statusRes.data);
            
            const plansData = Array.isArray(plansRes.data) ? plansRes.data : plansRes.data?.plans;
            if (plansData) {

                setPlans(plansData);
                if (plansData.length > 0) setSelectedPlanId(plansData[0].id);
            }
        } catch (err: any) {
            console.error('Failed to load subscription details', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePayNow = async () => {
        if (!phoneNumber) {
            setPaymentMessage({ type: 'error', text: 'Please enter your M-Pesa phone number to renew.' });
            return;
        }

        setIsProcessing(true);
        setPaymentMessage(null);

        try {
            const tenantId = localStorage.getItem('tenantId') || subStatus?.subscription?.tenantId || '';
            const res = await axios.post('/api/v1/checkout/prepare', {
                tenantId,
                itemType: 'SUBSCRIPTION_PLAN',
                itemId: selectedPlanId,
                billingCycle,
                paymentMethod: 'MPESA',
                phoneNumber
            });

            if (res.data?.success) {
                setPaymentMessage({
                    type: 'success',
                    text: 'M-Pesa STK Push sent! Please check your phone and enter your M-Pesa PIN to complete renewal.'
                });
                setTimeout(() => {
                    fetchSubscriptionDetails();
                }, 5000);
            } else {
                setPaymentMessage({ type: 'error', text: res.data?.message || 'Payment initiation failed.' });
            }
        } catch (err: any) {
            setPaymentMessage({ type: 'error', text: err.response?.data?.error || err.message || 'Payment error occurred.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const selectedPlan = plans.find(p => p.id === selectedPlanId) || subStatus?.plan;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Glow Effect */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-4xl w-full space-y-8 relative z-10">
                {/* Status Header Banner */}
                <div className="p-6 bg-slate-900/90 border border-rose-500/30 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400 shrink-0">
                            <ShieldAlert className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-white">Access Temporarily Suspended</h1>
                                <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-xs font-black uppercase">
                                    {subStatus?.status || 'EXPIRED'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {subStatus?.statusMessage || 'Your subscription has expired. Please renew to restore full dashboard access.'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={fetchSubscriptionDetails}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
                    </button>
                </div>

                {/* Plan Selection & Payment Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left 2 Cols: Subscription Details & Plan Options */}
                    <div className="md:col-span-2 p-6 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-black text-white flex items-center gap-2">
                                <Building className="w-5 h-5 text-sky-400" /> Select Renewal Plan
                            </h2>
                            <div className="flex bg-slate-800 p-1 rounded-xl text-xs font-bold">
                                <button
                                    onClick={() => setBillingCycle('MONTHLY')}
                                    className={`px-3 py-1 rounded-lg transition ${billingCycle === 'MONTHLY' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setBillingCycle('YEARLY')}
                                    className={`px-3 py-1 rounded-lg transition ${billingCycle === 'YEARLY' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}
                                >
                                    Yearly (Save 17%)
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {plans.map((p) => {
                                const isSelected = p.id === selectedPlanId;
                                const priceCents = billingCycle === 'MONTHLY' ? p.monthlyPriceCents : p.yearlyPriceCents;
                                const priceKes = (priceCents / 100).toLocaleString();

                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedPlanId(p.id)}
                                        className={`p-5 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'bg-sky-950/40 border-sky-500 shadow-lg shadow-sky-500/10' : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-black text-sm text-white">{p.name}</h3>
                                            {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                                        </div>
                                        <p className="text-xs text-slate-400 mb-3">{p.description}</p>
                                        <p className="text-lg font-black text-white">
                                            KES {priceKes} <span className="text-xs text-slate-400 font-normal">/{billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right 1 Col: Instant Payment Summary */}
                    <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl space-y-6 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h3 className="text-base font-black text-white flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-400" /> Instant Renewal
                            </h3>

                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Plan Selected:</span>
                                    <strong className="text-white">{selectedPlan?.name || 'Starter ISP'}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Billing Cycle:</span>
                                    <strong className="text-white">{billingCycle}</strong>
                                </div>
                                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm">
                                    <span className="text-white">Amount Due:</span>
                                    <strong className="text-emerald-400">
                                        KES {(((billingCycle === 'MONTHLY' ? selectedPlan?.monthlyPriceCents : selectedPlan?.yearlyPriceCents) || 150000) / 100).toLocaleString()}
                                    </strong>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase">M-Pesa Phone Number</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 254712345678"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500"
                                />
                            </div>

                            {paymentMessage && (
                                <div className={`p-3 rounded-xl border text-xs font-semibold ${paymentMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                                    {paymentMessage.text}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pt-4">
                            <button
                                onClick={handlePayNow}
                                disabled={isProcessing}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                Pay & Reactivate Platform
                            </button>

                            <a
                                href="https://wa.me/254700000000?text=Hi%20Jevish%20Support,%20I%20need%20help%20renewing%20my%20subscription."
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition flex items-center justify-center gap-2"
                            >
                                <PhoneCall className="w-3.5 h-3.5" /> Contact Sales / Support
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
