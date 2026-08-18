import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../context/BrandingContext';
import { HelpCircle, ArrowLeft, BookOpen, Phone, Mail, Search } from 'lucide-react';

const HelpCenter: React.FC = () => {
    const { branding } = useBranding();
    return (
        <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center gap-2 text-sky-400 font-bold text-sm hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>

                <div className="border-b border-slate-800 pb-6">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <HelpCircle className="w-8 h-8 text-sky-500" /> Help Center & Knowledge Base
                    </h1>
                    <p className="text-sm text-slate-400 mt-2">Find guides, setup tutorials, and technical support for {branding.platformName}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
                        <BookOpen className="w-6 h-6 text-sky-400" />
                        <h3 className="font-bold text-white text-base">MikroTik RouterOS Setup Guide</h3>
                        <p className="text-xs text-slate-400">Step-by-step instructions for configuring API access on ports 8728 and 8729.</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
                        <BookOpen className="w-6 h-6 text-sky-400" />
                        <h3 className="font-bold text-white text-base">M-Pesa STK Push Integration</h3>
                        <p className="text-xs text-slate-400">How to configure your Paybill or Till Number for instant automated subscriber renewal.</p>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl text-center space-y-4">
                    <h3 className="text-base font-bold text-white">Need Personalized Assistance?</h3>
                    <p className="text-xs text-slate-400">Our senior engineering team is standing by to help with your ISP deployment.</p>
                    <div className="flex items-center justify-center gap-6 text-xs font-mono text-sky-400">
                        <span>Phone: {branding.supportPhone}</span>
                        <span>Email: {branding.supportEmail}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpCenter;
