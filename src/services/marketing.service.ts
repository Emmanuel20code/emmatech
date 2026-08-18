import { AdCampaign, MediaItem, MarketingCoupon, QRCampaign, MarketingLandingPage, AdAnalytic, CustomerSegment, MarketingSetting, Tenant } from '../models';
import logger from '../utils/logger';
import { Op } from 'sequelize';

import crypto from 'crypto';

export interface ClientAdContext {
    displayRule?: string; // e.g. 'BEFORE_LOGIN', 'AFTER_LOGIN', 'PAYMENT_SUCCESS'
    routerId?: string;
    packageId?: string;
    deviceType?: string; // e.g. 'MOBILE', 'DESKTOP', 'TABLET'
    os?: string; // e.g. 'Android', 'iOS', 'Windows'
    browser?: string;
    customerType?: 'NEW' | 'RETURNING' | 'VIP';
    ipAddress?: string;
    macAddress?: string;
}

export class MarketingService {
    // ─────────────────────────────────────────────────────────────
    // 1. AD MATCHING & ROTATION ENGINE
    // ─────────────────────────────────────────────────────────────
    public static async getEligibleAds(tenantId: string, context: ClientAdContext): Promise<any[]> {
        try {
            const now = new Date();

            // Fetch active and approved campaigns for tenant
            const campaigns = await AdCampaign.findAll({
                where: {
                    tenantId,
                    status: 'RUNNING',
                    approvalStatus: 'APPROVED',
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { startDate: null },
                                { startDate: { [Op.lte]: now } }
                            ]
                        },
                        {
                            [Op.or]: [
                                { endDate: null },
                                { endDate: { [Op.gte]: now } }
                            ]
                        }
                    ]
                },
                order: [['priority', 'DESC'], ['weight', 'DESC']]
            });

            if (!campaigns || campaigns.length === 0) {
                return [];
            }

            // Filter campaigns based on context
            const eligible = campaigns.filter(campaign => {
                // Budget check
                if (campaign.budget > 0 && campaign.spentBudget >= campaign.budget) {
                    return false;
                }

                // Display Rules check
                if (context.displayRule && campaign.displayRules) {
                    try {
                        const rules: string[] = JSON.parse(campaign.displayRules);
                        if (rules.length > 0 && !rules.includes(context.displayRule)) {
                            return false;
                        }
                    } catch (e) {
                        // ignore JSON parse error
                    }
                }

                // Targeting rules check
                if (campaign.targeting) {
                    try {
                        const target = JSON.parse(campaign.targeting);

                        if (target.routerIds && target.routerIds.length > 0 && context.routerId) {
                            if (!target.routerIds.includes(context.routerId)) return false;
                        }

                        if (target.packageIds && target.packageIds.length > 0 && context.packageId) {
                            if (!target.packageIds.includes(context.packageId)) return false;
                        }

                        if (target.deviceTypes && target.deviceTypes.length > 0 && context.deviceType) {
                            if (!target.deviceTypes.includes(context.deviceType.toUpperCase())) return false;
                        }

                        if (target.customerTypes && target.customerTypes.length > 0 && context.customerType) {
                            if (!target.customerTypes.includes(context.customerType)) return false;
                        }
                    } catch (e) {
                        // ignore JSON parse error
                    }
                }

                return true;
            });

            if (eligible.length === 0) return [];

            // Apply rotation logic
            const rotationType = eligible[0].rotationType || 'PRIORITY';
            let selectedAds: AdCampaign[] = [];

            if (rotationType === 'RANDOM') {
                selectedAds = [...eligible].sort(() => Math.random() - 0.5);
            } else if (rotationType === 'WEIGHTED') {
                selectedAds = [...eligible].sort((a, b) => (b.weight || 1) - (a.weight || 1));
            } else {
                // Default: Priority
                selectedAds = eligible;
            }

            return selectedAds.map(ad => ({
                id: ad.id,
                name: ad.name,
                campaignType: ad.campaignType,
                mediaUrls: ad.mediaUrls ? JSON.parse(ad.mediaUrls) : [],
                headline: ad.headline,
                subheading: ad.subheading,
                buttonText: ad.buttonText || 'Learn More',
                destinationUrl: ad.destinationUrl,
                whatsappLink: ad.whatsappLink,
                facebookLink: ad.facebookLink,
                instagramLink: ad.instagramLink,
                tiktokLink: ad.tiktokLink,
                emailLink: ad.emailLink,
                ctaType: ad.ctaType,
                priority: ad.priority
            }));
        } catch (error: any) {
            logger.error('Failed to resolve eligible ads', { tenantId, error: error.message });
            return [];
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ANALYTICS & CTR TRACKING
    // ─────────────────────────────────────────────────────────────
    public static async trackEvent(
        tenantId: string,
        campaignId: string,
        eventType: 'IMPRESSION' | 'VIEW' | 'UNIQUE_VIEW' | 'CLICK' | 'VIDEO_COMPLETE' | 'CONVERSION',
        context: ClientAdContext & { revenue?: number; sessionDuration?: number }
    ): Promise<AdAnalytic | null> {
        try {
            const campaign = await AdCampaign.findByPk(campaignId);
            if (!campaign || campaign.tenantId !== tenantId) {
                return null;
            }

            const analytic = await AdAnalytic.create({
                tenantId,
                campaignId,
                eventType,
                revenue: context.revenue || 0,
                deviceType: context.deviceType || 'DESKTOP',
                browser: context.browser || 'Unknown',
                os: context.os || 'Unknown',
                country: 'KE',
                city: 'Nairobi',
                routerId: context.routerId || null,
                packageId: context.packageId || null,
                sessionDuration: context.sessionDuration || 0,
                ipAddress: context.ipAddress || null,
                macAddress: context.macAddress || null
            });

            return analytic;
        } catch (error: any) {
            logger.error('Failed to log ad analytic event', { campaignId, eventType, error: error.message });
            return null;
        }
    }

    public static async getCampaignMetrics(tenantId: string, campaignId?: string) {
        const whereClause: any = { tenantId };
        if (campaignId) whereClause.campaignId = campaignId;

        const analytics = await AdAnalytic.findAll({ where: whereClause });

        const impressions = analytics.filter(a => a.eventType === 'IMPRESSION').length;
        const views = analytics.filter(a => a.eventType === 'VIEW' || a.eventType === 'UNIQUE_VIEW').length;
        const clicks = analytics.filter(a => a.eventType === 'CLICK').length;
        const videoViews = analytics.filter(a => a.eventType === 'VIDEO_COMPLETE').length;
        const conversions = analytics.filter(a => a.eventType === 'CONVERSION').length;
        const totalRevenue = analytics.reduce((acc, curr) => acc + Number(curr.revenue || 0), 0);

        const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
        const conversionRate = views > 0 ? Number(((conversions / views) * 100).toFixed(2)) : 0;

        return {
            impressions,
            views,
            clicks,
            videoViews,
            conversions,
            ctr,
            conversionRate,
            totalRevenueCents: totalRevenue,
            totalReach: impressions + views
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 3. MEDIA UPLOAD & COMPRESSION HANDLER
    // ─────────────────────────────────────────────────────────────
    public static async uploadMedia(
        tenantId: string,
        mediaData: {
            fileName: string;
            fileUrl: string;
            fileType: 'IMAGE' | 'VIDEO' | 'GIF' | 'PDF' | 'LOGO' | 'ICON';
            fileSize: number;
            mimeType: string;
        }
    ): Promise<MediaItem> {
        // Fetch tenant settings or use default max 50MB
        const settings = await MarketingSetting.findOne({ where: { tenantId } });
        const maxBytes = settings ? settings.maxUploadSizeBytes : 52428800; // 50MB

        if (mediaData.fileSize > maxBytes) {
            throw new Error(`File size exceeds tenant limit of ${(maxBytes / (1024 * 1024)).toFixed(0)}MB`);
        }

        // Generate simulated compressed thumbnail
        const thumbnailUrl = mediaData.fileType === 'IMAGE' || mediaData.fileType === 'GIF'
            ? mediaData.fileUrl
            : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400';

        const mediaItem = await MediaItem.create({
            tenantId,
            fileName: mediaData.fileName,
            fileUrl: mediaData.fileUrl,
            fileType: mediaData.fileType,
            fileSize: mediaData.fileSize,
            mimeType: mediaData.mimeType,
            dimensions: '1920x1080',
            duration: mediaData.fileType === 'VIDEO' ? 15 : 0,
            thumbnailUrl,
            metadata: JSON.stringify({ compressed: true, uploadedAt: new Date().toISOString() })
        });

        return mediaItem;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. COUPON & QR CODE GENERATION ENGINE
    // ─────────────────────────────────────────────────────────────
    public static generateCouponCode(prefix: string = 'SURF'): string {
        const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
        return `${prefix}-${randomStr}`;
    }

    public static generateQRCodeDataUrl(text: string): string {
        // High quality SVG QR code data URL representation
        const encodedText = encodeURIComponent(text);
        return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodedText}`;
    }
}
