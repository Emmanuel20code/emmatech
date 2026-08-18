import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';
import JevishLogo from '../components/Common/JevishLogo';
import SupportButton from '../components/Common/SupportButton';
import EnterpriseLeadModal from '../components/EnterpriseLeadModal';
import InstallAppButton from '../components/Common/InstallAppButton';
import {
    Wifi, Shield, Zap, DollarSign, MessageSquare, BarChart3, ChevronRight,
    CheckCircle2, ArrowRight, Phone, Mail, Globe, MapPin, Users, HelpCircle,
    Star, Layers, Terminal, Sparkles, Check, Lock, ExternalLink, Building2
} from 'lucide-react';

const LandingPage: React.FC = () => {
    const { branding } = useBranding();
    const [faqOpen, setFaqOpen] = useState<number | null>(0);
    const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
    const [unlimitedPrice, setUnlimitedPrice] = useState('KES 300');

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

    const toggleFaq = (idx: number) => {
        setFaqOpen(faqOpen === idx ? null : idx);
    };

    return (
        <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-sky-500 selection:text-white overflow-x-hidden">
            {/* ── Top Announcement Bar ── */}
            <div className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-xs font-bold py-2 text-center px-4 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>Next-Gen Multi-Tenant WiFi Billing & MikroTik Management System.</span>
                <Link to="/register" className="underline hover:text-sky-100 flex items-center gap-0.5">Start Free Trial <ChevronRight className="w-3 h-3" /></Link>
            </div>

            {/* ── Navigation Bar ── */}
            <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#090d16]/80 border-b border-slate-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                        <JevishLogo size="md" showText={true} />
                    </Link>

                    {/* Nav Links */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
                        <a href="#features" className="hover:text-sky-400 transition-colors">Features</a>
                        <a href="#mikrotik" className="hover:text-sky-400 transition-colors">MikroTik Sync</a>
                        <a href="#captive" className="hover:text-sky-400 transition-colors">Captive Ads</a>
                        <a href="#pricing" className="hover:text-sky-400 transition-colors">Pricing</a>
                        <a href="#contact" className="hover:text-sky-400 transition-colors">Contact</a>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white transition-colors">
                            Sign In
                        </Link>
                        <Link to="/register" className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5">
                            Get Started Free
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── HERO SECTION ── */}
            <section className="relative pt-20 pb-28 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />
                <div className="max-w-6xl mx-auto text-center relative z-10 space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold">
                        <Zap className="w-4 h-4" /> Production-Ready Automated ISP & Hotspot Billing
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight">
                        Scale Your WiFi & ISP Business With Automated <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">M-Pesa Billing</span>
                    </h1>

                    <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">
                        {branding.platformDescription} Real-time MikroTik RouterOS sync, subscriber management, captive portal ads, and multi-channel customer communications.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-bold text-base rounded-2xl shadow-xl shadow-sky-500/30 transition-all flex items-center justify-center gap-2">
                            Start Free Trial <ArrowRight className="w-5 h-5" />
                        </Link>
                        <a href="#contact" className="w-full sm:w-auto px-8 py-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-2">
                            <MessageSquare className="w-5 h-5 text-sky-400" /> Contact Support Team
                        </a>
                        <InstallAppButton />
                    </div>

                    {/* Live Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-16 border-t border-slate-800 max-w-4xl mx-auto">
                        <div>
                            <div className="text-3xl font-black text-white">99.9%</div>
                            <div className="text-xs text-slate-400 font-semibold uppercase mt-1">Uptime Guaranteed</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-sky-400">100%</div>
                            <div className="text-xs text-slate-400 font-semibold uppercase mt-1">Automated M-Pesa</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-emerald-400">&lt; 2s</div>
                            <div className="text-xs text-slate-400 font-semibold uppercase mt-1">Router Sync Speed</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-indigo-400">24/7</div>
                            <div className="text-xs text-slate-400 font-semibold uppercase mt-1">Support Available</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FEATURES SECTION ── */}
            <section id="features" className="py-24 bg-slate-900/60 border-y border-slate-800 px-6">
                <div className="max-w-6xl mx-auto space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-xs font-black uppercase text-sky-400 tracking-wider">Complete Feature Suite</h2>
                        <p className="text-3xl md:text-4xl font-black text-white">Everything You Need To Run A Modern ISP</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: Wifi, title: 'MikroTik RouterOS Sync', desc: 'Direct API integration for Hotspot users, PPPoE secrets, active sessions, and queues.' },
                            { icon: DollarSign, title: 'Automated M-Pesa Payments', desc: 'Instant account activation via Paybill, Till Number, and IntaSend gateway with STK Push.' },
                            { icon: MessageSquare, title: 'SMS & WhatsApp Marketing', desc: 'Automated welcome messages, expiry alerts, receipts, and promotional campaigns.' },
                            { icon: Layers, title: 'Captive Portal Ads', desc: 'Monetize free WiFi with video ads, banner campaigns, and lead capture surveys.' },
                            { icon: Users, title: 'Subscriber Onboarding', desc: 'Complete CRM with bulk CSV import, customer groups, and wallet management.' },
                            { icon: BarChart3, title: 'Financial Analytics', desc: 'Live BI dashboards, revenue trends, customer lifetime value, and CSV reports.' },
                        ].map((f, i) => (
                            <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 hover:border-sky-500/50 transition-all space-y-4 group">
                                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <f.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-white">{f.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── MIKROTIK DEEP DIVE SECTION ── */}
            <section id="mikrotik" className="py-24 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold">
                            <Terminal className="w-4 h-4" /> Native RouterOS API
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-white">Seamless MikroTik Integration & Real-Time Sync</h2>
                        <p className="text-slate-400 text-base leading-relaxed">
                            Connect your MikroTik routers in seconds using secure API credentials. Jevish manages user profiles, bandwidth queues, disconnects expired sessions, and creates backups automatically.
                        </p>
                        <ul className="space-y-3 font-semibold text-slate-300 text-sm">
                            <li className="flex items-center gap-2.5"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Hotspot User & PPPoE Secret Provisioning</li>
                            <li className="flex items-center gap-2.5"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Real-time CPU, Memory & Interface Traffic Monitoring</li>
                            <li className="flex items-center gap-2.5"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> One-Click Backup Generation & List View</li>
                        </ul>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 font-mono text-xs text-slate-300 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <span className="text-sky-400 font-bold">mikrotik@jevish-router</span>
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px]">CONNECTED</span>
                        </div>
                        <div className="space-y-2 text-slate-400">
                            <div>&gt; /ip/hotspot/user/add name="user_0714" profile="10Mbps_Package"</div>
                            <div className="text-emerald-400">[OK] User added successfully in 0.12s</div>
                            <div>&gt; /ppp/secret/add name="pppoe_cust1" service=pppoe</div>
                            <div className="text-emerald-400">[OK] PPPoE secret active</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── PRICING SECTION ── */}
            <section id="pricing" className="py-24 bg-slate-900/60 border-t border-slate-800 px-6">
                <div className="max-w-6xl mx-auto space-y-16">
                    <div className="text-center space-y-4">
                        <h2 className="text-xs font-black uppercase text-sky-400 tracking-wider">Transparent Plans</h2>
                        <p className="text-3xl md:text-4xl font-black text-white">Simple, Affordable Pricing For Every ISP</p>
                    </div>

                                        <div className="grid grid-cols-1 max-w-md mx-auto gap-8">
                        {[
                            { name: 'Unlimited', badge: '', slug: 'unlimited', price: unlimitedPrice, period: '/month', popular: true, isEnterprise: false, features: ['Unlimited Subscribers', 'Unlimited Routers', 'Automated M-Pesa STK Push', 'WhatsApp & SMS Marketing', 'Captive Portal Advertising', 'Full Financial Reports', 'Multi-Location Management'] },
                        ].map((p, i) => (
                            <div key={i} className={`bg-slate-900 border rounded-3xl p-8 space-y-6 relative flex flex-col justify-between ${p.popular ? 'border-sky-500 ring-2 ring-sky-500/20' : p.isEnterprise ? 'border-amber-500/50 bg-gradient-to-b from-slate-900 to-slate-900/90' : 'border-slate-800'}`}>
                                {p.popular && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-sky-500 text-white rounded-full text-xs font-bold">MOST POPULAR</span>}
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
                                    <Link to="/register" className={`w-full py-3 block text-center rounded-2xl font-bold text-sm transition-all ${p.popular ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
                                        Get Started
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <EnterpriseLeadModal isOpen={isEnterpriseModalOpen} onClose={() => setIsEnterpriseModalOpen(false)} />

            {/* ── FAQ SECTION ── */}
            <section className="py-24 px-6 max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h2 className="text-xs font-black uppercase text-sky-400 tracking-wider">Frequently Asked Questions</h2>
                    <p className="text-3xl font-black text-white">Got Questions? We Have Answers</p>
                </div>

                <div className="space-y-4">
                    {[
                        { q: 'How fast can I connect my MikroTik router?', a: 'Connection takes less than 2 minutes. Simply enter your router IP address, API port (8728/8729), and credentials.' },
                        { q: 'Is M-Pesa automated billing instant?', a: 'Yes! When a subscriber pays via M-Pesa STK Push or Paybill, Jevish instantly creates/renews their account and updates the router.' },
                        { q: 'Can I white-label the software with my business logo?', a: 'Absolutely. Super Admins and Tenants can upload custom logos, set brand colors, and brand captive portals and invoices.' },
                        { q: 'How do I contact support?', a: 'You can reach our primary support line and technical team instantly using the contact toggle on the bottom right.' },
                    ].map((item, idx) => (
                        <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <button onClick={() => toggleFaq(idx)} className="w-full p-5 text-left font-bold text-white flex items-center justify-between hover:bg-slate-800/50">
                                <span>{item.q}</span>
                                <ChevronRight className={`w-5 h-5 text-sky-400 transition-transform ${faqOpen === idx ? 'rotate-90' : ''}`} />
                            </button>
                            {faqOpen === idx && (
                                <div className="p-5 pt-0 text-slate-400 text-sm border-t border-slate-800/50">
                                    {item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CONTACT US & SUPPORT FOOTER SECTION ── */}
            <section id="contact" className="py-20 bg-slate-900/80 border-t border-slate-800 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-black text-white">Need Support Or A Custom Setup?</h2>
                        <p className="text-slate-400 text-base">Contact our technical engineering team for live onboard assistance, custom integrations, or sales inquiries via our 24/7 contact toggle widget.</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
                        <h3 className="text-lg font-bold text-white">Send Us A Message</h3>
                        <input type="text" placeholder="Your Name" className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-2xl text-sm focus:outline-none focus:border-sky-500" />
                        <input type="email" placeholder="Your Email Address" className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-2xl text-sm focus:outline-none focus:border-sky-500" />
                        <textarea rows={3} placeholder="How can we help your ISP business?" className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-2xl text-sm focus:outline-none focus:border-sky-500" />
                        <button onClick={() => alert('Thank you! Your inquiry has been sent to our support team.')} className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl text-sm shadow-lg transition-all">
                            Submit Request
                        </button>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-slate-800 py-12 px-6 bg-[#090d16] text-xs text-slate-500">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <JevishLogo size="sm" showText={false} />
                        <div>
                            <div className="font-bold text-slate-300 text-sm">{branding.companyName}</div>
                            <div>{branding.copyrightInfo}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 font-semibold text-slate-400">
                        <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-white">Terms & Conditions</Link>
                        <Link to="/about" className="hover:text-white">About Us</Link>
                        <Link to="/status" className="hover:text-white">System Status</Link>
                        <Link to="/help" className="hover:text-white">Help Center</Link>
                    </div>
                </div>
            </footer>

            {/* Floating Contact Toggle */}
            <SupportButton />
        </div>
    );
};

export default LandingPage;
