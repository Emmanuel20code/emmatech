import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../context/BrandingContext';
import { ShieldCheck, Lock, ArrowLeft } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
    const { branding } = useBranding();
    return (
        <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center gap-2 text-sky-400 font-bold text-sm hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>

                <div className="border-b border-slate-800 pb-6">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-sky-500" /> Privacy Policy
                    </h1>
                    <p className="text-sm text-slate-400 mt-2">Last updated: July 2026 — {branding.companyName}</p>
                </div>

                <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
                        <p>We collect information you provide directly to us when creating a subscriber account, setting up WiFi billing, configuring MikroTik router credentials, or processing payments via M-Pesa. This includes contact details, phone numbers, email addresses, billing metadata, and network session logs.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">2. How We Use Information</h2>
                        <p>We use the collected information to operate, maintain, and provide the WiFi billing features, process transactions, dispatch SMS/Email notifications, and comply with legal requirements.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">3. Data Isolation & Security</h2>
                        <p>Tenant data is strictly isolated across multi-tenant boundaries. All network credentials, M-Pesa API keys, and session data are stored securely with enterprise encryption standards.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-bold text-white">4. Contacting Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
                        <ul className="list-disc pl-5 space-y-1 font-mono text-sky-400">
                            <li>Phone: {branding.supportPhone}</li>
                            <li>Email: {branding.supportEmail}</li>
                            <li>Address: {branding.businessAddress}</li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
