import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../context/BrandingContext';
import { Activity, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';

const SystemStatus: React.FC = () => {
    const { branding } = useBranding();
    return (
        <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center gap-2 text-sky-400 font-bold text-sm hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>

                <div className="border-b border-slate-800 pb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            <Activity className="w-8 h-8 text-emerald-400" /> System Operational Status
                        </h1>
                        <p className="text-sm text-slate-400 mt-2">{branding.platformName} Cloud Infrastructure</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs rounded-full">
                        <CheckCircle2 className="w-4 h-4" /> All Systems Operational
                    </div>
                </div>

                <div className="space-y-4">
                    {[
                        { service: 'Authentication & API Gateway', status: 'Operational', uptime: '100%' },
                        { service: 'M-Pesa Payment Gateway & STK Push', status: 'Operational', uptime: '99.98%' },
                        { service: 'MikroTik RouterOS API Engine', status: 'Operational', uptime: '100%' },
                        { service: 'SMS & WhatsApp Notification Gateway', status: 'Operational', uptime: '99.95%' },
                        { service: 'Captive Portal Monetization & Ads Engine', status: 'Operational', uptime: '100%' },
                        { service: 'Database & Multi-Tenant Billing Engine', status: 'Operational', uptime: '100%' },
                    ].map((s, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                            <div>
                                <div className="font-bold text-white text-sm">{s.service}</div>
                                <div className="text-xs text-slate-400">90-day uptime: {s.uptime}</div>
                            </div>
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full">
                                {s.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SystemStatus;
