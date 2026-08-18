import { Payment, Session, Package, Subscriber, Voucher, SMSLog, Router, Settlement, sequelize } from '../models';
import { Op } from 'sequelize';

export class AnalyticsService {
    static async getDashboardStats(tenantId: string) {
        const totalRevenue = await Payment.sum('amount', {
            where: { tenantId, status: 'SUCCESS' }
        });

        const activeSessions = await Session.count({
            where: { tenantId, status: 'ACTIVE' }
        });

        const totalSubscribers = await Subscriber.count({
            where: { tenantId }
        });

        const voucherSales = await Voucher.count({
            where: { tenantId, status: 'USED' }
        });

        // Revenue over the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Helper for date formatting per dialect
        const dialect = sequelize.getDialect();
        const dateCol = dialect === 'postgres'
            ? sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM-DD')`)
            : sequelize.fn('DATE', sequelize.col('createdAt'));

        const dailyRevenue = await Payment.findAll({
            attributes: [
                [dateCol as any, 'date'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total']
            ],
            where: {
                tenantId,
                status: 'SUCCESS',
                createdAt: { [Op.gte]: sevenDaysAgo }
            },
            group: [dateCol as any],
            raw: true
        });

        return {
            totalRevenue: Number(totalRevenue || 0),
            activeSessions,
            totalSubscribers,
            voucherSales,
            dailyRevenue: (dailyRevenue as unknown as Array<{ date: string, total: string | number }>).map(r => ({
                date: r.date,
                total: Number(r.total)
            }))
        };
    }

    static async getRevenueReport(tenantId: string, startDate?: string, endDate?: string) {
        const where: Record<string, unknown> = { tenantId, status: 'SUCCESS' };
        if (startDate || endDate) {
            const createdAt: Record<symbol, Date> = {};
            if (startDate) createdAt[Op.gte as symbol] = new Date(startDate);
            if (endDate) createdAt[Op.lte as symbol] = new Date(endDate);
            where.createdAt = createdAt;
        }

        return await Payment.findAll({
            where,
            include: [Package],
            order: [['createdAt', 'DESC']]
        });
    }

    static async getTrafficInsights(tenantId: string) {
        // Simple mock insight: Most popular package
        const popularPackage = await Payment.findAll({
            attributes: [
                'packageId',
                [sequelize.fn('COUNT', sequelize.col('packageId')), 'count']
            ],
            where: { tenantId, status: 'SUCCESS' },
            group: ['packageId'],
            order: [[sequelize.literal('count'), 'DESC']],
            limit: 1,
            include: [Package],
            raw: true,
            nest: true
        });

        return {
            topPackage: (popularPackage[0] as unknown as { package: { name: string } })?.package?.name || 'N/A',
            recommendation: "Consider a discount on your least popular plan to boost traffic."
        };
    }

    static async getGlobalPlatformStats() {
        const { Tenant, SaaSSubscriptionPayment } = require('../models');
        const totalRevenue = await SaaSSubscriptionPayment.sum('amount', { where: { status: 'SUCCESS' } }) || 0;
        const totalTenants = await Tenant.count();
        const totalPayments = await SaaSSubscriptionPayment.count({ where: { status: 'SUCCESS' } });
        const activeTenants = await Tenant.count({ where: { status: 'ACTIVE' } });
        const trialTenants = await Tenant.count({ where: { subscriptionStatus: 'TRIAL' } });
        const suspendedTenants = await Tenant.count({ where: { status: 'SUSPENDED' } });

        return {
            totalRevenue: Number(totalRevenue || 0),
            totalTenants,
            totalPayments,
            activeTenants,
            trialTenants,
            suspendedTenants
        };
    }

    /**
     * Real-time Revenue Tracking (Today / Week / Month)
     */
    static async getRealTimeRevenue(tenantId: string) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [today, week, month] = await Promise.all([
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfToday } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfWeek } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfMonth } } })
        ]);

        return {
            today: today || 0,
            week: week || 0,
            month: month || 0
        };
    }

    /**
     * Advanced Bandwidth Usage Analytics
     */
    static async getBandwidthUsage(tenantId: string) {
        const sessions = await Session.findAll({
            where: { tenantId, status: 'ACTIVE' },
            attributes: ['bytesIn', 'bytesOut', 'routerId']
        });

        const usageByRouter: Record<string, { in: number, out: number }> = {};
        let totalIn = 0;
        let totalOut = 0;

        sessions.forEach(s => {
            if (!usageByRouter[s.routerId]) usageByRouter[s.routerId] = { in: 0, out: 0 };
            usageByRouter[s.routerId].in += Number(s.bytesIn);
            usageByRouter[s.routerId].out += Number(s.bytesOut);
            totalIn += Number(s.bytesIn);
            totalOut += Number(s.bytesOut);
        });

        return {
            totalIn,
            totalOut,
            usageByRouter,
            activeSessions: sessions.length
        };
    }

    /**
     * Payment Performance (Success vs Failure Rates)
     */
    static async getPaymentPerformance(tenantId: string) {
        const [success, failed] = await Promise.all([
            Payment.count({ where: { tenantId, status: 'SUCCESS' } }),
            Payment.count({ where: { tenantId, status: 'FAILED' } })
        ]);

        const total = success + failed;
        return {
            success,
            failed,
            rate: total > 0 ? (success / total) * 100 : 0
        };
    }

    /**
     * SMS Usage and Metrics
     */
    static async getSmsMetrics(tenantId: string) {
        const stats = await SMSLog.findAll({
            where: { tenantId },
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('cost')), 'totalCost']
            ],
            group: ['status'],
            raw: true
        });

        return stats;
    }

    /**
     * Get hourly trends for the last 24 hours (Revenue & Active Sessions)
     */
    static async getHourlyTrends(tenantId: string) {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Revenue trend
        const dialect = sequelize.getDialect();
        let hourCol;
        if (dialect === 'postgres') {
            hourCol = sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM-DD HH24:00')`);
        } else if (dialect === 'mysql') {
            hourCol = sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d %H:00');
        } else {
            hourCol = sequelize.fn('STRFTIME', '%Y-%m-%d %H:00', sequelize.col('createdAt'));
        }

        const revenueTrend = await Payment.findAll({
            attributes: [
                [hourCol as any, 'hour'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'amount']
            ],
            where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: last24h } },
            group: [hourCol as any],
            order: [[hourCol as any, 'ASC']],
            raw: true
        });

        // Current active users count
        const activeUsersCount = await Session.count({
            where: { tenantId, status: 'ACTIVE' }
        });

        return {
            revenueTrend: (revenueTrend as unknown as Array<{ hour: string, amount: string | number }>).map(r => ({
                hour: r.hour,
                amount: Number(r.amount) // Cents to Number for charts
            })),
            activeUsersCount
        };
    }

    /**
     * Traffic Context & Peak Hours
     */
    static async getTrafficContext(tenantId: string) {
        // 1. Calculate Peak Hours (Last 30 days)
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        // Group sessions by hour of day (0-23)
        const dialect = sequelize.getDialect();
        let hourCol;
        if (dialect === 'postgres') {
            hourCol = sequelize.literal(`CAST(EXTRACT(HOUR FROM "startTime") AS integer)`);
        } else if (dialect === 'mysql') {
            hourCol = sequelize.fn('HOUR', sequelize.col('startTime'));
        } else {
            hourCol = sequelize.literal("cast(strftime('%H', startTime) as integer)");
        }

        const sessionsByHour = await Session.findAll({
            attributes: [
                [hourCol as any, 'hour'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: {
                tenantId,
                startTime: { [Op.gte]: last30Days }
            },
            group: [hourCol as any],
            raw: true
        });

        // Find the 3-hour window with max sessions
        const hoursMap: number[] = Array.from({ length: 24 }, () => 0);
        (sessionsByHour as unknown as Array<{ hour: string | number, count: string | number }>).forEach(r => {
            const hour = Number(r.hour);
            const count = Number(r.count);
            if (!isNaN(hour) && hour >= 0 && hour < 24) {
                hoursMap[hour] = count;
            }
        });

        let maxVolume = 0;
        let peakStart = 19; // Default 7 PM

        for (let i = 0; i < 24; i++) {
            const vol = hoursMap[i] + hoursMap[(i + 1) % 24] + hoursMap[(i + 2) % 24];
            if (vol > maxVolume) {
                maxVolume = vol;
                peakStart = i;
            }
        }

        const peakEnd = (peakStart + 3) % 24;
        const formatTime = (h: number) => {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hr = h % 12 || 12;
            return `${hr.toString().padStart(2, '0')}:00 ${ampm}`;
        };
        const peakHours = `${formatTime(peakStart)} - ${formatTime(peakEnd)}`;

        // 2. Calculate Net Efficiency (Success Rate of Payments/Auth)
        // Proxy: Successful Payments / Total Payments (Since sessions are essentially successful grants)
        const [success, total] = await Promise.all([
            Payment.count({ where: { tenantId, status: 'SUCCESS' } }),
            Payment.count({ where: { tenantId } }) // All attempts
        ]);

        const efficiency = total > 0 ? (success / total) * 100 : 100;

        return {
            peakHours,
            netEfficiency: efficiency.toFixed(1) + '%'
        };
    }

    /**
     * Full revenue breakdown: today, week, month, year
     */
    static async getYearlyRevenue(tenantId: string) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const [today, week, month, year] = await Promise.all([
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfToday } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfWeek } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfMonth } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfYear } } }),
        ]);

        return {
            today: Number(today || 0),
            week: Number(week || 0),
            month: Number(month || 0),
            year: Number(year || 0),
        };
    }

    /**
     * Subscriber growth: new subscribers per day for last 30 days
     */
    static async getSubscriberGrowth(tenantId: string) {
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const dialect = sequelize.getDialect();
        const dateCol = dialect === 'postgres'
            ? sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM-DD')`)
            : sequelize.fn('DATE', sequelize.col('createdAt'));

        const growth = await Subscriber.findAll({
            attributes: [
                [dateCol as any, 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: { tenantId, createdAt: { [Op.gte]: last30Days } },
            group: [dateCol as any],
            order: [[dateCol as any, 'ASC']],
            raw: true
        });

        return (growth as unknown as Array<{ date: string; count: string | number }>).map(r => ({
            date: r.date,
            count: Number(r.count)
        }));
    }

    /**
     * Top selling packages by revenue and count
     */
    static async getPackageSales(tenantId: string) {
        const sales = await Payment.findAll({
            attributes: [
                'packageId',
                [sequelize.fn('COUNT', sequelize.col('payment.id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('payment.amount')), 'revenue']
            ],
            where: { tenantId, status: 'SUCCESS' },
            group: ['packageId', 'package.id'],
            order: [[sequelize.literal('revenue'), 'DESC']],
            limit: 10,
            include: [{ model: Package, attributes: ['name', 'price'] }],
            raw: true,
            nest: true
        });

        return (sales as unknown as Array<{
            packageId: number;
            count: string | number;
            revenue: string | number;
            package: { name: string; price: string | number };
        }>).map(r => ({
            packageId: r.packageId,
            name: r.package?.name || 'Unknown',
            count: Number(r.count),
            revenue: Number(r.revenue),
        }));
    }

    /**
     * Network health score (0-100) based on online router percentage
     */
    static async getNetworkHealthScore(tenantId: string): Promise<number> {
        const [total, online] = await Promise.all([
            Router.count({ where: { tenantId } }),
            Router.count({ where: { tenantId, isOnline: true } }),
        ]);
        if (total === 0) return 100;
        return Math.round((online / total) * 100);
    }

    /**
     * Monthly revenue trend for the last 12 months
     */
    static async getMonthlyRevenueTrend(tenantId: string) {
        const last12Months = new Date();
        last12Months.setMonth(last12Months.getMonth() - 12);

        const dialect = sequelize.getDialect();
        let monthCol;
        if (dialect === 'postgres') {
            monthCol = sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM')`);
        } else if (dialect === 'mysql') {
            monthCol = sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m');
        } else {
            monthCol = sequelize.fn('STRFTIME', '%Y-%m', sequelize.col('createdAt'));
        }

        const trend = await Payment.findAll({
            attributes: [
                [monthCol as any, 'month'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total']
            ],
            where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: last12Months } },
            group: [monthCol as any],
            order: [[monthCol as any, 'ASC']],
            raw: true
        });

        return (trend as unknown as Array<{ month: string; total: string | number }>).map(r => ({
            month: r.month,
            total: Number(r.total)
        }));
    }

    /**
     * Full BI Dashboard Stats — aggregates all 18 KPIs in one call
     */
    static async getFullDashboardStats(tenantId: string) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const [
            revenueToday, revenueWeek, revenueMonth, revenueYear,
            totalSubscribers, activeSubscribers, expiredSubscribers,
            onlineUsers, totalRouters, connectedRouters,
            successPayments, failedPayments, pendingPayments,
            activeCampaigns, pendingWithdrawals
        ] = await Promise.all([
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfToday } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfWeek } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfMonth } } }),
            Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [Op.gte]: startOfYear } } }),
            Subscriber.count({ where: { tenantId } }),
            Subscriber.count({ where: { tenantId, status: 'ACTIVE' } }),
            Subscriber.count({ where: { tenantId, status: { [Op.in]: ['INACTIVE', 'SUSPENDED'] } } }),
            Session.count({ 
                where: { 
                    tenantId, 
                    status: 'ACTIVE',
                    [Op.or]: [
                        { lastUpdated: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } },
                        { lastUpdated: null, startTime: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } }
                    ]
                } 
            }),
            Router.count({ where: { tenantId } }),
            Router.count({ where: { tenantId, isOnline: true } }),
            Payment.count({ where: { tenantId, status: 'SUCCESS' } }),
            Payment.count({ where: { tenantId, status: 'FAILED' } }),
            Payment.count({ where: { tenantId, status: 'PENDING' } }),
            // Campaigns: count active SMS campaigns (vouchers available as proxy)
            Voucher.count({ where: { tenantId, status: 'AVAILABLE' } }),
            Settlement.count({ where: { tenantId, status: 'PENDING' } }),
        ]);

        const networkHealth = totalRouters > 0 ? Math.round((connectedRouters / totalRouters) * 100) : 100;

        return {
            revenueToday: Number(revenueToday || 0),
            revenueWeek: Number(revenueWeek || 0),
            revenueMonth: Number(revenueMonth || 0),
            revenueYear: Number(revenueYear || 0),
            totalSubscribers,
            activeSubscribers,
            expiredSubscribers,
            onlineUsers,
            offlineUsers: Math.max(0, activeSubscribers - onlineUsers),
            totalRouters,
            connectedRouters,
            disconnectedRouters: Math.max(0, totalRouters - connectedRouters),
            successPayments,
            failedPayments,
            pendingPayments,
            activeCampaigns,
            pendingWithdrawals,
            networkHealth,
        };
    }
}
