import { useState } from 'react';
import { Monitor, Tablet, Smartphone, Sun, Moon, RotateCcw } from 'lucide-react';

export const CaptivePortalPreview = () => {
    const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('mobile');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [selectedPackage, setSelectedPackage] = useState<string>('24hr');
    const [phone, setPhone] = useState<string>('');
    const [voucherCode, setVoucherCode] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'mpesa' | 'voucher'>('mpesa');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const getContainerStyles = () => {
        if (device === 'desktop') return 'w-full max-w-4xl h-[650px]';
        if (device === 'tablet') {
            return orientation === 'portrait' ? 'w-[600px] h-[750px]' : 'w-[750px] h-[550px]';
        }
        // Mobile
        return orientation === 'portrait' ? 'w-[360px] h-[700px]' : 'w-[680px] h-[360px]';
    };

    const handleConnect = () => {
        if (activeTab === 'mpesa' && !phone) {
            setStatusMessage('Please enter phone number');
            return;
        }
        if (activeTab === 'voucher' && !voucherCode) {
            setStatusMessage('Please enter voucher code');
            return;
        }
        setStatusMessage('STK Push sent or Voucher validated successfully!');
    };

    return (
        <div className="space-y-6">
            {/* Viewport Control Bar */}
            <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mr-2">Device:</span>
                    <button
                        onClick={() => setDevice('desktop')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${device === 'desktop' ? 'bg-sky-500 text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]'}`}
                    >
                        <Monitor size={14} /> Desktop
                    </button>
                    <button
                        onClick={() => setDevice('tablet')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${device === 'tablet' ? 'bg-sky-500 text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]'}`}
                    >
                        <Tablet size={14} /> Tablet
                    </button>
                    <button
                        onClick={() => setDevice('mobile')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${device === 'mobile' ? 'bg-sky-500 text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]'}`}
                    >
                        <Smartphone size={14} /> Phone
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mr-2">Theme & Orientation:</span>
                    <button
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] rounded-xl font-bold text-xs hover:text-[var(--text-primary)]"
                    >
                        {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />} {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                    </button>
                    {device !== 'desktop' && (
                        <button
                            onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] rounded-xl font-bold text-xs hover:text-[var(--text-primary)]"
                        >
                            <RotateCcw size={14} /> {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
                        </button>
                    )}
                </div>
            </div>

            {/* Simulated Captive Portal Preview Container */}
            <div className="flex justify-center bg-[var(--bg-main)] p-6 rounded-3xl border border-[var(--border-subtle)] overflow-auto min-h-[600px]">
                <div
                    className={`transition-all duration-300 rounded-3xl border-8 border-slate-900 shadow-2xl overflow-y-auto ${getContainerStyles()} ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}
                >
                    {/* Captive Portal Header */}
                    <div className="p-6 text-center bg-gradient-to-r from-sky-500 to-indigo-600 text-white">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-2 backdrop-blur-md">
                            <span className="font-black text-xl">S</span>
                        </div>
                        <h2 className="text-xl font-black">Jevish WiFi Zone</h2>
                        <p className="text-xs text-white/80 font-bold">Fast & Secure High-Speed Internet</p>
                    </div>

                    {/* Captive Portal Body */}
                    <div className="p-6 space-y-6">
                        {/* Package Selection */}
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400 mb-3">1. Select WiFi Package</p>
                            <div className="space-y-2">
                                {[
                                    { id: '1hr', name: '1 Hour Quick Pass', price: 'KES 20', speed: '5 Mbps' },
                                    { id: '24hr', name: '24 Hour Unlimited', price: 'KES 100', speed: '10 Mbps' },
                                    { id: '7day', name: '7 Day Super Saver', price: 'KES 500', speed: '15 Mbps' },
                                ].map(pkg => (
                                    <div
                                        key={pkg.id}
                                        onClick={() => setSelectedPackage(pkg.id)}
                                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${selectedPackage === pkg.id ? 'border-sky-500 bg-sky-500/10 shadow-sm' : theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
                                    >
                                        <div>
                                            <p className="font-black text-sm">{pkg.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">Speed: {pkg.speed}</p>
                                        </div>
                                        <span className="font-black text-sky-500 text-sm">{pkg.price}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment / Voucher Selector */}
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400 mb-3">2. Choose Payment Method</p>
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setActiveTab('mpesa')}
                                    className={`flex-1 py-2 font-bold text-xs rounded-xl border transition-all ${activeTab === 'mpesa' ? 'bg-emerald-500 text-white border-emerald-500' : theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                                >
                                    M-Pesa STK Push
                                </button>
                                <button
                                    onClick={() => setActiveTab('voucher')}
                                    className={`flex-1 py-2 font-bold text-xs rounded-xl border transition-all ${activeTab === 'voucher' ? 'bg-sky-500 text-white border-sky-500' : theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                                >
                                    Voucher Code
                                </button>
                            </div>

                            {activeTab === 'mpesa' ? (
                                <div className="space-y-3">
                                    <input
                                        type="tel"
                                        placeholder="0712345678 (M-Pesa Number)"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className={`w-full px-4 py-3 text-sm font-bold rounded-xl border outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Enter Voucher Code (e.g. STG-8821)"
                                        value={voucherCode}
                                        onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                                        className={`w-full px-4 py-3 text-sm font-bold rounded-xl border outline-none ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                    />
                                </div>
                            )}
                        </div>

                        {statusMessage && (
                            <div className="p-3 bg-sky-500/20 text-sky-400 rounded-xl text-xs font-bold text-center">
                                {statusMessage}
                            </div>
                        )}

                        <button
                            onClick={handleConnect}
                            className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-500/20 hover:opacity-95 transition-all"
                        >
                            Connect to WiFi
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
