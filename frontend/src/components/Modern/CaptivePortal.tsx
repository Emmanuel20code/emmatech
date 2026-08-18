import { useState, useEffect } from 'react';
import {
    Wifi,
    Smartphone,
    Zap,
    Clock,
    ShieldCheck,
    ChevronRight,
    Share2,
    Info,
    Smartphone as PhoneIcon,
    CreditCard,
    Wifi as WifiIcon
} from 'lucide-react';
import { Button } from '../Common/Button';
import { Card } from '../Common/Card.tsx';
import { Badge } from '../Common/Badge';
import axios from 'axios';

interface Package {
    id: string;
    name: string;
    price: number;
    durationMinutes: number;
    speedLimit: string;
    dataLimit?: string;
}

const CaptivePortal = () => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const res = await axios.get('/api/v1/admin/packages');
                const data = res.data;
                const list = Array.isArray(data) ? data : (data.packages || data.data || []);
                const mapped = list.map((p: any) => ({
                    id: String(p.id),
                    name: p.name,
                    price: p.price,
                    durationMinutes: p.validity ? p.validity * 1440 : 1440,
                    speedLimit: p.downloadSpeed ? `${p.downloadSpeed} Mbps` : '10 Mbps',
                    dataLimit: p.dataLimit || 'Unlimited'
                }));
                setPackages(mapped);
                if (mapped.length > 0) setSelectedPackage(mapped[0]);
            } catch (err) {
                console.error('Failed to load packages:', err);
                setPackages([]);
            } finally {
                setLoading(false);
            }
        };
        fetchPackages();
    }, []);

    const handlePayment = async () => {
        if (!selectedPackage || !phoneNumber) {
            alert('Please select a plan and enter your phone number');
            return;
        }

        setPaymentStatus('processing');

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tenantId = urlParams.get('tenantId') || localStorage.getItem('tenantId') || 'primary';
            const res = await axios.post(`/api/v1/portal/${tenantId}/pay`, {
                phone: phoneNumber.replace(/^0/, '254').replace(/^\+/, ''),
                packageId: selectedPackage.id,
                mac: '00:00:00:00:00:00',
                ip: '127.0.0.1'
            });

            if (res.data.success !== false) {
                setPaymentStatus('success');
                alert(`STK Push sent to ${phoneNumber} for KES ${selectedPackage.price}. Enter M-Pesa PIN to activate.`);
                setTimeout(() => {
                    setPaymentStatus('idle');
                    setSelectedPackage(null);
                    setPhoneNumber('');
                }, 3000);
            } else {
                throw new Error(res.data.message || 'Payment initiation failed');
            }
        } catch (err: any) {
            setPaymentStatus('error');
            alert(err.response?.data?.message || 'Payment failed. Please check your phone number and try again.');
            setTimeout(() => setPaymentStatus('idle'), 2000);
        }
    };

    const formatDuration = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes} minutes`;
        } else if (minutes < 1440) {
            return `${minutes / 60} hours`;
        } else {
            return `${minutes / 1440} days`;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto mb-4"></div>
                    <h2 className="text-white text-lg font-semibold">Authenticating Hub</h2>
                    <p className="text-white/60 text-sm mt-2">Please wait while we verify your connection</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 pt-12 pb-8 px-6">
                <div className="max-w-md mx-auto text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-6">
                        <Wifi className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">High-Speed Internet Access</h1>
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span>Jevish Hub Online</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 px-6 max-w-md mx-auto pb-24">
                <Card className="shadow-xl">
                    <div className="p-6">
                        {/* Plan Selection */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-slate-900">Choose Your Plan</h2>
                                <Badge variant="outline" className="text-xs">
                                    <Info className="w-3 h-3 mr-1" />
                                    Fast & Secure
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                {packages.map((pkg) => (
                                    <button
                                        key={pkg.id}
                                        onClick={() => setSelectedPackage(pkg)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${selectedPackage?.id === pkg.id
                                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${selectedPackage?.id === pkg.id
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {pkg.durationMinutes < 1440 ? (
                                                        <Clock className="w-5 h-5" />
                                                    ) : (
                                                        <Zap className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900">{pkg.name}</div>
                                                    <div className="text-sm text-slate-600">
                                                        {formatDuration(pkg.durationMinutes)} • {pkg.speedLimit}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-slate-500">KES</div>
                                                <div className="text-lg font-bold text-slate-900">{pkg.price}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Payment Form */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Mobile Number (M-Pesa)
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                                        <Smartphone className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="0712 345 678"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handlePayment}
                                disabled={!selectedPackage || !phoneNumber || paymentStatus === 'processing'}
                                className="w-full py-3 text-sm font-semibold"
                            >
                                {paymentStatus === 'processing' && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                )}
                                {paymentStatus === 'processing'
                                    ? 'Processing Payment...'
                                    : paymentStatus === 'success'
                                        ? 'Payment Successful!'
                                        : 'Activate Connection'
                                }
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>

                        {/* Features */}
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3">Features</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-green-500" />
                                    <span>Secure</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <WifiIcon className="w-4 h-4 text-blue-500" />
                                    <span>Fast</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <PhoneIcon className="w-4 h-4 text-purple-500" />
                                    <span>Mobile</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-orange-500" />
                                    <span>M-Pesa</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
                            <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
                                <button className="hover:text-slate-700 transition-colors">
                                    <Share2 className="w-4 h-4 inline mr-1" />
                                    Share Network
                                </button>
                                <span>•</span>
                                <button className="hover:text-slate-700 transition-colors">
                                    Fair Usage Policy
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Jevish v2.0 • Encrypted B2C</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default CaptivePortal;
