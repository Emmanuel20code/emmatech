import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface PlatformBrandingData {
    platformName: string;
    platformTagline: string;
    platformDescription: string;
    companyName: string;
    supportPhone: string;
    supportEmail: string;
    websiteUrl: string;
    socialLinks: { twitter?: string; facebook?: string; linkedin?: string; whatsapp?: string };
    businessAddress: string;
    copyrightInfo: string;
    legalInfo: string;

    // Logos
    primaryLogoUrl?: string | null;
    darkModeLogoUrl?: string | null;
    lightModeLogoUrl?: string | null;
    faviconUrl?: string | null;
    mobileLogoUrl?: string | null;
    invoiceLogoUrl?: string | null;
    emailLogoUrl?: string | null;
    captivePortalLogoUrl?: string | null;

    // Colors
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    successColor: string;
    warningColor: string;
    dangerColor: string;
    sidebarColor: string;
    navColor: string;
    buttonColor: string;
    chartColor: string;
}

const defaultBranding: PlatformBrandingData = {
    platformName: 'Jevish Pro',
    platformTagline: 'Next-Gen Multi-Tenant WiFi Billing & ISP Management System',
    platformDescription: 'Enterprise WiFi billing, MikroTik integration, bandwidth control, and M-Pesa automated payments for ISPs and hotspot owners.',
    companyName: 'Jevish Technologies Ltd',
    supportPhone: '0768926965',
    supportEmail: 'emmanueloyaro3@gmail.com',
    websiteUrl: 'https://jevish.site',
    socialLinks: { twitter: '', facebook: '', linkedin: '', whatsapp: 'https://wa.me/254768926965' },
    businessAddress: 'Nairobi, Kenya',
    copyrightInfo: '© 2026 Jevish Technologies Ltd. All rights reserved.',
    legalInfo: 'Jevish is a registered SaaS billing platform for Internet Service Providers.',

    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    successColor: '#10b981',
    warningColor: '#f59e0b',
    dangerColor: '#ef4444',
    sidebarColor: '#0f172a',
    navColor: '#0284c7',
    buttonColor: '#0284c7',
    chartColor: '#0284c7',
};

interface BrandingContextType {
    branding: PlatformBrandingData;
    loading: boolean;
    refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
    branding: defaultBranding,
    loading: false,
    refreshBranding: async () => {},
});

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [branding, setBranding] = useState<PlatformBrandingData>(defaultBranding);
    const [loading, setLoading] = useState(true);

    const applyThemeColors = useCallback((colors: Partial<PlatformBrandingData>) => {
        const root = document.documentElement;
        if (colors.primaryColor) root.style.setProperty('--color-brand-primary', colors.primaryColor);
        if (colors.secondaryColor) root.style.setProperty('--color-brand-secondary', colors.secondaryColor);
        if (colors.accentColor) root.style.setProperty('--color-brand-accent', colors.accentColor);
        if (colors.successColor) root.style.setProperty('--color-brand-success', colors.successColor);
        if (colors.warningColor) root.style.setProperty('--color-brand-warning', colors.warningColor);
        if (colors.dangerColor) root.style.setProperty('--color-brand-danger', colors.dangerColor);
        if (colors.sidebarColor) root.style.setProperty('--color-brand-sidebar', colors.sidebarColor);
    }, []);

    const fetchBranding = useCallback(async () => {
        try {
            const res = await axios.get('/api/v1/branding/public');
            if (res.data.branding) {
                const data = res.data.branding;
                let parsedSocial = data.socialLinks;
                if (typeof data.socialLinks === 'string') {
                    try { parsedSocial = JSON.parse(data.socialLinks); } catch (e) { parsedSocial = defaultBranding.socialLinks; }
                }
                const merged = { ...defaultBranding, ...data, socialLinks: parsedSocial };
                setBranding(merged);
                applyThemeColors(merged);
            }
        } catch (e) {
            console.warn('[BrandingContext] Using default fallback branding:', e);
            applyThemeColors(defaultBranding);
        } finally {
            setLoading(false);
        }
    }, [applyThemeColors]);

    useEffect(() => { fetchBranding(); }, [fetchBranding]);

    return (
        <BrandingContext.Provider value={{ branding, loading, refreshBranding: fetchBranding }}>
            {children}
        </BrandingContext.Provider>
    );
};

export const useBranding = () => useContext(BrandingContext);
