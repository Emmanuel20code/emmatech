import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../context/BrandingContext';
import { Globe, ArrowLeft, Users, Zap, Shield } from 'lucide-react';

const AboutUs: React.FC = () => {
    const { branding } = useBranding();
    return (
        <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center gap-2 text-sky-400 font-bold text-sm hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>

                <div className="border-b border-slate-800 pb-6">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Globe className="w-8 h-8 text-sky-500" /> About {branding.platformName}
                    </h1>
                    <p className="text-sm text-slate-400 mt-2">{branding.platformTagline}</p>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    <p className="text-base text-slate-200">
                        {branding.platformName} is built by {branding.companyName} to empower ISPs, WISPs, and Hotspot operators with automated billing, real-time MikroTik RouterOS synchronization, and M-Pesa automated payments.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
                            <Zap className="w-6 h-6 text-sky-400" />
                            <h3 className="font-bold text-white text-base">Speed & Automation</h3>
                            <p className="text-xs text-slate-400">Automated STK push payment processing and sub-2-second router user creation.</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
                            <Shield className="w-6 h-6 text-emerald-400" />
                            <h3 className="font-bold text-white text-base">Enterprise Security</h3>
                            <p className="text-xs text-slate-400">Strict multi-tenant data isolation and encrypted router credentials.</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
                            <Users className="w-6 h-6 text-indigo-400" />
                            <h3 className="font-bold text-white text-base">Subscriber CRM</h3>
                            <p className="text-xs text-slate-400">Complete customer management, wallets, and SMS/WhatsApp notifications.</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-2">
                        <h2 className="text-base font-bold text-white">Contact Information</h2>
                        <p>Our headquarters is based in {branding.businessAddress}. For support or partnerships, contact us:</p>
                        <ul className="list-disc pl-5 font-mono text-sky-400 text-xs space-y-1">
                            <li>Phone: {branding.supportPhone}</li>
                            <li>Email: {branding.supportEmail}</li>
                            <li>Website: {branding.websiteUrl}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutUs;
