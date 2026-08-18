import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../context/BrandingContext';
import { FileText, ArrowLeft } from 'lucide-react';

const TermsConditions: React.FC = () => {
    const { branding } = useBranding();
    return (
        <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center gap-2 text-sky-400 font-bold text-sm hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>

                <div className="border-b border-slate-800 pb-6">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <FileText className="w-8 h-8 text-sky-500" /> Terms & Conditions
                    </h1>
                    <p className="text-sm text-slate-400 mt-2">Effective Date: July 2026 — {branding.companyName}</p>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">1. Service Provision</h2>
                        <p>{branding.platformName} provides SaaS billing software for Internet Service Providers and Hotspot owners. By using our platform, you agree to comply with local communications and telecom regulations.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">2. Payments & Subscriptions</h2>
                        <p>All subscription fees and platform usage charges are billed according to your selected plan. M-Pesa billing integration operates in compliance with Safaricom guidelines.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">3. Acceptable Use Policy</h2>
                        <p>You agree not to use the billing software for fraudulent activities, illegal network traffic redirection, or unverified SMS spamming.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">4. Support & Maintenance</h2>
                        <p>For technical inquiries, contact support at {branding.supportPhone} or {branding.supportEmail}.</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TermsConditions;
