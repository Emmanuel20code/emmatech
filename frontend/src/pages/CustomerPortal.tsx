import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import BackButton from '../components/Common/BackButton';
import ThemeToggle from '../components/Common/ThemeToggle';

interface ActivityItem {
    action: string;
    date: string;
    amount: string;
}

interface CustomerDashboardData {
    name: string;
    email: string;
    currentPlan: string;
    balance: number;
    dataUsed: number;
    dataLimit: number;
    expires: string;
    recentActivity: ActivityItem[];
}

const CustomerPortal = () => {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [customerData, setCustomerData] = useState<CustomerDashboardData | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');

            // Check if we have authentication token
            if (token) {
                try {
                    // Try to verify token with backend
                    const res = await axios.get<{ customer: CustomerDashboardData }>('/api/v1/auth/verify', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setIsAuthenticated(true);
                    setCustomerData(res.data.customer);
                } catch (err: unknown) {
                    console.error('[CustomerPortal] Auth verification failed:', err);
                    // Token invalid, redirect to login
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/login');
                }
            } else {
                // Show sample subscriber dashboard for guest preview
                setIsAuthenticated(true);
                setCustomerData({
                    name: 'Client / Subscriber View',
                    email: 'subscriber@jevish.site',
                    currentPlan: 'Daily WiFi Unlimited Pass',
                    balance: 1500,
                    dataUsed: 35,
                    dataLimit: 100,
                    expires: '5 Days',
                    recentActivity: [
                        { action: 'M-Pesa STK Push Payment', date: 'Yesterday', amount: '+KES 500' },
                        { action: 'Daily WiFi Unlimited Renewed', date: '2 days ago', amount: '+KES 1,000' },
                        { action: 'Voucher STG-9921 Claimed', date: '1 week ago', amount: '+KES 200' }
                    ]
                });
            }
            setIsLoading(false);
        };

        checkAuth();
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center transition-colors duration-300">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[var(--border-subtle)] border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--text-secondary)] font-bold">Loading Customer Portal...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300">
            {/* Customer Header */}
            <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-0 z-50 shadow-sm transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-6">
                        <BackButton to="/" label="Home" variant="dark" />
                        <div className="flex-1 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-black text-[var(--text-primary)]">Welcome, {customerData?.name || 'Customer'}</h1>
                                <p className="text-[var(--text-secondary)] font-bold">Your personal internet service dashboard</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <ThemeToggle />
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                                    CLIENT PORTAL
                                </span>
                                <button
                                    onClick={() => navigate('/tenant')}
                                    className="px-3 py-1.5 bg-sky-500/10 text-sky-600 font-bold rounded-xl hover:bg-sky-500 hover:text-white border border-sky-500/20 transition-all text-xs"
                                >
                                    🏢 Tenant Portal
                                </button>
                                <button
                                    onClick={() => navigate('/captive-portal')}
                                    className="px-3 py-1.5 bg-purple-500/10 text-purple-600 font-bold rounded-xl hover:bg-purple-500 hover:text-white border border-purple-500/20 transition-all text-xs"
                                >
                                    📶 Captive Portal
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('token');
                                        localStorage.removeItem('user');
                                        navigate('/login');
                                    }}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-xs"
                                >
                                    Sign In / Switch
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8 space-y-8">
                {/* Customer Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="premium-card bg-[var(--bg-surface)] border-[var(--border-subtle)]">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">Current Plan</p>
                                <h3 className="text-2xl font-black text-[var(--text-primary)]">{customerData?.currentPlan || 'Monthly Pro'}</h3>
                            </div>
                            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="premium-card bg-[var(--bg-surface)] border-[var(--border-subtle)]">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">Account Balance</p>
                                <h3 className="text-2xl font-black text-[var(--text-primary)]">KES {customerData?.balance?.toLocaleString() || '2,500'}</h3>
                            </div>
                            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="premium-card bg-[var(--bg-surface)] border-[var(--border-subtle)]">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">Data Usage</p>
                                <h3 className="text-2xl font-black text-[var(--text-primary)]">{customerData?.dataUsed || 45}%</h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">of {customerData?.dataLimit || 100}GB</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-sky-50 text-sky-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="premium-card bg-[var(--bg-surface)] border-[var(--border-subtle)]">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-black text-[var(--text-muted)] uppercase mb-2">Plan Expires</p>
                                <h3 className="text-2xl font-black text-[var(--text-primary)]">{customerData?.expires || '12 Days'}</h3>
                            </div>
                            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Usage Progress */}
                <div className="premium-card bg-[var(--bg-surface)] border-[var(--border-subtle)]">
                    <div className="p-6 border-b border-[var(--border-subtle)]">
                        <h2 className="text-xl font-black text-[var(--text-primary)]">Data Usage Progress</h2>
                        <p className="text-[var(--text-secondary)] font-bold mt-1">Monitor your data consumption</p>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm font-bold text-[var(--text-primary)]">
                                <span>Data Used: {customerData?.dataUsed || 45}GB</span>
                                <span>Limit: {customerData?.dataLimit || 100}GB</span>
                            </div>
                            <div className="w-full bg-[var(--bg-surface-elevated)] rounded-full h-4">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((customerData?.dataUsed ?? 0) / (customerData?.dataLimit ?? 100)) * 100}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`h-4 rounded-full ${(customerData?.dataUsed ?? 0) > 80 ? 'bg-rose-500' : (customerData?.dataUsed ?? 0) > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                ></motion.div>
                            </div>
                            <div className="flex justify-between text-xs text-[var(--text-muted)] font-black uppercase tracking-widest">
                                <span>Low usage</span>
                                <span>High usage</span>
                                <span>Limit reached</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Customer Tabs */}
                <div className="premium-card bg-[var(--bg-surface)] border-[var(--border-subtle)]">
                    <div className="border-b border-[var(--border-subtle)]">
                        <div className="flex space-x-8 px-6">
                            {['dashboard', 'billing', 'activity', 'support'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-4 px-2 font-black text-sm uppercase tracking-widest border-b-2 transition-colors ${activeTab === tab
                                        ? 'border-sky-500 text-sky-500'
                                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-6">
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-black text-slate-900">Quick Actions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button className="btn-primary py-4 text-sm font-black uppercase tracking-widest">
                                        Top Up Data
                                    </button>
                                    <button className="btn-secondary py-4 text-sm font-black uppercase tracking-widest">
                                        Upgrade Plan
                                    </button>
                                    <button className="btn-ghost py-4 text-sm font-black uppercase tracking-widest">
                                        View Usage
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'billing' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-black text-[var(--text-primary)]">Billing History</h3>
                                <div className="space-y-4">
                                    {customerData?.recentActivity?.map((activity: ActivityItem, index: number) => (
                                        <div key={index} className="flex justify-between items-center p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl">
                                            <div>
                                                <p className="font-bold text-[var(--text-primary)]">{activity.action}</p>
                                                <p className="text-sm text-[var(--text-muted)]">{activity.date}</p>
                                            </div>
                                            <p className={`font-black ${activity.amount.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {activity.amount}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-black text-[var(--text-primary)]">Recent Activity</h3>
                                <div className="space-y-4">
                                    <div className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl">
                                        <p className="font-bold text-[var(--text-primary)]">Connected to WiFi Network</p>
                                        <p className="text-sm text-[var(--text-muted)]">Today at 10:30 AM</p>
                                    </div>
                                    <div className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl">
                                        <p className="font-bold text-[var(--text-primary)]">Data Top-up Successful</p>
                                        <p className="text-sm text-[var(--text-muted)]">Yesterday at 3:15 PM</p>
                                    </div>
                                    <div className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl">
                                        <p className="font-bold text-[var(--text-primary)]">Plan Renewal Scheduled</p>
                                        <p className="text-sm text-[var(--text-muted)]">In 2 days</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'support' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-black text-[var(--text-primary)]">Customer Support</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl">
                                        <h4 className="font-black text-[var(--text-primary)] mb-2">Live Chat</h4>
                                        <p className="text-sm text-[var(--text-secondary)] mb-4">Connect with our support team instantly</p>
                                        <button className="btn-primary py-2 px-6 text-xs font-black uppercase tracking-widest">Start Chat</button>
                                    </div>
                                    <div className="p-6 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl">
                                        <h4 className="font-black text-[var(--text-primary)] mb-2">Help Center</h4>
                                        <p className="text-sm text-[var(--text-secondary)] mb-4">Find answers to common questions</p>
                                        <button className="btn-secondary py-2 px-6 text-xs font-black uppercase tracking-widest">Visit Help Center</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerPortal;
