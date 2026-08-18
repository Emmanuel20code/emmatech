"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
class AnalyticsService {
    static async getDashboardStats(tenantId) {
        const totalRevenue = await models_1.Payment.sum('amount', {
            where: { tenantId, status: 'SUCCESS' }
        });
        const activeSessions = await models_1.Session.count({
            where: { tenantId, status: 'ACTIVE' }
        });
        const totalSubscribers = await models_1.Subscriber.count({
            where: { tenantId }
        });
        const voucherSales = await models_1.Voucher.count({
            where: { tenantId, status: 'USED' }
        });
        // Revenue over the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        // Helper for date formatting per dialect
        const dialect = models_1.sequelize.getDialect();
        const dateCol = dialect === 'postgres'
            ? models_1.sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM-DD')`)
            : models_1.sequelize.fn('DATE', models_1.sequelize.col('createdAt'));
        const dailyRevenue = await models_1.Payment.findAll({
            attributes: [
                [dateCol, 'date'],
                [models_1.sequelize.fn('SUM', models_1.sequelize.col('amount')), 'total']
            ],
            where: {
                tenantId,
                status: 'SUCCESS',
                createdAt: { [sequelize_1.Op.gte]: sevenDaysAgo }
            },
            group: [dateCol],
            raw: true
        });
        return {
            totalRevenue: Number(totalRevenue || 0),
            activeSessions,
            totalSubscribers,
            voucherSales,
            dailyRevenue: dailyRevenue.map(r => ({
                date: r.date,
                total: Number(r.total)
            }))
        };
    }
    static async getRevenueReport(tenantId, startDate, endDate) {
        const where = { tenantId, status: 'SUCCESS' };
        if (startDate || endDate) {
            const createdAt = {};
            if (startDate)
                createdAt[sequelize_1.Op.gte] = new Date(startDate);
            if (endDate)
                createdAt[sequelize_1.Op.lte] = new Date(endDate);
            where.createdAt = createdAt;
        }
        return await models_1.Payment.findAll({
            where,
            include: [models_1.Package],
            order: [['createdAt', 'DESC']]
        });
    }
    static async getTrafficInsights(tenantId) {
        // Simple mock insight: Most popular package
        const popularPackage = await models_1.Payment.findAll({
            attributes: [
                'packageId',
                [models_1.sequelize.fn('COUNT', models_1.sequelize.col('packageId')), 'count']
            ],
            where: { tenantId, status: 'SUCCESS' },
            group: ['packageId'],
            order: [[models_1.sequelize.literal('count'), 'DESC']],
            limit: 1,
            include: [models_1.Package],
            raw: true,
            nest: true
        });
        return {
            topPackage: popularPackage[0]?.package?.name || 'N/A',
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
    static async getRealTimeRevenue(tenantId) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [today, week, month] = await Promise.all([
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfToday } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfWeek } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfMonth } } })
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
    static async getBandwidthUsage(tenantId) {
        const sessions = await models_1.Session.findAll({
            where: { tenantId, status: 'ACTIVE' },
            attributes: ['bytesIn', 'bytesOut', 'routerId']
        });
        const usageByRouter = {};
        let totalIn = 0;
        let totalOut = 0;
        sessions.forEach(s => {
            if (!usageByRouter[s.routerId])
                usageByRouter[s.routerId] = { in: 0, out: 0 };
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
    static async getPaymentPerformance(tenantId) {
        const [success, failed] = await Promise.all([
            models_1.Payment.count({ where: { tenantId, status: 'SUCCESS' } }),
            models_1.Payment.count({ where: { tenantId, status: 'FAILED' } })
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
    static async getSmsMetrics(tenantId) {
        const stats = await models_1.SMSLog.findAll({
            where: { tenantId },
            attributes: [
                'status',
                [models_1.sequelize.fn('COUNT', models_1.sequelize.col('id')), 'count'],
                [models_1.sequelize.fn('SUM', models_1.sequelize.col('cost')), 'totalCost']
            ],
            group: ['status'],
            raw: true
        });
        return stats;
    }
    /**
     * Get hourly trends for the last 24 hours (Revenue & Active Sessions)
     */
    static async getHourlyTrends(tenantId) {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Revenue trend
        const dialect = models_1.sequelize.getDialect();
        let hourCol;
        if (dialect === 'postgres') {
            hourCol = models_1.sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM-DD HH24:00')`);
        }
        else if (dialect === 'mysql') {
            hourCol = models_1.sequelize.fn('DATE_FORMAT', models_1.sequelize.col('createdAt'), '%Y-%m-%d %H:00');
        }
        else {
            hourCol = models_1.sequelize.fn('STRFTIME', '%Y-%m-%d %H:00', models_1.sequelize.col('createdAt'));
        }
        const revenueTrend = await models_1.Payment.findAll({
            attributes: [
                [hourCol, 'hour'],
                [models_1.sequelize.fn('SUM', models_1.sequelize.col('amount')), 'amount']
            ],
            where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: last24h } },
            group: [hourCol],
            order: [[hourCol, 'ASC']],
            raw: true
        });
        // Current active users count
        const activeUsersCount = await models_1.Session.count({
            where: { tenantId, status: 'ACTIVE' }
        });
        return {
            revenueTrend: revenueTrend.map(r => ({
                hour: r.hour,
                amount: Number(r.amount) // Cents to Number for charts
            })),
            activeUsersCount
        };
    }
    /**
     * Traffic Context & Peak Hours
     */
    static async getTrafficContext(tenantId) {
        // 1. Calculate Peak Hours (Last 30 days)
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        // Group sessions by hour of day (0-23)
        const dialect = models_1.sequelize.getDialect();
        let hourCol;
        if (dialect === 'postgres') {
            hourCol = models_1.sequelize.literal(`CAST(EXTRACT(HOUR FROM "startTime") AS integer)`);
        }
        else if (dialect === 'mysql') {
            hourCol = models_1.sequelize.fn('HOUR', models_1.sequelize.col('startTime'));
        }
        else {
            hourCol = models_1.sequelize.literal("cast(strftime('%H', startTime) as integer)");
        }
        const sessionsByHour = await models_1.Session.findAll({
            attributes: [
                [hourCol, 'hour'],
                [models_1.sequelize.fn('COUNT', models_1.sequelize.col('id')), 'count']
            ],
            where: {
                tenantId,
                startTime: { [sequelize_1.Op.gte]: last30Days }
            },
            group: [hourCol],
            raw: true
        });
        // Find the 3-hour window with max sessions
        const hoursMap = Array.from({ length: 24 }, () => 0);
        sessionsByHour.forEach(r => {
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
        const formatTime = (h) => {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hr = h % 12 || 12;
            return `${hr.toString().padStart(2, '0')}:00 ${ampm}`;
        };
        const peakHours = `${formatTime(peakStart)} - ${formatTime(peakEnd)}`;
        // 2. Calculate Net Efficiency (Success Rate of Payments/Auth)
        // Proxy: Successful Payments / Total Payments (Since sessions are essentially successful grants)
        const [success, total] = await Promise.all([
            models_1.Payment.count({ where: { tenantId, status: 'SUCCESS' } }),
            models_1.Payment.count({ where: { tenantId } }) // All attempts
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
    static async getYearlyRevenue(tenantId) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const [today, week, month, year] = await Promise.all([
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfToday } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfWeek } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfMonth } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfYear } } }),
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
    static async getSubscriberGrowth(tenantId) {
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        const dialect = models_1.sequelize.getDialect();
        const dateCol = dialect === 'postgres'
            ? models_1.sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM-DD')`)
            : models_1.sequelize.fn('DATE', models_1.sequelize.col('createdAt'));
        const growth = await models_1.Subscriber.findAll({
            attributes: [
                [dateCol, 'date'],
                [models_1.sequelize.fn('COUNT', models_1.sequelize.col('id')), 'count']
            ],
            where: { tenantId, createdAt: { [sequelize_1.Op.gte]: last30Days } },
            group: [dateCol],
            order: [[dateCol, 'ASC']],
            raw: true
        });
        return growth.map(r => ({
            date: r.date,
            count: Number(r.count)
        }));
    }
    /**
     * Top selling packages by revenue and count
     */
    static async getPackageSales(tenantId) {
        const sales = await models_1.Payment.findAll({
            attributes: [
                'packageId',
                [models_1.sequelize.fn('COUNT', models_1.sequelize.col('payment.id')), 'count'],
                [models_1.sequelize.fn('SUM', models_1.sequelize.col('payment.amount')), 'revenue']
            ],
            where: { tenantId, status: 'SUCCESS' },
            group: ['packageId', 'package.id'],
            order: [[models_1.sequelize.literal('revenue'), 'DESC']],
            limit: 10,
            include: [{ model: models_1.Package, attributes: ['name', 'price'] }],
            raw: true,
            nest: true
        });
        return sales.map(r => ({
            packageId: r.packageId,
            name: r.package?.name || 'Unknown',
            count: Number(r.count),
            revenue: Number(r.revenue),
        }));
    }
    /**
     * Network health score (0-100) based on online router percentage
     */
    static async getNetworkHealthScore(tenantId) {
        const [total, online] = await Promise.all([
            models_1.Router.count({ where: { tenantId } }),
            models_1.Router.count({ where: { tenantId, isOnline: true } }),
        ]);
        if (total === 0)
            return 100;
        return Math.round((online / total) * 100);
    }
    /**
     * Monthly revenue trend for the last 12 months
     */
    static async getMonthlyRevenueTrend(tenantId) {
        const last12Months = new Date();
        last12Months.setMonth(last12Months.getMonth() - 12);
        const dialect = models_1.sequelize.getDialect();
        let monthCol;
        if (dialect === 'postgres') {
            monthCol = models_1.sequelize.literal(`TO_CHAR("createdAt", 'YYYY-MM')`);
        }
        else if (dialect === 'mysql') {
            monthCol = models_1.sequelize.fn('DATE_FORMAT', models_1.sequelize.col('createdAt'), '%Y-%m');
        }
        else {
            monthCol = models_1.sequelize.fn('STRFTIME', '%Y-%m', models_1.sequelize.col('createdAt'));
        }
        const trend = await models_1.Payment.findAll({
            attributes: [
                [monthCol, 'month'],
                [models_1.sequelize.fn('SUM', models_1.sequelize.col('amount')), 'total']
            ],
            where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: last12Months } },
            group: [monthCol],
            order: [[monthCol, 'ASC']],
            raw: true
        });
        return trend.map(r => ({
            month: r.month,
            total: Number(r.total)
        }));
    }
    /**
     * Full BI Dashboard Stats — aggregates all 18 KPIs in one call
     */
    static async getFullDashboardStats(tenantId) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const [revenueToday, revenueWeek, revenueMonth, revenueYear, totalSubscribers, activeSubscribers, expiredSubscribers, onlineUsers, totalRouters, connectedRouters, successPayments, failedPayments, pendingPayments, activeCampaigns, pendingWithdrawals] = await Promise.all([
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfToday } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfWeek } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfMonth } } }),
            models_1.Payment.sum('amount', { where: { tenantId, status: 'SUCCESS', createdAt: { [sequelize_1.Op.gte]: startOfYear } } }),
            models_1.Subscriber.count({ where: { tenantId } }),
            models_1.Subscriber.count({ where: { tenantId, status: 'ACTIVE' } }),
            models_1.Subscriber.count({ where: { tenantId, status: { [sequelize_1.Op.in]: ['INACTIVE', 'SUSPENDED'] } } }),
            models_1.Session.count({
                where: {
                    tenantId,
                    status: 'ACTIVE',
                    [sequelize_1.Op.or]: [
                        { lastUpdated: { [sequelize_1.Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } },
                        { lastUpdated: null, startTime: { [sequelize_1.Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } }
                    ]
                }
            }),
            models_1.Router.count({ where: { tenantId } }),
            models_1.Router.count({ where: { tenantId, isOnline: true } }),
            models_1.Payment.count({ where: { tenantId, status: 'SUCCESS' } }),
            models_1.Payment.count({ where: { tenantId, status: 'FAILED' } }),
            models_1.Payment.count({ where: { tenantId, status: 'PENDING' } }),
            // Campaigns: count active SMS campaigns (vouchers available as proxy)
            models_1.Voucher.count({ where: { tenantId, status: 'AVAILABLE' } }),
            models_1.Settlement.count({ where: { tenantId, status: 'PENDING' } }),
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
exports.AnalyticsService = AnalyticsService;
