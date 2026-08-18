import { Tenant, TenantCaptivePortalBranding, AuditLog, PlatformSetting } from '../models';
import { Op } from 'sequelize';
import logger from '../utils/logger';

export class BrandingService {
    /**
     * Get or initialize global platform branding
     */
    static async getPlatformBranding() {
        const defaultBranding = {
            id: 'global-config',
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
            faviconUrl: '',
            primaryLogoUrl: ''
        };

        try {
            const setting = await PlatformSetting.findByPk('platform_branding');
            if (setting) {
                return { ...defaultBranding, ...JSON.parse(setting.value) };
            }
        } catch (error) {
            logger.error('Failed to fetch platform branding from settings', { error });
        }

        return defaultBranding;
    }

    /**
     * Update Super Admin global platform branding
     */
    static async updatePlatformBranding(data: any) {
        try {
            const current = await this.getPlatformBranding();
            const updated = { ...current, ...data };
            
            const [setting] = await PlatformSetting.upsert({
                key: 'platform_branding',
                value: JSON.stringify(updated)
            });

            logger.info('Platform branding updated by Super Admin');
            return updated;
        } catch (error: any) {
            logger.error('Failed to update platform branding', { error: error.message });
            throw new Error('Failed to save platform branding settings');
        }
    }

    /**
     * Get isolated Tenant Captive Portal Branding with system default fallbacks
     */
    static async getTenantCaptivePortalBranding(tenantIdOrIdentifier: string) {
        const platform = await this.getPlatformBranding();

        // 1. Resolve Tenant using local DB
        let tenant = await Tenant.findOne({
            where: {
                [Op.or]: [
                    { id: tenantIdOrIdentifier },
                    { subdomain: tenantIdOrIdentifier }
                ]
            }
        });

        if (!tenant && (tenantIdOrIdentifier === 'my-tenant' || tenantIdOrIdentifier === 'primary' || tenantIdOrIdentifier === 'default' || !tenantIdOrIdentifier)) {
            tenant = await Tenant.findOne();
        }

        let brandingRecord: any = null;

        if (tenant) {
            brandingRecord = await TenantCaptivePortalBranding.findOne({
                where: { tenantId: tenant.id }
            });
        } else {
            // Check custom domain
            brandingRecord = await TenantCaptivePortalBranding.findOne({
                where: { customDomain: tenantIdOrIdentifier },
                include: [{ model: Tenant, as: 'tenant' }]
            });
            if (brandingRecord && (brandingRecord as any).tenant) {
                (brandingRecord as any).tenants = (brandingRecord as any).tenant;
            }
        }

        const b = brandingRecord || {};
        const t = tenant || (brandingRecord as any)?.tenants || {};

        return {
            tenantId: t.id || tenantIdOrIdentifier,
            businessName: b.businessName || t.name || platform.platformName || 'Jevish Hotspot',
            tagline: b.tagline || t.tradingName || 'High-Speed Wi-Fi Access',
            description: b.description || t.description || platform.platformDescription,
            supportPhone: b.supportPhone || t.contactPhone || t.supportPhone || platform.supportPhone,
            supportEmail: b.supportEmail || t.businessEmail || t.supportEmail || platform.supportEmail,
            whatsappNumber: b.whatsappNumber || b.supportPhone || t.contactPhone || platform.supportPhone,
            websiteUrl: b.websiteUrl || t.website || platform.websiteUrl,
            physicalAddress: b.physicalAddress || t.businessAddress || platform.businessAddress,
            socialLinks: typeof b.socialLinks === 'string' ? JSON.parse(b.socialLinks) : (b.socialLinks || { whatsapp: `https://wa.me/${(b.whatsappNumber || platform.supportPhone).replace(/\D/g, '')}` }),
            
            // Logos
            primaryLogoUrl: b.primaryLogoUrl || t.logoUrl || t.businessLogoUrl || platform.primaryLogoUrl,
            mobileLogoUrl: b.mobileLogoUrl || b.primaryLogoUrl || t.logoUrl || platform.primaryLogoUrl,
            darkModeLogoUrl: b.darkModeLogoUrl || b.primaryLogoUrl || t.logoUrl || platform.primaryLogoUrl,
            lightModeLogoUrl: b.lightModeLogoUrl || b.primaryLogoUrl || t.logoUrl || platform.primaryLogoUrl,
            faviconUrl: b.faviconUrl || platform.faviconUrl,
            footerLogoUrl: b.footerLogoUrl || b.primaryLogoUrl || platform.primaryLogoUrl,
            loginLogoUrl: b.loginLogoUrl || b.primaryLogoUrl || platform.primaryLogoUrl,
            welcomeScreenLogoUrl: b.welcomeScreenLogoUrl || b.primaryLogoUrl || platform.primaryLogoUrl,

            // Theme Color System
            primaryColor: b.primaryColor || t.primaryColor || platform.primaryColor || '#0284c7',
            secondaryColor: b.secondaryColor || platform.secondaryColor || '#0f172a',
            accentColor: b.accentColor || platform.accentColor || '#38bdf8',
            buttonColor: b.buttonColor || b.primaryColor || platform.buttonColor || '#0284c7',
            navColor: b.navColor || b.primaryColor || platform.navColor || '#0284c7',
            backgroundColor: b.backgroundColor || '#0f172a',
            footerColor: b.footerColor || b.primaryColor || platform.primaryColor || '#0284c7',
            textColor: b.textColor || '#ffffff',
            linkColor: b.linkColor || '#38bdf8',

            // Custom Messages
            welcomeMessage: b.welcomeMessage || 'Select an internet package below for instant network access.',
            headline: b.headline || `${b.businessName || t.name || 'Jevish'} High-Speed Wi-Fi`,
            subheadline: b.subheadline || 'Instant M-Pesa Activation',
            termsConditions: b.termsConditions || 'Standard fair usage policies apply. Misuse may result in connection termination.',
            privacyNotice: b.privacyNotice || 'We respect your privacy. Connection details are encrypted.',
            supportInfo: b.supportInfo || `Contact Customer Support at ${b.supportPhone || platform.supportPhone}`,
            footerText: b.footerText || `© 2026 ${b.businessName || t.name || 'Jevish Network'}. All rights reserved.`,
            copyrightText: b.copyrightText || `© 2026 ${b.businessName || t.name || 'Jevish Network'}.`,
            loginInstructions: b.loginInstructions || 'Select a package or enter your voucher code to connect.',
            paymentInstructions: b.paymentInstructions || 'Enter M-Pesa phone number and accept STK Push prompt.',
            voucherInstructions: b.voucherInstructions || 'Enter your 8-digit pre-paid voucher code.',

            // Background
            backgroundType: b.backgroundType || 'GRADIENT',
            backgroundUrl: b.backgroundUrl || null,
            backgroundVideoUrl: b.backgroundVideoUrl || null,
            gradientStartColor: b.gradientStartColor || '#0f172a',
            gradientEndColor: b.gradientEndColor || b.primaryColor || '#0284c7',
            backgroundBlur: b.backgroundBlur || 0,
            backgroundOverlayOpacity: b.backgroundOverlayOpacity || 0.2,
            mobileBackgroundUrl: b.mobileBackgroundUrl || b.backgroundUrl || null,

            // Domain
            customDomain: b.customDomain || null,
            landingHeroTitle: b.landingHeroTitle || 'Ultra-Fast Fiber Internet',
            landingHeroSubtitle: b.landingHeroSubtitle || 'Connect to the most reliable network in town.',
            showLandingHero: b.showLandingHero !== undefined ? b.showLandingHero : true,
            packageCardLayout: b.packageCardLayout || 'GRID_2COL',
            packageCardStyle: b.packageCardStyle || 'GLASS',
            showPackageBadges: b.showPackageBadges !== undefined ? b.showPackageBadges : true,
            showSpeedBadges: b.showSpeedBadges !== undefined ? b.showSpeedBadges : true,
            pinnedPackageIds: typeof b.pinnedPackageIds === 'string' ? JSON.parse(b.pinnedPackageIds) : (b.pinnedPackageIds || []),
            featuredPackageId: b.featuredPackageId || null,
            showPromotions: b.showPromotions !== undefined ? b.showPromotions : true,
            isApproved: b.isApproved !== undefined ? b.isApproved : true
        };
    }

    /**
     * Update Tenant Captive Portal Branding
     */
    static async updateTenantCaptivePortalBranding(tenantId: string, data: any) {
        try {
            const tenant = await Tenant.findByPk(tenantId);
            if (!tenant) throw new Error('Tenant not found');

            const existing = await TenantCaptivePortalBranding.findOne({
                where: { tenantId }
            });

            // Convert objects to strings for DB if needed
            const preparedData = { ...data };
            if (preparedData.socialLinks && typeof preparedData.socialLinks !== 'string') {
                preparedData.socialLinks = JSON.stringify(preparedData.socialLinks);
            }
            if (preparedData.pinnedPackageIds && typeof preparedData.pinnedPackageIds !== 'string') {
                preparedData.pinnedPackageIds = JSON.stringify(preparedData.pinnedPackageIds);
            }

            // Remove id from data to avoid primary key conflicts
            delete preparedData.id;
            delete preparedData.tenantId;

            if (existing) {
                await existing.update(preparedData);
            } else {
                await TenantCaptivePortalBranding.create({ ...preparedData, tenantId });
            }

            // Update tenant primary color if provided
            if (data.primaryColor) {
                await tenant.update({ primaryColor: data.primaryColor });
            }

            await AuditLog.create({
                action: 'TENANT_BRANDING_UPDATED',
                details: `Captive Portal Branding updated for tenant ${tenant.name}`,
                tenantId
            });

            return this.getTenantCaptivePortalBranding(tenantId);
        } catch (error: any) {
            logger.error('Failed to update tenant branding in service', { tenantId, error: error.message, stack: error.stack });
            throw new Error(`Failed to save branding settings: ${error.message}`);
        }
    }

    /**
     * Reset Tenant Captive Portal Branding to Defaults
     */
    static async resetTenantCaptivePortalBranding(tenantId: string) {
        await TenantCaptivePortalBranding.destroy({
            where: { tenantId }
        });
        
        await AuditLog.create({
            action: 'TENANT_BRANDING_RESET',
            details: `Captive Portal Branding reset to defaults for tenant ${tenantId}`,
            tenantId
        });
            
        return this.getTenantCaptivePortalBranding(tenantId);
    }
}

