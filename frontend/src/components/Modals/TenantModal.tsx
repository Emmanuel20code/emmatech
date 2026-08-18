import React, { useState } from 'react';
import Modal from '../Common/Modal';
import axios from 'axios';

interface TenantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const TenantModal: React.FC<TenantModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [onboardingFee, setOnboardingFee] = useState('300');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const token = localStorage.getItem('token');
            interface OnboardResponse {
                message?: string;
            }
            const res = await axios.post<OnboardResponse>('/api/v1/superadmin/tenants/onboard', {
                name,
                subdomain,
                email,
                phoneNumber,
                onboardingFeeCents: Number(onboardingFee) * 100
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccessMessage(res.data.message || 'Tenant successfully onboarded with M-Pesa fee request!');
            setTimeout(() => {
                onSuccess();
                onClose();
                setLoading(false);
            }, 1500);
        } catch (err: unknown) {
            let msg = 'Failed to onboard tenant';
            if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object' && 'error' in err.response.data) {
                msg = String((err.response.data as { error: unknown }).error);
            } else if (err instanceof Error) {
                msg = err.message;
            }
            setError(msg);
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Register New Tenant & Collect Onboarding Fee">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-bold">
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl text-xs font-bold">
                        {successMessage}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Organization Name</label>
                        <input
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold focus:border-sky-500 focus:outline-none transition-all"
                            placeholder="e.g. Acme Web Services"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Namespace / Subdomain</label>
                        <div className="relative">
                            <input
                                required
                                value={subdomain}
                                onChange={(e) => setSubdomain(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold focus:border-sky-500 focus:outline-none transition-all"
                                placeholder="acme"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">.jevish.site</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Admin Email</label>
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold focus:border-sky-500 focus:outline-none transition-all"
                                placeholder="admin@acme.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">M-Pesa Phone (Onboarding Fee)</label>
                            <input
                                required
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold focus:border-sky-500 focus:outline-none transition-all"
                                placeholder="0712345678"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Onboarding Fee (KES)</label>
                        <input
                            required
                            type="number"
                            value={onboardingFee}
                            onChange={(e) => setOnboardingFee(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold focus:border-sky-500 focus:outline-none transition-all"
                            placeholder="2500"
                        />
                    </div>
                </div>

                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100">
                    <h4 className="font-bold text-sky-900 text-sm">M-Pesa Onboarding Integration</h4>
                    <p className="text-xs text-sky-700 opacity-80 mt-1 leading-relaxed">
                        Submitting will provision the tenant workspace, generate a setup invoice, and instantly trigger an M-Pesa STK Push prompt to the phone number provided for seamless onboarding fee collection.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:bg-sky-500 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
                >
                    {loading ? 'Processing STK Push & Provisioning...' : 'Provision Tenant & Trigger M-Pesa Onboarding Fee'}
                </button>
            </form>
        </Modal>
    );
};

export default TenantModal;
