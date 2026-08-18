import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useBranding } from '../../context/BrandingContext';
import {
    Palette, Image as ImageIcon, ShieldCheck, Phone, Mail, Globe, MapPin,
    Save, RefreshCw, CheckCircle2, AlertCircle, Eye, Sliders, Layout, Lock
} from 'lucide-react';

const BrandingCenter: React.FC = () => {
    const { branding, refreshBranding } = useBranding();
    const [activeTab, setActiveTab] = useState<'identity' | 'logos' | 'colors' | 'legal'>('identity');
    const [formData, setFormData] = useState<any>({ ...branding });
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        setFormData({ ...branding });
    }, [branding]);

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMsg('');
        setErrorMsg('');

        try {
            const payload = {
                ...formData,
                socialLinks: typeof formData.socialLinks === 'object' ? JSON.stringify(formData.socialLinks) : formData.socialLinks
            };
            await axios.put('/api/v1/superadmin/branding', payload);
            await refreshBranding();
            setSuccessMsg('System branding and theme custom properties updated successfully!');
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || 'Failed to update branding settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Palette className="w-5 h-5 text-sky-500" /> Branding & White-Label Management Center
                    </h1>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Configure global system identity, dynamic CSS color tokens, support channels, and logos</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-sm font-bold shadow-md transition-all disabled:opacity-60"
                >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Branding Settings
                </button>
            </div>

            {/* Alert Messages */}
            {successMsg && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-2xl flex items-center gap-3 text-sm font-semibold">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 rounded-2xl flex items-center gap-3 text-sm font-semibold">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /> {errorMsg}
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <button
                    onClick={() => setActiveTab('identity')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'identity' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                    Platform Identity & Support
                </button>
                <button
                    onClick={() => setActiveTab('logos')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'logos' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                    Logo Management (8 Slots)
                </button>
                <button
                    onClick={() => setActiveTab('colors')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'colors' ? 'bg-sky-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                    Color Tokens & Theme Configurator
                </button>
            </div>

            {/* TAB 1: PLATFORM IDENTITY & SUPPORT */}
            {activeTab === 'identity' && (
                <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-8 shadow-sm space-y-6">
                    <h3 className="text-sm font-black uppercase text-sky-600 tracking-wider flex items-center gap-2">
                        <Sliders className="w-4 h-4" /> Global Identity & Primary Support Channels
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Platform Name</label>
                            <input
                                type="text"
                                value={formData.platformName || ''}
                                onChange={e => handleChange('platformName', e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Company Legal Name</label>
                            <input
                                type="text"
                                value={formData.companyName || ''}
                                onChange={e => handleChange('companyName', e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Platform Tagline</label>
                        <input
                            type="text"
                            value={formData.platformTagline || ''}
                            onChange={e => handleChange('platformTagline', e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Platform Description</label>
                        <textarea
                            rows={3}
                            value={formData.platformDescription || ''}
                            onChange={e => handleChange('platformDescription', e.target.value)}
                            className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--border-subtle)]">
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-sky-500" /> Primary Support Phone</label>
                            <input
                                type="text"
                                value={formData.supportPhone || '0768926965'}
                                onChange={e => handleChange('supportPhone', e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-mono font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-sky-500" /> Primary Support Email</label>
                            <input
                                type="email"
                                value={formData.supportEmail || 'emmanueloyaro3@gmail.com'}
                                onChange={e => handleChange('supportEmail', e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-mono font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-sky-500" /> Website URL</label>
                            <input
                                type="text"
                                value={formData.websiteUrl || 'https://jevish.site'}
                                onChange={e => handleChange('websiteUrl', e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-mono font-semibold"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-500" /> Business Address</label>
                            <input
                                type="text"
                                value={formData.businessAddress || ''}
                                onChange={e => handleChange('businessAddress', e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Copyright Footer Line</label>
                            <input
                                type="text"
                                value={formData.copyrightInfo || ''}
                                onChange={e => handleChange('copyrightInfo', e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-3 rounded-2xl text-sm font-semibold"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: LOGO MANAGEMENT (8 SLOTS) */}
            {activeTab === 'logos' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[
                        { key: 'primaryLogoUrl', label: 'Primary Platform Logo', desc: 'Used in main headers & navigation' },
                        { key: 'darkModeLogoUrl', label: 'Dark Mode Logo', desc: 'Optimized for dark mode background' },
                        { key: 'lightModeLogoUrl', label: 'Light Mode Logo', desc: 'Optimized for light mode background' },
                        { key: 'faviconUrl', label: 'Favicon URL', desc: 'Browser tab icon (.png or .ico)' },
                        { key: 'mobileLogoUrl', label: 'Mobile Header Logo', desc: 'Compact logo for small screens' },
                        { key: 'invoiceLogoUrl', label: 'PDF Invoice & Report Logo', desc: 'High resolution logo for PDF exports' },
                        { key: 'emailLogoUrl', label: 'Email Template Logo', desc: 'Used in email headers' },
                        { key: 'captivePortalLogoUrl', label: 'Captive Portal Logo', desc: 'Displayed on customer WiFi login page' },
                    ].map(slot => (
                        <div key={slot.key} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase text-[var(--text-primary)]">{slot.label}</label>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">{slot.desc}</span>
                            </div>

                            {/* Preview */}
                            <div className="h-24 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-center p-3">
                                {formData[slot.key] ? (
                                    <img src={formData[slot.key]} alt={slot.label} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 opacity-50" /> No custom logo set (Using default)
                                    </div>
                                )}
                            </div>

                            {/* URL Input */}
                            <input
                                type="text"
                                placeholder="Paste Image URL (e.g. https://...)"
                                value={formData[slot.key] || ''}
                                onChange={e => handleChange(slot.key, e.target.value)}
                                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-2.5 rounded-xl text-xs font-mono"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* TAB 3: COLOR TOKENS & THEME CONFIGURATOR */}
            {activeTab === 'colors' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {[
                            { key: 'primaryColor', label: 'Primary Brand' },
                            { key: 'secondaryColor', label: 'Secondary / Dark' },
                            { key: 'accentColor', label: 'Accent Highlight' },
                            { key: 'successColor', label: 'Success Green' },
                            { key: 'warningColor', label: 'Warning Amber' },
                            { key: 'dangerColor', label: 'Danger Red' },
                            { key: 'sidebarColor', label: 'Sidebar Background' },
                            { key: 'navColor', label: 'Top Nav Accent' },
                            { key: 'buttonColor', label: 'Button Color' },
                            { key: 'chartColor', label: 'Chart Accent' },
                        ].map(c => (
                            <div key={c.key} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center space-y-2">
                                <div className="text-xs font-bold text-[var(--text-muted)]">{c.label}</div>
                                <div className="flex items-center justify-center gap-2">
                                    <input
                                        type="color"
                                        value={formData[c.key] || '#0284c7'}
                                        onChange={e => handleChange(c.key, e.target.value)}
                                        className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={formData[c.key] || '#0284c7'}
                                        onChange={e => handleChange(c.key, e.target.value)}
                                        className="w-20 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-mono font-bold py-1 px-2 rounded-lg text-center"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Live Preview Box */}
                    <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 space-y-4">
                        <h3 className="text-xs font-black uppercase text-sky-600 tracking-wider flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Live System Theme Preview
                        </h3>
                        <div className="p-6 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: formData.primaryColor }}>
                                        SB
                                    </div>
                                    <div className="font-bold text-[var(--text-primary)]">{formData.platformName || 'Jevish Pro'} Dashboard</div>
                                </div>
                                <button className="px-4 py-2 text-white rounded-xl text-xs font-bold shadow-md" style={{ backgroundColor: formData.buttonColor || formData.primaryColor }}>
                                    Primary Action
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: formData.successColor }}>Active</span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: formData.warningColor }}>Warning</span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: formData.dangerColor }}>Suspended</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrandingCenter;
