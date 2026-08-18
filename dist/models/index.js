"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRCampaign = exports.MarketingCoupon = exports.MediaItem = exports.AdCampaign = exports.TenantWithdrawal = exports.TenantDocument = exports.TestAccountSeed = exports.SandboxPaymentLog = exports.SandboxMessageLog = exports.StagingErrorLog = exports.FeatureFlag = exports.SmsLedgerTransaction = exports.SmsProcurementTask = exports.SmsFinancialLedger = exports.SmsCampaignMessage = exports.SmsTransaction = exports.TenantSmsWallet = exports.SmsPackage = exports.SmsGateway = exports.DormantRouterPolicy = exports.RouterConnectionLog = exports.CampaignLog = exports.MessageTemplate = exports.Campaign = exports.PasswordResetToken = exports.PlatformFee = exports.PlatformWallet = exports.TieredFee = exports.WalletTransaction = exports.PlatformTransaction = exports.SMSLog = exports.FraudLog = exports.Voucher = exports.AdminSession = exports.Session = exports.Payment = exports.PlatformSetting = exports.AuditLog = exports.Settlement = exports.Wallet = exports.Invoice = exports.Subscriber = exports.DeviceBinding = exports.SubscriberGroup = exports.Package = exports.DowntimeRecord = exports.RouterIncident = exports.Router = exports.AdminUser = exports.Tenant = void 0;
exports.PaymentVerificationAudit = exports.sequelize = exports.PaymentLog = exports.MpesaCallbackLog = exports.SaaSSubscriptionPayment = exports.RadiusPolicy = exports.RadPostAuth = exports.RadAcct = exports.RadUserGroup = exports.RadGroupReply = exports.RadGroupCheck = exports.RadReply = exports.RadCheck = exports.Nas = exports.EnterpriseQuote = exports.EnterpriseLead = exports.PlatformBranding = exports.RefundAuditLog = exports.CompensationRule = exports.RefundRequest = exports.SaaSNotification = exports.SaaSPayment = exports.SaaSInvoiceItem = exports.SaaSInvoice = exports.TenantAddonModule = exports.TenantCaptivePortalBranding = exports.FeatureViolationLog = exports.TrialAgreement = exports.TenantSubscription = exports.PlatformPricingConfig = exports.SubscriptionPlan = exports.MarketingSetting = exports.CustomerSegment = exports.AdAnalytic = exports.MarketingLandingPage = void 0;
const sequelize_1 = require("sequelize");
const env_1 = require("../config/env");
const encryption_1 = require("../utils/encryption");
const rawDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL || '';
let sequelize = null;
exports.sequelize = sequelize;
if (rawDbUrl && (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'))) {
    try {
        let hostname = 'postgres-host';
        try {
            hostname = new URL(rawDbUrl).hostname;
        }
        catch {
            hostname = rawDbUrl.split('@')[1]?.split(':')[0] || 'postgres';
        }
        console.info(`[DB] Attempting connection via DATABASE_URL to host: ${hostname}`);
        exports.sequelize = sequelize = new sequelize_1.Sequelize(rawDbUrl, {
            dialect: 'postgres',
            dialectOptions: {
                ssl: process.env.DB_SSL === 'false' ? false : {
                    require: true,
                    rejectUnauthorized: false
                },
                connectTimeout: 10000,
            },
            pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
            logging: false,
        });
    }
    catch (err) {
        console.error('Sequelize initialization error from URL:', err);
        throw err;
    }
}
else if (env_1.config.db.host && env_1.config.db.user && env_1.config.db.pass) {
    try {
        exports.sequelize = sequelize = new sequelize_1.Sequelize(env_1.config.db.name, env_1.config.db.user, env_1.config.db.pass, {
            host: env_1.config.db.host,
            port: env_1.config.db.port,
            dialect: 'postgres',
            dialectOptions: {
                ssl: process.env.DB_SSL === 'false' ? false : {
                    require: true,
                    rejectUnauthorized: false
                },
                connectTimeout: 8000,
            },
            pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
            logging: false,
        });
    }
    catch (err) {
        console.error('Sequelize initialization error from config:', err);
        throw err;
    }
}
else {
    console.error('CRITICAL: Database connection parameters are missing or incomplete. PostgreSQL is required.');
    console.info('Please set DATABASE_URL in Settings to the postgres:// connection string provided in your Supabase dashboard.');
    exports.sequelize = sequelize = new sequelize_1.Sequelize('postgres://unconfigured:unconfigured@localhost:5432/unconfigured', {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            connectTimeout: 1,
        },
    });
}
// Database connection is managed by Sequelize
class Tenant extends sequelize_1.Model {
    // Billing calculation helper
    async getSubscriptionInfo() {
        const now = new Date();
        const trialEnd = this.trialEndsAt ? new Date(this.trialEndsAt) : null;
        const dueAt = this.nextPaymentDueDate ? new Date(this.nextPaymentDueDate) : null;
        let isTrial = this.subscriptionStatus === 'TRIAL';
        let isPaid = this.subscriptionStatus === 'PAID';
        let isExpired = this.subscriptionStatus === 'EXPIRED';
        let daysRemaining = 0;
        let showNotification = false;
        let message = "";
        // Dynamic Price Retrieval
        let priceCents = 150000; // Default KES 1500 in cents
        try {
            // Look up tenant subscription plan first
            const sub = await TenantSubscription.findOne({
                where: { tenantId: this.id },
                include: [SubscriptionPlan]
            });
            if (sub && sub.SubscriptionPlan) {
                priceCents = sub.SubscriptionPlan.monthlyPriceCents;
            }
            else {
                // Fallback to global platform pricing config
                const config = await PlatformPricingConfig.findOne();
                if (config) {
                    priceCents = config.baseSubscriptionPriceCents;
                }
            }
        }
        catch (err) {
            // Safe fallback if tables aren't queried successfully
        }
        const price = Math.round(priceCents / 100);
        if (isTrial && trialEnd) {
            const diff = trialEnd.getTime() - now.getTime();
            daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            showNotification = true;
            message = `Trial Pass: ${daysRemaining} days remaining. Pay KES ${price.toLocaleString()} to activate monthly subscription.`;
        }
        else if (isPaid && dueAt) {
            const diff = dueAt.getTime() - now.getTime();
            daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            // Reappear 4 days to due date
            if (daysRemaining <= 4) {
                showNotification = true;
                message = `Subscription renewal in ${daysRemaining} days. Pay KES ${price.toLocaleString()} to avoid suspension.`;
            }
        }
        else if (isExpired) {
            showNotification = true;
            message = `Account suspended. Please pay KES ${price.toLocaleString()} to restore access.`;
        }
        return {
            status: this.subscriptionStatus,
            isTrial,
            isPaid,
            isExpired,
            daysRemaining,
            showNotification,
            message,
            trialEndsAt: this.trialEndsAt,
            nextPaymentDueDate: this.nextPaymentDueDate,
            price: price
        };
    }
}
exports.Tenant = Tenant;
Tenant.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    subdomain: { type: sequelize_1.DataTypes.STRING, unique: true, allowNull: false },
    logoUrl: { type: sequelize_1.DataTypes.STRING },
    primaryColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#3b82f6' },
    themePreference: { type: sequelize_1.DataTypes.ENUM('light', 'dark', 'system'), defaultValue: 'light' },
    mpesaShortcode: { type: sequelize_1.DataTypes.STRING },
    mpesaConsumerKey: { type: sequelize_1.DataTypes.STRING },
    mpesaConsumerSecret: { type: sequelize_1.DataTypes.STRING },
    mpesaPasskey: { type: sequelize_1.DataTypes.STRING },
    mpesaInitiatorName: { type: sequelize_1.DataTypes.STRING },
    mpesaInitiatorPassword: { type: sequelize_1.DataTypes.STRING },
    mpesaEnvironment: { type: sequelize_1.DataTypes.STRING, defaultValue: 'sandbox' },
    mpesaWebhookSecret: { type: sequelize_1.DataTypes.STRING },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'SUSPENDED'), defaultValue: 'ACTIVE' },
    description: { type: sequelize_1.DataTypes.TEXT },
    contactPhone: { type: sequelize_1.DataTypes.STRING },
    bankName: { type: sequelize_1.DataTypes.STRING },
    bankAccountNumber: { type: sequelize_1.DataTypes.STRING },
    bankAccountName: { type: sequelize_1.DataTypes.STRING },
    bankBranch: { type: sequelize_1.DataTypes.STRING },
    bankSwiftCode: { type: sequelize_1.DataTypes.STRING },
    minimumWithdrawalAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 10000 }, // 100.00 KES
    settlementMethod: { type: sequelize_1.DataTypes.STRING, defaultValue: 'INTASEND' },
    settlementSchedule: { type: sequelize_1.DataTypes.STRING, defaultValue: 'MANUAL' },
    idNumber: { type: sequelize_1.DataTypes.STRING },
    businessRegistrationNumber: { type: sequelize_1.DataTypes.STRING },
    taxPin: { type: sequelize_1.DataTypes.STRING },
    withdrawalVerificationMethod: { type: sequelize_1.DataTypes.ENUM('OTP_EMAIL', 'OTP_SMS', 'NONE'), defaultValue: 'NONE' },
    mpesaPaybillNumber: { type: sequelize_1.DataTypes.STRING },
    mpesaPaybillAccount: { type: sequelize_1.DataTypes.STRING },
    mpesaTillNumber: { type: sequelize_1.DataTypes.STRING },
    mpesaTillName: { type: sequelize_1.DataTypes.STRING },
    mpesaPochiNumber: { type: sequelize_1.DataTypes.STRING },
    payoutMethod: { type: sequelize_1.DataTypes.STRING, defaultValue: 'TILL' },
    directPayoutEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    bankAccountDetails: { type: sequelize_1.DataTypes.TEXT },
    aggregatorSubAccountId: { type: sequelize_1.DataTypes.STRING },
    commissionPercentage: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 10 },
    baseMonthlyFee: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    transactionFee: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    smsFee: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    activeUserFee: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    subscriptionExpiry: { type: sequelize_1.DataTypes.DATE },
    trialEndsAt: { type: sequelize_1.DataTypes.DATE },
    subscriptionStatus: { type: sequelize_1.DataTypes.ENUM('TRIAL', 'PAID', 'EXPIRED', 'GRACE'), defaultValue: 'TRIAL' },
    nextPaymentDueDate: { type: sequelize_1.DataTypes.DATE },
    intasendPublishableKey: { type: sequelize_1.DataTypes.STRING },
    intasendSecretKey: { type: sequelize_1.DataTypes.STRING },
    isProduction: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    isGoLiveChecked: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    productionReadyAt: { type: sequelize_1.DataTypes.DATE },
    lastSanitizedAt: { type: sequelize_1.DataTypes.DATE },
    tradingName: { type: sequelize_1.DataTypes.STRING },
    businessLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    vatNumber: { type: sequelize_1.DataTypes.STRING },
    website: { type: sequelize_1.DataTypes.STRING },
    businessEmail: { type: sequelize_1.DataTypes.STRING },
    businessAddress: { type: sequelize_1.DataTypes.TEXT },
    supportEmail: { type: sequelize_1.DataTypes.STRING },
    supportPhone: { type: sequelize_1.DataTypes.STRING },
    loginLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    portalLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    faviconUrl: { type: sequelize_1.DataTypes.TEXT },
    themeColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0f172a' },
    secondaryColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#38bdf8' },
    mpesaWithdrawalName: { type: sequelize_1.DataTypes.STRING },
    mpesaWithdrawalNumber: { type: sequelize_1.DataTypes.STRING },
    bankIban: { type: sequelize_1.DataTypes.STRING },
    defaultWithdrawalMethod: { type: sequelize_1.DataTypes.STRING, defaultValue: 'MPESA' },
    notificationPreferences: { type: sequelize_1.DataTypes.TEXT },
}, {
    sequelize,
    modelName: 'tenant',
    hooks: {
        beforeSave: (tenant) => {
            const sensitiveFields = [
                'mpesaPasskey',
                'mpesaConsumerKey',
                'mpesaConsumerSecret',
                'mpesaInitiatorPassword',
                'intasendSecretKey'
            ];
            sensitiveFields.forEach(field => {
                if (tenant[field] && typeof tenant[field] === 'string' && !tenant[field].includes(':')) {
                    tenant[field] = encryption_1.EncryptionService.encrypt(tenant[field]);
                }
            });
        }
    }
});
class AdminUser extends sequelize_1.Model {
}
exports.AdminUser = AdminUser;
AdminUser.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    email: { type: sequelize_1.DataTypes.STRING, unique: true, allowNull: false },
    password: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    role: { type: sequelize_1.DataTypes.ENUM('PLATFORM_OWNER', 'SUPER_ADMIN', 'TENANT', 'STAFF', 'AGENT'), defaultValue: 'TENANT' },
    themePreference: { type: sequelize_1.DataTypes.ENUM('light', 'dark', 'system'), defaultValue: 'light' },
    tenantId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    },
    commissionRate: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 0.0 },
    firstName: { type: sequelize_1.DataTypes.STRING },
    lastName: { type: sequelize_1.DataTypes.STRING },
    displayName: { type: sequelize_1.DataTypes.STRING },
    username: { type: sequelize_1.DataTypes.STRING },
    phone: { type: sequelize_1.DataTypes.STRING },
    altPhone: { type: sequelize_1.DataTypes.STRING },
    preferredLanguage: { type: sequelize_1.DataTypes.STRING, defaultValue: 'en' },
    timeZone: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Africa/Nairobi' },
    country: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Kenya' },
    countyState: { type: sequelize_1.DataTypes.STRING },
    city: { type: sequelize_1.DataTypes.STRING },
    postalCode: { type: sequelize_1.DataTypes.STRING },
    physicalAddress: { type: sequelize_1.DataTypes.TEXT },
    profilePhotoUrl: { type: sequelize_1.DataTypes.TEXT },
    twoFactorEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    twoFactorMethod: { type: sequelize_1.DataTypes.STRING, defaultValue: 'EMAIL' },
    lastPasswordChange: { type: sequelize_1.DataTypes.DATE },
}, {
    sequelize,
    modelName: 'admin_user',
    hooks: {
        beforeValidate: (user) => {
            const role = user.getDataValue('role') || user.role;
            const tenantId = user.getDataValue('tenantId') || user.tenantId;
            // Logic for Platform Owner and Super Admin
            if (role === 'SUPER_ADMIN' || role === 'PLATFORM_OWNER') {
                user.setDataValue('tenantId', null);
                user.tenantId = null; // System admins never belong to a single tenant
                return;
            }
            // Logic for Tenant/Staff/Agent
            if (!tenantId) {
                throw new Error('TENANT_RESOLUTION_REQUIRED: All non-superadmin users must be associated with a workspace.');
            }
        }
    }
});
class Router extends sequelize_1.Model {
}
exports.Router = Router;
Router.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    host: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    port: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 8728 },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    password: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    location: { type: sequelize_1.DataTypes.STRING },
    isOnline: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    lastSeen: { type: sequelize_1.DataTypes.DATE },
    identity: { type: sequelize_1.DataTypes.STRING },
    validationStatus: { type: sequelize_1.DataTypes.ENUM('PENDING', 'VALIDATED', 'FAILED'), defaultValue: 'PENDING' },
    // Auto-configuration fields
    apiUser: { type: sequelize_1.DataTypes.STRING },
    apiPassword: { type: sequelize_1.DataTypes.STRING },
    autoConfigStatus: { type: sequelize_1.DataTypes.ENUM('PENDING', 'CONFIGURED', 'FAILED'), defaultValue: 'PENDING' },
    autoConfigScript: { type: sequelize_1.DataTypes.TEXT },
    onboardToken: { type: sequelize_1.DataTypes.STRING },
    autoConfigError: { type: sequelize_1.DataTypes.TEXT },
    capabilities: { type: sequelize_1.DataTypes.TEXT }, // JSON string
    version: { type: sequelize_1.DataTypes.STRING },
    model: { type: sequelize_1.DataTypes.STRING },
    architecture: { type: sequelize_1.DataTypes.STRING },
    // Power & Maintenance
    powerStatus: { type: sequelize_1.DataTypes.ENUM('GRID', 'UPS_BATTERY', 'OFFLINE', 'UNKNOWN'), defaultValue: 'GRID' },
    maintenanceStatus: {
        type: sequelize_1.DataTypes.ENUM('OPERATIONAL', 'MAINTENANCE', 'POWER_OUTAGE', 'BLACKOUT', 'NETWORK_FAILURE', 'HARDWARE_FAILURE', 'UPSTREAM_FAILURE'),
        defaultValue: 'OPERATIONAL'
    },
    maintenanceNotes: { type: sequelize_1.DataTypes.TEXT },
    maintenanceStartTime: { type: sequelize_1.DataTypes.DATE },
    expectedReturnTime: { type: sequelize_1.DataTypes.DATE },
    maintenanceCreatedBy: { type: sequelize_1.DataTypes.STRING },
    uptimeSeconds: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    subscriberCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    cpuUsagePercent: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 0 },
    memoryUsagePercent: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 0 },
    bandwidthUsageMbps: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 0 },
    hasSmartPower: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    smartPowerType: { type: sequelize_1.DataTypes.ENUM('SMART_PDU', 'SMART_UPS', 'SMART_PLUG', 'REMOTE_SWITCH', 'NONE'), defaultValue: 'NONE' },
    smartPowerHost: { type: sequelize_1.DataTypes.STRING },
    smartPowerPort: { type: sequelize_1.DataTypes.INTEGER },
    smartPowerOutletId: { type: sequelize_1.DataTypes.STRING },
    outageAutoDetect: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    outageThresholdMinutes: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 5 },
    escalationThresholdMinutes: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 30 },
    suspendAlertsInBlackout: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    autoExtendSubscribersOnOutage: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, {
    sequelize,
    modelName: 'router',
    tableName: 'routers',
    hooks: {
        beforeSave: (router) => {
            const sensitiveFields = ['password', 'apiPassword'];
            sensitiveFields.forEach(field => {
                if (router[field] && typeof router[field] === 'string' && !router[field].includes(':')) {
                    router[field] = encryption_1.EncryptionService.encrypt(router[field]);
                }
            });
        }
    }
});
class RouterIncident extends sequelize_1.Model {
}
exports.RouterIncident = RouterIncident;
RouterIncident.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    routerId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    incidentType: {
        type: sequelize_1.DataTypes.ENUM('POWER_OUTAGE', 'BLACKOUT', 'MAINTENANCE', 'NETWORK_FAILURE', 'HARDWARE_FAILURE', 'UPSTREAM_FAILURE'),
        allowNull: false
    },
    severity: { type: sequelize_1.DataTypes.ENUM('INFO', 'WARNING', 'CRITICAL', 'EMERGENCY'), defaultValue: 'WARNING' },
    status: { type: sequelize_1.DataTypes.ENUM('OPEN', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'), defaultValue: 'OPEN' },
    summary: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    details: { type: sequelize_1.DataTypes.TEXT },
    startTime: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    endTime: { type: sequelize_1.DataTypes.DATE },
    expectedReturnTime: { type: sequelize_1.DataTypes.DATE },
    affectedSubscriberCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    compensationIssuedCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    notifiedChannels: { type: sequelize_1.DataTypes.TEXT },
    resolvedBy: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'router_incident' });
class DowntimeRecord extends sequelize_1.Model {
}
exports.DowntimeRecord = DowntimeRecord;
DowntimeRecord.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    routerId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    incidentId: { type: sequelize_1.DataTypes.UUID },
    reason: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    downtimeMinutes: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    subscriberCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    compensationPerSubscriberCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    totalCompensationCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize, modelName: 'downtime_record' });
class Package extends sequelize_1.Model {
}
exports.Package = Package;
Package.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    price: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    durationMinutes: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    dataLimitBytes: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    speedLimit: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    isEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    type: { type: sequelize_1.DataTypes.ENUM('HOTSPOT', 'ISP'), defaultValue: 'HOTSPOT' },
    // Enhanced MikroTik fields
    description: { type: sequelize_1.DataTypes.TEXT },
    validity: { type: sequelize_1.DataTypes.INTEGER }, // Days
    uploadSpeed: { type: sequelize_1.DataTypes.STRING },
    downloadSpeed: { type: sequelize_1.DataTypes.STRING },
    burstUpload: { type: sequelize_1.DataTypes.STRING },
    burstDownload: { type: sequelize_1.DataTypes.STRING },
    burstThreshold: { type: sequelize_1.DataTypes.STRING },
    burstTime: { type: sequelize_1.DataTypes.STRING },
    priority: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 8 },
    sharedUsers: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1 },
    expiryAction: { type: sequelize_1.DataTypes.ENUM('SUSPEND', 'DELETE', 'NOTIFY'), defaultValue: 'SUSPEND' },
    isVisible: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    category: { type: sequelize_1.DataTypes.STRING },
    mikrotikProfile: { type: sequelize_1.DataTypes.STRING },
    limitAtTime: { type: sequelize_1.DataTypes.STRING },
    parentQueue: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'package' });
class SubscriberGroup extends sequelize_1.Model {
}
exports.SubscriberGroup = SubscriberGroup;
SubscriberGroup.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT },
    discountPercentage: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 0 },
}, {
    sequelize,
    modelName: 'subscriber_group',
    indexes: [{ fields: ['tenantId'] }]
});
class DeviceBinding extends sequelize_1.Model {
}
exports.DeviceBinding = DeviceBinding;
class Subscriber extends sequelize_1.Model {
}
exports.Subscriber = Subscriber;
DeviceBinding.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    routerId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    subscriberId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    macAddress: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    deviceType: { type: sequelize_1.DataTypes.ENUM('SMARTPHONE', 'TV', 'LAPTOP', 'OTHER'), defaultValue: 'OTHER' },
    bindingType: { type: sequelize_1.DataTypes.ENUM('BYPASSED', 'BLOCKED', 'REGULAR'), defaultValue: 'BYPASSED' },
    comments: { type: sequelize_1.DataTypes.STRING }
}, {
    sequelize,
    modelName: 'device_binding',
    indexes: [{ fields: ['tenantId'] }, { fields: ['macAddress'] }]
});
Subscriber.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    firstName: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    lastName: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    phoneNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    altPhone: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    email: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    idNumber: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    password: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    pppoeUsername: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    pppoePassword: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    macAddress: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    address: { type: sequelize_1.DataTypes.STRING },
    location: { type: sequelize_1.DataTypes.STRING },
    customerType: {
        type: sequelize_1.DataTypes.ENUM('RESIDENTIAL', 'BUSINESS', 'CORPORATE', 'INSTITUTION', 'HOTSPOT', 'PPPOE'),
        defaultValue: 'RESIDENTIAL'
    },
    connectionType: {
        type: sequelize_1.DataTypes.ENUM('HOTSPOT', 'PPPOE'),
        defaultValue: 'HOTSPOT'
    },
    customerGroupId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'), defaultValue: 'INACTIVE' },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    routerId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    packageId: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    expiryDate: { type: sequelize_1.DataTypes.DATE },
    lastPaymentDate: { type: sequelize_1.DataTypes.DATE },
    notes: { type: sequelize_1.DataTypes.TEXT },
    autoRenewal: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    notificationsEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    isDraft: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    archivedAt: { type: sequelize_1.DataTypes.DATE, allowNull: true },
}, {
    sequelize,
    modelName: 'subscriber',
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['phoneNumber'] },
        { fields: ['username'] },
        { fields: ['customerGroupId'] }
    ]
});
Tenant.hasMany(SubscriberGroup, { foreignKey: 'tenantId' });
SubscriberGroup.belongsTo(Tenant, { foreignKey: 'tenantId' });
SubscriberGroup.hasMany(Subscriber, { foreignKey: 'customerGroupId' });
Subscriber.belongsTo(SubscriberGroup, { foreignKey: 'customerGroupId' });
class Invoice extends sequelize_1.Model {
}
exports.Invoice = Invoice;
Invoice.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    subscriberId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    dueDate: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('UNPAID', 'PAID', 'CANCELLED'), defaultValue: 'UNPAID' },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'invoice' });
class Wallet extends sequelize_1.Model {
}
exports.Wallet = Wallet;
Wallet.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    ownerId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    ownerType: { type: sequelize_1.DataTypes.ENUM('SUBSCRIBER', 'TENANT', 'AGENT'), allowNull: false },
    balance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    frozenBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    pendingBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    settledBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    currency: { type: sequelize_1.DataTypes.STRING, defaultValue: 'KES' },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'wallet' });
class Settlement extends sequelize_1.Model {
}
exports.Settlement = Settlement;
Settlement.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'REVERSED'), defaultValue: 'PENDING' },
    method: { type: sequelize_1.DataTypes.STRING },
    paidAt: { type: sequelize_1.DataTypes.DATE },
    referenceNumber: { type: sequelize_1.DataTypes.STRING },
    transactionFee: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    walletTransactionId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    processedBy: { type: sequelize_1.DataTypes.UUID, allowNull: true },
}, { sequelize, modelName: 'settlement' });
class AuditLog extends sequelize_1.Model {
}
exports.AuditLog = AuditLog;
AuditLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID },
    userId: { type: sequelize_1.DataTypes.UUID },
    action: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    details: { type: sequelize_1.DataTypes.TEXT },
    ipAddress: { type: sequelize_1.DataTypes.STRING },
}, {
    sequelize,
    modelName: 'auditLog',
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['userId'] }
    ]
});
class PlatformSetting extends sequelize_1.Model {
}
exports.PlatformSetting = PlatformSetting;
PlatformSetting.init({
    key: { type: sequelize_1.DataTypes.STRING, primaryKey: true },
    value: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'platformSetting' });
class Payment extends sequelize_1.Model {
}
exports.Payment = Payment;
Payment.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    mpesaReceiptNumber: { type: sequelize_1.DataTypes.STRING, unique: true },
    checkoutRequestId: { type: sequelize_1.DataTypes.STRING, unique: true },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    phoneNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED', 'REVERSED'), defaultValue: 'PENDING' },
    packageId: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    macAddress: { type: sequelize_1.DataTypes.STRING },
    ipAddress: { type: sequelize_1.DataTypes.STRING },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    routerId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    subscriberId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    rawCallback: { type: sequelize_1.DataTypes.TEXT },
    processedCallbackHash: { type: sequelize_1.DataTypes.STRING }, // For idempotency checks
    completedAt: { type: sequelize_1.DataTypes.DATE }, // When payment completed
    failureReason: { type: sequelize_1.DataTypes.STRING }, // Detailed failure reason
    sessionId: { type: sequelize_1.DataTypes.STRING }, // Encrypted session identifier
    metadata: { type: sequelize_1.DataTypes.TEXT }, // JSON metadata storage
    paymentChannel: { type: sequelize_1.DataTypes.STRING, defaultValue: 'MPESA' },
    paymentMethod: { type: sequelize_1.DataTypes.STRING, defaultValue: 'PAYHERO' },
    transactionFee: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    platformFee: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    netAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    walletTransactionId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    aggregatorTransactionId: { type: sequelize_1.DataTypes.STRING },
    rawAggregatorPayload: { type: sequelize_1.DataTypes.TEXT },
    intasendCheckoutId: { type: sequelize_1.DataTypes.STRING },
    intasendTrackingId: { type: sequelize_1.DataTypes.STRING },
    intasendState: { type: sequelize_1.DataTypes.STRING },
    payheroReference: { type: sequelize_1.DataTypes.STRING },
    payheroCheckoutId: { type: sequelize_1.DataTypes.STRING },
    payheroStatus: { type: sequelize_1.DataTypes.STRING },
    destinationType: { type: sequelize_1.DataTypes.STRING },
    destinationAccount: { type: sequelize_1.DataTypes.STRING },
}, {
    sequelize,
    modelName: 'payment',
    tableName: 'payment',
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['phoneNumber'] },
        { fields: ['status'] },
        { fields: ['checkoutRequestId'] },
        { fields: ['mpesaReceiptNumber'] }
    ]
});
class Session extends sequelize_1.Model {
}
exports.Session = Session;
Session.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    paymentId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    routerId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    mikrotikUsername: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    mikrotikPassword: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    macAddress: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    ipAddress: { type: sequelize_1.DataTypes.STRING },
    startTime: { type: sequelize_1.DataTypes.DATE },
    expiryTime: { type: sequelize_1.DataTypes.DATE },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'EXPIRED'), defaultValue: 'ACTIVE' },
    fraudScore: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    bytesIn: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    bytesOut: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    lastUpdated: { type: sequelize_1.DataTypes.DATE },
}, {
    sequelize,
    modelName: 'session',
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['macAddress'] },
        { fields: ['status'] }
    ]
});
class AdminSession extends sequelize_1.Model {
}
exports.AdminSession = AdminSession;
AdminSession.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    userId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    tokenHash: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    ipAddress: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    userAgent: { type: sequelize_1.DataTypes.STRING },
    loginTime: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    lastActivity: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    expiryTime: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'EXPIRED', 'REVOKED'), defaultValue: 'ACTIVE' },
}, { sequelize, modelName: 'adminSession' });
class Voucher extends sequelize_1.Model {
}
exports.Voucher = Voucher;
Voucher.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    code: { type: sequelize_1.DataTypes.STRING, unique: true, allowNull: false },
    packageId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    batch: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM('AVAILABLE', 'USED', 'EXPIRED'), defaultValue: 'AVAILABLE' },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    usedAt: { type: sequelize_1.DataTypes.DATE },
    soldByAgentId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
}, { sequelize, modelName: 'voucher' });
class FraudLog extends sequelize_1.Model {
}
exports.FraudLog = FraudLog;
FraudLog.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sessionId: { type: sequelize_1.DataTypes.UUID },
    violationType: { type: sequelize_1.DataTypes.STRING },
    details: { type: sequelize_1.DataTypes.TEXT },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'fraud_log' });
class SMSLog extends sequelize_1.Model {
}
exports.SMSLog = SMSLog;
SMSLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    phoneNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    message: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('SENT', 'FAILED', 'PENDING'), defaultValue: 'PENDING' },
    cost: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    providerReference: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'sms_log' });
class PlatformTransaction extends sequelize_1.Model {
}
exports.PlatformTransaction = PlatformTransaction;
PlatformTransaction.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    type: { type: sequelize_1.DataTypes.ENUM('FEE_SUBSCRIPTION', 'FEE_TRANSACTION', 'FEE_SMS', 'COMMISSION'), allowNull: false },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    referenceId: { type: sequelize_1.DataTypes.UUID },
    metadata: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'platform_transaction' });
// Relationships
Tenant.hasMany(AdminUser, { foreignKey: 'tenantId' });
AdminUser.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Router, { foreignKey: 'tenantId' });
Router.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Package, { foreignKey: 'tenantId' });
Package.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Subscriber, { foreignKey: 'tenantId' });
Subscriber.belongsTo(Tenant, { foreignKey: 'tenantId' });
Subscriber.belongsTo(Package, { foreignKey: 'packageId' });
Package.hasMany(Subscriber, { foreignKey: 'packageId' });
Subscriber.belongsTo(Router, { foreignKey: 'routerId' });
Router.hasMany(Subscriber, { foreignKey: 'routerId' });
Tenant.hasMany(Payment, { foreignKey: 'tenantId' });
Payment.belongsTo(Tenant, { foreignKey: 'tenantId' });
Payment.hasOne(Session, { foreignKey: 'paymentId' });
Session.belongsTo(Payment, { foreignKey: 'paymentId' });
Payment.belongsTo(Package, { foreignKey: 'packageId' });
Package.hasMany(Payment, { foreignKey: 'packageId' });
Payment.belongsTo(Subscriber, { foreignKey: 'subscriberId' });
Subscriber.hasMany(DeviceBinding, { foreignKey: 'subscriberId' });
DeviceBinding.belongsTo(Subscriber, { foreignKey: 'subscriberId' });
Router.hasMany(DeviceBinding, { foreignKey: 'routerId' });
DeviceBinding.belongsTo(Router, { foreignKey: 'routerId' });
Subscriber.hasMany(Payment, { foreignKey: 'subscriberId' });
Tenant.hasMany(Session, { foreignKey: 'tenantId' });
Session.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(FraudLog, { foreignKey: 'tenantId' });
FraudLog.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Invoice, { foreignKey: 'tenantId' });
Invoice.belongsTo(Tenant, { foreignKey: 'tenantId' });
Subscriber.hasMany(Invoice, { foreignKey: 'subscriberId' });
Invoice.belongsTo(Subscriber, { foreignKey: 'subscriberId' });
Tenant.hasMany(Wallet, { foreignKey: 'tenantId' });
Wallet.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Voucher, { foreignKey: 'tenantId' });
Voucher.belongsTo(Tenant, { foreignKey: 'tenantId' });
Package.hasMany(Voucher, { foreignKey: 'packageId' });
Voucher.belongsTo(Package, { foreignKey: 'packageId' });
Tenant.hasMany(AuditLog, { foreignKey: 'tenantId' });
AuditLog.belongsTo(Tenant, { foreignKey: 'tenantId' });
AdminUser.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(AdminUser, { foreignKey: 'userId' });
Settlement.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(SMSLog, { foreignKey: 'tenantId' });
SMSLog.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(PlatformTransaction, { foreignKey: 'tenantId' });
PlatformTransaction.belongsTo(Tenant, { foreignKey: 'tenantId' });
Payment.hasMany(PlatformTransaction, { foreignKey: 'referenceId', constraints: false });
PlatformTransaction.belongsTo(Payment, { foreignKey: 'referenceId', constraints: false });
SMSLog.hasMany(PlatformTransaction, { foreignKey: 'referenceId', constraints: false });
PlatformTransaction.belongsTo(SMSLog, { foreignKey: 'referenceId', constraints: false });
// Add new models for wallet transactions and ledger
class WalletTransaction extends sequelize_1.Model {
}
exports.WalletTransaction = WalletTransaction;
WalletTransaction.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    walletId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    sourceWalletId: { type: sequelize_1.DataTypes.UUID },
    destinationWalletId: { type: sequelize_1.DataTypes.UUID },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    transactionType: { type: sequelize_1.DataTypes.ENUM('CREDIT', 'DEBIT', 'FEE', 'SETTLEMENT', 'REVERSAL'), allowNull: false },
    referenceId: { type: sequelize_1.DataTypes.UUID },
    referenceType: { type: sequelize_1.DataTypes.STRING },
    balanceAfter: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED'), defaultValue: 'COMPLETED' },
    settlementStatus: { type: sequelize_1.DataTypes.ENUM('PENDING', 'SETTLED', 'NA'), defaultValue: 'NA' },
    maturesAt: { type: sequelize_1.DataTypes.DATE },
    createdBy: { type: sequelize_1.DataTypes.UUID },
    metadata: { type: sequelize_1.DataTypes.TEXT },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
}, {
    sequelize,
    modelName: 'walletTransaction',
    indexes: [
        { fields: ['walletId'] },
        { fields: ['tenantId'] }
    ]
});
class TieredFee extends sequelize_1.Model {
}
exports.TieredFee = TieredFee;
TieredFee.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    platformFeeId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    minAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    maxAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    feeValue: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    isPercentage: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'tieredFee' });
class PlatformWallet extends sequelize_1.Model {
}
exports.PlatformWallet = PlatformWallet;
PlatformWallet.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    balance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    pendingBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    currency: { type: sequelize_1.DataTypes.STRING, defaultValue: 'KES' },
}, { sequelize, modelName: 'platformWallet' });
class PlatformFee extends sequelize_1.Model {
}
exports.PlatformFee = PlatformFee;
PlatformFee.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    feeType: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    feeValue: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    isPercentage: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    minAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    maxAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    isActive: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    description: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'platformFee' });
class PasswordResetToken extends sequelize_1.Model {
}
exports.PasswordResetToken = PasswordResetToken;
PasswordResetToken.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    userId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    token: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    tokenHash: { type: sequelize_1.DataTypes.STRING },
    otpCode: { type: sequelize_1.DataTypes.STRING },
    resetType: { type: sequelize_1.DataTypes.ENUM('LINK', 'OTP'), defaultValue: 'LINK' },
    attempts: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    isLocked: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    expiresAt: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    used: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    ipAddress: { type: sequelize_1.DataTypes.STRING },
    userAgent: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'passwordResetToken' });
class Campaign extends sequelize_1.Model {
}
exports.Campaign = Campaign;
Campaign.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    type: { type: sequelize_1.DataTypes.ENUM('EMAIL', 'SMS', 'WHATSAPP', 'BOTH'), allowNull: false },
    content: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    subject: { type: sequelize_1.DataTypes.STRING },
    templateId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    filterCriteria: { type: sequelize_1.DataTypes.TEXT },
    status: { type: sequelize_1.DataTypes.ENUM('DRAFT', 'SENDING', 'COMPLETED', 'FAILED'), defaultValue: 'DRAFT' },
    scheduledAt: { type: sequelize_1.DataTypes.DATE },
    sentCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    failedCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    totalRecipients: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'campaign' });
class MessageTemplate extends sequelize_1.Model {
}
exports.MessageTemplate = MessageTemplate;
MessageTemplate.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    content: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    channel: { type: sequelize_1.DataTypes.ENUM('EMAIL', 'SMS', 'WHATSAPP'), allowNull: false },
    externalId: { type: sequelize_1.DataTypes.STRING },
    status: { type: sequelize_1.DataTypes.ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED'), defaultValue: 'DRAFT' },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'messageTemplate' });
class CampaignLog extends sequelize_1.Model {
}
exports.CampaignLog = CampaignLog;
CampaignLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    campaignId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    subscriberId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'), defaultValue: 'PENDING' },
    providerReference: { type: sequelize_1.DataTypes.STRING },
    error: { type: sequelize_1.DataTypes.TEXT },
    sentAt: { type: sequelize_1.DataTypes.DATE },
}, { sequelize, modelName: 'campaignLog' });
class RouterConnectionLog extends sequelize_1.Model {
}
exports.RouterConnectionLog = RouterConnectionLog;
RouterConnectionLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    routerId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: { model: 'routers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    tenantId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    action: { type: sequelize_1.DataTypes.ENUM('CONNECT', 'VERIFY', 'DISCONNECT', 'TEST', 'SYNC', 'ERROR'), allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('SUCCESS', 'FAILED', 'PENDING'), defaultValue: 'PENDING' },
    details: { type: sequelize_1.DataTypes.TEXT },
    errorMessage: { type: sequelize_1.DataTypes.TEXT },
    ipAddress: { type: sequelize_1.DataTypes.STRING },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: { model: 'admin_users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    },
    metadata: { type: sequelize_1.DataTypes.TEXT }, // JSON string
}, {
    sequelize,
    modelName: 'router_connection_log',
    tableName: 'router_connection_logs'
});
class DormantRouterPolicy extends sequelize_1.Model {
}
exports.DormantRouterPolicy = DormantRouterPolicy;
DormantRouterPolicy.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    dormantThresholdMinutes: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 30 },
    actionOnDormant: {
        type: sequelize_1.DataTypes.ENUM('ALERT_ONLY', 'SUSPEND_ROUTER', 'DISABLE_SYNC', 'RECONNECT_ATTEMPT'),
        defaultValue: 'ALERT_ONLY'
    },
    notifyTenantAdmin: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    notifyPlatformOwner: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    autoActionEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    lastExecutionAt: { type: sequelize_1.DataTypes.DATE },
    lastExecutionSummary: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'dormantRouterPolicy' });
// Add relationships for new models
AdminUser.hasMany(PasswordResetToken, { foreignKey: 'userId' });
PasswordResetToken.belongsTo(AdminUser, { foreignKey: 'userId' });
Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId' });
Payment.belongsTo(WalletTransaction, { foreignKey: 'walletTransactionId' });
WalletTransaction.hasOne(Payment, { foreignKey: 'walletTransactionId' });
Settlement.belongsTo(WalletTransaction, { foreignKey: 'walletTransactionId' });
WalletTransaction.hasOne(Settlement, { foreignKey: 'walletTransactionId' });
PlatformFee.hasMany(TieredFee, { foreignKey: 'platformFeeId', as: 'tieredFees' });
TieredFee.belongsTo(PlatformFee, { foreignKey: 'platformFeeId', as: 'platformFee' });
// Router Connection Log relationships
Router.hasMany(RouterConnectionLog, { foreignKey: 'routerId' });
RouterConnectionLog.belongsTo(Router, { foreignKey: 'routerId' });
Tenant.hasMany(RouterConnectionLog, { foreignKey: 'tenantId' });
RouterConnectionLog.belongsTo(Tenant, { foreignKey: 'tenantId' });
AdminUser.hasMany(RouterConnectionLog, { foreignKey: 'userId' });
RouterConnectionLog.belongsTo(AdminUser, { foreignKey: 'userId' });
Tenant.hasMany(MessageTemplate, { foreignKey: 'tenantId' });
MessageTemplate.belongsTo(Tenant, { foreignKey: 'tenantId' });
Campaign.belongsTo(MessageTemplate, { foreignKey: 'templateId' });
MessageTemplate.hasMany(Campaign, { foreignKey: 'templateId' });
// ============================================================
// SMS CREDITS PURCHASE SYSTEM
// ============================================================
class SmsGateway extends sequelize_1.Model {
}
exports.SmsGateway = SmsGateway;
SmsGateway.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    provider: { type: sequelize_1.DataTypes.ENUM('TALKSASA', 'AFRICASTALKING', 'INFOBIP', 'VONAGE', 'TWILIO', 'GENERIC'), defaultValue: 'TALKSASA' },
    apiBaseUrl: { type: sequelize_1.DataTypes.STRING },
    apiKeyEncrypted: { type: sequelize_1.DataTypes.TEXT },
    apiSecretEncrypted: { type: sequelize_1.DataTypes.TEXT },
    senderId: { type: sequelize_1.DataTypes.STRING },
    callbackUrl: { type: sequelize_1.DataTypes.STRING },
    isActive: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    supportedCountries: { type: sequelize_1.DataTypes.TEXT }, // JSON
    supportedCurrencies: { type: sequelize_1.DataTypes.TEXT }, // JSON
    taxRate: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 0 },
    minPurchaseAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 10000 }, // 100.00 KES
    maxPurchaseAmount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 1000000 }, // 10,000.00 KES
    metadata: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'sms_gateway' });
class SmsPackage extends sequelize_1.Model {
}
exports.SmsPackage = SmsPackage;
SmsPackage.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    smsCount: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    sellingPrice: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    costPrice: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
    description: { type: sequelize_1.DataTypes.TEXT },
    isCustom: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    sortOrder: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'sms_package' });
class TenantSmsWallet extends sequelize_1.Model {
}
exports.TenantSmsWallet = TenantSmsWallet;
TenantSmsWallet.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false, unique: true },
    balance: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    usedCredits: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    purchasedCredits: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    lastPurchaseAt: { type: sequelize_1.DataTypes.DATE },
    lastPurchasePackageId: { type: sequelize_1.DataTypes.UUID },
    lowBalanceThreshold: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 50 },
    lowBalanceNotified: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, modelName: 'tenant_sms_wallet' });
class SmsTransaction extends sequelize_1.Model {
}
exports.SmsTransaction = SmsTransaction;
SmsTransaction.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    packageId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    creditsAdded: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    paymentMethod: { type: sequelize_1.DataTypes.ENUM('WALLET', 'INTASEND', 'MPESA'), allowNull: false },
    paymentReference: { type: sequelize_1.DataTypes.STRING },
    idempotencyKey: { type: sequelize_1.DataTypes.STRING, unique: true },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'), defaultValue: 'PENDING' },
    invoiceNumber: { type: sequelize_1.DataTypes.STRING, unique: true },
    metadata: { type: sequelize_1.DataTypes.TEXT },
    completedAt: { type: sequelize_1.DataTypes.DATE },
    failureReason: { type: sequelize_1.DataTypes.STRING },
    intasendCheckoutId: { type: sequelize_1.DataTypes.STRING },
    intasendTrackingId: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'sms_transaction' });
class SmsCampaignMessage extends sequelize_1.Model {
}
exports.SmsCampaignMessage = SmsCampaignMessage;
SmsCampaignMessage.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    campaignId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    phoneNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    message: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED'), defaultValue: 'PENDING' },
    providerReference: { type: sequelize_1.DataTypes.STRING },
    retries: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    scheduledAt: { type: sequelize_1.DataTypes.DATE },
    sentAt: { type: sequelize_1.DataTypes.DATE },
    errorMessage: { type: sequelize_1.DataTypes.TEXT },
    creditsCost: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1 },
}, { sequelize, modelName: 'sms_campaign_message' });
// SMS System Relationships
Tenant.hasOne(TenantSmsWallet, { foreignKey: 'tenantId' });
TenantSmsWallet.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(SmsTransaction, { foreignKey: 'tenantId' });
SmsTransaction.belongsTo(Tenant, { foreignKey: 'tenantId' });
SmsPackage.hasMany(SmsTransaction, { foreignKey: 'packageId' });
SmsTransaction.belongsTo(SmsPackage, { foreignKey: 'packageId' });
Campaign.hasMany(SmsCampaignMessage, { foreignKey: 'campaignId' });
SmsCampaignMessage.belongsTo(Campaign, { foreignKey: 'campaignId' });
Tenant.hasMany(SmsCampaignMessage, { foreignKey: 'tenantId' });
SmsCampaignMessage.belongsTo(Tenant, { foreignKey: 'tenantId' });
// SMS PROCUREMENT & MARGIN PROTECTION MODELS
class SmsFinancialLedger extends sequelize_1.Model {
}
exports.SmsFinancialLedger = SmsFinancialLedger;
SmsFinancialLedger.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    providerProcurementBalanceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    reservedProfitBalanceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    availableOperatingBalanceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    smsInventoryBalanceCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    totalTenantRevenueCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    totalProcurementSpentCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    totalReservedProfitCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize, modelName: 'sms_financial_ledger' });
class SmsProcurementTask extends sequelize_1.Model {
}
exports.SmsProcurementTask = SmsProcurementTask;
SmsProcurementTask.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    procurementNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    invoiceId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    packageId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    smsCount: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    amountPaidCents: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    providerCostCents: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    reservedProfitCents: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    executionMode: {
        type: sequelize_1.DataTypes.ENUM('API', 'AUTOMATED_PROCUREMENT_SERVICE'),
        defaultValue: 'API'
    },
    procurementStatus: {
        type: sequelize_1.DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFICATION_FAILED', 'FAILED', 'RETRYING'),
        defaultValue: 'PENDING'
    },
    providerReference: { type: sequelize_1.DataTypes.STRING },
    providerBalanceBeforeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    providerBalanceAfterCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    procurementHash: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    failureReason: { type: sequelize_1.DataTypes.TEXT },
    verifiedAt: { type: sequelize_1.DataTypes.DATE },
    allocatedAt: { type: sequelize_1.DataTypes.DATE }
}, { sequelize, modelName: 'sms_procurement_task' });
class SmsLedgerTransaction extends sequelize_1.Model {
}
exports.SmsLedgerTransaction = SmsLedgerTransaction;
SmsLedgerTransaction.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    procurementTaskId: { type: sequelize_1.DataTypes.UUID },
    tenantId: { type: sequelize_1.DataTypes.UUID },
    transactionType: {
        type: sequelize_1.DataTypes.ENUM('TENANT_PAYMENT', 'PROFIT_RESERVED', 'PROCUREMENT_DEBIT', 'PROFIT_RELEASE', 'PROCUREMENT_REFUND'),
        allowNull: false
    },
    amountCents: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    providerProcurementBalanceAfterCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    reservedProfitBalanceAfterCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    notes: { type: sequelize_1.DataTypes.TEXT }
}, { sequelize, modelName: 'sms_ledger_transaction' });
Tenant.hasMany(SmsProcurementTask, { foreignKey: 'tenantId' });
SmsProcurementTask.belongsTo(Tenant, { foreignKey: 'tenantId' });
SmsProcurementTask.hasMany(SmsLedgerTransaction, { foreignKey: 'procurementTaskId' });
SmsLedgerTransaction.belongsTo(SmsProcurementTask, { foreignKey: 'procurementTaskId' });
// ============================================================
// STAGING & TESTING ENVIRONMENT MODELS
// ============================================================
class FeatureFlag extends sequelize_1.Model {
}
exports.FeatureFlag = FeatureFlag;
FeatureFlag.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    key: { type: sequelize_1.DataTypes.STRING, unique: true, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT },
    isEnabledGlobal: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    isEnabledStaging: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    enabledTenants: { type: sequelize_1.DataTypes.TEXT }, // JSON string
    enabledAdmins: { type: sequelize_1.DataTypes.TEXT }, // JSON string
}, { sequelize, modelName: 'feature_flag' });
class StagingErrorLog extends sequelize_1.Model {
}
exports.StagingErrorLog = StagingErrorLog;
StagingErrorLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    severity: { type: sequelize_1.DataTypes.ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL'), defaultValue: 'ERROR' },
    source: { type: sequelize_1.DataTypes.ENUM('FRONTEND', 'BACKEND', 'API', 'PAYMENT', 'DATABASE', 'ROUTER', 'EMAIL', 'SMS', 'WHATSAPP'), defaultValue: 'BACKEND' },
    message: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    stackTrace: { type: sequelize_1.DataTypes.TEXT },
    requestPath: { type: sequelize_1.DataTypes.STRING },
    userId: { type: sequelize_1.DataTypes.UUID },
    tenantId: { type: sequelize_1.DataTypes.UUID },
    suggestedFix: { type: sequelize_1.DataTypes.TEXT },
    metadata: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'staging_error_log' });
class SandboxMessageLog extends sequelize_1.Model {
}
exports.SandboxMessageLog = SandboxMessageLog;
SandboxMessageLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    channel: { type: sequelize_1.DataTypes.ENUM('EMAIL', 'SMS', 'WHATSAPP'), allowNull: false },
    recipient: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    subject: { type: sequelize_1.DataTypes.STRING },
    content: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    gateway: { type: sequelize_1.DataTypes.STRING },
    status: { type: sequelize_1.DataTypes.ENUM('CAPTURED', 'SIMULATED', 'FAILED'), defaultValue: 'CAPTURED' },
    cost: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    metadata: { type: sequelize_1.DataTypes.TEXT },
    tenantId: { type: sequelize_1.DataTypes.UUID },
}, { sequelize, modelName: 'sandbox_message_log' });
class SandboxPaymentLog extends sequelize_1.Model {
}
exports.SandboxPaymentLog = SandboxPaymentLog;
SandboxPaymentLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    provider: { type: sequelize_1.DataTypes.ENUM('WALLET', 'INTASEND', 'MPESA'), allowNull: false },
    transactionType: { type: sequelize_1.DataTypes.ENUM('PAYMENT', 'REFUND', 'CREDIT_PURCHASE'), defaultValue: 'PAYMENT' },
    reference: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    phoneNumber: { type: sequelize_1.DataTypes.STRING },
    status: { type: sequelize_1.DataTypes.ENUM('SUCCESS', 'FAILED', 'TIMEOUT', 'DUPLICATE'), defaultValue: 'SUCCESS' },
    failureReason: { type: sequelize_1.DataTypes.STRING },
    retryCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    metadata: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'sandbox_payment_log' });
class TestAccountSeed extends sequelize_1.Model {
}
exports.TestAccountSeed = TestAccountSeed;
TestAccountSeed.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    role: { type: sequelize_1.DataTypes.ENUM('SUPER_ADMIN', 'TENANT', 'STAFF', 'AGENT', 'CUSTOMER'), allowNull: false },
    email: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    phoneNumber: { type: sequelize_1.DataTypes.STRING },
    tenantId: { type: sequelize_1.DataTypes.UUID },
    description: { type: sequelize_1.DataTypes.STRING, allowNull: false },
}, { sequelize, modelName: 'test_account_seed' });
// Profile & Account Management Models
class TenantDocument extends sequelize_1.Model {
}
exports.TenantDocument = TenantDocument;
TenantDocument.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    docType: { type: sequelize_1.DataTypes.ENUM('BUSINESS_CERT', 'TAX_PIN_CERT', 'NATIONAL_ID', 'BANK_LETTER', 'UTILITY_BILL'), allowNull: false },
    fileName: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    fileUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    fileType: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    fileSize: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'), defaultValue: 'PENDING' },
    notes: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'tenant_document' });
class TenantWithdrawal extends sequelize_1.Model {
}
exports.TenantWithdrawal = TenantWithdrawal;
TenantWithdrawal.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    amount: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    method: { type: sequelize_1.DataTypes.ENUM('MPESA', 'BANK'), defaultValue: 'MPESA' },
    recipientDetails: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED'), defaultValue: 'PENDING' },
    referenceId: { type: sequelize_1.DataTypes.STRING },
    failureReason: { type: sequelize_1.DataTypes.TEXT },
    requestedBy: { type: sequelize_1.DataTypes.UUID },
    requestedAt: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    completedAt: { type: sequelize_1.DataTypes.DATE },
}, { sequelize, modelName: 'tenant_withdrawal' });
Tenant.hasMany(TenantDocument, { foreignKey: 'tenantId' });
TenantDocument.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(TenantWithdrawal, { foreignKey: 'tenantId' });
TenantWithdrawal.belongsTo(Tenant, { foreignKey: 'tenantId' });
// ─────────────────────────────────────────────────────────────────
// CAPTIVE PORTAL ADVERTISING & MARKETING PLATFORM MODELS
// ─────────────────────────────────────────────────────────────────
class AdCampaign extends sequelize_1.Model {
}
exports.AdCampaign = AdCampaign;
AdCampaign.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT },
    campaignType: {
        type: sequelize_1.DataTypes.ENUM('IMAGE_BANNER', 'VIDEO_AD', 'CAROUSEL', 'POPUP', 'FULLSCREEN_SPLASH', 'HTML_AD', 'GIF_AD', 'TEXT_ANNOUNCEMENT', 'SCROLLING_MARQUEE', 'COUPON_CARD', 'QR_PROMOTION', 'COUNTDOWN_PROMOTION'),
        defaultValue: 'IMAGE_BANNER'
    },
    mediaUrls: { type: sequelize_1.DataTypes.TEXT },
    headline: { type: sequelize_1.DataTypes.STRING },
    subheading: { type: sequelize_1.DataTypes.STRING },
    buttonText: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Learn More' },
    destinationUrl: { type: sequelize_1.DataTypes.TEXT },
    whatsappLink: { type: sequelize_1.DataTypes.TEXT },
    facebookLink: { type: sequelize_1.DataTypes.TEXT },
    instagramLink: { type: sequelize_1.DataTypes.TEXT },
    tiktokLink: { type: sequelize_1.DataTypes.TEXT },
    emailLink: { type: sequelize_1.DataTypes.TEXT },
    ctaType: {
        type: sequelize_1.DataTypes.ENUM('VISIT_WEBSITE', 'BUY_NOW', 'CALL_NOW', 'WHATSAPP', 'MESSENGER', 'DOWNLOAD_APP', 'LEARN_MORE', 'REDEEM_COUPON', 'OPEN_MAPS'),
        defaultValue: 'LEARN_MORE'
    },
    priority: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1 },
    status: {
        type: sequelize_1.DataTypes.ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'EXPIRED', 'APPROVED', 'REJECTED', 'SUSPENDED'),
        defaultValue: 'RUNNING'
    },
    budget: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    spentBudget: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    displayRules: { type: sequelize_1.DataTypes.TEXT },
    startDate: { type: sequelize_1.DataTypes.DATE },
    endDate: { type: sequelize_1.DataTypes.DATE },
    startTime: { type: sequelize_1.DataTypes.STRING },
    endTime: { type: sequelize_1.DataTypes.STRING },
    daysOfWeek: { type: sequelize_1.DataTypes.TEXT },
    isRecurring: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    targeting: { type: sequelize_1.DataTypes.TEXT },
    rotationType: {
        type: sequelize_1.DataTypes.ENUM('SINGLE', 'RANDOM', 'PRIORITY', 'WEIGHTED', 'SEQUENTIAL'),
        defaultValue: 'PRIORITY'
    },
    weight: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 1.0 },
    abTestEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    abVariant: { type: sequelize_1.DataTypes.STRING },
    abSiblingId: { type: sequelize_1.DataTypes.UUID },
    marketingTrigger: { type: sequelize_1.DataTypes.TEXT },
    approvalStatus: {
        type: sequelize_1.DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        defaultValue: 'APPROVED'
    },
    approvedBy: { type: sequelize_1.DataTypes.UUID },
}, { sequelize, modelName: 'ad_campaign' });
class MediaItem extends sequelize_1.Model {
}
exports.MediaItem = MediaItem;
MediaItem.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    fileName: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    fileUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    fileType: { type: sequelize_1.DataTypes.ENUM('IMAGE', 'VIDEO', 'GIF', 'PDF', 'LOGO', 'ICON'), defaultValue: 'IMAGE' },
    fileSize: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    mimeType: { type: sequelize_1.DataTypes.STRING },
    dimensions: { type: sequelize_1.DataTypes.STRING },
    duration: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    thumbnailUrl: { type: sequelize_1.DataTypes.TEXT },
    metadata: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'media_item' });
class MarketingCoupon extends sequelize_1.Model {
}
exports.MarketingCoupon = MarketingCoupon;
MarketingCoupon.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    campaignId: { type: sequelize_1.DataTypes.UUID },
    couponCode: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    discountType: { type: sequelize_1.DataTypes.ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_PACKAGE'), defaultValue: 'PERCENTAGE' },
    discountValue: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    validityDays: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 30 },
    maxUses: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 100 },
    currentUses: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    expirationDate: { type: sequelize_1.DataTypes.DATE },
    applicablePackageIds: { type: sequelize_1.DataTypes.TEXT },
    qrCodeUrl: { type: sequelize_1.DataTypes.TEXT },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'EXPIRED', 'EXHAUSTED'), defaultValue: 'ACTIVE' },
}, { sequelize, modelName: 'marketing_coupon' });
class QRCampaign extends sequelize_1.Model {
}
exports.QRCampaign = QRCampaign;
QRCampaign.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    title: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    destinationType: {
        type: sequelize_1.DataTypes.ENUM('WEBSITE', 'PACKAGE_PURCHASE', 'WHATSAPP', 'PAYMENT', 'LOCATION', 'PROMOTION'),
        defaultValue: 'WEBSITE'
    },
    targetUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    qrCodeUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    scansCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'qr_campaign' });
class MarketingLandingPage extends sequelize_1.Model {
}
exports.MarketingLandingPage = MarketingLandingPage;
MarketingLandingPage.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    slug: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    title: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    logoUrl: { type: sequelize_1.DataTypes.TEXT },
    bannerUrl: { type: sequelize_1.DataTypes.TEXT },
    videoUrl: { type: sequelize_1.DataTypes.TEXT },
    headline: { type: sequelize_1.DataTypes.STRING },
    bodyContent: { type: sequelize_1.DataTypes.TEXT },
    ctaButtonText: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Get Started' },
    ctaUrl: { type: sequelize_1.DataTypes.TEXT },
    contactInfo: { type: sequelize_1.DataTypes.TEXT },
    mapEmbedUrl: { type: sequelize_1.DataTypes.TEXT },
    countdownEndDate: { type: sequelize_1.DataTypes.DATE },
    testimonials: { type: sequelize_1.DataTypes.TEXT },
    status: { type: sequelize_1.DataTypes.ENUM('DRAFT', 'PUBLISHED'), defaultValue: 'DRAFT' },
    publishedAt: { type: sequelize_1.DataTypes.DATE },
}, { sequelize, modelName: 'marketing_landing_page' });
class AdAnalytic extends sequelize_1.Model {
}
exports.AdAnalytic = AdAnalytic;
AdAnalytic.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    campaignId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    eventType: {
        type: sequelize_1.DataTypes.ENUM('IMPRESSION', 'VIEW', 'UNIQUE_VIEW', 'CLICK', 'VIDEO_COMPLETE', 'CONVERSION'),
        allowNull: false
    },
    revenue: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    deviceType: { type: sequelize_1.DataTypes.STRING },
    browser: { type: sequelize_1.DataTypes.STRING },
    os: { type: sequelize_1.DataTypes.STRING },
    country: { type: sequelize_1.DataTypes.STRING },
    city: { type: sequelize_1.DataTypes.STRING },
    routerId: { type: sequelize_1.DataTypes.UUID },
    packageId: { type: sequelize_1.DataTypes.UUID },
    sessionDuration: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    ipAddress: { type: sequelize_1.DataTypes.STRING },
    macAddress: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'ad_analytic' });
class CustomerSegment extends sequelize_1.Model {
}
exports.CustomerSegment = CustomerSegment;
CustomerSegment.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT },
    rules: { type: sequelize_1.DataTypes.TEXT },
    memberCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'customer_segment' });
class MarketingSetting extends sequelize_1.Model {
}
exports.MarketingSetting = MarketingSetting;
MarketingSetting.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    maxUploadSizeBytes: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 52428800 }, // 50MB
    supportedFormats: { type: sequelize_1.DataTypes.TEXT, defaultValue: JSON.stringify(['jpg', 'png', 'gif', 'mp4', 'pdf', 'webp']) },
    defaultImpressionsLimit: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 50000 },
    autoApproveAds: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    moduleEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'marketing_setting' });
// Marketing Model Relationships
Tenant.hasMany(AdCampaign, { foreignKey: 'tenantId' });
AdCampaign.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(MediaItem, { foreignKey: 'tenantId' });
MediaItem.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(MarketingCoupon, { foreignKey: 'tenantId' });
MarketingCoupon.belongsTo(Tenant, { foreignKey: 'tenantId' });
AdCampaign.hasMany(MarketingCoupon, { foreignKey: 'campaignId' });
MarketingCoupon.belongsTo(AdCampaign, { foreignKey: 'campaignId' });
Tenant.hasMany(QRCampaign, { foreignKey: 'tenantId' });
QRCampaign.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(MarketingLandingPage, { foreignKey: 'tenantId' });
MarketingLandingPage.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(AdAnalytic, { foreignKey: 'tenantId' });
AdAnalytic.belongsTo(Tenant, { foreignKey: 'tenantId' });
AdCampaign.hasMany(AdAnalytic, { foreignKey: 'campaignId' });
AdAnalytic.belongsTo(AdCampaign, { foreignKey: 'campaignId' });
Tenant.hasMany(CustomerSegment, { foreignKey: 'tenantId' });
CustomerSegment.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasOne(MarketingSetting, { foreignKey: 'tenantId' });
MarketingSetting.belongsTo(Tenant, { foreignKey: 'tenantId' });
// ─────────────────────────────────────────────────────────────
// SAAS MONETISATION & SUBSCRIPTION MODELS
// ─────────────────────────────────────────────────────────────
class SubscriptionPlan extends sequelize_1.Model {
}
exports.SubscriptionPlan = SubscriptionPlan;
SubscriptionPlan.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    slug: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    description: { type: sequelize_1.DataTypes.TEXT },
    monthlyPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 150000 },
    yearlyPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 1500000 },
    maxActiveUsers: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 500 },
    maxRouters: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 5 },
    maxStaff: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 3 },
    maxSMS: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 200 },
    maxWhatsapp: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    maxCampaigns: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 2 },
    maxAdvertisements: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 5 },
    maxBranches: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1 },
    maxIntegrations: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    storageLimitMB: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1024 },
    apiAccess: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    marketingFeatures: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    analyticsFeatures: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    whiteLabelFeatures: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    multiBranchFeatures: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    customIntegrations: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    supportLevel: { type: sequelize_1.DataTypes.ENUM('COMMUNITY', 'STANDARD', 'PRIORITY', 'DEDICATED'), defaultValue: 'STANDARD' },
    isPopular: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'subscription_plan' });
class PlatformPricingConfig extends sequelize_1.Model {
}
exports.PlatformPricingConfig = PlatformPricingConfig;
PlatformPricingConfig.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    baseSubscriptionPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 150000 }, // KSh 1,500
    includedActiveUsers: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 100 },
    extraActiveUserPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 1500 }, // KSh 15
    adMonthlyFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 500000 }, // KSh 5,000
    adCampaignFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 100000 }, // KSh 1,000
    adVideoFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 200000 }, // KSh 2,000
    adBannerFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 50000 }, // KSh 500
    adStorageFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 50000 }, // KSh 500 per GB
    smsPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 200 }, // KSh 2.00
    emailPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 50 }, // KSh 0.50
    whatsappPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 300 }, // KSh 3.00
    extraRouterPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 100000 }, // KSh 1,000
    vatPercentage: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 16.0 },
    gracePeriodDays: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 7 },
    trialPeriodDays: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 14 },
    latePaymentFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 50000 }, // KSh 500
    subscriptionTillNumber: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'platform_pricing_config' });
class TenantSubscription extends sequelize_1.Model {
}
exports.TenantSubscription = TenantSubscription;
TenantSubscription.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    planId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    status: {
        type: sequelize_1.DataTypes.ENUM('FREE_TRIAL', 'PENDING_PAYMENT', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED', 'ARCHIVED', 'TRIAL', 'OVERDUE'),
        defaultValue: 'FREE_TRIAL'
    },
    billingCycle: { type: sequelize_1.DataTypes.ENUM('MONTHLY', 'YEARLY'), defaultValue: 'MONTHLY' },
    startDate: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    currentPeriodStart: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    currentPeriodEnd: { type: sequelize_1.DataTypes.DATE },
    gracePeriodEndDate: { type: sequelize_1.DataTypes.DATE },
    cancelledAt: { type: sequelize_1.DataTypes.DATE },
    trialEndDate: { type: sequelize_1.DataTypes.DATE },
    autoRenew: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'tenant_subscription' });
class TrialAgreement extends sequelize_1.Model {
}
exports.TrialAgreement = TrialAgreement;
TrialAgreement.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    businessName: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    ownerName: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    phone: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    email: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    businessLocation: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    expectedSubscriberCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 50 },
    expectedRouterCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 2 },
    termsAccepted: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    trialAgreementAccepted: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    agreedAt: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    agreedIp: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    agreedUserAgent: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    agreedTextHash: { type: sequelize_1.DataTypes.STRING, allowNull: false },
}, { sequelize, modelName: 'trial_agreement' });
class FeatureViolationLog extends sequelize_1.Model {
}
exports.FeatureViolationLog = FeatureViolationLog;
FeatureViolationLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    featureOrLimitKey: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    attemptedAction: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    currentUsage: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    allowedLimit: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    subscriptionStatus: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    requestIp: { type: sequelize_1.DataTypes.STRING },
    userAgent: { type: sequelize_1.DataTypes.STRING },
}, { sequelize, modelName: 'feature_violation_log' });
class TenantCaptivePortalBranding extends sequelize_1.Model {
}
exports.TenantCaptivePortalBranding = TenantCaptivePortalBranding;
TenantCaptivePortalBranding.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false, unique: true },
    businessName: { type: sequelize_1.DataTypes.STRING },
    tagline: { type: sequelize_1.DataTypes.STRING },
    description: { type: sequelize_1.DataTypes.TEXT },
    supportPhone: { type: sequelize_1.DataTypes.STRING },
    supportEmail: { type: sequelize_1.DataTypes.STRING },
    whatsappNumber: { type: sequelize_1.DataTypes.STRING },
    websiteUrl: { type: sequelize_1.DataTypes.STRING },
    physicalAddress: { type: sequelize_1.DataTypes.TEXT },
    socialLinks: { type: sequelize_1.DataTypes.TEXT },
    primaryLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    mobileLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    darkModeLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    lightModeLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    faviconUrl: { type: sequelize_1.DataTypes.TEXT },
    footerLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    loginLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    welcomeScreenLogoUrl: { type: sequelize_1.DataTypes.TEXT },
    primaryColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    secondaryColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0f172a' },
    accentColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#38bdf8' },
    buttonColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    navColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    backgroundColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0f172a' },
    footerColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    textColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#ffffff' },
    linkColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#38bdf8' },
    welcomeMessage: { type: sequelize_1.DataTypes.TEXT },
    headline: { type: sequelize_1.DataTypes.STRING },
    subheadline: { type: sequelize_1.DataTypes.STRING },
    termsConditions: { type: sequelize_1.DataTypes.TEXT },
    privacyNotice: { type: sequelize_1.DataTypes.TEXT },
    supportInfo: { type: sequelize_1.DataTypes.TEXT },
    footerText: { type: sequelize_1.DataTypes.TEXT },
    copyrightText: { type: sequelize_1.DataTypes.STRING },
    loginInstructions: { type: sequelize_1.DataTypes.TEXT },
    paymentInstructions: { type: sequelize_1.DataTypes.TEXT },
    voucherInstructions: { type: sequelize_1.DataTypes.TEXT },
    backgroundType: { type: sequelize_1.DataTypes.ENUM('IMAGE', 'VIDEO', 'GRADIENT', 'SOLID'), defaultValue: 'GRADIENT' },
    backgroundUrl: { type: sequelize_1.DataTypes.TEXT },
    backgroundVideoUrl: { type: sequelize_1.DataTypes.TEXT },
    gradientStartColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0f172a' },
    gradientEndColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    backgroundBlur: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    backgroundOverlayOpacity: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 0.2 },
    mobileBackgroundUrl: { type: sequelize_1.DataTypes.TEXT },
    customDomain: { type: sequelize_1.DataTypes.STRING },
    landingHeroTitle: { type: sequelize_1.DataTypes.STRING },
    landingHeroSubtitle: { type: sequelize_1.DataTypes.TEXT },
    showLandingHero: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    packageCardLayout: { type: sequelize_1.DataTypes.ENUM('GRID_2COL', 'GRID_3COL', 'VERTICAL_LIST', 'COMPACT_TILES', 'HORIZONTAL_SCROLL'), defaultValue: 'GRID_2COL' },
    packageCardStyle: { type: sequelize_1.DataTypes.ENUM('GLASS', 'SOLID', 'OUTLINE', 'GRADIENT_ACCENT'), defaultValue: 'GLASS' },
    showPackageBadges: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    showSpeedBadges: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    pinnedPackageIds: { type: sequelize_1.DataTypes.TEXT },
    featuredPackageId: { type: sequelize_1.DataTypes.STRING },
    showPromotions: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    isApproved: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'tenant_captive_portal_branding' });
class TenantAddonModule extends sequelize_1.Model {
}
exports.TenantAddonModule = TenantAddonModule;
TenantAddonModule.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    moduleName: {
        type: sequelize_1.DataTypes.ENUM('ADVERTISING', 'SMS', 'WHATSAPP', 'EMAIL', 'ADVANCED_ANALYTICS', 'API_ACCESS', 'WHITE_LABEL', 'EXTRA_ROUTERS', 'CUSTOM_DOMAINS', 'BACKUPS'),
        allowNull: false
    },
    monthlyPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    yearlyPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'TRIAL', 'EXPIRED', 'DISABLED'), defaultValue: 'ACTIVE' },
    trialEndsAt: { type: sequelize_1.DataTypes.DATE },
}, { sequelize, modelName: 'tenant_addon_module' });
class SaaSInvoice extends sequelize_1.Model {
}
exports.SaaSInvoice = SaaSInvoice;
SaaSInvoice.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    invoiceNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    billingPeriodStart: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    billingPeriodEnd: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    dueDate: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    subscriptionAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    usageAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    adAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    smsAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    emailAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    whatsappAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    extraRoutersAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    addonAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    taxAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    discountAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    lateFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    totalAmountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    subtotalCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    taxCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    paymentStatus: {
        type: sequelize_1.DataTypes.ENUM('UNPAID', 'PAID', 'OVERDUE', 'FAILED', 'CANCELLED'),
        defaultValue: 'UNPAID'
    },
    paidAt: { type: sequelize_1.DataTypes.DATE },
    paymentMethod: { type: sequelize_1.DataTypes.STRING },
    paymentReference: { type: sequelize_1.DataTypes.STRING },
    intasendCheckoutUrl: { type: sequelize_1.DataTypes.TEXT },
    invoicePdfUrl: { type: sequelize_1.DataTypes.TEXT },
    metadata: { type: sequelize_1.DataTypes.TEXT },
}, { sequelize, modelName: 'saas_invoice' });
class SaaSInvoiceItem extends sequelize_1.Model {
}
exports.SaaSInvoiceItem = SaaSInvoiceItem;
SaaSInvoiceItem.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    invoiceId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    description: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    category: {
        type: sequelize_1.DataTypes.ENUM('SUBSCRIPTION', 'USAGE', 'ADVERTISING', 'SMS', 'EMAIL', 'WHATSAPP', 'ADDON', 'TAX', 'DISCOUNT', 'LATE_FEE'),
        allowNull: false
    },
    quantity: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1 },
    unitPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    totalPriceCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize, modelName: 'saas_invoice_item' });
class SaaSPayment extends sequelize_1.Model {
}
exports.SaaSPayment = SaaSPayment;
SaaSPayment.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    invoiceId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    amountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    gateway: { type: sequelize_1.DataTypes.ENUM('INTASEND', 'MPESA', 'WALLET'), defaultValue: 'INTASEND' },
    transactionReference: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    rawPayload: { type: sequelize_1.DataTypes.TEXT },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'), defaultValue: 'SUCCESS' },
}, { sequelize, modelName: 'saas_payment' });
class SaaSNotification extends sequelize_1.Model {
}
exports.SaaSNotification = SaaSNotification;
SaaSNotification.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    type: {
        type: sequelize_1.DataTypes.ENUM('INVOICE_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_SUSPENDED', 'TRIAL_ENDING', 'GRACE_PERIOD_ENDING', 'AD_CHARGES_APPLIED'),
        allowNull: false
    },
    title: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    message: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    read: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, modelName: 'saas_notification' });
// SaaS Model Relationships
Tenant.hasOne(TenantSubscription, { foreignKey: 'tenantId' });
TenantSubscription.belongsTo(Tenant, { foreignKey: 'tenantId' });
SubscriptionPlan.hasMany(TenantSubscription, { foreignKey: 'planId' });
TenantSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'planId' });
Tenant.hasMany(TenantAddonModule, { foreignKey: 'tenantId' });
TenantAddonModule.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(SaaSInvoice, { foreignKey: 'tenantId' });
SaaSInvoice.belongsTo(Tenant, { foreignKey: 'tenantId' });
SaaSInvoice.hasMany(SaaSInvoiceItem, { foreignKey: 'invoiceId' });
SaaSInvoiceItem.belongsTo(SaaSInvoice, { foreignKey: 'invoiceId' });
Tenant.hasMany(SaaSPayment, { foreignKey: 'tenantId' });
SaaSPayment.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(SaaSNotification, { foreignKey: 'tenantId' });
SaaSNotification.belongsTo(Tenant, { foreignKey: 'tenantId' });
// ─── REFUND & COMPENSATION MODELS ──────────────────────────────────────────
class RefundRequest extends sequelize_1.Model {
}
exports.RefundRequest = RefundRequest;
RefundRequest.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    subscriberId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    paymentId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    packageId: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    type: {
        type: sequelize_1.DataTypes.ENUM('FULL_REFUND', 'PARTIAL_REFUND', 'WALLET_CREDIT', 'PACKAGE_EXTENSION', 'VOUCHER_REPLACEMENT', 'FREE_DATA', 'MANUAL_COMPENSATION', 'GOODWILL_CREDIT'),
        allowNull: false,
    },
    category: {
        type: sequelize_1.DataTypes.ENUM('NETWORK_OUTAGE', 'ROUTER_FAILURE', 'POWER_FAILURE', 'PAYMENT_FAILURE', 'AUTH_FAILURE', 'SLOW_INTERNET', 'MAINTENANCE', 'GOODWILL', 'CUSTOM'),
        defaultValue: 'GOODWILL',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'),
        defaultValue: 'SUBMITTED',
    },
    amount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    extensionMinutes: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    freeDataBytes: { type: sequelize_1.DataTypes.BIGINT, allowNull: true },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    notes: { type: sequelize_1.DataTypes.TEXT },
    evidenceUrl: { type: sequelize_1.DataTypes.TEXT },
    requestedBy: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    approvedBy: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    rejectedBy: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    rejectionReason: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    completedAt: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    providerRefundId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    providerRefundStatus: {
        type: sequelize_1.DataTypes.ENUM('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'),
        allowNull: true,
    },
    previousBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    newBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    idempotencyKey: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
}, {
    sequelize,
    modelName: 'refund_request',
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['subscriberId'] },
        { fields: ['status'] },
        { fields: ['idempotencyKey'] },
    ],
});
class CompensationRule extends sequelize_1.Model {
}
exports.CompensationRule = CompensationRule;
CompensationRule.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    triggerType: {
        type: sequelize_1.DataTypes.ENUM('ROUTER_DOWNTIME', 'HOTSPOT_OUTAGE', 'AUTH_FAILURES', 'CUSTOM'),
        defaultValue: 'ROUTER_DOWNTIME',
    },
    downtimeThresholdMinutes: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 60 },
    compensationType: {
        type: sequelize_1.DataTypes.ENUM('PACKAGE_EXTENSION', 'WALLET_CREDIT', 'FREE_DATA'),
        defaultValue: 'PACKAGE_EXTENSION',
    },
    compensationValue: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 60 },
    autoApprove: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    isEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
}, {
    sequelize,
    modelName: 'compensation_rule',
    indexes: [{ fields: ['tenantId'] }],
});
class RefundAuditLog extends sequelize_1.Model {
}
exports.RefundAuditLog = RefundAuditLog;
RefundAuditLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    refundRequestId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    subscriberId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    type: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    amount: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    action: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    performedBy: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    ipAddress: { type: sequelize_1.DataTypes.STRING },
    userAgent: { type: sequelize_1.DataTypes.TEXT },
    previousBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    newBalance: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    reason: { type: sequelize_1.DataTypes.TEXT },
}, {
    sequelize,
    modelName: 'refund_audit_log',
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['refundRequestId'] },
        { fields: ['subscriberId'] },
    ],
});
// Relationships
Tenant.hasMany(RefundRequest, { foreignKey: 'tenantId' });
RefundRequest.belongsTo(Tenant, { foreignKey: 'tenantId' });
Subscriber.hasMany(RefundRequest, { foreignKey: 'subscriberId' });
RefundRequest.belongsTo(Subscriber, { foreignKey: 'subscriberId' });
Payment.hasMany(RefundRequest, { foreignKey: 'paymentId' });
RefundRequest.belongsTo(Payment, { foreignKey: 'paymentId' });
Tenant.hasMany(CompensationRule, { foreignKey: 'tenantId' });
CompensationRule.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(RefundAuditLog, { foreignKey: 'tenantId' });
RefundAuditLog.belongsTo(Tenant, { foreignKey: 'tenantId' });
// ─── PLATFORM BRANDING & WHITE-LABEL MODEL ─────────────────────────────────
class PlatformBranding extends sequelize_1.Model {
}
exports.PlatformBranding = PlatformBranding;
PlatformBranding.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    platformName: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Jevish Pro' },
    platformTagline: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Next-Gen Multi-Tenant WiFi Billing & ISP Management System' },
    platformDescription: { type: sequelize_1.DataTypes.TEXT, defaultValue: 'Enterprise WiFi billing, MikroTik integration, bandwidth control, and M-Pesa automated payments for ISPs and hotspot owners.' },
    companyName: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Jevish Technologies Ltd' },
    supportPhone: { type: sequelize_1.DataTypes.STRING, defaultValue: '0768926965' },
    supportEmail: { type: sequelize_1.DataTypes.STRING, defaultValue: 'emmanueloyaro3@gmail.com' },
    websiteUrl: { type: sequelize_1.DataTypes.STRING, defaultValue: 'https://jevish.site' },
    socialLinks: { type: sequelize_1.DataTypes.TEXT, defaultValue: JSON.stringify({ twitter: '', facebook: '', linkedin: '', whatsapp: 'https://wa.me/254768926965' }) },
    businessAddress: { type: sequelize_1.DataTypes.TEXT, defaultValue: 'Nairobi, Kenya' },
    copyrightInfo: { type: sequelize_1.DataTypes.STRING, defaultValue: '© 2026 Jevish Technologies Ltd. All rights reserved.' },
    legalInfo: { type: sequelize_1.DataTypes.TEXT, defaultValue: 'Jevish is a registered SaaS billing platform for Internet Service Providers.' },
    primaryLogoUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    darkModeLogoUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    lightModeLogoUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    faviconUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    mobileLogoUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    invoiceLogoUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    emailLogoUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    captivePortalLogoUrl: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    primaryColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    secondaryColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0f172a' },
    accentColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#38bdf8' },
    successColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#10b981' },
    warningColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#f59e0b' },
    dangerColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#ef4444' },
    sidebarColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0f172a' },
    navColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    buttonColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
    chartColor: { type: sequelize_1.DataTypes.STRING, defaultValue: '#0284c7' },
}, {
    sequelize,
    modelName: 'platform_branding'
});
// ENTERPRISE CRM & QUOTATION MODELS
class EnterpriseLead extends sequelize_1.Model {
}
exports.EnterpriseLead = EnterpriseLead;
EnterpriseLead.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    leadNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    companyName: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    registrationNumber: { type: sequelize_1.DataTypes.STRING },
    contactPerson: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    position: { type: sequelize_1.DataTypes.STRING },
    phone: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    altPhone: { type: sequelize_1.DataTypes.STRING },
    email: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    website: { type: sequelize_1.DataTypes.STRING },
    country: { type: sequelize_1.DataTypes.STRING, defaultValue: 'Kenya' },
    region: { type: sequelize_1.DataTypes.STRING },
    physicalAddress: { type: sequelize_1.DataTypes.TEXT },
    currentIspSize: { type: sequelize_1.DataTypes.STRING },
    expectedGrowth: { type: sequelize_1.DataTypes.STRING },
    subscriberCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    activeUserCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    routerCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    currentBillingPlatform: { type: sequelize_1.DataTypes.STRING },
    requiredFeatures: { type: sequelize_1.DataTypes.TEXT },
    expectedLaunchDate: { type: sequelize_1.DataTypes.STRING },
    monthlyBudget: { type: sequelize_1.DataTypes.STRING },
    notes: { type: sequelize_1.DataTypes.TEXT },
    status: {
        type: sequelize_1.DataTypes.ENUM('NEW', 'CONTACTED', 'QUALIFICATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'AWAITING_APPROVAL', 'WON', 'LOST', 'ARCHIVED'),
        defaultValue: 'NEW'
    },
    assignedTo: { type: sequelize_1.DataTypes.STRING }
}, { sequelize, modelName: 'enterprise_lead' });
class EnterpriseQuote extends sequelize_1.Model {
}
exports.EnterpriseQuote = EnterpriseQuote;
EnterpriseQuote.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    quoteNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    leadId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    monthlyCostCents: { type: sequelize_1.DataTypes.BIGINT, allowNull: false },
    setupFeeCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    maxActiveUsers: { type: sequelize_1.DataTypes.INTEGER, defaultValue: -1 },
    maxRouters: { type: sequelize_1.DataTypes.INTEGER, defaultValue: -1 },
    smsAllocation: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 10000 },
    whatsappAllocation: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 5000 },
    storageAllocationMB: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 10240 },
    customModules: { type: sequelize_1.DataTypes.TEXT },
    discountCents: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    taxPercentage: { type: sequelize_1.DataTypes.FLOAT, defaultValue: 16.0 },
    contractDurationMonths: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 12 },
    status: {
        type: sequelize_1.DataTypes.ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED', 'EXPIRED'),
        defaultValue: 'DRAFT'
    },
    validUntil: { type: sequelize_1.DataTypes.DATE },
    termsAndConditions: { type: sequelize_1.DataTypes.TEXT },
    rejectionReason: { type: sequelize_1.DataTypes.TEXT },
    customerNotes: { type: sequelize_1.DataTypes.TEXT }
}, { sequelize, modelName: 'enterprise_quote' });
// Enterprise Relationships
EnterpriseLead.hasMany(EnterpriseQuote, { foreignKey: 'leadId' });
EnterpriseQuote.belongsTo(EnterpriseLead, { foreignKey: 'leadId' });
// =========================================================
// FREERADIUS & RADIUS-FIRST ISP MODELS
// =========================================================
class Nas extends sequelize_1.Model {
}
exports.Nas = Nas;
Nas.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    nasname: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    shortname: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    type: { type: sequelize_1.DataTypes.STRING, defaultValue: 'other' },
    ports: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    secret: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    server: { type: sequelize_1.DataTypes.STRING },
    community: { type: sequelize_1.DataTypes.STRING },
    description: { type: sequelize_1.DataTypes.TEXT },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    status: { type: sequelize_1.DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE'), defaultValue: 'ACTIVE' }
}, { sequelize, modelName: 'nas', tableName: 'nas' });
class RadCheck extends sequelize_1.Model {
}
exports.RadCheck = RadCheck;
RadCheck.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    attribute: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    op: { type: sequelize_1.DataTypes.STRING(2), defaultValue: ':=' },
    value: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radcheck', tableName: 'radcheck', timestamps: false });
class RadReply extends sequelize_1.Model {
}
exports.RadReply = RadReply;
RadReply.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    attribute: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    op: { type: sequelize_1.DataTypes.STRING(2), defaultValue: '=' },
    value: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radreply', tableName: 'radreply', timestamps: false });
class RadGroupCheck extends sequelize_1.Model {
}
exports.RadGroupCheck = RadGroupCheck;
RadGroupCheck.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    groupname: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    attribute: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    op: { type: sequelize_1.DataTypes.STRING(2), defaultValue: ':=' },
    value: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radgroupcheck', tableName: 'radgroupcheck', timestamps: false });
class RadGroupReply extends sequelize_1.Model {
}
exports.RadGroupReply = RadGroupReply;
RadGroupReply.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    groupname: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    attribute: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    op: { type: sequelize_1.DataTypes.STRING(2), defaultValue: '=' },
    value: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radgroupreply', tableName: 'radgroupreply', timestamps: false });
class RadUserGroup extends sequelize_1.Model {
}
exports.RadUserGroup = RadUserGroup;
RadUserGroup.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    groupname: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    priority: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1 },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radusergroup', tableName: 'radusergroup', timestamps: false });
class RadAcct extends sequelize_1.Model {
}
exports.RadAcct = RadAcct;
RadAcct.init({
    radacctid: { type: sequelize_1.DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    acctsessionid: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    acctuniqueid: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    groupname: { type: sequelize_1.DataTypes.STRING },
    realm: { type: sequelize_1.DataTypes.STRING },
    nasipaddress: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    nasportid: { type: sequelize_1.DataTypes.STRING },
    nasporttype: { type: sequelize_1.DataTypes.STRING },
    acctstarttime: { type: sequelize_1.DataTypes.DATE },
    acctupdatetime: { type: sequelize_1.DataTypes.DATE },
    acctstoptime: { type: sequelize_1.DataTypes.DATE },
    acctinterval: { type: sequelize_1.DataTypes.INTEGER },
    acctsessiontime: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    acctauthentic: { type: sequelize_1.DataTypes.STRING },
    connectinfo_start: { type: sequelize_1.DataTypes.STRING },
    connectinfo_stop: { type: sequelize_1.DataTypes.STRING },
    acctinputoctets: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    acctoutputoctets: { type: sequelize_1.DataTypes.BIGINT, defaultValue: 0 },
    calledstationid: { type: sequelize_1.DataTypes.STRING },
    callingstationid: { type: sequelize_1.DataTypes.STRING },
    acctterminatecause: { type: sequelize_1.DataTypes.STRING },
    servicetype: { type: sequelize_1.DataTypes.STRING },
    framedprotocol: { type: sequelize_1.DataTypes.STRING },
    framedipaddress: { type: sequelize_1.DataTypes.STRING },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radacct', tableName: 'radacct', timestamps: false });
class RadPostAuth extends sequelize_1.Model {
}
exports.RadPostAuth = RadPostAuth;
RadPostAuth.init({
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    pass: { type: sequelize_1.DataTypes.STRING, defaultValue: '' },
    reply: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    authdate: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    nasipaddress: { type: sequelize_1.DataTypes.STRING },
    tenantId: { type: sequelize_1.DataTypes.UUID },
    reason: { type: sequelize_1.DataTypes.STRING }
}, { sequelize, modelName: 'radpostauth', tableName: 'radpostauth', timestamps: false });
class RadiusPolicy extends sequelize_1.Model {
}
exports.RadiusPolicy = RadiusPolicy;
RadiusPolicy.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    authType: { type: sequelize_1.DataTypes.ENUM('PAP', 'CHAP', 'MSCHAPv2', 'EAP', 'MAC'), defaultValue: 'PAP' },
    macAuthEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    voucherAuthEnabled: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    simultaneousUse: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 1 },
    sessionTimeout: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 86400 },
    idleTimeout: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 300 },
    rateLimit: { type: sequelize_1.DataTypes.STRING, defaultValue: '10M/10M' },
    fallbackAction: { type: sequelize_1.DataTypes.ENUM('REJECT', 'ACCEPT_GUEST', 'REDIRECT_PORTAL'), defaultValue: 'REJECT' }
}, { sequelize, modelName: 'radius_policy' });
// SaaSSubscriptionPayment Model definition for platform subscription fees
class SaaSSubscriptionPayment extends sequelize_1.Model {
}
exports.SaaSSubscriptionPayment = SaaSSubscriptionPayment;
SaaSSubscriptionPayment.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    invoiceId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    amount: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    currency: { type: sequelize_1.DataTypes.STRING, defaultValue: 'KES' },
    status: { type: sequelize_1.DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'), defaultValue: 'PENDING' },
    phoneNumber: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    mpesaReceiptNumber: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    checkoutRequestId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    merchantRequestId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    rawCallback: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    completedAt: { type: sequelize_1.DataTypes.DATE, allowNull: true }
}, {
    sequelize,
    modelName: 'SaaSSubscriptionPayment',
    tableName: 'saas_subscription_payments'
});
// MpesaCallbackLog Model definition for comprehensive callback tracking and diagnostics
class MpesaCallbackLog extends sequelize_1.Model {
}
exports.MpesaCallbackLog = MpesaCallbackLog;
MpesaCallbackLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    checkoutRequestId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    merchantRequestId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    rawPayload: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    validationStatus: { type: sequelize_1.DataTypes.STRING, defaultValue: 'VALID' },
    validationErrors: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    signatureVerified: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    tenantId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    databaseUpdateStatus: { type: sequelize_1.DataTypes.STRING, defaultValue: 'PENDING' },
    errorDetails: { type: sequelize_1.DataTypes.TEXT, allowNull: true }
}, {
    sequelize,
    modelName: 'MpesaCallbackLog',
    tableName: 'mpesa_callback_logs'
});
// Payment Log Model for comprehensive transaction lifecycle audit trail
class PaymentLog extends sequelize_1.Model {
}
exports.PaymentLog = PaymentLog;
PaymentLog.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    transactionReference: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    checkoutRequestId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    merchantRequestId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    tenantId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    stage: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: 'STK_INITIATED' },
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: 'PENDING' },
    amount: { type: sequelize_1.DataTypes.FLOAT, allowNull: true },
    phoneNumber: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    safaricomResultCode: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    safaricomResultDesc: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    errorDetails: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    rawPayload: { type: sequelize_1.DataTypes.TEXT, allowNull: true }
}, {
    sequelize,
    modelName: 'PaymentLog',
    tableName: 'payment_logs'
});
// PaymentVerificationAudit Model for tracking verification attempts and historical payment reconciliation
class PaymentVerificationAudit extends sequelize_1.Model {
}
exports.PaymentVerificationAudit = PaymentVerificationAudit;
PaymentVerificationAudit.init({
    id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    invoiceId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    checkoutRequestId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: 'PENDING_ON_MPESA' },
    matchedReceipt: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    verificationSource: { type: sequelize_1.DataTypes.STRING, defaultValue: 'STK_QUERY' },
    details: { type: sequelize_1.DataTypes.TEXT, allowNull: true }
}, {
    sequelize,
    modelName: 'PaymentVerificationAudit',
    tableName: 'payment_verification_audits'
});
// RADIUS Relationships
Nas.belongsTo(Tenant, { foreignKey: 'tenantId' });
RadiusPolicy.belongsTo(Tenant, { foreignKey: 'tenantId' });
SaaSSubscriptionPayment.belongsTo(Tenant, { foreignKey: 'tenantId' });
PaymentLog.belongsTo(Tenant, { foreignKey: 'tenantId', constraints: false });
PaymentVerificationAudit.belongsTo(Tenant, { foreignKey: 'tenantId', constraints: false });
