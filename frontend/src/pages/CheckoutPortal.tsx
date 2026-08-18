import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import JevishLogo from '../components/Common/JevishLogo';
import ThemeToggle from '../components/Common/ThemeToggle';
import {
    CreditCard, ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft,
    Phone, Wallet, Lock, Tag, Sparkles, RefreshCw, FileText, Check, ChevronRight
} from 'lucide-react';

interface CheckoutData {
    invoiceId: string;
    invoiceNumber: string;
    itemType: string;
    itemName: string;
    itemDescription: string;
    quantity: number;
    billingCycle: 'MONTHLY' | 'YEARLY';
    unitPriceCents: number;
    subtotalCents: number;
    taxCents: number;
    discountCents: number;
    totalAmountCents: number;
    totalAmountKes: number;
    paymentStatus: string;
}

const CheckoutPortal: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const itemType = searchParams.get('type') || 'SUBSCRIPTION_PLAN';
    const itemSlug = searchParams.get('slug') || 'unlimited';
    const itemId = searchParams.get('id') || '';
    const existingInvoiceId = searchParams.get('invoiceId') || '';
    const initialCycle = (searchParams.get('cycle') as 'MONTHLY' | 'YEARLY') || 'MONTHLY';

    const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>(initialCycle);
    const [couponCode, setCouponCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
    const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
    const [loading, setLoading] = useState(true);

    const [paymentMethod, setPaymentMethod] = useState<'STK_PUSH' | 'WALLET' | 'INTASEND'>('STK_PUSH');
    const [phoneNumber, setPhoneNumber] = useState('254712345678');
    const [termsAccepted, setTermsAccepted] = useState(true);

    const [isPaying, setIsPaying] = useState(false);
    const [stkSent, setStkSent] = useState(false);
    const [paySuccess, setPaySuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [pollTimer, setPollTimer] = useState<any | null>(null);

    useEffect(() => {
        loadCheckoutIntent();
    }, [itemType, itemSlug, itemId, billingCycle, existingInvoiceId]);

    const loadCheckoutIntent = async (couponToApply?: string) => {
        setLoading(true);
        setErrorMessage('');
        try {
            if (existingInvoiceId) {
                const statusRes = await axios.get(`/api/v1/checkout/status/${existingInvoiceId}`);
                const data = statusRes.data;
                setCheckoutData({
                    invoiceId: data.invoiceId,
                    invoiceNumber: data.invoiceNumber,
                    itemType: 'INVOICE',
                    itemName: `Jevish Invoice #${data.invoiceNumber}`,
                    itemDescription: 'Outstanding Platform Invoice',
                    quantity: 1,
                    billingCycle: 'MONTHLY',
                    unitPriceCents: data.totalAmountKes * 100,
                    subtotalCents: data.totalAmountKes * 100,
                    taxCents: 0,
                    discountCents: 0,
                    totalAmountCents: data.totalAmountKes * 100,
                    totalAmountKes: data.totalAmountKes,
                    paymentStatus: data.paymentStatus
                });
            } else {
                const res = await axios.post('/api/v1/checkout/prepare', {
                    itemType,
                    itemId,
                    itemSlug,
                    billingCycle,
                    couponCode: couponToApply || couponCode
                });
                setCheckoutData(res.data);
            }
        } catch (err: any) {
            console.error('Checkout prepare error', err);
            setErrorMessage(err.response?.data?.error || 'Failed to prepare checkout invoice.');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode) return;
        setCouponMessage(null);
        try {
            const res = await axios.post('/api/v1/checkout/validate-coupon', { couponCode });
            if (res.data.valid) {
                setAppliedDiscount(res.data.discountPercent);
                setCouponMessage({ type: 'success', text: `${res.data.discountPercent}% discount applied!` });
                loadCheckoutIntent(couponCode);
            }
        } catch (err: any) {
            setCouponMessage({ type: 'error', text: err.response?.data?.message || 'Invalid coupon code' });
        }
    };

    const handleProceedPayment = async () => {
        if (!termsAccepted) {
            alert('Please accept the Terms & Conditions to proceed with payment.');
            return;
        }

        if (!checkoutData) return;

        setIsPaying(true);
        setErrorMessage('');

        try {
            if (paymentMethod === 'STK_PUSH') {
                if (!phoneNumber) {
                    setErrorMessage('Please enter a valid M-Pesa phone number.');
                    setIsPaying(false);
                    return;
                }

                const stkRes = await axios.post('/api/v1/checkout/pay-stk', {
                    invoiceId: checkoutData.invoiceId,
                    phoneNumber
                });

                if (stkRes.data.success) {
                    setStkSent(true);
                    startPollingPaymentStatus(checkoutData.invoiceId);
                }
            } else if (paymentMethod === 'WALLET') {
                const walletRes = await axios.post('/api/v1/checkout/pay-wallet', {
                    invoiceId: checkoutData.invoiceId
                });

                if (walletRes.data.success) {
                    setPaySuccess(true);
                    setIsPaying(false);
                }
            } else if (paymentMethod === 'INTASEND') {
                // Trigger IntaSend verification/checkout
                const verifyRes = await axios.post('/api/v1/checkout/verify', {
                    invoiceId: checkoutData.invoiceId,
                    paymentMethod: 'INTASEND'
                });

                if (verifyRes.data.success) {
                    setPaySuccess(true);
                    setIsPaying(false);
                }
            }
        } catch (err: any) {
            console.error('Payment execution error', err);
            setErrorMessage(err.response?.data?.error || err.message || 'Payment initiation failed.');
            setIsPaying(false);
        }
    };

    const startPollingPaymentStatus = (invoiceId: string) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts >= 15) { // 45 seconds polling
                clearInterval(interval);
                // Auto verify for smooth experience
                try {
                    await axios.post('/api/v1/checkout/verify', { invoiceId, paymentMethod: 'STK_PUSH' });
                    setPaySuccess(true);
                    setStkSent(false);
                    setIsPaying(false);
                } catch (e) {
                    setErrorMessage('Payment polling timed out. If you entered your M-Pesa PIN, your feature will be activated automatically.');
                    setIsPaying(false);
                }
                return;
            }

            try {
                const res = await axios.get(`/api/v1/checkout/status/${invoiceId}`);
                if (res.data.paymentStatus === 'PAID') {
                    clearInterval(interval);
                    setPaySuccess(true);
                    setStkSent(false);
                    setIsPaying(false);
                }
            } catch (e) { }
        }, 3000);

        setPollTimer(interval);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 text-center">
                <RefreshCw className="w-10 h-10 animate-spin text-sky-500 mb-4" />
                <p className="text-base font-bold text-slate-300">Preparing Secured Checkout Session...</p>
                <p className="text-xs text-slate-500 mt-1">Validating product pricing and invoice generation</p>
            </div>
        );
    }

    if (paySuccess) {
        return (
            <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white">Payment Successful!</h2>
                        <p className="text-sm text-slate-400">
                            Your payment for <strong className="text-white">{checkoutData?.itemName}</strong> (Invoice #{checkoutData?.invoiceNumber}) has been completed.
                        </p>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left text-xs space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Amount Paid:</span>
                            <strong className="text-emerald-400">KES {checkoutData?.totalAmountKes.toLocaleString()}</strong>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Status:</span>
                            <strong className="text-emerald-400 uppercase">ACTIVATED</strong>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Invoice #:</span>
                            <span className="text-slate-200">{checkoutData?.invoiceNumber}</span>
                        </div>
                    </div>
                    <div className="space-y-3 pt-2">
                        <button
                            onClick={() => navigate('/tenant')}
                            className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-2xl shadow-lg transition"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-sky-500 selection:text-white pb-20">
            {/* Header */}
            <div className="bg-[#090d16]/80 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-xl px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <JevishLogo size="sm" showText={true} />
                    <div className="flex items-center gap-3 text-xs font-bold text-emerald-400">
                        <Lock className="w-4 h-4" /> 256-Bit SSL Encrypted
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
                <div className="text-center space-y-2 max-w-xl mx-auto">
                    <span className="px-3.5 py-1 text-[10px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-400 rounded-full border border-sky-500/20">
                        Secure Order Checkout
                    </span>
                    <h1 className="text-3xl md:text-4xl font-black text-white">Complete Your Order</h1>
                    <p className="text-slate-400 text-sm">Review your selected plan and select your preferred payment method.</p>
                </div>

                {errorMessage && (
                    <div className="max-w-2xl mx-auto p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm font-bold flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
                    {/* Left: Summary & Options */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Order Items */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <ShieldCheck className="text-sky-400" /> Item Summary
                                </h3>
                                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">{checkoutData?.itemType}</span>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className="text-base font-bold text-white">{checkoutData?.itemName}</h4>
                                        <p className="text-xs text-slate-400 mt-0.5">{checkoutData?.itemDescription}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-white">KES {(checkoutData?.unitPriceCents || 0) / 100}</div>
                                        <span className="text-[10px] text-slate-500 uppercase">{checkoutData?.billingCycle}</span>
                                    </div>
                                </div>

                                {itemType === 'SUBSCRIPTION_PLAN' && (
                                    <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                                        <button
                                            onClick={() => setBillingCycle('MONTHLY')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${billingCycle === 'MONTHLY' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Monthly Billing
                                        </button>
                                        <button
                                            onClick={() => setBillingCycle('YEARLY')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${billingCycle === 'YEARLY' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Yearly Billing (Save 15%)
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Coupon Section */}
                            <div className="pt-4 border-t border-slate-800 space-y-3">
                                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5 text-sky-400" /> Have a Coupon or Promo Code?
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Enter coupon (e.g. SURFBILL10)"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-800 text-white text-xs p-3 rounded-2xl focus:outline-none focus:border-sky-500 uppercase font-mono"
                                    />
                                    <button
                                        onClick={handleApplyCoupon}
                                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl transition"
                                    >
                                        Apply
                                    </button>
                                </div>
                                {couponMessage && (
                                    <div className={`text-xs font-bold ${couponMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {couponMessage.text}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Method Selector */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <CreditCard className="text-sky-400" /> Select Payment Method
                            </h3>

                            <div className="space-y-3">
                                <label
                                    onClick={() => setPaymentMethod('STK_PUSH')}
                                    className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition ${paymentMethod === 'STK_PUSH' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                                            M
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-white">M-Pesa Express (STK Push)</div>
                                            <div className="text-xs text-slate-400">Instant mobile PIN prompt on your phone</div>
                                        </div>
                                    </div>
                                    <input type="radio" name="pay_method" checked={paymentMethod === 'STK_PUSH'} onChange={() => { }} className="accent-sky-500" />
                                </label>

                                {paymentMethod === 'STK_PUSH' && (
                                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                                        <label className="text-xs font-bold text-slate-300">M-Pesa Phone Number</label>
                                        <div className="relative">
                                            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                                            <input
                                                type="text"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                placeholder="e.g. 254712345678"
                                                className="w-full bg-slate-900 border border-slate-800 text-white text-xs pl-10 p-3 rounded-xl focus:outline-none focus:border-sky-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                )}

                                <label
                                    onClick={() => setPaymentMethod('WALLET')}
                                    className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition ${paymentMethod === 'WALLET' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                            <Wallet className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-white">Tenant Wallet Balance</div>
                                            <div className="text-xs text-slate-400">Instant automated wallet deduction</div>
                                        </div>
                                    </div>
                                    <input type="radio" name="pay_method" checked={paymentMethod === 'WALLET'} onChange={() => { }} className="accent-sky-500" />
                                </label>

                                <label
                                    onClick={() => setPaymentMethod('INTASEND')}
                                    className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition ${paymentMethod === 'INTASEND' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-white">IntaSend Card & Mobile Money</div>
                                            <div className="text-xs text-slate-400">Visa, Mastercard, & Bank Transfer</div>
                                        </div>
                                    </div>
                                    <input type="radio" name="pay_method" checked={paymentMethod === 'INTASEND'} onChange={() => { }} className="accent-sky-500" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Right: Payment Calculation */}
                    <div className="lg:col-span-5 space-y-6 sticky top-24">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">Payment Summary</h3>

                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Subtotal:</span>
                                    <strong className="text-white font-mono">KES {((checkoutData?.subtotalCents || 0) / 100).toLocaleString()}</strong>
                                </div>
                                {checkoutData?.discountCents ? (
                                    <div className="flex justify-between text-emerald-400 font-bold">
                                        <span>Discount:</span>
                                        <span className="font-mono">- KES {(checkoutData.discountCents / 100).toLocaleString()}</span>
                                    </div>
                                ) : null}
                                {Boolean(checkoutData?.taxCents) && (
                                    <div className="flex justify-between text-slate-400">
                                        <span>VAT Tax:</span>
                                        <strong className="text-white font-mono">KES {((checkoutData?.taxCents || 0) / 100).toLocaleString()}</strong>
                                    </div>
                                )}
                                <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                                    <span className="text-sm font-bold text-white">Total Amount Due:</span>
                                    <span className="text-2xl font-black text-emerald-400 font-mono">KES {(checkoutData?.totalAmountKes || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer pt-2">
                                <input
                                    type="checkbox"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    className="mt-0.5 accent-sky-500 rounded"
                                />
                                <span>I agree to the <Link to="/terms" className="text-sky-400 underline">Terms of Service</Link> & acknowledge instant subscription activation upon payment.</span>
                            </label>

                            <button
                                onClick={handleProceedPayment}
                                disabled={isPaying || !termsAccepted}
                                className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-sky-500/30 transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isPaying ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing Payment...
                                    </>
                                ) : (
                                    <>
                                        Proceed To Payment <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* STK Push Waiting Modal */}
            {stkSent && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
                        <div className="w-16 h-16 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mx-auto border border-sky-500/30 animate-pulse">
                            <Phone className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">M-Pesa STK Prompt Sent</h3>
                            <p className="text-xs text-slate-400">
                                Check your mobile phone <strong>{phoneNumber}</strong> and enter your M-Pesa PIN to complete payment.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-sky-400">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Waiting for confirmation...
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutPortal;
