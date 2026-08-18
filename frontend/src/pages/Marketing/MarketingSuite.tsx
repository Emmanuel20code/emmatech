import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Radio, Globe, Zap, CreditCard, Users, FileText,
    BarChart3, Settings, Plus, Search, Filter, Play, Pause, Trash2, Edit3,
    Eye, MousePointer, Share2, Download, CheckCircle, AlertCircle, ArrowUpRight,
    Smartphone, Monitor, Tablet, RefreshCw, Upload, Image, Video, Sparkles, Code
} from 'lucide-react';
import axios from 'axios';

interface Campaign {
    id: string;
    name: string;
    campaignType: string;
    headline: string;
    buttonText: string;
    destinationUrl: string;
    status: string;
    priority: number;
    budget: number;
    createdAt: string;
}

interface MediaItem {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    thumbnailUrl: string;
}

const MarketingSuite: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Determine current sub-tab from path (e.g. /tenant/marketing/coupons -> 'coupons')
    const pathParts = location.pathname.split('/');
    const activeTab = pathParts[3] || 'dashboard';

    // State
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [coupons, setCoupons] = useState<any[]>([]);
    const [qrCampaigns, setQRCampaigns] = useState<any[]>([]);
    const [landingPages, setLandingPages] = useState<any[]>([]);
    const [segments, setSegments] = useState<any[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [showLandingModal, setShowLandingModal] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<'MOBILE' | 'TABLET' | 'DESKTOP'>('MOBILE');

    // New Campaign Form State
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        description: '',
        campaignType: 'IMAGE_BANNER',
        headline: '',
        subheading: '',
        buttonText: 'Learn More',
        destinationUrl: '',
        whatsappLink: '',
        ctaType: 'VISIT_WEBSITE',
        priority: 1,
        status: 'RUNNING',
        budget: 0,
        displayRules: ['BEFORE_LOGIN', 'AFTER_LOGIN']
    });

    // New Coupon Form
    const [newCoupon, setNewCoupon] = useState({
        couponCode: '',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        validityDays: 30,
        maxUses: 100
    });

    // New QR Form
    const [newQR, setNewQR] = useState({
        title: '',
        destinationType: 'WEBSITE',
        targetUrl: 'https://'
    });

    // New Landing Page Form
    const [newLanding, setNewLanding] = useState({
        title: '',
        headline: '',
        bodyContent: '',
        ctaButtonText: 'Claim Offer',
        ctaUrl: 'https://'
    });

    // Load Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const requests: Promise<any>[] = [];
            const keys: string[] = [];

            if (activeTab === 'dashboard' || !summary) {
                requests.push(axios.get('/api/v1/marketing/dashboard/summary', { headers }));
                keys.push('summary');
            }
            if (activeTab === 'campaigns' || activeTab === 'dashboard') {
                requests.push(axios.get('/api/v1/marketing/campaigns', { headers }));
                keys.push('campaigns');
            }
            if (activeTab === 'coupons') {
                requests.push(axios.get('/api/v1/marketing/coupons', { headers }));
                keys.push('coupons');
            }
            if (activeTab === 'qr-campaigns') {
                requests.push(axios.get('/api/v1/marketing/qr-campaigns', { headers }));
                keys.push('qr-campaigns');
            }
            if (activeTab === 'landing-pages') {
                requests.push(axios.get('/api/v1/marketing/landing-pages', { headers }));
                keys.push('landing-pages');
            }
            if (activeTab === 'customer-segments') {
                requests.push(axios.get('/api/v1/marketing/customer-segments', { headers }));
                keys.push('customer-segments');
            }

            const results = await Promise.allSettled(requests);
            results.forEach((res, index) => {
                const key = keys[index];
                if (res.status === 'fulfilled') {
                    if (key === 'summary') setSummary(res.value.data);
                    if (key === 'campaigns') setCampaigns(Array.isArray(res.value.data) ? res.value.data : []);
                    if (key === 'coupons') setCoupons(Array.isArray(res.value.data) ? res.value.data : []);
                    if (key === 'qr-campaigns') setQRCampaigns(Array.isArray(res.value.data) ? res.value.data : []);
                    if (key === 'landing-pages') setLandingPages(Array.isArray(res.value.data) ? res.value.data : []);
                    if (key === 'customer-segments') setSegments(Array.isArray(res.value.data) ? res.value.data : []);
                }
            });
        } catch (e: any) {
            // Safe fallback
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
            await axios.post('/api/v1/marketing/campaigns', newCampaign, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowCreateModal(false);
            fetchData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to create campaign');
        }
    };

    const handleCreateCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
            await axios.post('/api/v1/marketing/coupons', newCoupon, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowCouponModal(false);
            fetchData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to create coupon');
        }
    };

    const handleCreateQR = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
            await axios.post('/api/v1/marketing/qr-campaigns', newQR, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowQRModal(false);
            fetchData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to create QR campaign');
        }
    };

    const handleCreateLanding = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
            await axios.post('/api/v1/marketing/landing-pages', newLanding, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowLandingModal(false);
            fetchData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to create landing page');
        }
    };

    // Sub-tab Navigation
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'campaigns', label: 'Ad Campaigns', icon: Radio },
        { id: 'captive-ads', label: 'Captive Portal Ads', icon: Globe },
        { id: 'promotions', label: 'Promotions', icon: Zap },
        { id: 'coupons', label: 'Coupons', icon: CreditCard },
        { id: 'customer-segments', label: 'Customer Segments', icon: Users },
        { id: 'landing-pages', label: 'Landing Pages', icon: FileText },
        { id: 'qr-campaigns', label: 'QR Campaigns', icon: Radio },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600/10 text-blue-600 rounded-xl">
                            <Radio className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Captive Portal Marketing Hub</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Advertise on your captive portal, launch QR promotions & track CTR in real time
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                        <RefreshCw className={`w-4 h-4 inline mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Campaign
                    </button>
                </div>
            </div>

            {/* Sub Navigation Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
                {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(`/tenant/marketing/${item.id}`)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${isActive
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {/* ─── TAB 1: DASHBOARD ─── */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* Key Metric Widgets */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase">Running</span>
                            <div className="text-2xl font-bold mt-1 text-emerald-600">{summary?.runningCampaigns || 0}</div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase">Scheduled</span>
                            <div className="text-2xl font-bold mt-1 text-blue-600">{summary?.scheduledCampaigns || 0}</div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase">Impressions</span>
                            <div className="text-2xl font-bold mt-1">{summary?.todaysImpressions || 0}</div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase">Clicks</span>
                            <div className="text-2xl font-bold mt-1 text-indigo-600">{summary?.todaysClicks || 0}</div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase">CTR %</span>
                            <div className="text-2xl font-bold mt-1 text-purple-600">{summary?.ctr || 0}%</div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-xs font-semibold text-slate-400 uppercase">Revenue</span>
                            <div className="text-2xl font-bold mt-1 text-emerald-600">KES {summary?.revenueGenerated || 0}</div>
                        </div>
                    </div>

                    {/* Top Performing Ads & Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="text-lg font-bold mb-4">Top Performing Advertisements</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-500">
                                        <tr>
                                            <th className="p-3">Ad Name</th>
                                            <th className="p-3">Type</th>
                                            <th className="p-3">Impressions</th>
                                            <th className="p-3">Clicks</th>
                                            <th className="p-3">CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {summary?.topPerformingAds?.map((ad: any, idx: number) => (
                                            <tr key={ad.id || ad._id || `ad-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                                                <td className="p-3 font-semibold">{ad.name}</td>
                                                <td className="p-3"><span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600">{ad.campaignType}</span></td>
                                                <td className="p-3">{ad.impressions}</td>
                                                <td className="p-3">{ad.clicks}</td>
                                                <td className="p-3 font-bold text-emerald-600">{ad.ctr}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="text-lg font-bold mb-4">Recent Campaign Activity</h3>
                            <div className="space-y-4">
                                {summary?.recentActivity?.map((act: any, idx: number) => (
                                    <div key={act.id || act._id || `act-${idx}`} className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl text-xs space-y-1">
                                        <div className="font-medium text-slate-800 dark:text-slate-200">{act.action}</div>
                                        <div className="text-slate-400">{new Date(act.timestamp).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TAB 2: AD CAMPAIGNS ─── */}
            {activeTab === 'campaigns' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Active Advertisement Campaigns</h2>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
                        >
                            + Add Campaign
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-500">
                                <tr>
                                    <th className="p-3">Campaign Name</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Headline</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Priority</th>
                                    <th className="p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {campaigns.map((c, idx) => (
                                    <tr key={c.id || `c-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                                        <td className="p-3 font-semibold">{c.name}</td>
                                        <td className="p-3"><span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{c.campaignType}</span></td>
                                        <td className="p-3 text-slate-500">{c.headline || '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${c.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-3 font-medium">P{c.priority}</td>
                                        <td className="p-3">
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500"><Edit3 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── TAB 3: CAPTIVE PORTAL ADS PREVIEW SIMULATOR ─── */}
            {activeTab === 'captive-ads' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold">Captive Portal Live Ad Preview</h2>
                            <p className="text-sm text-slate-500">Test how advertisements look to users logging into your WiFi</p>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1.5 rounded-xl">
                            <button
                                onClick={() => setPreviewDevice('MOBILE')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${previewDevice === 'MOBILE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                <Smartphone className="w-4 h-4" /> Mobile
                            </button>
                            <button
                                onClick={() => setPreviewDevice('TABLET')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${previewDevice === 'TABLET' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                <Tablet className="w-4 h-4" /> Tablet
                            </button>
                            <button
                                onClick={() => setPreviewDevice('DESKTOP')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${previewDevice === 'DESKTOP' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                <Monitor className="w-4 h-4" /> Desktop
                            </button>
                        </div>
                    </div>

                    {/* Preview Screen */}
                    <div className="flex justify-center p-8 bg-slate-900 rounded-2xl border border-slate-800">
                        <div className={`bg-slate-800 rounded-3xl p-4 shadow-2xl transition-all duration-300 border-4 border-slate-700 ${previewDevice === 'MOBILE' ? 'w-[360px]' : previewDevice === 'TABLET' ? 'w-[600px]' : 'w-[900px]'
                            }`}>
                            <div className="bg-slate-900 p-6 rounded-2xl text-slate-100 space-y-4 text-center">
                                <div className="text-xl font-bold text-blue-400">Jevish WiFi Portal</div>

                                {/* Banner Ad Preview */}
                                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">Sponsored Ad</span>
                                    <div className="font-bold text-lg">Special Discount Package!</div>
                                    <div className="text-xs text-blue-100">Get 50% off on all Unlimited 24hr WiFi passes today.</div>
                                    <button className="mt-2 px-4 py-1.5 text-xs font-bold bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition">
                                        Claim Coupon Now
                                    </button>
                                </div>

                                <div className="p-4 bg-slate-800 rounded-xl space-y-3 text-left">
                                    <div className="text-sm font-semibold">Enter your Phone Number:</div>
                                    <input type="text" placeholder="0712345678" className="w-full px-3 py-2 text-sm bg-slate-700 rounded-lg border border-slate-600 text-white" readOnly />
                                    <button className="w-full py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg">Connect to Internet</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TAB 4: COUPONS ─── */}
            {activeTab === 'coupons' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Marketing Coupons & Promo Codes</h2>
                        <button
                            onClick={() => setShowCouponModal(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
                        >
                            + Generate Coupon
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {coupons.map((c, idx) => (
                            <div key={c.id || c.couponCode || `coup-${idx}`} className="p-5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xl font-extrabold text-blue-600 font-mono tracking-widest">{c.couponCode}</span>
                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">{c.status}</span>
                                </div>
                                <div className="text-sm text-slate-500">
                                    Discount: <strong className="text-slate-800 dark:text-slate-200">{c.discountValue}% Off</strong>
                                </div>
                                <div className="text-xs text-slate-400">Uses: {c.currentUses} / {c.maxUses}</div>
                                {c.qrCodeUrl && (
                                    <img src={c.qrCodeUrl} alt="QR Code" className="w-24 h-24 mx-auto rounded-lg border p-1 bg-white" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── TAB 5: QR CAMPAIGNS ─── */}
            {activeTab === 'qr-campaigns' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">QR Code Marketing Campaigns</h2>
                        <button
                            onClick={() => setShowQRModal(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
                        >
                            + Create QR Campaign
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {qrCampaigns.map((qr, idx) => (
                            <div key={qr.id || `qr-${idx}`} className="p-5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-3 text-center">
                                <h3 className="font-bold text-base">{qr.title}</h3>
                                <img src={qr.qrCodeUrl} alt="QR" className="w-32 h-32 mx-auto border p-1 rounded-xl bg-white" />
                                <div className="text-xs text-slate-500 truncate">{qr.targetUrl}</div>
                                <div className="text-xs font-semibold text-blue-600">Scans: {qr.scansCount}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── TAB 6: LANDING PAGES ─── */}
            {activeTab === 'landing-pages' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Landing Pages Builder</h2>
                        <button
                            onClick={() => setShowLandingModal(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
                        >
                            + Build Landing Page
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {landingPages.map((lp, idx) => (
                            <div key={lp.id || `lp-${idx}`} className="p-5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2">
                                <h3 className="font-bold text-lg">{lp.title}</h3>
                                <p className="text-xs text-slate-500">{lp.headline}</p>
                                <div className="text-xs font-mono text-blue-500">Slug: /p/{lp.slug}</div>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-700">{lp.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── TAB 7: CUSTOMER SEGMENTS ─── */}
            {activeTab === 'customer-segments' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Customer Segments</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {segments.map((seg, idx) => (
                            <div key={seg.id || seg.name || `seg-${idx}`} className="p-5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2">
                                <h3 className="font-bold text-lg">{seg.name}</h3>
                                <p className="text-xs text-slate-500">{seg.description || 'Target audience segment'}</p>
                                <div className="text-xs font-semibold text-blue-600">Subscribers: {seg.memberCount || 0}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── CREATE CAMPAIGN MODAL ─── */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold">Create Advertisement Campaign</h3>
                        <form onSubmit={handleCreateCampaign} className="space-y-3 text-sm">
                            <div>
                                <label className="block font-medium mb-1">Campaign Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newCampaign.name}
                                    onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="e.g. Summer Promo 2026"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium mb-1">Ad Type</label>
                                    <select
                                        value={newCampaign.campaignType}
                                        onChange={e => setNewCampaign({ ...newCampaign, campaignType: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    >
                                        <option value="IMAGE_BANNER">Image Banner</option>
                                        <option value="VIDEO_AD">Video Advertisement</option>
                                        <option value="POPUP">Popup</option>
                                        <option value="FULLSCREEN_SPLASH">Fullscreen Splash</option>
                                        <option value="COUPON_CARD">Coupon Card</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-medium mb-1">Priority (1-10)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={newCampaign.priority}
                                        onChange={e => setNewCampaign({ ...newCampaign, priority: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Headline</label>
                                <input
                                    type="text"
                                    value={newCampaign.headline}
                                    onChange={e => setNewCampaign({ ...newCampaign, headline: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="e.g. Unlimited WiFi for 24 Hours!"
                                />
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Destination URL</label>
                                <input
                                    type="url"
                                    value={newCampaign.destinationUrl}
                                    onChange={e => setNewCampaign({ ...newCampaign, destinationUrl: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="https://yourwebsite.com/promo"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Save & Launch</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── CREATE COUPON MODAL ─── */}
            {showCouponModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold">Generate Promo Coupon</h3>
                        <form onSubmit={handleCreateCoupon} className="space-y-3 text-sm">
                            <div>
                                <label className="block font-medium mb-1">Coupon Code (Leave blank for auto)</label>
                                <input
                                    type="text"
                                    value={newCoupon.couponCode}
                                    onChange={e => setNewCoupon({ ...newCoupon, couponCode: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700 font-mono"
                                    placeholder="SURF-50OFF"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium mb-1">Discount Type</label>
                                    <select
                                        value={newCoupon.discountType}
                                        onChange={e => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    >
                                        <option value="PERCENTAGE">Percentage (%)</option>
                                        <option value="FIXED_AMOUNT">Fixed KES</option>
                                        <option value="FREE_PACKAGE">Free Pass</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-medium mb-1">Discount Value</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newCoupon.discountValue}
                                        onChange={e => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium mb-1">Validity (Days)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newCoupon.validityDays}
                                        onChange={e => setNewCoupon({ ...newCoupon, validityDays: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium mb-1">Max Redemptions</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newCoupon.maxUses}
                                        onChange={e => setNewCoupon({ ...newCoupon, maxUses: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button type="button" onClick={() => setShowCouponModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Generate & Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── CREATE QR CAMPAIGN MODAL ─── */}
            {showQRModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold">Create QR Code Campaign</h3>
                        <form onSubmit={handleCreateQR} className="space-y-3 text-sm">
                            <div>
                                <label className="block font-medium mb-1">Campaign Title</label>
                                <input
                                    type="text"
                                    required
                                    value={newQR.title}
                                    onChange={e => setNewQR({ ...newQR, title: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="e.g. Lobby Wi-Fi QR Code"
                                />
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Destination Type</label>
                                <select
                                    value={newQR.destinationType}
                                    onChange={e => setNewQR({ ...newQR, destinationType: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                >
                                    <option value="WEBSITE">Website Link</option>
                                    <option value="PACKAGE_PURCHASE">Package Purchase</option>
                                    <option value="WHATSAPP">WhatsApp Support</option>
                                    <option value="PAYMENT">Direct M-Pesa Payment</option>
                                    <option value="LOCATION">Google Maps Location</option>
                                </select>
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Target URL / Link</label>
                                <input
                                    type="url"
                                    required
                                    value={newQR.targetUrl}
                                    onChange={e => setNewQR({ ...newQR, targetUrl: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="https://yourwebsite.com"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button type="button" onClick={() => setShowQRModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Generate QR Code</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── CREATE LANDING PAGE MODAL ─── */}
            {showLandingModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold">Build Micro Landing Page</h3>
                        <form onSubmit={handleCreateLanding} className="space-y-3 text-sm">
                            <div>
                                <label className="block font-medium mb-1">Page Title</label>
                                <input
                                    type="text"
                                    required
                                    value={newLanding.title}
                                    onChange={e => setNewLanding({ ...newLanding, title: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="e.g. VIP Member Signup"
                                />
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Headline</label>
                                <input
                                    type="text"
                                    value={newLanding.headline}
                                    onChange={e => setNewLanding({ ...newLanding, headline: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="Welcome to High Speed WiFi"
                                />
                            </div>

                            <div>
                                <label className="block font-medium mb-1">Body Content</label>
                                <textarea
                                    rows={3}
                                    value={newLanding.bodyContent}
                                    onChange={e => setNewLanding({ ...newLanding, bodyContent: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border dark:bg-slate-700"
                                    placeholder="Describe your special promotion or event details..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button type="button" onClick={() => setShowLandingModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Publish Landing Page</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketingSuite;
