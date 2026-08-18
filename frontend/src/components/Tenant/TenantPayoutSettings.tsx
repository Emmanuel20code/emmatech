import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle, CreditCard, Smartphone, Building2 } from 'lucide-react';

interface PayoutSettings {
    payoutMethod: 'TILL' | 'PAYBILL' | 'BANK';
    directPayoutEnabled: boolean;
    tillNumber: string;
    tillStoreName: string;
    paybillNumber: string;
    paybillAccount: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    bankBranch: string;
    bankSwiftCode: string;
    pochiPhone: string;
    mpesaWithdrawalName: string;
    gatewayStatus: string;
}

export default function TenantPayoutSettings() {
    const [settings, setSettings] = useState<PayoutSettings>({
        payoutMethod: 'TILL',
        directPayoutEnabled: true,
        tillNumber: '',
        tillStoreName: '',
        paybillNumber: '',
        paybillAccount: '',
        bankName: '',
        bankAccountNumber: '',
        bankAccountName: '',
        bankBranch: '',
        bankSwiftCode: '',
        pochiPhone: '',
        mpesaWithdrawalName: '',
        gatewayStatus: 'Loading...'
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/v1/payments/tenant/payout-settings', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSettings({
                ...settings,
                ...res.data
            });
        } catch (error: any) {
            console.error('Failed to load payout settings:', error);
            setMessage({ type: 'error', text: 'Could not load your payout settings.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.put('/api/v1/payments/tenant/payout-settings', settings, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage({ type: 'success', text: res.data.message || 'Payout settings saved successfully.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.error || error.message || 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-xs font-bold text-slate-500">Loading Payout Configuration...</div>;
    }

    return (
        <form onSubmit={handleSave} className="space-y-8">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-5">
                <div>
                    <h2 className="text-xl font-black text-[var(--text-primary)]">Direct Payout Settings</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Configure your receiving account for customer Wi-Fi payments.</p>
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="bg-emerald-500 text-white text-xs font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save Payout Details'}</span>
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-2 text-xs font-bold border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            <div className="bg-sky-500/10 border border-sky-500/20 p-5 rounded-3xl flex items-start gap-4">
                <div className="p-3 bg-sky-500 rounded-2xl text-white">
                    <CreditCard className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)]">Direct Automatic Settlement Active</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                        All payments made by your hotspot customers via M-Pesa STK Push are directly routed into your provided destination account immediately. You do not need to request manual withdrawals. The master payment gateway is managed by the SuperAdmin.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${settings.payoutMethod === 'TILL' ? 'border-emerald-500 bg-emerald-500/5' : 'border-[var(--border-subtle)] hover:border-emerald-500/50'}`}>
                    <input type="radio" name="payoutMethod" checked={settings.payoutMethod === 'TILL'} onChange={() => setSettings({ ...settings, payoutMethod: 'TILL' })} className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 border-slate-300" />
                    <div>
                        <div className="font-bold text-sm text-[var(--text-primary)]">Buy Goods Till</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Receive directly to M-Pesa Till</div>
                    </div>
                </label>

                <label className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${settings.payoutMethod === 'PAYBILL' ? 'border-emerald-500 bg-emerald-500/5' : 'border-[var(--border-subtle)] hover:border-emerald-500/50'}`}>
                    <input type="radio" name="payoutMethod" checked={settings.payoutMethod === 'PAYBILL'} onChange={() => setSettings({ ...settings, payoutMethod: 'PAYBILL' })} className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 border-slate-300" />
                    <div>
                        <div className="font-bold text-sm text-[var(--text-primary)]">Paybill Account</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Receive directly to Paybill</div>
                    </div>
                </label>

                <label className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${settings.payoutMethod === 'BANK' ? 'border-sky-500 bg-sky-500/5' : 'border-[var(--border-subtle)] hover:border-sky-500/50'}`}>
                    <input type="radio" name="payoutMethod" checked={settings.payoutMethod === 'BANK'} onChange={() => setSettings({ ...settings, payoutMethod: 'BANK' })} className="w-4 h-4 text-sky-500 focus:ring-sky-500 border-slate-300" />
                    <div>
                        <div className="font-bold text-sm text-[var(--text-primary)]">Bank Account</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">Direct EFT/RTGS to Bank</div>
                    </div>
                </label>
            </div>

            <div className="bg-[var(--bg-surface-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)]">
                {settings.payoutMethod === 'TILL' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Buy Goods Till Number <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={settings.tillNumber}
                                onChange={e => setSettings({ ...settings, tillNumber: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-emerald-500 outline-none"
                                placeholder="e.g. 5001234"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Till Store Name</label>
                            <input
                                type="text"
                                value={settings.tillStoreName}
                                onChange={e => setSettings({ ...settings, tillStoreName: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-emerald-500 outline-none"
                                placeholder="e.g. Kenshop Wi-Fi"
                            />
                        </div>
                    </div>
                )}

                {settings.payoutMethod === 'PAYBILL' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Paybill Number <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={settings.paybillNumber}
                                onChange={e => setSettings({ ...settings, paybillNumber: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-emerald-500 outline-none"
                                placeholder="e.g. 247247"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Account Number / Name <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={settings.paybillAccount}
                                onChange={e => setSettings({ ...settings, paybillAccount: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-emerald-500 outline-none"
                                placeholder="e.g. 011000222333 (Bank Acc)"
                            />
                        </div>
                    </div>
                )}

                {settings.payoutMethod === 'BANK' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Bank Name <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={settings.bankName}
                                onChange={e => setSettings({ ...settings, bankName: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                placeholder="e.g. Equity Bank"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Account Number <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={settings.bankAccountNumber}
                                onChange={e => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                placeholder="e.g. 0123456789"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Account Name</label>
                            <input
                                type="text"
                                value={settings.bankAccountName}
                                onChange={e => setSettings({ ...settings, bankAccountName: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Branch / Swift Code</label>
                            <input
                                type="text"
                                value={settings.bankBranch}
                                onChange={e => setSettings({ ...settings, bankBranch: e.target.value })}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] focus:border-sky-500 outline-none"
                                placeholder="e.g. Nairobi Branch"
                            />
                        </div>
                    </div>
                )}
            </div>
        </form>
    );
}
