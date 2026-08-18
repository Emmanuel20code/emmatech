import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building2, CheckCircle2, ShieldCheck, FileText, Calendar, DollarSign, ArrowRight, MessageSquare, XCircle, PhoneCall, Sparkles, Download, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface QuoteData {
    quote: {
        id: string;
        quoteNumber: string;
        monthlyCostCents: number;
        setupFeeCents: number;
        maxActiveUsers: number;
        maxRouters: number;
        smsAllocation: number;
        whatsappAllocation: number;
        storageAllocationMB: number;
        customModules: string;
        discountCents: number;
        taxPercentage: number;
        contractDurationMonths: number;
        status: string;
        validUntil: string;
        termsAndConditions: string;
    };
    lead: {
        companyName: string;
        contactPerson: string;
        position: string;
        email: string;
        phone: string;
        country: string;
    };
    financials: {
        monthlyKes: number;
        setupFeeKes: number;
        discountKes: number;
        subtotalKes: number;
        taxKes: number;
        totalFirstMonthKes: number;
    };
}

export const EnterpriseQuoteView: React.FC = () => {
    const { quoteId } = useParams<{ quoteId: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<QuoteData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isResponding, setIsResponding] = useState(false);
    const [responseMessage, setResponseMessage] = useState('');
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [notesAction, setNotesAction] = useState<'REJECT' | 'REQUEST_CHANGES'>('REQUEST_CHANGES');
    const [customerNotes, setCustomerNotes] = useState('');

    useEffect(() => {
        const fetchQuote = async () => {
            try {
                const res = await axios.get(`/api/v1/enterprise/quote/${quoteId}`);
                setData(res.data);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load enterprise quotation details.');
            } finally {
                setLoading(false);
            }
        };
        fetchQuote();
    }, [quoteId]);

    const handleAction = async (action: 'ACCEPT' | 'REJECT' | 'REQUEST_CHANGES') => {
        setIsResponding(true);
        setResponseMessage('');
        try {
            const res = await axios.post(`/api/v1/enterprise/quote/${quoteId}/respond`, {
                action,
                customerNotes
            });

            if (res.data.success) {
                setResponseMessage(res.data.message);
                if (action === 'ACCEPT' && res.data.redirectUrl) {
                    setTimeout(() => {
                        window.location.href = res.data.redirectUrl;
                    }, 1500);
                } else {
                    // Refresh proposal status
                    const updated = await axios.get(`/api/v1/enterprise/quote/${quoteId}`);
                    setData(updated.data);
                    setShowNotesModal(false);
                }
            }
        } catch (err: any) {
            setResponseMessage(err.response?.data?.error || 'Failed to submit response.');
        } finally {
            setIsResponding(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-400 text-sm font-medium">Loading Enterprise Proposal Specification...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
                <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
                    <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
                    <h2 className="text-xl font-bold">Proposal Unavailable</h2>
                    <p className="text-slate-400 text-sm">{error || 'The requested quotation reference does not exist or has expired.'}</p>
                    <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition">
                        Return to Home Page
                    </button>
                </div>
            </div>
        );
    }

    const { quote, lead, financials } = data;
    const modules: string[] = quote.customModules ? JSON.parse(quote.customModules) : [
        'Multi-Location Centralized Dashboard',
        'Custom White-Label Portal & Invoices',
        'Dedicated MikroTik Bandwidth Engine',
        '24/7 SLA Priority Account Executive'
    ];

    return (
        <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans p-4 md:p-12">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Top Header Card */}
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -tr-8 -tt-8 pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <div>
                                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-black uppercase tracking-wider border border-amber-500/20">
                                    {quote.status} • PROPOSAL #{quote.quoteNumber}
                                </span>
                                <h1 className="text-2xl md:text-3xl font-black text-white mt-1">Enterprise Solution Proposal</h1>
                                <p className="text-slate-400 text-sm font-medium">Prepared for <strong className="text-white">{lead.companyName}</strong></p>
                            </div>
                        </div>

                        <div className="text-right space-y-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valid Until</p>
                            <p className="text-sm font-black text-sky-400 flex items-center justify-end gap-1.5">
                                <Calendar className="w-4 h-4" /> {new Date(quote.validUntil).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>

                {responseMessage && (
                    <div className="p-4 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-2xl text-sm font-semibold text-center">
                        {responseMessage}
                    </div>
                )}

                {/* Executive Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase">Monthly Retainer</span>
                        <p className="text-2xl font-black text-white">KES {financials.monthlyKes.toLocaleString()} <span className="text-xs font-normal text-slate-400">/mo</span></p>
                    </div>
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase">One-Time Setup Fee</span>
                        <p className="text-2xl font-black text-white">KES {financials.setupFeeKes.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase">Subscribers Capacity</span>
                        <p className="text-2xl font-black text-emerald-400">{quote.maxActiveUsers === -1 ? 'Unlimited' : quote.maxActiveUsers.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                        <span className="text-xs font-bold text-slate-400 uppercase">MikroTik Router Syncs</span>
                        <p className="text-2xl font-black text-sky-400">{quote.maxRouters === -1 ? 'Unlimited' : quote.maxRouters.toLocaleString()}</p>
                    </div>
                </div>

                {/* Scope & Capabilities Checklist */}
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-sky-400" /> Included Enterprise Deliverables & Modules
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {modules.map((m, idx) => (
                            <div key={idx} className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                <span className="text-sm font-bold text-slate-200">{m}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Financial Table */}
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-sky-400" /> Pricing & Financial Breakdown
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-800/80 text-xs font-black uppercase text-slate-400 border-b border-slate-700">
                                <tr>
                                    <th className="p-4">Item Description</th>
                                    <th className="p-4">Term</th>
                                    <th className="p-4 text-right">Amount (KES)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                <tr>
                                    <td className="p-4 font-bold text-white">Enterprise Subscription Plan (Monthly Retainer)</td>
                                    <td className="p-4">{quote.contractDurationMonths} Months</td>
                                    <td className="p-4 text-right font-black">KES {financials.monthlyKes.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="p-4 font-bold text-white">Custom RADIUS & MikroTik System Deployment (Setup Fee)</td>
                                    <td className="p-4">One-Time</td>
                                    <td className="p-4 text-right font-black">KES {financials.setupFeeKes.toLocaleString()}</td>
                                </tr>
                                {financials.discountKes > 0 && (
                                    <tr className="text-emerald-400">
                                        <td className="p-4 font-bold">Negotiated Enterprise Discount</td>
                                        <td className="p-4">Special Credit</td>
                                        <td className="p-4 text-right font-black">- KES {financials.discountKes.toLocaleString()}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="p-4 font-bold text-slate-400">Subtotal Before Tax</td>
                                    <td className="p-4"></td>
                                    <td className="p-4 text-right font-bold">KES {financials.subtotalKes.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="p-4 font-bold text-slate-400">Value Added Tax (VAT {quote.taxPercentage}%)</td>
                                    <td className="p-4">16%</td>
                                    <td className="p-4 text-right font-bold">KES {financials.taxKes.toLocaleString()}</td>
                                </tr>
                                <tr className="bg-slate-800/50 text-white">
                                    <td className="p-4 font-black text-base">Total Initial Activation Payment Due</td>
                                    <td className="p-4"></td>
                                    <td className="p-4 text-right font-black text-xl text-sky-400">KES {financials.totalFirstMonthKes.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Terms and Action Footer */}
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-6">
                    <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase text-slate-400">Terms & Service Level Agreement</h4>
                        <p className="text-xs text-slate-400 leading-relaxed bg-slate-800/40 p-4 rounded-xl border border-slate-800">{quote.termsAndConditions}</p>
                    </div>

                    {quote.status === 'SENT' || quote.status === 'CHANGES_REQUESTED' ? (
                        <div className="flex flex-col md:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                onClick={() => { setNotesAction('REJECT'); setShowNotesModal(true); }}
                                disabled={isResponding}
                                className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-rose-500/20 text-rose-400 rounded-xl font-bold text-xs transition"
                            >
                                Decline Proposal
                            </button>
                            <button
                                onClick={() => { setNotesAction('REQUEST_CHANGES'); setShowNotesModal(true); }}
                                disabled={isResponding}
                                className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition"
                            >
                                Request Changes / Negotiation
                            </button>
                            <button
                                onClick={() => handleAction('ACCEPT')}
                                disabled={isResponding}
                                className="w-full md:w-auto px-8 py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" /> Accept Proposal & Proceed to Activation
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-800/80 rounded-xl text-center text-sm font-bold text-slate-300">
                            Proposal Status: <span className="text-sky-400">{quote.status}</span>. For further assistance, contact your Account Executive.
                        </div>
                    )}
                </div>

            </div>

            {/* Notes Modal for Decline or Change Request */}
            {showNotesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white">
                        <h3 className="text-lg font-bold">
                            {notesAction === 'REJECT' ? 'Decline Proposal' : 'Request Changes'}
                        </h3>
                        <p className="text-xs text-slate-400">Please provide notes or feedback for your Enterprise Account Manager:</p>
                        <textarea
                            rows={4}
                            value={customerNotes}
                            onChange={(e) => setCustomerNotes(e.target.value)}
                            placeholder="Enter notes or custom SLA adjustments..."
                            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowNotesModal(false)} className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl">Cancel</button>
                            <button
                                onClick={() => handleAction(notesAction)}
                                disabled={isResponding}
                                className="px-6 py-2 bg-sky-500 text-xs font-bold text-white rounded-xl"
                            >
                                Submit Response
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseQuoteView;
