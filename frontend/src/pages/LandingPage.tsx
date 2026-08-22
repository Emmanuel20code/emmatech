import React, { useState, useEffect, Suspense } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';
import JevishLogo from '../components/Common/JevishLogo';
import SupportButton from '../components/Common/SupportButton';
import EnterpriseLeadModal from '../components/EnterpriseLeadModal';
import InstallAppButton from '../components/Common/InstallAppButton';
import { ThreeDBackground } from '../components/Landing/ThreeDBackground';
import { motion } from 'framer-motion';
import {
    Wifi, Shield, Zap, DollarSign, MessageSquare, BarChart3, ChevronRight,
    CheckCircle2, ArrowRight, Phone, Mail, Globe, MapPin, Users, HelpCircle,
    Star, Layers, Terminal, Sparkles, Check, Lock, ExternalLink, Building2,
    Router, Smartphone, Cloud, Headphones, TrendingUp, Clock, Award, Server
} from 'lucide-react';

// Animation variants
const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const fadeInLeft = {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const fadeInRight = {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.3
        }
    }
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } }
};

const LandingPage: React.FC = () => {
    const { branding } = useBranding();
    const [faqOpen, setFaqOpen] = useState<number | null>(null);
    const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
    const [unlimitedPrice, setUnlimitedPrice] = useState('KES 300');
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        axios.get('/api/v1/checkout/plans')
            .then(res => {
                const unlimitedPlan = res.data.find((p: any) => p.slug === 'unlimited');
                if (unlimitedPlan) {
                    const priceVal = Number(unlimitedPlan.monthlyPriceCents) / 100;
                    setUnlimitedPrice(`KES ${priceVal.toLocaleString()}`);
                }
            })
            .catch(err => {
                console.error('Failed to load pricing plans', err);
            });
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const toggleFaq = (idx: number) => {
        setFaqOpen(faqOpen === idx ? null : idx);
    };

    return (
        <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-sky-500 selection:text-white overflow-x-hidden relative">
            {/* ── 3D Background ── */}
            <Suspense fallback={<div className="fixed inset-0 bg-[#090d16] flex items-center justify-center"><div className="text-sky-400 animate-pulse">Loading 3D Experience...</div></div>}>
                <ThreeDBackground variant="hero" />
            </Suspense>

            {/* Mouse-following gradient overlay */}
            <div 
                className="fixed inset-0 pointer-events-none z-0 opacity-30"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(14,165,233,0.15), transparent 40%)`
                }}
            />

            {/* ── Top Announcement Bar ── */}
            <motion.div 
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 text-white text-xs font-bold py-3 text-center px-4 flex items-center justify-center gap-2 relative z-50 shadow-lg shadow-sky-500/20"
            >
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>Next-Gen Multi-Tenant WiFi Billing & MikroTik Management System — Now with AI-Powered Analytics</span>
                <Link to="/register" className="underline hover:text-sky-100 flex items-center gap-0.5 ml-2">Start Free Trial <ArrowRight className="w-3 h-3" /></Link>
            </motion.div>

            {/* ── Navigation Bar ── */}
            <motion.nav 
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="sticky top-0 z-40 backdrop-blur-xl bg-[#090d16]/70 border-b border-slate-800/50 px-6 py-4 shadow-xl"
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                            <JevishLogo size="md" showText={true} />
                        </Link>
                    </motion.div>

                    {/* Nav Links */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
                        {['Features', 'MikroTik', 'Captive Portal', 'Pricing', 'Contact'].map((item, i) => (
                            <motion.a
                                key={item}
                                href={`#${item.toLowerCase().replace(' ', '-')}`}
                                className="relative group hover:text-sky-400 transition-colors"
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i }}
                            >
                                {item}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-sky-400 group-hover:w-full transition-all duration-300" />
                            </motion.a>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white transition-colors hidden sm:block">
                            Sign In
                        </Link>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link to="/register" className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-sky-500/30 transition-all flex items-center gap-2">
                                Get Started Free <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </motion.nav>

            {/* ── HERO SECTION ── */}
            <section className="relative pt-24 pb-32 px-6 overflow-hidden">
                <div className="max-w-6xl mx-auto text-center relative z-10 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold backdrop-blur-sm"
                    >
                        <Zap className="w-4 h-4" /> Production-Ready Automated ISP & Hotspot Billing
                    </motion.div>

                    <motion.h1 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-5xl mx-auto leading-tight"
                    >
                        Scale Your WiFi & ISP Business With Automated{' '}
                        <span className="bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                            M-Pesa Billing
                        </span>
                    </motion.h1>

                    <motion.p 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.3 }}
                        className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto font-medium"
                    >
                        {branding.platformDescription} Real-time MikroTik RouterOS sync, subscriber management, captive portal ads, and multi-channel customer communications.
                    </motion.p>

                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.4 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                    >
                        <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-base rounded-2xl shadow-xl shadow-sky-500/30 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-1">
                            Start Free Trial <ArrowRight className="w-5 h-5" />
                        </Link>
                        <a href="#contact" className="w-full sm:w-auto px-8 py-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
                            <MessageSquare className="w-5 h-5 text-sky-400" /> Contact Support Team
                        </a>
                        <InstallAppButton />
                    </motion.div>

                    {/* Live Stats Row */}
                    <motion.div 
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.5 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-16 border-t border-slate-800/50 max-w-4xl mx-auto backdrop-blur-sm bg-slate-900/30 rounded-3xl p-8"
                    >
                        {[
                            { value: '99.9%', label: 'Uptime Guaranteed', color: 'text-white' },
                            { value: '100%', label: 'Automated M-Pesa', color: 'text-sky-400' },
                            { value: '< 2s', label: 'Router Sync Speed', color: 'text-emerald-400' },
                            { value: '24/7', label: 'Support Available', color: 'text-indigo-400' }
                        ].map((stat, i) => (
                            <motion.div 
                                key={i}
                                whileHover={{ scale: 1.05 }}
                                className="text-center"
                            >
                                <div className={`text-3xl md:text-4xl font-black ${stat.color}`}>{stat.value}</div>
                                <div className="text-xs text-slate-400 font-semibold uppercase mt-1">{stat.label}</div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── FEATURES SECTION ── */}
            <section id="features" className="py-24 bg-slate-900/60 border-y border-slate-800/50 px-6 relative">
                <Suspense fallback={null}>
                    <ThreeDBackground variant="features" />
                </Suspense>
                <div className="max-w-6xl mx-auto space-y-16 relative z-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center space-y-4"
                    >
                        <h2 className="text-xs font-black uppercase text-sky-400 tracking-wider">Complete Feature Suite</h2>
                        <p className="text-3xl md:text-4xl font-black text-white">Everything You Need To Run A Modern ISP</p>
                    </motion.div>

                    <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                    >
                        {[
                            { icon: Router, title: 'MikroTik RouterOS Sync', desc: 'Direct API integration for Hotspot users, PPPoE secrets, active sessions, and queues.', color: 'sky' },
                            { icon: DollarSign, title: 'Automated M-Pesa Payments', desc: 'Instant account activation via Paybill, Till Number, and IntaSend gateway with STK Push.', color: 'emerald' },
                            { icon: MessageSquare, title: 'SMS & WhatsApp Marketing', desc: 'Automated welcome messages, expiry alerts, receipts, and promotional campaigns.', color: 'purple' },
                            { icon: Layers, title: 'Captive Portal Ads', desc: 'Monetize free WiFi with video ads, banner campaigns, and lead capture surveys.', color: 'amber' },
                            { icon: Users, title: 'Subscriber Onboarding', desc: 'Complete CRM with bulk CSV import, customer groups, and wallet management.', color: 'pink' },
                            { icon: BarChart3, title: 'Financial Analytics', desc: 'Live BI dashboards, revenue trends, customer lifetime value, and CSV reports.', color: 'cyan' },
                        ].map((f, i) => (
                            <motion.div 
                                key={i}
                                variants={fadeInUp}
                                whileHover={{ y: -5, scale: 1.02 }}
                                className="bg-slate-900/80 border border-slate-800/50 rounded-3xl p-8 hover:border-sky-500/50 transition-all space-y-4 group backdrop-blur-sm"
                            >
                                <div className={`w-14 h-14 rounded-2xl bg-${f.color}-500/10 text-${f.color}-400 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-${f.color}-500/20`}>
                                    <f.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-white">{f.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── MIKROTIK DEEP DIVE SECTION ── */}
            <section id="mikrotik" className="py-24 px-6 relative overflow-hidden">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                    <motion.div 
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold">
                            <Terminal className="w-4 h-4" /> Native RouterOS API
                        </div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white">Seamless MikroTik Integration & Real-Time Sync</h2>
                        <p className="text-slate-400 text-base leading-relaxed">
                            Connect your MikroTik routers in seconds using secure API credentials. Jevish manages user profiles, bandwidth queues, disconnects expired sessions, and creates backups automatically.
                        </p>
                        <ul className="space-y-3 font-semibold text-slate-300 text-sm">
                            {[
                                'Hotspot User & PPPoE Secret Provisioning',
                                'Real-time CPU, Memory & Interface Traffic Monitoring',
                                'One-Click Backup Generation & List View',
                                'Automatic Session Disconnection on Expiry'
                            ].map((item, i) => (
                                <motion.li 
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center gap-2.5"
                                >
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {item}
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>
                    <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 font-mono text-xs text-slate-300 space-y-4 shadow-2xl backdrop-blur-sm"
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <span className="text-sky-400 font-bold">mikrotik@jevish-router</span>
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold">CONNECTED</span>
                        </div>
                        <div className="space-y-2 text-slate-400">
                            <div>&gt; /ip/hotspot/user/add name="user_0714" profile="10Mbps_Package"</div>
                            <div className="text-emerald-400">[OK] User added successfully in 0.12s</div>
                            <div>&gt; /ppp/secret/add name="pppoe_cust1" service=pppoe</div>
                            <div className="text-emerald-400">[OK] PPPoE secret active</div>
                            <div>&gt; /queue/simple/add name="limit_user0714" max-limit=10M/2M</div>
                            <div className="text-emerald-400">[OK] Queue created</div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── HOW IT WORKS SECTION ── */}
            <section className="py-24 bg-slate-900/60 border-y border-slate-800/50 px-6 relative">
                <div className="max-w-6xl mx-auto space-y-16 relative z-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center space-y-4"
                    >
                        <h2 className="text-xs font-black uppercase text-sky-400 tracking-wider">How It Works</h2>
                        <p className="text-3xl md:text-4xl font-black text-white">Get Started in 4 Simple Steps</p>
                    </motion.div>

                    <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-4 gap-8"
                    >
                        {[
                            { icon: Router, step: '01', title: 'Connect Router', desc: 'Add your MikroTik router using secure API credentials or onboarding code' },
                            { icon: Layers, step: '02', title: 'Create Packages', desc: 'Define WiFi packages with pricing, speed limits, and duration' },
                            { icon: Smartphone, step: '03', title: 'Customer Pays', desc: 'Customers select package and pay via M-Pesa STK Push' },
                            { icon: Wifi, step: '04', title: 'Auto Activation', desc: 'System automatically activates internet access on the router' }
                        ].map((item, i) => (
                            <motion.div 
                                key={i}
                                variants={fadeInUp}
                                className="relative"
                            >
                                <div className="bg-slate-900/80 border border-slate-800/50 rounded-3xl p-8 backdrop-blur-sm h-full">
                                    <div className="text-6xl font-black text-slate-800 mb-4">{item.step}</div>
                                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                    <p className="text-slate-400 text-sm">{item.desc}</p>
                                </div>
                                {i < 3 && (
                                    <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-20">
                                        <ArrowRight className="w-8 h-8 text-slate-700" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── PRICING SECTION ── */}
            <section id="pricing" className="py-24 px-6 relative">
                <div className="max-w-6xl mx-auto space-y-16 relative z-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center space-y-4"
                    >
                        <h2 className="text-xs font-black uppercase text-sky-400 tracking-wider">Transparent Plans</h2>
                        <p className="text-3xl md:text-4xl font-black text-white">Simple, Affordable Pricing For Every ISP</p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="grid grid-cols-1 max-w-md mx-auto gap-8"
                    >
                        {[
                            { name: 'Unlimited', badge: '', slug: 'unlimited', price: unlimitedPrice, period: '/month', popular: true, isEnterprise: false, features: ['Unlimited Subscribers', 'Unlimited Routers', 'Automated M-Pesa STK Push', 'WhatsApp & SMS Marketing', 'Captive Portal Advertising', 'Full Financial Reports', 'Multi-Location Management'] }
                        ].map((p, i) => (
                            <motion.div 
                                key={i}
                                whileHover={{ y: -5, scale: 1.02 }}
                                className={`bg-slate-900/90 border rounded-3xl p-8 space-y-6 relative flex flex-col justify-between backdrop-blur-sm ${p.popular ? 'border-sky-500 ring-2 ring-sky-500/20' : p.isEnterprise ? 'border-amber-500/50 bg-gradient-to-b from-slate-900 to-slate-900/90' : 'border-slate-800'}`}
                            >
                                {p.popular && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-sky-500 text-white rounded-full text-xs font-bold shadow-lg">MOST POPULAR</span>}
                                {p.badge && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500 text-white rounded-full text-xs font-black uppercase tracking-wider">{p.badge}</span>}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white flex items-center justify-between">
                                            {p.name}
                                            {p.isEnterprise && <Building2 className="w-5 h-5 text-amber-400" />}
                                        </h3>
                                        <div className="text-2xl md:text-3xl font-black text-white">{p.price} <span className="text-xs text-slate-400 font-medium">{p.period}</span></div>
                                    </div>
                                    <ul className="space-y-3 text-sm text-slate-300">
                                        {p.features.map((ft, fIdx) => (
                                            <li key={fIdx} className="flex items-center gap-2"><Check className={`w-4 h-4 ${p.isEnterprise ? 'text-amber-400' : 'text-sky-400'}`} /> {ft}</li>
                                        ))}
                                    </ul>
                                </div>
                                {p.isEnterprise ? (
                                    <button
                                        onClick={() => setIsEnterpriseModalOpen(true)}
                                        className="w-full py-3 text-center rounded-2xl font-bold text-sm transition-all bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                                    >
                                        <Building2 className="w-4 h-4" /> Request Quote / Contact Sales
                                    </button>
                                ) : (
                                    <Link to="/register" className={`w-full py-3 block text-center rounded-2xl font-bold text-sm transition-all ${p.popular ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
                                        Get Started
                                    </Link>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            <EnterpriseLeadModal isOpen={isEnterpriseModalOpen} onClose={() => setIsEnterpriseModalOpen(false)} />

            {/* ── FAQ SECTION ── */}
            <section className="py-24 px-6 max-w-4xl mx-auto space-y-12 relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center space-y-4"
                >
                    <h2 className="text-xs font-black uppercase text-sky-400 tracking-wider">Frequently Asked Questions</h2>
                    <p className="text-3xl font-black text-white">Got Questions? We Have Answers</p>
                </motion.div>

                <motion.div 
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="space-y-4"
                >
                    {[
                        { q: 'How fast can I connect my MikroTik router?', a: 'Connection takes less than 2 minutes. Simply enter your router IP address, API port (8728/8729), and credentials.' },
                        { q: 'Is M-Pesa automated billing instant?', a: 'Yes! When a subscriber pays via M-Pesa STK Push or Paybill, Jevish instantly creates/renews their account and updates the router.' },
                        { q: 'Can I white-label the software with my business logo?', a: 'Absolutely. Super Admins and Tenants can upload custom logos, set brand colors, and brand captive portals and invoices.' },
                        { q: 'How do I contact support?', a: 'You can reach our primary support line and technical team instantly using the contact toggle on the bottom right.' },
                    ].map((item, idx) => (
                        <motion.div 
                            key={idx}
                            variants={fadeInUp}
                            className="bg-slate-900/80 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-sm"
                        >
                            <button onClick={() => toggleFaq(idx)} className="w-full p-5 text-left font-bold text-white flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                                <span>{item.q}</span>
                                <ChevronRight className={`w-5 h-5 text-sky-400 transition-transform ${faqOpen === idx ? 'rotate-90' : ''}`} />
                            </button>
                            {faqOpen === idx && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="p-5 pt-0 text-slate-400 text-sm border-t border-slate-800/50"
                                >
                                    {item.a}
                                </motion.div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ── CONTACT US & SUPPORT FOOTER SECTION ── */}
            <section id="contact" className="py-20 bg-slate-900/80 border-t border-slate-800/50 px-6 relative">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                    <motion.div 
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <h2 className="text-3xl md:text-4xl font-black text-white">Need Support Or A Custom Setup?</h2>
                        <p className="text-slate-400 text-base">Contact our technical engineering team for live onboard assistance, custom integrations, or sales inquiries via our 24/7 contact toggle widget.</p>
                        
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-4 text-slate-300">
                                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                                    <Phone className="w-5 h-5 text-sky-400" />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-semibold uppercase">Call Us</div>
                                    <div className="font-bold">+254 700 000 000</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-slate-300">
                                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-sky-400" />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-semibold uppercase">Email Us</div>
                                    <div className="font-bold">support@jevish.com</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="bg-slate-900/90 border border-slate-800/50 rounded-3xl p-8 space-y-4 backdrop-blur-sm"
                    >
                        <h3 className="text-lg font-bold text-white">Send Us A Message</h3>
                        <input type="text" placeholder="Your Name" className="w-full bg-slate-800/50 border border-slate-700 text-white p-3 rounded-2xl text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                        <input type="email" placeholder="Your Email Address" className="w-full bg-slate-800/50 border border-slate-700 text-white p-3 rounded-2xl text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                        <textarea rows={3} placeholder="How can we help your ISP business?" className="w-full bg-slate-800/50 border border-slate-700 text-white p-3 rounded-2xl text-sm focus:outline-none focus:border-sky-500 transition-colors resize-none" />
                        <button onClick={() => alert('Thank you! Your inquiry has been sent to our support team.')} className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold rounded-2xl text-sm shadow-lg shadow-sky-500/30 transition-all">
                            Submit Request
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-slate-800/50 py-12 px-6 bg-[#090d16] text-xs text-slate-500 relative z-10">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <JevishLogo size="sm" showText={false} />
                        <div>
                            <div className="font-bold text-slate-300 text-sm">{branding.companyName}</div>
                            <div>{branding.copyrightInfo}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 font-semibold text-slate-400 flex-wrap justify-center">
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
                        <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
                        <Link to="/status" className="hover:text-white transition-colors">System Status</Link>
                        <Link to="/help" className="hover:text-white transition-colors">Help Center</Link>
                    </div>
                </div>
            </footer>

            {/* Floating Contact Toggle */}
            <SupportButton />
        </div>
    );
};

export default LandingPage;
