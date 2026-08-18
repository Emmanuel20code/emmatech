import { useState, useEffect } from 'react';
import {
    Palette, Image as ImageIcon, Type, Layout, Globe, Phone, Save, RotateCcw,
    Monitor, Tablet, Smartphone, Sparkles, CheckCircle2, AlertTriangle, Eye,
    Grid, Layers, Zap, Check, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface BrandingState {
    businessName: string;
    tagline: string;
    description: string;
    supportPhone: string;
    supportEmail: string;
    whatsappNumber: string;
    websiteUrl: string;
    physicalAddress: string;

    primaryLogoUrl: string;
    mobileLogoUrl: string;
    darkModeLogoUrl: string;
    lightModeLogoUrl: string;
    faviconUrl: string;
    footerLogoUrl: string;

    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    buttonColor: string;
    navColor: string;
    backgroundColor: string;
    footerColor: string;
    textColor: string;
    linkColor: string;

    welcomeMessage: string;
    headline: string;
    subheadline: string;
    termsConditions: string;
    privacyNotice: string;
    footerText: string;

    backgroundType: 'IMAGE' | 'VIDEO' | 'GRADIENT' | 'SOLID';
    backgroundUrl: string;
    gradientStartColor: string;
    gradientEndColor: string;
    backgroundBlur: number;
    backgroundOverlayOpacity: number;

    packageCardLayout: 'GRID_2COL' | 'GRID_3COL' | 'VERTICAL_LIST' | 'COMPACT_TILES' | 'HORIZONTAL_SCROLL';
    packageCardStyle: 'GLASS' | 'SOLID' | 'OUTLINE' | 'GRADIENT_ACCENT';
    showPackageBadges: boolean;
    showSpeedBadges: boolean;

    customDomain: string;
    landingHeroTitle: string;
    landingHeroSubtitle: string;
    showLandingHero: boolean;
}

const defaultState: BrandingState = {
    businessName: 'Apex Fiber ISP',
    tagline: 'High-Speed Wi-Fi Access',
    description: 'Enterprise ISP & Hotspot Provider',
    supportPhone: '0768926965',
    supportEmail: 'emmanueloyaro3@gmail.com',
    whatsappNumber: '254768926965',
    websiteUrl: 'https://apexfiber.co.ke',
    physicalAddress: 'Nairobi, Kenya',

    primaryLogoUrl: '',
    mobileLogoUrl: '',
    darkModeLogoUrl: '',
    lightModeLogoUrl: '',
    faviconUrl: '',
    footerLogoUrl: '',

    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    buttonColor: '#0284c7',
    navColor: '#0284c7',
    backgroundColor: '#0f172a',
    footerColor: '#0284c7',
    textColor: '#ffffff',
    linkColor: '#38bdf8',

    welcomeMessage: 'Select an internet package below for instant network access.',
    headline: 'Apex Fiber High-Speed Wi-Fi',
    subheadline: 'Instant M-Pesa Activation',
    termsConditions: 'Standard fair usage policies apply.',
    privacyNotice: 'Your privacy is protected.',
    footerText: '© 2026 Apex Fiber ISP. All rights reserved.',

    backgroundType: 'GRADIENT',
    backgroundUrl: '',
    gradientStartColor: '#0f172a',
    gradientEndColor: '#0284c7',
    backgroundBlur: 0,
    backgroundOverlayOpacity: 0.2,

    packageCardLayout: 'GRID_2COL',
    packageCardStyle: 'GLASS',
    showPackageBadges: true,
    showSpeedBadges: true,

    customDomain: 'wifi.apexfiber.co.ke',
    landingHeroTitle: 'Ultra-Fast Fiber Internet',
    landingHeroSubtitle: 'Connect to the most reliable network in town.',
    showLandingHero: true
};

const TenantBrandingCenter = () => {
    const [branding, setBranding] = useState<BrandingState>(defaultState);
    const [realPackages, setRealPackages] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'IDENTITY' | 'LOGOS' | 'COLORS' | 'LAYOUT' | 'MESSAGES' | 'BACKGROUND' | 'DOMAIN' | 'LANDING'>('LAYOUT');
    const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [previewSelectedPackage, setPreviewSelectedPackage] = useState<any | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewPhone, setPreviewPhone] = useState('');

    useEffect(() => {
        const fetchBrandingAndPackages = async () => {
            try {
                const [brandingRes, adminPkgRes, pkgRes] = await Promise.all([
                    axios.get('/api/v1/branding/tenant/my-tenant').catch(() => ({ data: null })),
                    axios.get('/api/v1/admin/packages').catch(() => ({ data: [] })),
                    axios.get('/api/v1/packages').catch(() => axios.get('/api/v1/portal/my-tenant/packages')).catch(() => ({ data: [] }))
                ]);
                
                if (brandingRes.data) {
                    setBranding((prev) => ({ ...prev, ...brandingRes.data }));
                }

                let pkgs: any[] = [];
                if (Array.isArray(adminPkgRes.data)) {
                    pkgs = adminPkgRes.data;
                } else if (adminPkgRes.data && typeof adminPkgRes.data === 'object' && Array.isArray(adminPkgRes.data.packages)) {
                    pkgs = adminPkgRes.data.packages;
                } else if (Array.isArray(pkgRes.data?.packages)) {
                    pkgs = pkgRes.data.packages;
                } else if (Array.isArray(pkgRes.data)) {
                    pkgs = pkgRes.data;
                }
                setRealPackages(pkgs);
            } catch (_) {
                // Fallback to default state on error
            } finally {
                setLoading(false);
            }
        };
        fetchBrandingAndPackages();
    }, []);

    const handleChange = (field: keyof BrandingState, value: any) => {
        setBranding((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setFeedback(null);
        try {
            await axios.put('/api/v1/branding/tenant', branding);
            setFeedback({ type: 'success', message: 'Captive Portal branding saved & published successfully!' });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to save branding settings.' });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Reset all captive portal branding to system defaults?')) return;
        setSaving(true);
        try {
            await axios.post('/api/v1/branding/tenant/reset');
            setBranding(defaultState);
            setFeedback({ type: 'success', message: 'Branding reset to system defaults.' });
        } catch (err: any) {
            setFeedback({ type: 'error', message: 'Failed to reset branding.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-white text-center font-bold">
                Loading Captive Portal Branding Engine...
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Sparkles className="w-7 h-7 text-sky-400" /> Captive Portal Branding Center
                    </h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">
                        Customize your captive portal branding, colors, logos, and messages independently.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleReset}
                        disabled={saving}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" /> Reset Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save & Publish'}
                    </button>
                </div>
            </div>

            {feedback && (
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* Split Screen: Editor Tabs (Left 7 Cols) + Real-Time Live Preview (Right 5 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Section: Settings Editor */}
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                    
                    {/* Tabs */}
                    <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold no-scrollbar">
                        {[
                            { id: 'LAYOUT', label: 'Package Layout', icon: Grid },
                            { id: 'IDENTITY', label: 'Identity', icon: Globe },
                            { id: 'LOGOS', label: 'Logos', icon: ImageIcon },
                            { id: 'COLORS', label: 'Colors', icon: Palette },
                            { id: 'MESSAGES', label: 'Messaging', icon: Type },
                            { id: 'BACKGROUND', label: 'Background', icon: Layout },
                            { id: 'DOMAIN', label: 'Domain', icon: Globe },
                            { id: 'LANDING', label: 'Landing Page', icon: Sparkles },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${isActive ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
                                >
                                    <Icon className="w-3.5 h-3.5" /> {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab 0: Package Card Layout & Aesthetic Design */}
                    {activeTab === 'LAYOUT' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Grid className="w-4 h-4 text-sky-400" /> Package Card Grid Layout
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Select how Wi-Fi packages are structured and arranged on your captive portal.</p>
                            </div>

                            {/* Layout Selection Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { id: 'GRID_2COL', name: '2-Column Grid', desc: 'Balanced side-by-side cards', cols: '2 Cols' },
                                    { id: 'GRID_3COL', name: '3-Column Grid', desc: 'Dense multi-option matrix', cols: '3 Cols' },
                                    { id: 'VERTICAL_LIST', name: 'Vertical Stack', desc: 'Full-width stacked cards', cols: '1 Col' },
                                    { id: 'COMPACT_TILES', name: 'Compact Badges', desc: 'Minimalist price tiles', cols: 'Tiles' },
                                    { id: 'HORIZONTAL_SCROLL', name: 'Horizontal Swipe', desc: 'Swipeable card carousel', cols: 'Carousel' }
                                ].map((layout) => {
                                    const isSelected = branding.packageCardLayout === layout.id;
                                    return (
                                        <button
                                            key={layout.id}
                                            onClick={() => handleChange('packageCardLayout', layout.id)}
                                            className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between ${isSelected ? 'bg-sky-500/10 border-sky-500 text-white shadow-lg shadow-sky-500/10' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-sky-400">
                                                    {layout.cols}
                                                </span>
                                                {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-white">{layout.name}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{layout.desc}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="border-t border-slate-800/80 pt-5 space-y-4">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-sky-400" /> Package Card Visual Style
                                </h3>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { id: 'GLASS', name: 'Frosted Glass', desc: 'Glassmorphic backdrop blur' },
                                        { id: 'SOLID', name: 'Solid Slate', desc: 'High contrast dark fill' },
                                        { id: 'OUTLINE', name: 'Neon Outline', desc: 'Minimal glowing outline' },
                                        { id: 'GRADIENT_ACCENT', name: 'Gradient Accent', desc: 'Top brand color bar' }
                                    ].map((style) => {
                                        const isSelected = branding.packageCardStyle === style.id;
                                        return (
                                            <button
                                                key={style.id}
                                                onClick={() => handleChange('packageCardStyle', style.id)}
                                                className={`p-3 rounded-2xl border text-left transition ${isSelected ? 'bg-sky-500/10 border-sky-500 text-white' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
                                            >
                                                <div className="text-xs font-black text-white">{style.name}</div>
                                                <div className="text-[9px] text-slate-400 mt-0.5">{style.desc}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-slate-800/80 pt-5 space-y-3">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Card Element Toggles</h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                                        <div>
                                            <div className="text-xs font-bold text-white">Popular & Recommended Badges</div>
                                            <div className="text-[10px] text-slate-400">Highlight best value packages</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={branding.showPackageBadges}
                                            onChange={(e) => handleChange('showPackageBadges', e.target.checked)}
                                            className="w-4 h-4 accent-sky-500 rounded"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                                        <div>
                                            <div className="text-xs font-bold text-white">Speed & Data Volume Badges</div>
                                            <div className="text-[10px] text-slate-400">Show Mbps and GB details</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={branding.showSpeedBadges}
                                            onChange={(e) => handleChange('showSpeedBadges', e.target.checked)}
                                            className="w-4 h-4 accent-sky-500 rounded"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 1: Business Identity & Contact Info */}
                    {activeTab === 'IDENTITY' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Business Identity & Contact Profile</h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Business Name</label>
                                    <input
                                        type="text"
                                        value={branding.businessName}
                                        onChange={(e) => handleChange('businessName', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tagline</label>
                                    <input
                                        type="text"
                                        value={branding.tagline}
                                        onChange={(e) => handleChange('tagline', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Support Phone</label>
                                    <input
                                        type="text"
                                        value={branding.supportPhone}
                                        onChange={(e) => handleChange('supportPhone', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Support Email</label>
                                    <input
                                        type="email"
                                        value={branding.supportEmail}
                                        onChange={(e) => handleChange('supportEmail', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp Support Number</label>
                                    <input
                                        type="text"
                                        value={branding.whatsappNumber}
                                        onChange={(e) => handleChange('whatsappNumber', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Website URL</label>
                                    <input
                                        type="text"
                                        value={branding.websiteUrl}
                                        onChange={(e) => handleChange('websiteUrl', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Logo Asset Management */}
                    {activeTab === 'LOGOS' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Logo & Brand Asset URLs</h3>
                            
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Primary Portal Logo URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://cdn.example.com/logo.png"
                                        value={branding.primaryLogoUrl}
                                        onChange={(e) => handleChange('primaryLogoUrl', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile Header Logo URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://cdn.example.com/mobile-logo.png"
                                        value={branding.mobileLogoUrl}
                                        onChange={(e) => handleChange('mobileLogoUrl', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Favicon Icon URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://cdn.example.com/favicon.ico"
                                        value={branding.faviconUrl}
                                        onChange={(e) => handleChange('faviconUrl', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Color Customization */}
                    {activeTab === 'COLORS' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Color Palette Customization</h3>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Primary Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={branding.primaryColor}
                                            onChange={(e) => handleChange('primaryColor', e.target.value)}
                                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                                        />
                                        <span className="text-xs font-mono text-white">{branding.primaryColor}</span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Button Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={branding.buttonColor}
                                            onChange={(e) => handleChange('buttonColor', e.target.value)}
                                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                                        />
                                        <span className="text-xs font-mono text-white">{branding.buttonColor}</span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Accent Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={branding.accentColor}
                                            onChange={(e) => handleChange('accentColor', e.target.value)}
                                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                                        />
                                        <span className="text-xs font-mono text-white">{branding.accentColor}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 4: Messages & Copy */}
                    {activeTab === 'MESSAGES' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Custom Text & Messages</h3>
                            
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Portal Headline</label>
                                    <input
                                        type="text"
                                        value={branding.headline}
                                        onChange={(e) => handleChange('headline', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Welcome Message</label>
                                    <textarea
                                        rows={2}
                                        value={branding.welcomeMessage}
                                        onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white resize-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Terms & Conditions Summary</label>
                                    <textarea
                                        rows={2}
                                        value={branding.termsConditions}
                                        onChange={(e) => handleChange('termsConditions', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 5: Background Styling */}
                    {activeTab === 'BACKGROUND' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Background Type & Style</h3>
                            
                            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                                {['GRADIENT', 'IMAGE', 'SOLID'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => handleChange('backgroundType', type)}
                                        className={`flex-1 py-2 rounded-xl transition ${branding.backgroundType === type ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            {branding.backgroundType === 'IMAGE' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Background Image URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://images.unsplash.com/photo-..."
                                        value={branding.backgroundUrl}
                                        onChange={(e) => handleChange('backgroundUrl', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                    />
                                </div>
                            )}

                            {branding.backgroundType === 'GRADIENT' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Start Color</label>
                                        <input
                                            type="color"
                                            value={branding.gradientStartColor}
                                            onChange={(e) => handleChange('gradientStartColor', e.target.value)}
                                            className="w-full h-10 rounded border-none cursor-pointer bg-slate-950"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">End Color</label>
                                        <input
                                            type="color"
                                            value={branding.gradientEndColor}
                                            onChange={(e) => handleChange('gradientEndColor', e.target.value)}
                                            className="w-full h-10 rounded border-none cursor-pointer bg-slate-950"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 6: Custom Domain */}
                    {activeTab === 'DOMAIN' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Custom Portal Domain Settings</h3>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Custom Domain (CNAME)</label>
                                <input
                                    type="text"
                                    placeholder="wifi.yourdomain.com"
                                    value={branding.customDomain}
                                    onChange={(e) => handleChange('customDomain', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                />
                                <p className="text-[11px] text-slate-400 pt-1">
                                    Point your domain's CNAME record to <code>cname.jevish.site</code> for automatic SSL resolution.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tab 8: Landing Page Hero */}
                    {activeTab === 'LANDING' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-sky-400" /> Hero Section Settings
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Configure the main welcome section shown at the top of your landing page.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                                    <div>
                                        <div className="text-xs font-bold text-white">Enable Hero Section</div>
                                        <div className="text-[10px] text-slate-400">Show/hide the primary welcome banner</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={branding.showLandingHero}
                                        onChange={(e) => handleChange('showLandingHero', e.target.checked)}
                                        className="w-4 h-4 accent-sky-500 rounded"
                                    />
                                </label>

                                {branding.showLandingHero && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Hero Headline</label>
                                            <input
                                                type="text"
                                                value={branding.landingHeroTitle}
                                                onChange={(e) => handleChange('landingHeroTitle', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Hero Subtitle</label>
                                            <textarea
                                                rows={2}
                                                value={branding.landingHeroSubtitle}
                                                onChange={(e) => handleChange('landingHeroSubtitle', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white resize-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Section: Real-Time Live Multi-Device Preview Container */}
                <div className="lg:col-span-5 space-y-4 sticky top-6">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Eye className="w-4 h-4 text-sky-400" /> Live Portal Preview
                        </span>
                        
                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                            <button
                                onClick={() => setPreviewDevice('DESKTOP')}
                                className={`p-1.5 rounded-lg transition ${previewDevice === 'DESKTOP' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}
                                title="Desktop View"
                            >
                                <Monitor size={16} />
                            </button>
                            <button
                                onClick={() => setPreviewDevice('TABLET')}
                                className={`p-1.5 rounded-lg transition ${previewDevice === 'TABLET' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}
                                title="Tablet View"
                            >
                                <Tablet size={16} />
                            </button>
                            <button
                                onClick={() => setPreviewDevice('MOBILE')}
                                className={`p-1.5 rounded-lg transition ${previewDevice === 'MOBILE' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}
                                title="Mobile View"
                            >
                                <Smartphone size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Rendered Mockup Container */}
                    <div className={`mx-auto transition-all duration-500 overflow-hidden border border-slate-800 rounded-3xl shadow-2xl relative ${previewDevice === 'MOBILE' ? 'w-[320px] h-[580px]' : previewDevice === 'TABLET' ? 'w-[420px] h-[600px]' : 'w-full h-[600px]'}`}>
                        <div
                            className="w-full h-full p-4 overflow-y-auto space-y-4 text-white text-center flex flex-col justify-between relative"
                            style={{
                                background: branding.backgroundType === 'GRADIENT' 
                                    ? `linear-gradient(to bottom, ${branding.gradientStartColor || '#0f172a'}, ${branding.gradientEndColor || '#0284c7'})`
                                    : branding.backgroundType === 'IMAGE' && branding.backgroundUrl
                                    ? `url(${branding.backgroundUrl}) center/cover no-repeat`
                                    : branding.backgroundColor || '#0f172a',
                                filter: branding.backgroundBlur ? `blur(${branding.backgroundBlur}px)` : undefined,
                            }}
                        >
                            {/* Overlay if image background */}
                            {branding.backgroundType === 'IMAGE' && (
                                <div 
                                    className="absolute inset-0 bg-slate-950 pointer-events-none" 
                                    style={{ opacity: branding.backgroundOverlayOpacity ?? 0.3 }}
                                />
                            )}

                            <div className="relative z-10 space-y-3">
                                {/* Header / Logo */}
                                {branding.primaryLogoUrl ? (
                                    <img 
                                        src={branding.primaryLogoUrl} 
                                        alt={branding.businessName} 
                                        className="h-10 mx-auto object-contain max-w-[140px]" 
                                    />
                                ) : (
                                    <div 
                                        className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center font-black text-lg shadow-lg"
                                        style={{ backgroundColor: branding.primaryColor || '#0284c7', color: '#ffffff' }}
                                    >
                                        {branding.businessName ? branding.businessName.charAt(0).toUpperCase() : 'W'}
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-sm font-black tracking-tight" style={{ color: branding.textColor || '#ffffff' }}>{branding.headline || 'High-Speed Wi-Fi Access'}</h4>
                                    <p className="text-[10px] opacity-80 mt-0.5" style={{ color: branding.textColor || '#ffffff' }}>{branding.welcomeMessage || 'Select a plan below to get connected instantly.'}</p>
                                </div>
                            </div>

                            {/* Captive Portal Packages & M-Pesa / Voucher Login Simulator */}
                            <div className="relative z-10 space-y-3 text-left">
                                {/* WiFi Package Cards connected to Live Database Packages */}
                                {(() => {
                                    if (realPackages.length === 0) {
                                        return (
                                            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-700/60 text-center space-y-1 my-2 shadow-inner">
                                                <p className="text-xs font-bold text-sky-400">No Custom Packages Created Yet</p>
                                                <p className="text-[10px] text-slate-400">Go to Package Management to create your internet plans. They will automatically appear here on your portal.</p>
                                            </div>
                                        );
                                    }

                                    const displayPkgs = realPackages.map((p, i) => ({
                                        id: p.id || String(i),
                                        name: p.name || 'Wi-Fi Package',
                                        price: typeof p.price === 'number' ? `KES ${p.price}` : (p.price ? (String(p.price).startsWith('KES') ? p.price : `KES ${p.price}`) : 'KES 100'),
                                        duration: p.duration ? p.duration : (p.durationMinutes ? `${p.durationMinutes} Mins` : (p.validity ? `${p.validity} Days` : '24 Hours')),
                                        speed: p.downloadSpeed ? `${p.downloadSpeed} Mbps` : (p.speed || '20 Mbps'),
                                        data: p.dataLimitMB ? `${p.dataLimitMB} MB` : (p.dataLimit ? `${p.dataLimit} MB` : 'Unlimited Data'),
                                        isPopular: p.isPopular || i === 1,
                                        isRec: p.isRecommended || i === 0
                                    }));

                                    // Determine layout container CSS classes
                                    let layoutContainerCss = 'space-y-2'; // Default VERTICAL_LIST
                                    if (branding.packageCardLayout === 'GRID_2COL') {
                                        layoutContainerCss = 'grid grid-cols-2 gap-2';
                                    } else if (branding.packageCardLayout === 'GRID_3COL') {
                                        layoutContainerCss = 'grid grid-cols-3 gap-1.5';
                                    } else if (branding.packageCardLayout === 'COMPACT_TILES') {
                                        layoutContainerCss = 'grid grid-cols-2 sm:grid-cols-3 gap-2';
                                    } else if (branding.packageCardLayout === 'HORIZONTAL_SCROLL') {
                                        layoutContainerCss = 'flex gap-2 overflow-x-auto pb-1 no-scrollbar';
                                    }

                                    // Determine card aesthetic style CSS classes
                                    let cardStyleCss = 'bg-white/10 backdrop-blur-md border border-white/15'; // Default GLASS
                                    if (branding.packageCardStyle === 'SOLID') {
                                        cardStyleCss = 'bg-slate-900/90 border border-slate-800 shadow-md';
                                    } else if (branding.packageCardStyle === 'OUTLINE') {
                                        cardStyleCss = 'bg-slate-950/40 border-2 border-sky-400/80 shadow-[0_0_12px_rgba(56,189,248,0.15)]';
                                    } else if (branding.packageCardStyle === 'GRADIENT_ACCENT') {
                                        cardStyleCss = 'bg-slate-900/90 border border-slate-800 border-t-4 border-t-sky-400 shadow-md';
                                    }

                                    return (
                                        <div className={layoutContainerCss}>
                                            {displayPkgs.map((pkg, idx) => {
                                                const isSelected = previewSelectedPackage?.id === pkg.id || (idx === 0 && !previewSelectedPackage);
                                                const isCompact = branding.packageCardLayout === 'COMPACT_TILES';
                                                const isHorizontal = branding.packageCardLayout === 'HORIZONTAL_SCROLL';

                                                return (
                                                    <div
                                                        key={pkg.id}
                                                        onClick={() => {
                                                            setPreviewSelectedPackage(pkg);
                                                            setShowPreviewModal(true);
                                                        }}
                                                        className={`p-2.5 rounded-2xl transition-all duration-300 flex flex-col justify-between relative cursor-pointer hover:scale-[1.02] ${cardStyleCss} ${isHorizontal ? 'min-w-[140px] shrink-0' : ''} ${isSelected ? 'ring-2 ring-sky-400' : ''}`}
                                                    >
                                                        {branding.showPackageBadges && (pkg.isPopular || pkg.isRec) && (
                                                            <div className="mb-1">
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${pkg.isPopular ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}`}>
                                                                    {pkg.isPopular ? 'Popular' : 'Best Value'}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div>
                                                            <div className={`font-black text-white ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
                                                                {pkg.name}
                                                            </div>

                                                            <div className="font-black text-xs mt-0.5" style={{ color: branding.accentColor || '#38bdf8' }}>
                                                                {pkg.price} <span className="text-[9px] opacity-75 font-normal">/ {pkg.duration}</span>
                                                            </div>

                                                            {branding.showSpeedBadges && !isCompact && (
                                                                <div className="text-[9px] opacity-70 mt-1 space-y-0.5 pt-1 border-t border-white/10">
                                                                    <div>{pkg.speed}</div>
                                                                    <div>{pkg.data}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}

                                {/* Login Input Preview */}
                                <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
                                    <div className="flex bg-white/10 p-0.5 rounded-xl text-[10px] font-bold">
                                        <button className="flex-1 py-1 rounded-lg bg-white/20 text-white font-black text-center">
                                            M-Pesa STK Push
                                        </button>
                                        <button className="flex-1 py-1 rounded-lg opacity-60 text-center">
                                            Voucher Code
                                        </button>
                                    </div>
                                    <input 
                                        type="text" 
                                        readOnly 
                                        onClick={() => setShowPreviewModal(true)}
                                        placeholder="07XX XXX XXX (M-Pesa Phone)"
                                        className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white placeholder-slate-500 cursor-pointer"
                                    />
                                    <button
                                        onClick={() => setShowPreviewModal(true)}
                                        className="w-full py-2 text-[10px] font-black uppercase rounded-xl transition shadow-lg text-slate-950 hover:brightness-110 active:scale-[0.98]"
                                        style={{ 
                                            backgroundColor: branding.buttonColor || branding.primaryColor || '#0284c7',
                                            color: '#ffffff'
                                        }}
                                    >
                                        Connect & Pay Now
                                    </button>
                                </div>
                            </div>

                            {/* Footer & Support Contacts */}
                            <div className="relative z-10 text-[9px] opacity-75 border-t border-white/10 pt-2 space-y-1">
                                <div>{branding.footerText || `© 2026 ${branding.businessName}. All rights reserved.`}</div>
                                {(branding.supportPhone || branding.supportEmail) && (
                                    <div className="text-[8px] opacity-60">
                                        Support: {branding.supportPhone} {branding.supportEmail ? `• ${branding.supportEmail}` : ''}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Preview Modal Pop-Up for Package Selection */}
            <AnimatePresence>
                {showPreviewModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowPreviewModal(false)}
                            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative z-10 space-y-4 text-left"
                        >
                            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-white">M-Pesa Express Payment</h3>
                                    <p className="text-[11px] text-sky-400 font-bold mt-0.5">
                                        {previewSelectedPackage?.name || realPackages[0]?.name || 'Wi-Fi Internet Plan'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowPreviewModal(false)}
                                    className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex justify-between items-center text-xs">
                                <span className="text-slate-400 font-medium">Package Price:</span>
                                <span className="font-black text-white text-sm" style={{ color: branding.accentColor || '#38bdf8' }}>
                                    {previewSelectedPackage ? (typeof previewSelectedPackage.price === 'number' ? `KES ${previewSelectedPackage.price}` : previewSelectedPackage.price) : (realPackages[0]?.price ? `KES ${realPackages[0].price}` : 'KES 100')}
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Enter Phone Number for M-Pesa Prompt
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                                        <Smartphone size={16} />
                                    </div>
                                    <input
                                        type="tel"
                                        autoFocus
                                        placeholder="07XX XXX XXX (e.g. 0712345678)"
                                        value={previewPhone}
                                        onChange={(e) => setPreviewPhone(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                                    />
                                </div>
                                <p className="text-[9px] text-slate-500 italic">An M-Pesa STK Push prompt will be sent to this phone.</p>
                            </div>

                            <button
                                onClick={() => {
                                    alert(`M-Pesa prompt simulation triggered for ${previewPhone || '07XXXXXXXX'}!`);
                                    setShowPreviewModal(false);
                                }}
                                className="w-full py-3 text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg text-slate-950 hover:brightness-110 active:scale-[0.98]"
                                style={{
                                    backgroundColor: branding.buttonColor || branding.primaryColor || '#0284c7',
                                    color: '#ffffff'
                                }}
                            >
                                Send M-Pesa Prompt
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TenantBrandingCenter;
