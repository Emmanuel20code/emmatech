import { Sequelize, DataTypes, Model } from 'sequelize';
import { config } from '../config/env';
import { EncryptionService } from '../utils/encryption';
import fs from 'fs';
import path from 'path';

const rawDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL || '';

let sequelize: Sequelize = null as any;

if (rawDbUrl && (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'))) {
    try {
        let hostname = 'postgres-host';
        try {
            hostname = new URL(rawDbUrl).hostname;
        } catch {
            hostname = rawDbUrl.split('@')[1]?.split(':')[0] || 'postgres';
        }
        console.info(`[DB] Attempting connection via DATABASE_URL to host: ${hostname}`);
        sequelize = new Sequelize(rawDbUrl, {
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
    } catch (err) {
        console.error('Sequelize initialization error from URL:', err);
        throw err;
    }
} else if (config.db.host && config.db.user && config.db.pass) {
    try {
        sequelize = new Sequelize(config.db.name, config.db.user, config.db.pass, {
          host: config.db.host,
          port: config.db.port,
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
    } catch (err) {
        console.error('Sequelize initialization error from config:', err);
        throw err;
    }
} else {
    console.error('CRITICAL: Database connection parameters are missing or incomplete. PostgreSQL is required.');
    console.info('Please set DATABASE_URL in Settings to the postgres:// connection string provided in your Supabase dashboard.');
    
    sequelize = new Sequelize('postgres://unconfigured:unconfigured@localhost:5432/unconfigured', {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            connectTimeout: 1,
        },
    });
}

// Database connection is managed by Sequelize

export class Tenant extends Model {
  public id!: string;
  public name!: string;
  public subdomain!: string;
  public logoUrl!: string | null;
  public primaryColor!: string | null;
  // M-Pesa dynamic credentials
  public mpesaShortcode!: string | null;
  public mpesaConsumerKey!: string | null;
  public mpesaConsumerSecret!: string | null;
  public mpesaPasskey!: string | null;
  public mpesaInitiatorName!: string | null;
  public mpesaInitiatorPassword!: string | null;
  public mpesaEnvironment!: string | null;
  public mpesaWebhookSecret!: string | null;
  public status!: 'ACTIVE' | 'SUSPENDED';
  public description!: string | null;
  public contactPhone!: string | null;
  // Banking details for settlements
  public bankName!: string | null;
  public bankAccountNumber!: string | null;
  public bankAccountName!: string | null;
  public bankBranch!: string | null;
  public bankSwiftCode!: string | null;
  // Settlement preferences
  public minimumWithdrawalAmount!: number;
  public settlementMethod!: string;
  public settlementSchedule!: string;
  // KYC Fields
  public idNumber!: string | null;
  public businessRegistrationNumber!: string | null;
  public taxPin!: string | null;
  // Withdrawal verification
  public withdrawalVerificationMethod!: 'OTP_EMAIL' | 'OTP_SMS' | 'NONE';
  // Payment Channels & Direct Payouts
  public mpesaPaybillNumber!: string | null;
  public mpesaPaybillAccount!: string | null;
  public mpesaTillNumber!: string | null;
  public mpesaTillName!: string | null;
  public mpesaPochiNumber!: string | null;
  public payoutMethod!: 'TILL' | 'PAYBILL' | 'BANK' | 'MPESA';
  public directPayoutEnabled!: boolean;
  public bankAccountDetails!: string | null; // JSON string
  // Aggregator Model
  public aggregatorSubAccountId!: string | null;
  public commissionPercentage!: number; // e.g. 10 for 10%
  // Hybrid Pricing Model
  public baseMonthlyFee!: number;
  public transactionFee!: number;
  public smsFee!: number;
  public activeUserFee!: number;
  public subscriptionExpiry!: Date | null;
  public trialEndsAt!: Date | null;
  public subscriptionStatus!: 'TRIAL' | 'PAID' | 'EXPIRED' | 'GRACE';
  public nextPaymentDueDate!: Date | null;
  // IntaSend Credentials (Optional per tenant)
  public intasendPublishableKey!: string | null;
  public intasendSecretKey!: string | null;
  public isProduction!: boolean;
  public isGoLiveChecked!: boolean;
  public productionReadyAt!: Date | null;
  public lastSanitizedAt!: Date | null;
  public themePreference!: 'light' | 'dark' | 'system';
  // Additional Profile & Business Attributes
  public tradingName!: string | null;
  public businessLogoUrl!: string | null;
  public vatNumber!: string | null;
  public website!: string | null;
  public businessEmail!: string | null;
  public businessAddress!: string | null;
  public supportEmail!: string | null;
  public supportPhone!: string | null;
  // Branding Details
  public loginLogoUrl!: string | null;
  public portalLogoUrl!: string | null;
  public faviconUrl!: string | null;
  public themeColor!: string | null;
  public secondaryColor!: string | null;
  // Withdrawal Accounts
  public mpesaWithdrawalName!: string | null;
  public mpesaWithdrawalNumber!: string | null;
  public bankIban!: string | null;
  public defaultWithdrawalMethod!: 'MPESA' | 'BANK';
  public notificationPreferences!: string | null; // JSON String

  // Billing calculation helper
  public async getSubscriptionInfo() {
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
      } else {
        // Fallback to global platform pricing config
        const config = await PlatformPricingConfig.findOne();
        if (config) {
          priceCents = config.baseSubscriptionPriceCents;
        }
      }
    } catch (err) {
      // Safe fallback if tables aren't queried successfully
    }

    const price = Math.round(priceCents / 100);

    if (isTrial && trialEnd) {
      const diff = trialEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      showNotification = true;
      message = `Trial Pass: ${daysRemaining} days remaining. Pay KES ${price.toLocaleString()} to activate monthly subscription.`;
    } else if (isPaid && dueAt) {
      const diff = dueAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      // Reappear 4 days to due date
      if (daysRemaining <= 4) {
        showNotification = true;
        message = `Subscription renewal in ${daysRemaining} days. Pay KES ${price.toLocaleString()} to avoid suspension.`;
      }
    } else if (isExpired) {
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
Tenant.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  subdomain: { type: DataTypes.STRING, unique: true, allowNull: false },
  logoUrl: { type: DataTypes.STRING },
  primaryColor: { type: DataTypes.STRING, defaultValue: '#3b82f6' },
  themePreference: { type: DataTypes.ENUM('light', 'dark', 'system'), defaultValue: 'light' },
  mpesaShortcode: { type: DataTypes.STRING },
  mpesaConsumerKey: { type: DataTypes.STRING },
  mpesaConsumerSecret: { type: DataTypes.STRING },
  mpesaPasskey: { type: DataTypes.STRING },
  mpesaInitiatorName: { type: DataTypes.STRING },
  mpesaInitiatorPassword: { type: DataTypes.STRING },
  mpesaEnvironment: { type: DataTypes.STRING, defaultValue: 'sandbox' },
  mpesaWebhookSecret: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('ACTIVE', 'SUSPENDED'), defaultValue: 'ACTIVE' },
  description: { type: DataTypes.TEXT },
  contactPhone: { type: DataTypes.STRING },
  bankName: { type: DataTypes.STRING },
  bankAccountNumber: { type: DataTypes.STRING },
  bankAccountName: { type: DataTypes.STRING },
  bankBranch: { type: DataTypes.STRING },
  bankSwiftCode: { type: DataTypes.STRING },
  minimumWithdrawalAmount: { type: DataTypes.BIGINT, defaultValue: 10000 }, // 100.00 KES
  settlementMethod: { type: DataTypes.STRING, defaultValue: 'INTASEND' },
  settlementSchedule: { type: DataTypes.STRING, defaultValue: 'MANUAL' },
  idNumber: { type: DataTypes.STRING },
  businessRegistrationNumber: { type: DataTypes.STRING },
  taxPin: { type: DataTypes.STRING },
  withdrawalVerificationMethod: { type: DataTypes.ENUM('OTP_EMAIL', 'OTP_SMS', 'NONE'), defaultValue: 'NONE' },
  mpesaPaybillNumber: { type: DataTypes.STRING },
  mpesaPaybillAccount: { type: DataTypes.STRING },
  mpesaTillNumber: { type: DataTypes.STRING },
  mpesaTillName: { type: DataTypes.STRING },
  mpesaPochiNumber: { type: DataTypes.STRING },
  payoutMethod: { type: DataTypes.STRING, defaultValue: 'TILL' },
  directPayoutEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  bankAccountDetails: { type: DataTypes.TEXT },
  aggregatorSubAccountId: { type: DataTypes.STRING },
  commissionPercentage: { type: DataTypes.FLOAT, defaultValue: 10 },
  baseMonthlyFee: { type: DataTypes.BIGINT, defaultValue: 0 },
  transactionFee: { type: DataTypes.BIGINT, defaultValue: 0 },
  smsFee: { type: DataTypes.BIGINT, defaultValue: 0 },
  activeUserFee: { type: DataTypes.BIGINT, defaultValue: 0 },
  subscriptionExpiry: { type: DataTypes.DATE },
  trialEndsAt: { type: DataTypes.DATE },
  subscriptionStatus: { type: DataTypes.ENUM('TRIAL', 'PAID', 'EXPIRED', 'GRACE'), defaultValue: 'TRIAL' },
  nextPaymentDueDate: { type: DataTypes.DATE },
  intasendPublishableKey: { type: DataTypes.STRING },
  intasendSecretKey: { type: DataTypes.STRING },
  isProduction: { type: DataTypes.BOOLEAN, defaultValue: false },
  isGoLiveChecked: { type: DataTypes.BOOLEAN, defaultValue: false },
  productionReadyAt: { type: DataTypes.DATE },
  lastSanitizedAt: { type: DataTypes.DATE },
  tradingName: { type: DataTypes.STRING },
  businessLogoUrl: { type: DataTypes.TEXT },
  vatNumber: { type: DataTypes.STRING },
  website: { type: DataTypes.STRING },
  businessEmail: { type: DataTypes.STRING },
  businessAddress: { type: DataTypes.TEXT },
  supportEmail: { type: DataTypes.STRING },
  supportPhone: { type: DataTypes.STRING },
  loginLogoUrl: { type: DataTypes.TEXT },
  portalLogoUrl: { type: DataTypes.TEXT },
  faviconUrl: { type: DataTypes.TEXT },
  themeColor: { type: DataTypes.STRING, defaultValue: '#0f172a' },
  secondaryColor: { type: DataTypes.STRING, defaultValue: '#38bdf8' },
  mpesaWithdrawalName: { type: DataTypes.STRING },
  mpesaWithdrawalNumber: { type: DataTypes.STRING },
  bankIban: { type: DataTypes.STRING },
  defaultWithdrawalMethod: { type: DataTypes.STRING, defaultValue: 'MPESA' },
  notificationPreferences: { type: DataTypes.TEXT },
}, { 
  sequelize, 
  modelName: 'tenant',
  hooks: {
    beforeSave: (tenant: any) => {
      const sensitiveFields = [
        'mpesaPasskey', 
        'mpesaConsumerKey', 
        'mpesaConsumerSecret', 
        'mpesaInitiatorPassword', 
        'intasendSecretKey'
      ];
      sensitiveFields.forEach(field => {
        if (tenant[field] && typeof tenant[field] === 'string' && !tenant[field].includes(':')) {
          tenant[field] = EncryptionService.encrypt(tenant[field]);
        }
      });
    }
  }
});

export class AdminUser extends Model {
  declare id: string;
  declare email: string;
  declare password: string;
  declare role: 'PLATFORM_OWNER' | 'SUPER_ADMIN' | 'TENANT' | 'STAFF' | 'AGENT';
  declare tenantId: string | null;
  declare themePreference: 'light' | 'dark' | 'system';
  declare commissionRate: number; // Percentage (e.g., 0.1 for 10%)
  // Personal Information
  declare firstName: string | null;
  declare lastName: string | null;
  declare displayName: string | null;
  declare username: string | null;
  declare phone: string | null;
  declare altPhone: string | null;
  declare preferredLanguage: string;
  declare timeZone: string;
  declare country: string;
  declare countyState: string | null;
  declare city: string | null;
  declare postalCode: string | null;
  declare physicalAddress: string | null;
  declare profilePhotoUrl: string | null;
  declare twoFactorEnabled: boolean;
  declare twoFactorMethod: 'EMAIL' | 'SMS' | 'AUTHENTICATOR';
  declare lastPasswordChange: Date | null;
}
AdminUser.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('PLATFORM_OWNER', 'SUPER_ADMIN', 'TENANT', 'STAFF', 'AGENT'), defaultValue: 'TENANT' },
  themePreference: { type: DataTypes.ENUM('light', 'dark', 'system'), defaultValue: 'light' },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'tenants', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  commissionRate: { type: DataTypes.FLOAT, defaultValue: 0.0 },
  firstName: { type: DataTypes.STRING },
  lastName: { type: DataTypes.STRING },
  displayName: { type: DataTypes.STRING },
  username: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  altPhone: { type: DataTypes.STRING },
  preferredLanguage: { type: DataTypes.STRING, defaultValue: 'en' },
  timeZone: { type: DataTypes.STRING, defaultValue: 'Africa/Nairobi' },
  country: { type: DataTypes.STRING, defaultValue: 'Kenya' },
  countyState: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  postalCode: { type: DataTypes.STRING },
  physicalAddress: { type: DataTypes.TEXT },
  profilePhotoUrl: { type: DataTypes.TEXT },
  twoFactorEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  twoFactorMethod: { type: DataTypes.STRING, defaultValue: 'EMAIL' },
  lastPasswordChange: { type: DataTypes.DATE },
}, {
  sequelize,
  modelName: 'admin_user',
  hooks: {
    beforeValidate: (user: AdminUser) => {
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

export class Router extends Model {
  public id!: string;
  public name!: string;
  public host!: string;
  public port!: number;
  public username!: string;
  public password!: string;
  public tenantId!: string;
  public location!: string | null;
  public isOnline!: boolean;
  public lastSeen!: Date | null;
  public identity!: string | null;
  public validationStatus!: 'PENDING' | 'VALIDATED' | 'FAILED';
  // Auto-configuration fields
  public apiUser!: string | null;
  public apiPassword!: string | null;
  public autoConfigStatus!: 'PENDING' | 'CONFIGURED' | 'FAILED';
  public autoConfigScript!: string | null;
  public onboardToken!: string | null;
  public autoConfigError!: string | null;
  public capabilities!: string | null; // JSON: {hotspot: true, pppoe: true, radius: true}
  public version!: string | null; // RouterOS version
  public model!: string | null; // Hardware model
  public architecture!: string | null; // arm, mipsbe, x86, etc.
  // Power & Maintenance Management fields
  public powerStatus!: 'GRID' | 'UPS_BATTERY' | 'OFFLINE' | 'UNKNOWN';
  public maintenanceStatus!: 'OPERATIONAL' | 'MAINTENANCE' | 'POWER_OUTAGE' | 'BLACKOUT' | 'NETWORK_FAILURE' | 'HARDWARE_FAILURE' | 'UPSTREAM_FAILURE';
  public maintenanceNotes!: string | null;
  public maintenanceStartTime!: Date | null;
  public expectedReturnTime!: Date | null;
  public maintenanceCreatedBy!: string | null;
  public uptimeSeconds!: number;
  public subscriberCount!: number;
  public cpuUsagePercent!: number;
  public memoryUsagePercent!: number;
  public bandwidthUsageMbps!: number;
  public hasSmartPower!: boolean;
  public smartPowerType!: 'SMART_PDU' | 'SMART_UPS' | 'SMART_PLUG' | 'REMOTE_SWITCH' | 'NONE';
  public smartPowerHost!: string | null;
  public smartPowerPort!: number | null;
  public smartPowerOutletId!: string | null;
  public outageAutoDetect!: boolean;
  public outageThresholdMinutes!: number;
  public escalationThresholdMinutes!: number;
  public suspendAlertsInBlackout!: boolean;
  public autoExtendSubscribersOnOutage!: boolean;
}
Router.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  host: { type: DataTypes.STRING, allowNull: false },
  port: { type: DataTypes.INTEGER, defaultValue: 8728 },
  username: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  location: { type: DataTypes.STRING },
  isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastSeen: { type: DataTypes.DATE },
  identity: { type: DataTypes.STRING },
  validationStatus: { type: DataTypes.ENUM('PENDING', 'VALIDATED', 'FAILED'), defaultValue: 'PENDING' },
  // Auto-configuration fields
  apiUser: { type: DataTypes.STRING },
  apiPassword: { type: DataTypes.STRING },
  autoConfigStatus: { type: DataTypes.ENUM('PENDING', 'CONFIGURED', 'FAILED'), defaultValue: 'PENDING' },
  autoConfigScript: { type: DataTypes.TEXT },
  onboardToken: { type: DataTypes.STRING },
  autoConfigError: { type: DataTypes.TEXT },
  capabilities: { type: DataTypes.TEXT }, // JSON string
  version: { type: DataTypes.STRING },
  model: { type: DataTypes.STRING },
  architecture: { type: DataTypes.STRING },
  // Power & Maintenance
  powerStatus: { type: DataTypes.ENUM('GRID', 'UPS_BATTERY', 'OFFLINE', 'UNKNOWN'), defaultValue: 'GRID' },
  maintenanceStatus: {
    type: DataTypes.ENUM('OPERATIONAL', 'MAINTENANCE', 'POWER_OUTAGE', 'BLACKOUT', 'NETWORK_FAILURE', 'HARDWARE_FAILURE', 'UPSTREAM_FAILURE'),
    defaultValue: 'OPERATIONAL'
  },
  maintenanceNotes: { type: DataTypes.TEXT },
  maintenanceStartTime: { type: DataTypes.DATE },
  expectedReturnTime: { type: DataTypes.DATE },
  maintenanceCreatedBy: { type: DataTypes.STRING },
  uptimeSeconds: { type: DataTypes.INTEGER, defaultValue: 0 },
  subscriberCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  cpuUsagePercent: { type: DataTypes.FLOAT, defaultValue: 0 },
  memoryUsagePercent: { type: DataTypes.FLOAT, defaultValue: 0 },
  bandwidthUsageMbps: { type: DataTypes.FLOAT, defaultValue: 0 },
  hasSmartPower: { type: DataTypes.BOOLEAN, defaultValue: false },
  smartPowerType: { type: DataTypes.ENUM('SMART_PDU', 'SMART_UPS', 'SMART_PLUG', 'REMOTE_SWITCH', 'NONE'), defaultValue: 'NONE' },
  smartPowerHost: { type: DataTypes.STRING },
  smartPowerPort: { type: DataTypes.INTEGER },
  smartPowerOutletId: { type: DataTypes.STRING },
  outageAutoDetect: { type: DataTypes.BOOLEAN, defaultValue: true },
  outageThresholdMinutes: { type: DataTypes.INTEGER, defaultValue: 5 },
  escalationThresholdMinutes: { type: DataTypes.INTEGER, defaultValue: 30 },
  suspendAlertsInBlackout: { type: DataTypes.BOOLEAN, defaultValue: true },
  autoExtendSubscribersOnOutage: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { 
  sequelize, 
  modelName: 'router',
  tableName: 'routers',
  hooks: {
    beforeSave: (router: any) => {
      const sensitiveFields = ['password', 'apiPassword'];
      sensitiveFields.forEach(field => {
        if (router[field] && typeof router[field] === 'string' && !router[field].includes(':')) {
          router[field] = EncryptionService.encrypt(router[field]);
        }
      });
    }
  }
});

export class RouterIncident extends Model {
  public id!: string;
  public tenantId!: string;
  public routerId!: string;
  public incidentType!: 'POWER_OUTAGE' | 'BLACKOUT' | 'MAINTENANCE' | 'NETWORK_FAILURE' | 'HARDWARE_FAILURE' | 'UPSTREAM_FAILURE';
  public severity!: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  public status!: 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
  public summary!: string;
  public details!: string | null;
  public startTime!: Date;
  public endTime!: Date | null;
  public expectedReturnTime!: Date | null;
  public affectedSubscriberCount!: number;
  public compensationIssuedCents!: number;
  public notifiedChannels!: string | null; // JSON Array: ['SMS', 'EMAIL', 'WHATSAPP', 'DASHBOARD']
  public resolvedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RouterIncident.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  routerId: { type: DataTypes.UUID, allowNull: false },
  incidentType: {
    type: DataTypes.ENUM('POWER_OUTAGE', 'BLACKOUT', 'MAINTENANCE', 'NETWORK_FAILURE', 'HARDWARE_FAILURE', 'UPSTREAM_FAILURE'),
    allowNull: false
  },
  severity: { type: DataTypes.ENUM('INFO', 'WARNING', 'CRITICAL', 'EMERGENCY'), defaultValue: 'WARNING' },
  status: { type: DataTypes.ENUM('OPEN', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'), defaultValue: 'OPEN' },
  summary: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT },
  startTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  endTime: { type: DataTypes.DATE },
  expectedReturnTime: { type: DataTypes.DATE },
  affectedSubscriberCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  compensationIssuedCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  notifiedChannels: { type: DataTypes.TEXT },
  resolvedBy: { type: DataTypes.STRING },
}, { sequelize, modelName: 'router_incident' });

export class DowntimeRecord extends Model {
  public id!: string;
  public tenantId!: string;
  public routerId!: string;
  public incidentId!: string | null;
  public reason!: string;
  public downtimeMinutes!: number;
  public subscriberCount!: number;
  public compensationPerSubscriberCents!: number;
  public totalCompensationCents!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DowntimeRecord.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  routerId: { type: DataTypes.UUID, allowNull: false },
  incidentId: { type: DataTypes.UUID },
  reason: { type: DataTypes.STRING, allowNull: false },
  downtimeMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  subscriberCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  compensationPerSubscriberCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  totalCompensationCents: { type: DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize, modelName: 'downtime_record' });

export class Package extends Model {
  public id!: number;
  public name!: string;
  public price!: number;
  public durationMinutes!: number | null;
  public dataLimitBytes!: number | null;
  public speedLimit!: string | null;
  public isEnabled!: boolean;
  public tenantId!: string;
  public type!: 'HOTSPOT' | 'ISP';
  // Enhanced MikroTik fields
  public description!: string | null;
  public validity!: number | null; // Days until expiry
  public uploadSpeed!: string | null; // e.g., "10M"
  public downloadSpeed!: string | null; // e.g., "20M"
  public burstUpload!: string | null; // e.g., "15M"
  public burstDownload!: string | null; // e.g., "30M"
  public burstThreshold!: string | null; // e.g., "8M/16M"
  public burstTime!: string | null; // e.g., "8s/8s"
  public priority!: number; // Queue priority 1-8
  public sharedUsers!: number; // Max concurrent connections
  public expiryAction!: 'SUSPEND' | 'DELETE' | 'NOTIFY';
  public isVisible!: boolean; // Show on captive portal
  public category!: string | null; // e.g., 'Daily', 'Weekly', 'Monthly'
  public mikrotikProfile!: string | null; // Custom profile name
  public limitAtTime!: string | null; // Time-based limits
  public parentQueue!: string | null; // Parent queue for hierarchical QoS
}
Package.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.BIGINT, allowNull: false },
  durationMinutes: { type: DataTypes.INTEGER, allowNull: true },
  dataLimitBytes: { type: DataTypes.BIGINT, allowNull: true },
  speedLimit: { type: DataTypes.STRING, allowNull: true },
  isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.ENUM('HOTSPOT', 'ISP'), defaultValue: 'HOTSPOT' },
  // Enhanced MikroTik fields
  description: { type: DataTypes.TEXT },
  validity: { type: DataTypes.INTEGER }, // Days
  uploadSpeed: { type: DataTypes.STRING },
  downloadSpeed: { type: DataTypes.STRING },
  burstUpload: { type: DataTypes.STRING },
  burstDownload: { type: DataTypes.STRING },
  burstThreshold: { type: DataTypes.STRING },
  burstTime: { type: DataTypes.STRING },
  priority: { type: DataTypes.INTEGER, defaultValue: 8 },
  sharedUsers: { type: DataTypes.INTEGER, defaultValue: 1 },
  expiryAction: { type: DataTypes.ENUM('SUSPEND', 'DELETE', 'NOTIFY'), defaultValue: 'SUSPEND' },
  isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
  category: { type: DataTypes.STRING },
  mikrotikProfile: { type: DataTypes.STRING },
  limitAtTime: { type: DataTypes.STRING },
  parentQueue: { type: DataTypes.STRING },
}, { sequelize, modelName: 'package' });

export class SubscriberGroup extends Model {
  public id!: string;
  public tenantId!: string;
  public name!: string;
  public description!: string | null;
  public discountPercentage!: number;
}

SubscriberGroup.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  discountPercentage: { type: DataTypes.FLOAT, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'subscriber_group',
  indexes: [{ fields: ['tenantId'] }]
});


export class DeviceBinding extends Model {
  public id!: string;
  public tenantId!: string;
  public routerId!: string;
  public subscriberId!: string | null;
  public macAddress!: string;
  public deviceType!: 'SMARTPHONE' | 'TV' | 'LAPTOP' | 'OTHER';
  public bindingType!: 'BYPASSED' | 'BLOCKED' | 'REGULAR';
  public comments!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export class Subscriber extends Model {
  public id!: string;
  public name!: string | null;
  public firstName!: string | null;
  public lastName!: string | null;
  public phoneNumber!: string;
  public altPhone!: string | null;
  public email!: string | null;
  public idNumber!: string | null;
  public username!: string | null;
  public password!: string | null;
  public pppoeUsername!: string | null;
  public pppoePassword!: string | null;
  public macAddress!: string | null;
  public address!: string | null;
  public location!: string | null;
  public customerType!: 'RESIDENTIAL' | 'BUSINESS' | 'CORPORATE' | 'INSTITUTION' | 'HOTSPOT' | 'PPPOE';
  public connectionType!: 'HOTSPOT' | 'PPPOE';
  public customerGroupId!: string | null;
  public status!: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  public tenantId!: string;
  public routerId!: string | null;
  public packageId!: number | null;
  public expiryDate!: Date | null;
  public lastPaymentDate!: Date | null;
  public notes!: string | null;
  public autoRenewal!: boolean;
  public notificationsEnabled!: boolean;
  public isDraft!: boolean;
  public archivedAt!: Date | null;
}

DeviceBinding.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  routerId: { type: DataTypes.UUID, allowNull: false },
  subscriberId: { type: DataTypes.UUID, allowNull: true },
  macAddress: { type: DataTypes.STRING, allowNull: false },
  deviceType: { type: DataTypes.ENUM('SMARTPHONE', 'TV', 'LAPTOP', 'OTHER'), defaultValue: 'OTHER' },
  bindingType: { type: DataTypes.ENUM('BYPASSED', 'BLOCKED', 'REGULAR'), defaultValue: 'BYPASSED' },
  comments: { type: DataTypes.STRING }
}, {
  sequelize,
  modelName: 'device_binding',
  indexes: [{ fields: ['tenantId'] }, { fields: ['macAddress'] }]
});

Subscriber.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: true },
  firstName: { type: DataTypes.STRING, allowNull: true },
  lastName: { type: DataTypes.STRING, allowNull: true },
  phoneNumber: { type: DataTypes.STRING, allowNull: false },
  altPhone: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true },
  idNumber: { type: DataTypes.STRING, allowNull: true },
  username: { type: DataTypes.STRING, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: true },
  pppoeUsername: { type: DataTypes.STRING, allowNull: true },
  pppoePassword: { type: DataTypes.STRING, allowNull: true },
  macAddress: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  customerType: {
    type: DataTypes.ENUM('RESIDENTIAL', 'BUSINESS', 'CORPORATE', 'INSTITUTION', 'HOTSPOT', 'PPPOE'),
    defaultValue: 'RESIDENTIAL'
  },
  connectionType: {
    type: DataTypes.ENUM('HOTSPOT', 'PPPOE'),
    defaultValue: 'HOTSPOT'
  },
  customerGroupId: { type: DataTypes.UUID, allowNull: true },
  status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'), defaultValue: 'INACTIVE' },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  routerId: { type: DataTypes.UUID, allowNull: true },
  packageId: { type: DataTypes.INTEGER, allowNull: true },
  expiryDate: { type: DataTypes.DATE },
  lastPaymentDate: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
  autoRenewal: { type: DataTypes.BOOLEAN, defaultValue: false },
  notificationsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  isDraft: { type: DataTypes.BOOLEAN, defaultValue: false },
  archivedAt: { type: DataTypes.DATE, allowNull: true },
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

export class Invoice extends Model {
  public id!: string;
  public subscriberId!: string;
  public amount!: number;
  public dueDate!: Date;
  public status!: 'UNPAID' | 'PAID' | 'CANCELLED';
  public tenantId!: string;
}
Invoice.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  subscriberId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  dueDate: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('UNPAID', 'PAID', 'CANCELLED'), defaultValue: 'UNPAID' },
  tenantId: { type: DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'invoice' });

export class Wallet extends Model {
  public id!: string;
  public ownerId!: string; // Subscriber ID, Agent ID, or Tenant ID
  public ownerType!: 'SUBSCRIBER' | 'TENANT' | 'AGENT';
  public balance!: number;
  public frozenBalance!: number;
  public pendingBalance!: number;
  public settledBalance!: number;
  public currency!: string;
  public tenantId!: string;
}
Wallet.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ownerId: { type: DataTypes.UUID, allowNull: false },
  ownerType: { type: DataTypes.ENUM('SUBSCRIBER', 'TENANT', 'AGENT'), allowNull: false },
  balance: { type: DataTypes.BIGINT, defaultValue: 0 },
  frozenBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  pendingBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  settledBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  currency: { type: DataTypes.STRING, defaultValue: 'KES' },
  tenantId: { type: DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'wallet' });

export class Settlement extends Model {
  public id!: string;
  public tenantId!: string;
  public amount!: number;
  public status!: 'PENDING' | 'PAID' | 'FAILED' | 'REVERSED';
  public method!: string;
  public paidAt!: Date | null;
  public referenceNumber!: string | null;
  public transactionFee!: number;
  public walletTransactionId!: string | null;
  public processedBy!: string | null;
}
Settlement.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  status: { type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'REVERSED'), defaultValue: 'PENDING' },
  method: { type: DataTypes.STRING },
  paidAt: { type: DataTypes.DATE },
  referenceNumber: { type: DataTypes.STRING },
  transactionFee: { type: DataTypes.BIGINT, defaultValue: 0 },
  walletTransactionId: { type: DataTypes.UUID, allowNull: true },
  processedBy: { type: DataTypes.UUID, allowNull: true },
}, { sequelize, modelName: 'settlement' });

export class AuditLog extends Model {
  public id!: string;
  public tenantId!: string | null;
  public userId!: string | null;
  public action!: string;
  public details!: string;
  public ipAddress!: string | null;
}
AuditLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID },
  userId: { type: DataTypes.UUID },
  action: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT },
  ipAddress: { type: DataTypes.STRING },
}, { 
  sequelize, 
  modelName: 'auditLog',
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['userId'] }
  ]
});

export class PlatformSetting extends Model {
  public key!: string;
  public value!: string;
}
PlatformSetting.init({
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'platformSetting' });

export class Payment extends Model {
  public id!: string;
  public mpesaReceiptNumber!: string;
  public checkoutRequestId!: string | null;
  public amount!: number;
  public phoneNumber!: string;
  public status!: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  public packageId!: number;
  public macAddress!: string | null;
  public ipAddress!: string | null;
  public tenantId!: string;
  public routerId!: string | null;
  public subscriberId!: string | null;
  public rawCallback!: string | null; // Storing the full JSON payload
  public processedCallbackHash!: string | null; // For idempotency
  public completedAt!: Date | null; // Completion timestamp
  public failureReason!: string | null; // Failure details
  public sessionId!: string | null; // Session identifier for tracking
  public metadata!: string | null; // Additional metadata as JSON
  public paymentChannel!: string;
  public paymentMethod!: string;
  public transactionFee!: number;
  public platformFee!: number;
  public netAmount!: number;
  public walletTransactionId!: string | null;
  public aggregatorTransactionId!: string | null;
  public rawAggregatorPayload!: string | null;
  // IntaSend tracking
  public intasendCheckoutId!: string | null;
  public intasendTrackingId!: string | null;
  public intasendState!: string | null;
  // PayHero & Direct Payout tracking
  public payheroReference!: string | null;
  public payheroCheckoutId!: string | null;
  public payheroStatus!: string | null;
  public destinationType!: string | null;
  public destinationAccount!: string | null;
}
Payment.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  mpesaReceiptNumber: { type: DataTypes.STRING, unique: true },
  checkoutRequestId: { type: DataTypes.STRING, unique: true },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  phoneNumber: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED', 'REVERSED'), defaultValue: 'PENDING' },
  packageId: { type: DataTypes.INTEGER, allowNull: true },
  macAddress: { type: DataTypes.STRING },
  ipAddress: { type: DataTypes.STRING },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  routerId: { type: DataTypes.UUID, allowNull: true },
  subscriberId: { type: DataTypes.UUID, allowNull: true },
  rawCallback: { type: DataTypes.TEXT },
  processedCallbackHash: { type: DataTypes.STRING }, // For idempotency checks
  completedAt: { type: DataTypes.DATE }, // When payment completed
  failureReason: { type: DataTypes.STRING }, // Detailed failure reason
  sessionId: { type: DataTypes.STRING }, // Encrypted session identifier
  metadata: { type: DataTypes.TEXT }, // JSON metadata storage
  paymentChannel: { type: DataTypes.STRING, defaultValue: 'MPESA' },
  paymentMethod: { type: DataTypes.STRING, defaultValue: 'PAYHERO' },
  transactionFee: { type: DataTypes.BIGINT, defaultValue: 0 },
  platformFee: { type: DataTypes.BIGINT, defaultValue: 0 },
  netAmount: { type: DataTypes.BIGINT, defaultValue: 0 },
  walletTransactionId: { type: DataTypes.UUID, allowNull: true },
  aggregatorTransactionId: { type: DataTypes.STRING },
  rawAggregatorPayload: { type: DataTypes.TEXT },
  intasendCheckoutId: { type: DataTypes.STRING },
  intasendTrackingId: { type: DataTypes.STRING },
  intasendState: { type: DataTypes.STRING },
  payheroReference: { type: DataTypes.STRING },
  payheroCheckoutId: { type: DataTypes.STRING },
  payheroStatus: { type: DataTypes.STRING },
  destinationType: { type: DataTypes.STRING },
  destinationAccount: { type: DataTypes.STRING },
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

export class Session extends Model {
  public id!: string;
  public paymentId!: string;
  public routerId!: string;
  public mikrotikUsername!: string;
  public mikrotikPassword!: string;
  public macAddress!: string;
  public ipAddress!: string;
  public startTime!: Date;
  public expiryTime!: Date;
  public status!: 'ACTIVE' | 'EXPIRED';
  public fraudScore!: number;
  public tenantId!: string;
  // Bandwidth Tracking
  public bytesIn!: number;
  public bytesOut!: number;
  public lastUpdated!: Date | null;
}
Session.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  paymentId: { type: DataTypes.UUID, allowNull: false },
  routerId: { type: DataTypes.UUID, allowNull: false },
  mikrotikUsername: { type: DataTypes.STRING, allowNull: false },
  mikrotikPassword: { type: DataTypes.STRING, allowNull: false },
  macAddress: { type: DataTypes.STRING, allowNull: false },
  ipAddress: { type: DataTypes.STRING },
  startTime: { type: DataTypes.DATE },
  expiryTime: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('ACTIVE', 'EXPIRED'), defaultValue: 'ACTIVE' },
  fraudScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  bytesIn: { type: DataTypes.BIGINT, defaultValue: 0 },
  bytesOut: { type: DataTypes.BIGINT, defaultValue: 0 },
  lastUpdated: { type: DataTypes.DATE },
}, { 
  sequelize, 
  modelName: 'session',
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['macAddress'] },
    { fields: ['status'] }
  ]
});

export class AdminSession extends Model {
  public id!: string;
  public userId!: string;
  public tokenHash!: string;
  public ipAddress!: string;
  public userAgent!: string;
  public loginTime!: Date;
  public lastActivity!: Date;
  public expiryTime!: Date;
  public status!: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}
AdminSession.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  tokenHash: { type: DataTypes.STRING, allowNull: false },
  ipAddress: { type: DataTypes.STRING, allowNull: false },
  userAgent: { type: DataTypes.STRING },
  loginTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expiryTime: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('ACTIVE', 'EXPIRED', 'REVOKED'), defaultValue: 'ACTIVE' },
}, { sequelize, modelName: 'adminSession' });

export class Voucher extends Model {
  public id!: string;
  public code!: string;
  public packageId!: number;
  public batch!: string | null;
  public status!: 'AVAILABLE' | 'USED' | 'EXPIRED';
  public tenantId!: string;
  public usedAt!: Date | null;
  public soldByAgentId!: string | null;
}
Voucher.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  packageId: { type: DataTypes.INTEGER, allowNull: false },
  batch: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('AVAILABLE', 'USED', 'EXPIRED'), defaultValue: 'AVAILABLE' },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  usedAt: { type: DataTypes.DATE },
  soldByAgentId: { type: DataTypes.UUID, allowNull: true },
}, { sequelize, modelName: 'voucher' });

export class FraudLog extends Model {
  public id!: number;
  public sessionId!: string;
  public violationType!: string;
  public details!: string;
  public tenantId!: string;
}
FraudLog.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  sessionId: { type: DataTypes.UUID },
  violationType: { type: DataTypes.STRING },
  details: { type: DataTypes.TEXT },
  tenantId: { type: DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'fraud_log' });

export class SMSLog extends Model {
  public id!: string;
  public tenantId!: string;
  public phoneNumber!: string;
  public message!: string;
  public status!: 'SENT' | 'FAILED' | 'PENDING';
  public cost!: number;
  public providerReference!: string | null;
}
SMSLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  phoneNumber: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('SENT', 'FAILED', 'PENDING'), defaultValue: 'PENDING' },
  cost: { type: DataTypes.BIGINT, defaultValue: 0 },
  providerReference: { type: DataTypes.STRING },
}, { sequelize, modelName: 'sms_log' });

export class PlatformTransaction extends Model {
  public id!: string;
  public type!: 'FEE_SUBSCRIPTION' | 'FEE_TRANSACTION' | 'FEE_SMS' | 'COMMISSION';
  public amount!: number;
  public tenantId!: string;
  public referenceId!: string | null; // e.g. Payment ID or SMS Log ID
  public metadata!: string | null;
}
PlatformTransaction.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  type: { type: DataTypes.ENUM('FEE_SUBSCRIPTION', 'FEE_TRANSACTION', 'FEE_SMS', 'COMMISSION'), allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  referenceId: { type: DataTypes.UUID },
  metadata: { type: DataTypes.TEXT },
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
export class WalletTransaction extends Model {
  public id!: string;
  public walletId!: string;
  public sourceWalletId!: string | null;
  public destinationWalletId!: string | null;
  public amount!: number;
  public transactionType!: 'CREDIT' | 'DEBIT' | 'FEE' | 'SETTLEMENT' | 'REVERSAL';
  public referenceId!: string | null;
  public referenceType!: string | null;
  public balanceAfter!: number;
  public description!: string;
  public status!: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  public settlementStatus!: 'PENDING' | 'SETTLED' | 'NA';
  public maturesAt!: Date | null;
  public createdBy!: string | null;
  public metadata!: string | null;
  public tenantId!: string;
}
WalletTransaction.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  walletId: { type: DataTypes.UUID, allowNull: false },
  sourceWalletId: { type: DataTypes.UUID },
  destinationWalletId: { type: DataTypes.UUID },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  transactionType: { type: DataTypes.ENUM('CREDIT', 'DEBIT', 'FEE', 'SETTLEMENT', 'REVERSAL'), allowNull: false },
  referenceId: { type: DataTypes.UUID },
  referenceType: { type: DataTypes.STRING },
  balanceAfter: { type: DataTypes.BIGINT, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED'), defaultValue: 'COMPLETED' },
  settlementStatus: { type: DataTypes.ENUM('PENDING', 'SETTLED', 'NA'), defaultValue: 'NA' },
  maturesAt: { type: DataTypes.DATE },
  createdBy: { type: DataTypes.UUID },
  metadata: { type: DataTypes.TEXT },
  tenantId: { type: DataTypes.UUID, allowNull: false },
}, { 
  sequelize, 
  modelName: 'walletTransaction',
  indexes: [
    { fields: ['walletId'] },
    { fields: ['tenantId'] }
  ]
});

export class TieredFee extends Model {
  public id!: string;
  public platformFeeId!: string;
  public minAmount!: number;
  public maxAmount!: number;
  public feeValue!: number;
  public isPercentage!: boolean;
}
TieredFee.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  platformFeeId: { type: DataTypes.UUID, allowNull: false },
  minAmount: { type: DataTypes.BIGINT, defaultValue: 0 },
  maxAmount: { type: DataTypes.BIGINT, defaultValue: 0 },
  feeValue: { type: DataTypes.BIGINT, allowNull: false },
  isPercentage: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'tieredFee' });

export class PlatformWallet extends Model {
  public id!: string;
  public balance!: number;
  public pendingBalance!: number;
  public currency!: string;
}
PlatformWallet.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  balance: { type: DataTypes.BIGINT, defaultValue: 0 },
  pendingBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  currency: { type: DataTypes.STRING, defaultValue: 'KES' },
}, { sequelize, modelName: 'platformWallet' });

export class PlatformFee extends Model {
  public id!: string;
  public feeType!: string;
  public feeValue!: number;
  public isPercentage!: boolean;
  public minAmount!: number;
  public maxAmount!: number;
  public isActive!: boolean;
  public description!: string;
}
PlatformFee.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  feeType: { type: DataTypes.STRING, allowNull: false },
  feeValue: { type: DataTypes.BIGINT, allowNull: false },
  isPercentage: { type: DataTypes.BOOLEAN, defaultValue: true },
  minAmount: { type: DataTypes.BIGINT, defaultValue: 0 },
  maxAmount: { type: DataTypes.BIGINT, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  description: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'platformFee' });

export class PasswordResetToken extends Model {
  public id!: string;
  public userId!: string;
  public token!: string;
  public tokenHash!: string | null;
  public otpCode!: string | null;
  public resetType!: 'LINK' | 'OTP';
  public attempts!: number;
  public isLocked!: boolean;
  public expiresAt!: Date;
  public used!: boolean;
  public ipAddress!: string | null;
  public userAgent!: string | null;
}
PasswordResetToken.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  token: { type: DataTypes.STRING, allowNull: false },
  tokenHash: { type: DataTypes.STRING },
  otpCode: { type: DataTypes.STRING },
  resetType: { type: DataTypes.ENUM('LINK', 'OTP'), defaultValue: 'LINK' },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  isLocked: { type: DataTypes.BOOLEAN, defaultValue: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  used: { type: DataTypes.BOOLEAN, defaultValue: false },
  ipAddress: { type: DataTypes.STRING },
  userAgent: { type: DataTypes.STRING },
}, { sequelize, modelName: 'passwordResetToken' });

export class Campaign extends Model {
  public id!: string;
  public tenantId!: string;
  public name!: string;
  public type!: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'BOTH';
  public content!: string;
  public subject!: string | null;
  public templateId!: string | null;
  public filterCriteria!: string | null; // JSON string
  public status!: 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED';
  public scheduledAt!: Date | null;
  public sentCount!: number;
  public failedCount!: number;
  public totalRecipients!: number;
}
Campaign.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('EMAIL', 'SMS', 'WHATSAPP', 'BOTH'), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  subject: { type: DataTypes.STRING },
  templateId: { type: DataTypes.UUID, allowNull: true },
  filterCriteria: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('DRAFT', 'SENDING', 'COMPLETED', 'FAILED'), defaultValue: 'DRAFT' },
  scheduledAt: { type: DataTypes.DATE },
  sentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  failedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalRecipients: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'campaign' });

export class MessageTemplate extends Model {
  public id!: string;
  public name!: string;
  public content!: string;
  public channel!: 'EMAIL' | 'SMS' | 'WHATSAPP';
  public externalId!: string | null;
  public status!: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  public tenantId!: string;
}
MessageTemplate.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  channel: { type: DataTypes.ENUM('EMAIL', 'SMS', 'WHATSAPP'), allowNull: false },
  externalId: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED'), defaultValue: 'DRAFT' },
  tenantId: { type: DataTypes.UUID, allowNull: false },
}, { sequelize, modelName: 'messageTemplate' });

export class CampaignLog extends Model {
  public id!: string;
  public campaignId!: string;
  public subscriberId!: string;
  public status!: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  public providerReference!: string | null;
  public error!: string | null;
  public sentAt!: Date | null;
}
CampaignLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  subscriberId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'), defaultValue: 'PENDING' },
  providerReference: { type: DataTypes.STRING },
  error: { type: DataTypes.TEXT },
  sentAt: { type: DataTypes.DATE },
}, { sequelize, modelName: 'campaignLog' });

export class RouterConnectionLog extends Model {
  public id!: string;
  public routerId!: string;
  public tenantId!: string;
  public action!: 'CONNECT' | 'VERIFY' | 'DISCONNECT' | 'TEST' | 'SYNC' | 'ERROR';
  public status!: 'SUCCESS' | 'FAILED' | 'PENDING';
  public details!: string | null;
  public errorMessage!: string | null;
  public ipAddress!: string | null;
  public userId!: string | null;
  public metadata!: string | null; // JSON for additional data
  public createdAt!: Date;
  public updatedAt!: Date;
}
RouterConnectionLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  routerId: { 
    type: DataTypes.UUID, 
    allowNull: false,
    references: { model: 'routers', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  tenantId: { 
    type: DataTypes.UUID, 
    allowNull: false,
    references: { model: 'tenants', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  action: { type: DataTypes.ENUM('CONNECT', 'VERIFY', 'DISCONNECT', 'TEST', 'SYNC', 'ERROR'), allowNull: false },
  status: { type: DataTypes.ENUM('SUCCESS', 'FAILED', 'PENDING'), defaultValue: 'PENDING' },
  details: { type: DataTypes.TEXT },
  errorMessage: { type: DataTypes.TEXT },
  ipAddress: { type: DataTypes.STRING },
  userId: { 
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'admin_users', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  metadata: { type: DataTypes.TEXT }, // JSON string
}, { 
  sequelize, 
  modelName: 'router_connection_log',
  tableName: 'router_connection_logs'
});

export class DormantRouterPolicy extends Model {
  public id!: string;
  public dormantThresholdMinutes!: number;
  public actionOnDormant!: 'ALERT_ONLY' | 'SUSPEND_ROUTER' | 'DISABLE_SYNC' | 'RECONNECT_ATTEMPT';
  public notifyTenantAdmin!: boolean;
  public notifyPlatformOwner!: boolean;
  autoActionEnabled!: boolean;
  public lastExecutionAt!: Date | null;
  public lastExecutionSummary!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}
DormantRouterPolicy.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  dormantThresholdMinutes: { type: DataTypes.INTEGER, defaultValue: 30 },
  actionOnDormant: { 
    type: DataTypes.ENUM('ALERT_ONLY', 'SUSPEND_ROUTER', 'DISABLE_SYNC', 'RECONNECT_ATTEMPT'), 
    defaultValue: 'ALERT_ONLY' 
  },
  notifyTenantAdmin: { type: DataTypes.BOOLEAN, defaultValue: true },
  notifyPlatformOwner: { type: DataTypes.BOOLEAN, defaultValue: true },
  autoActionEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastExecutionAt: { type: DataTypes.DATE },
  lastExecutionSummary: { type: DataTypes.TEXT },
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

export class SmsGateway extends Model {
  public id!: string;
  public name!: string;
  public provider!: 'TALKSASA' | 'AFRICASTALKING' | 'INFOBIP' | 'VONAGE' | 'TWILIO' | 'GENERIC';
  public apiBaseUrl!: string | null;
  public apiKeyEncrypted!: string | null;   // AES-256-GCM encrypted
  public apiSecretEncrypted!: string | null; // AES-256-GCM encrypted
  public senderId!: string | null;
  public callbackUrl!: string | null;
  public isActive!: boolean;
  public supportedCountries!: string | null; // JSON array
  public supportedCurrencies!: string | null; // JSON array
  public taxRate!: number; // percentage e.g. 16 for 16%
  public minPurchaseAmount!: number; // in cents
  public maxPurchaseAmount!: number; // in cents
  public metadata!: string | null; // JSON
}
SmsGateway.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  provider: { type: DataTypes.ENUM('TALKSASA', 'AFRICASTALKING', 'INFOBIP', 'VONAGE', 'TWILIO', 'GENERIC'), defaultValue: 'TALKSASA' },
  apiBaseUrl: { type: DataTypes.STRING },
  apiKeyEncrypted: { type: DataTypes.TEXT },
  apiSecretEncrypted: { type: DataTypes.TEXT },
  senderId: { type: DataTypes.STRING },
  callbackUrl: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  supportedCountries: { type: DataTypes.TEXT }, // JSON
  supportedCurrencies: { type: DataTypes.TEXT }, // JSON
  taxRate: { type: DataTypes.FLOAT, defaultValue: 0 },
  minPurchaseAmount: { type: DataTypes.BIGINT, defaultValue: 10000 }, // 100.00 KES
  maxPurchaseAmount: { type: DataTypes.BIGINT, defaultValue: 1000000 }, // 10,000.00 KES
  metadata: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'sms_gateway' });

export class SmsPackage extends Model {
  public id!: string;
  public name!: string;
  public smsCount!: number;
  public sellingPrice!: number; // in cents
  public costPrice!: number;    // in cents (super admin only)
  public status!: 'ACTIVE' | 'INACTIVE';
  public description!: string | null;
  public isCustom!: boolean;
  public sortOrder!: number;
}
SmsPackage.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  smsCount: { type: DataTypes.INTEGER, allowNull: false },
  sellingPrice: { type: DataTypes.BIGINT, allowNull: false },
  costPrice: { type: DataTypes.BIGINT, defaultValue: 0 },
  status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
  description: { type: DataTypes.TEXT },
  isCustom: { type: DataTypes.BOOLEAN, defaultValue: false },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'sms_package' });

export class TenantSmsWallet extends Model {
  public id!: string;
  public tenantId!: string;
  public balance!: number;       // SMS credits remaining
  public usedCredits!: number;
  public purchasedCredits!: number;
  public lastPurchaseAt!: Date | null;
  public lastPurchasePackageId!: string | null;
  public lowBalanceThreshold!: number;
  public lowBalanceNotified!: boolean;
}
TenantSmsWallet.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, unique: true },
  balance: { type: DataTypes.INTEGER, defaultValue: 0 },
  usedCredits: { type: DataTypes.INTEGER, defaultValue: 0 },
  purchasedCredits: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastPurchaseAt: { type: DataTypes.DATE },
  lastPurchasePackageId: { type: DataTypes.UUID },
  lowBalanceThreshold: { type: DataTypes.INTEGER, defaultValue: 50 },
  lowBalanceNotified: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, modelName: 'tenant_sms_wallet' });

export class SmsTransaction extends Model {
  public id!: string;
  public tenantId!: string;
  public packageId!: string | null;
  public creditsAdded!: number;
  public amount!: number; // in cents
  public paymentMethod!: 'WALLET' | 'INTASEND' | 'MPESA';
  public paymentReference!: string | null;
  public idempotencyKey!: string | null;
  public status!: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  public invoiceNumber!: string | null;
  public metadata!: string | null;
  public completedAt!: Date | null;
  public failureReason!: string | null;
  // IntaSend tracking
  public intasendCheckoutId!: string | null;
  public intasendTrackingId!: string | null;
}
SmsTransaction.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  packageId: { type: DataTypes.UUID, allowNull: true },
  creditsAdded: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  paymentMethod: { type: DataTypes.ENUM('WALLET', 'INTASEND', 'MPESA'), allowNull: false },
  paymentReference: { type: DataTypes.STRING },
  idempotencyKey: { type: DataTypes.STRING, unique: true },
  status: { type: DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'), defaultValue: 'PENDING' },
  invoiceNumber: { type: DataTypes.STRING, unique: true },
  metadata: { type: DataTypes.TEXT },
  completedAt: { type: DataTypes.DATE },
  failureReason: { type: DataTypes.STRING },
  intasendCheckoutId: { type: DataTypes.STRING },
  intasendTrackingId: { type: DataTypes.STRING },
}, { sequelize, modelName: 'sms_transaction' });

export class SmsCampaignMessage extends Model {
  public id!: string;
  public campaignId!: string;
  public tenantId!: string;
  public phoneNumber!: string;
  public message!: string;
  public status!: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  public providerReference!: string | null;
  public retries!: number;
  public scheduledAt!: Date | null;
  public sentAt!: Date | null;
  public errorMessage!: string | null;
  public creditsCost!: number;
}
SmsCampaignMessage.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  phoneNumber: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED'), defaultValue: 'PENDING' },
  providerReference: { type: DataTypes.STRING },
  retries: { type: DataTypes.INTEGER, defaultValue: 0 },
  scheduledAt: { type: DataTypes.DATE },
  sentAt: { type: DataTypes.DATE },
  errorMessage: { type: DataTypes.TEXT },
  creditsCost: { type: DataTypes.INTEGER, defaultValue: 1 },
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
export class SmsFinancialLedger extends Model {
  public id!: string;
  public providerProcurementBalanceCents!: number;
  public reservedProfitBalanceCents!: number;
  public availableOperatingBalanceCents!: number;
  public smsInventoryBalanceCount!: number;
  public totalTenantRevenueCents!: number;
  public totalProcurementSpentCents!: number;
  public totalReservedProfitCents!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SmsFinancialLedger.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  providerProcurementBalanceCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  reservedProfitBalanceCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  availableOperatingBalanceCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  smsInventoryBalanceCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalTenantRevenueCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  totalProcurementSpentCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  totalReservedProfitCents: { type: DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize, modelName: 'sms_financial_ledger' });

export class SmsProcurementTask extends Model {
  public id!: string;
  public procurementNumber!: string;
  public tenantId!: string;
  public invoiceId!: string;
  public packageId!: string | null;
  public smsCount!: number;
  public amountPaidCents!: number;
  public providerCostCents!: number;
  public reservedProfitCents!: number;
  public executionMode!: 'API' | 'AUTOMATED_PROCUREMENT_SERVICE';
  public procurementStatus!: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFICATION_FAILED' | 'FAILED' | 'RETRYING';
  public providerReference!: string | null;
  public providerBalanceBeforeCents!: number;
  public providerBalanceAfterCents!: number;
  public procurementHash!: string;
  public failureReason!: string | null;
  public verifiedAt!: Date | null;
  public allocatedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SmsProcurementTask.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  procurementNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  invoiceId: { type: DataTypes.UUID, allowNull: false },
  packageId: { type: DataTypes.UUID, allowNull: true },
  smsCount: { type: DataTypes.INTEGER, allowNull: false },
  amountPaidCents: { type: DataTypes.BIGINT, allowNull: false },
  providerCostCents: { type: DataTypes.BIGINT, allowNull: false },
  reservedProfitCents: { type: DataTypes.BIGINT, allowNull: false },
  executionMode: {
    type: DataTypes.ENUM('API', 'AUTOMATED_PROCUREMENT_SERVICE'),
    defaultValue: 'API'
  },
  procurementStatus: {
    type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFICATION_FAILED', 'FAILED', 'RETRYING'),
    defaultValue: 'PENDING'
  },
  providerReference: { type: DataTypes.STRING },
  providerBalanceBeforeCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  providerBalanceAfterCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  procurementHash: { type: DataTypes.STRING, allowNull: false },
  failureReason: { type: DataTypes.TEXT },
  verifiedAt: { type: DataTypes.DATE },
  allocatedAt: { type: DataTypes.DATE }
}, { sequelize, modelName: 'sms_procurement_task' });

export class SmsLedgerTransaction extends Model {
  public id!: string;
  public procurementTaskId!: string | null;
  public tenantId!: string | null;
  public transactionType!: 'TENANT_PAYMENT' | 'PROFIT_RESERVED' | 'PROCUREMENT_DEBIT' | 'PROFIT_RELEASE' | 'PROCUREMENT_REFUND';
  public amountCents!: number;
  public providerProcurementBalanceAfterCents!: number;
  public reservedProfitBalanceAfterCents!: number;
  public notes!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SmsLedgerTransaction.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  procurementTaskId: { type: DataTypes.UUID },
  tenantId: { type: DataTypes.UUID },
  transactionType: {
    type: DataTypes.ENUM('TENANT_PAYMENT', 'PROFIT_RESERVED', 'PROCUREMENT_DEBIT', 'PROFIT_RELEASE', 'PROCUREMENT_REFUND'),
    allowNull: false
  },
  amountCents: { type: DataTypes.BIGINT, allowNull: false },
  providerProcurementBalanceAfterCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  reservedProfitBalanceAfterCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  notes: { type: DataTypes.TEXT }
}, { sequelize, modelName: 'sms_ledger_transaction' });

Tenant.hasMany(SmsProcurementTask, { foreignKey: 'tenantId' });
SmsProcurementTask.belongsTo(Tenant, { foreignKey: 'tenantId' });

SmsProcurementTask.hasMany(SmsLedgerTransaction, { foreignKey: 'procurementTaskId' });
SmsLedgerTransaction.belongsTo(SmsProcurementTask, { foreignKey: 'procurementTaskId' });

// ============================================================
// STAGING & TESTING ENVIRONMENT MODELS
// ============================================================

export class FeatureFlag extends Model {
  public id!: string;
  public key!: string;
  public description!: string | null;
  public isEnabledGlobal!: boolean;
  public isEnabledStaging!: boolean;
  public enabledTenants!: string | null; // JSON array of tenant IDs
  public enabledAdmins!: string | null;  // JSON array of user IDs
}
FeatureFlag.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  key: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.TEXT },
  isEnabledGlobal: { type: DataTypes.BOOLEAN, defaultValue: false },
  isEnabledStaging: { type: DataTypes.BOOLEAN, defaultValue: true },
  enabledTenants: { type: DataTypes.TEXT }, // JSON string
  enabledAdmins: { type: DataTypes.TEXT },  // JSON string
}, { sequelize, modelName: 'feature_flag' });

export class StagingErrorLog extends Model {
  public id!: string;
  public severity!: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  public source!: 'FRONTEND' | 'BACKEND' | 'API' | 'PAYMENT' | 'DATABASE' | 'ROUTER' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  public message!: string;
  public stackTrace!: string | null;
  public requestPath!: string | null;
  public userId!: string | null;
  public tenantId!: string | null;
  public suggestedFix!: string | null;
  public metadata!: string | null;
}
StagingErrorLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  severity: { type: DataTypes.ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL'), defaultValue: 'ERROR' },
  source: { type: DataTypes.ENUM('FRONTEND', 'BACKEND', 'API', 'PAYMENT', 'DATABASE', 'ROUTER', 'EMAIL', 'SMS', 'WHATSAPP'), defaultValue: 'BACKEND' },
  message: { type: DataTypes.TEXT, allowNull: false },
  stackTrace: { type: DataTypes.TEXT },
  requestPath: { type: DataTypes.STRING },
  userId: { type: DataTypes.UUID },
  tenantId: { type: DataTypes.UUID },
  suggestedFix: { type: DataTypes.TEXT },
  metadata: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'staging_error_log' });

export class SandboxMessageLog extends Model {
  public id!: string;
  public channel!: 'EMAIL' | 'SMS' | 'WHATSAPP';
  public recipient!: string;
  public subject!: string | null;
  public content!: string;
  public gateway!: string | null;
  public status!: 'CAPTURED' | 'SIMULATED' | 'FAILED';
  public cost!: number; // Simulated cost in cents
  public metadata!: string | null;
  public tenantId!: string | null;
}
SandboxMessageLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  channel: { type: DataTypes.ENUM('EMAIL', 'SMS', 'WHATSAPP'), allowNull: false },
  recipient: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING },
  content: { type: DataTypes.TEXT, allowNull: false },
  gateway: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('CAPTURED', 'SIMULATED', 'FAILED'), defaultValue: 'CAPTURED' },
  cost: { type: DataTypes.BIGINT, defaultValue: 0 },
  metadata: { type: DataTypes.TEXT },
  tenantId: { type: DataTypes.UUID },
}, { sequelize, modelName: 'sandbox_message_log' });

export class SandboxPaymentLog extends Model {
  public id!: string;
  public provider!: 'WALLET' | 'INTASEND' | 'MPESA';
  public transactionType!: 'PAYMENT' | 'REFUND' | 'CREDIT_PURCHASE';
  public reference!: string;
  public amount!: number; // in cents
  public phoneNumber!: string | null;
  public status!: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'DUPLICATE';
  public failureReason!: string | null;
  public retryCount!: number;
  public tenantId!: string;
  public metadata!: string | null;
}
SandboxPaymentLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  provider: { type: DataTypes.ENUM('WALLET', 'INTASEND', 'MPESA'), allowNull: false },
  transactionType: { type: DataTypes.ENUM('PAYMENT', 'REFUND', 'CREDIT_PURCHASE'), defaultValue: 'PAYMENT' },
  reference: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  phoneNumber: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('SUCCESS', 'FAILED', 'TIMEOUT', 'DUPLICATE'), defaultValue: 'SUCCESS' },
  failureReason: { type: DataTypes.STRING },
  retryCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  metadata: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'sandbox_payment_log' });

export class TestAccountSeed extends Model {
  public id!: string;
  public role!: 'SUPER_ADMIN' | 'TENANT' | 'STAFF' | 'AGENT' | 'CUSTOMER';
  public email!: string;
  public phoneNumber!: string | null;
  public tenantId!: string | null;
  public description!: string;
}
TestAccountSeed.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  role: { type: DataTypes.ENUM('SUPER_ADMIN', 'TENANT', 'STAFF', 'AGENT', 'CUSTOMER'), allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  phoneNumber: { type: DataTypes.STRING },
  tenantId: { type: DataTypes.UUID },
  description: { type: DataTypes.STRING, allowNull: false },
}, { sequelize, modelName: 'test_account_seed' });

// Profile & Account Management Models
export class TenantDocument extends Model {
  public id!: string;
  public tenantId!: string;
  public docType!: 'BUSINESS_CERT' | 'TAX_PIN_CERT' | 'NATIONAL_ID' | 'BANK_LETTER' | 'UTILITY_BILL';
  public fileName!: string;
  public fileUrl!: string;
  public fileType!: string;
  public fileSize!: number;
  public status!: 'PENDING' | 'VERIFIED' | 'REJECTED';
  public notes!: string | null;
}
TenantDocument.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  docType: { type: DataTypes.ENUM('BUSINESS_CERT', 'TAX_PIN_CERT', 'NATIONAL_ID', 'BANK_LETTER', 'UTILITY_BILL'), allowNull: false },
  fileName: { type: DataTypes.STRING, allowNull: false },
  fileUrl: { type: DataTypes.TEXT, allowNull: false },
  fileType: { type: DataTypes.STRING, allowNull: false },
  fileSize: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'), defaultValue: 'PENDING' },
  notes: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'tenant_document' });

export class TenantWithdrawal extends Model {
  public id!: string;
  public tenantId!: string;
  public amount!: number; // stored in cents (e.g. 10000 = KES 100.00)
  public method!: 'MPESA' | 'BANK';
  public recipientDetails!: string; // JSON: name, phone, bankName, accountNumber, branch, etc.
  public status!: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  public referenceId!: string | null;
  public failureReason!: string | null;
  public requestedBy!: string | null;
  public requestedAt!: Date;
  public completedAt!: Date | null;
}
TenantWithdrawal.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  method: { type: DataTypes.ENUM('MPESA', 'BANK'), defaultValue: 'MPESA' },
  recipientDetails: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REJECTED'), defaultValue: 'PENDING' },
  referenceId: { type: DataTypes.STRING },
  failureReason: { type: DataTypes.TEXT },
  requestedBy: { type: DataTypes.UUID },
  requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  completedAt: { type: DataTypes.DATE },
}, { sequelize, modelName: 'tenant_withdrawal' });

Tenant.hasMany(TenantDocument, { foreignKey: 'tenantId' });
TenantDocument.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(TenantWithdrawal, { foreignKey: 'tenantId' });
TenantWithdrawal.belongsTo(Tenant, { foreignKey: 'tenantId' });

// ─────────────────────────────────────────────────────────────────
// CAPTIVE PORTAL ADVERTISING & MARKETING PLATFORM MODELS
// ─────────────────────────────────────────────────────────────────

export class AdCampaign extends Model {
  public id!: string;
  public tenantId!: string;
  public name!: string;
  public description!: string | null;
  public campaignType!: 'IMAGE_BANNER' | 'VIDEO_AD' | 'CAROUSEL' | 'POPUP' | 'FULLSCREEN_SPLASH' | 'HTML_AD' | 'GIF_AD' | 'TEXT_ANNOUNCEMENT' | 'SCROLLING_MARQUEE' | 'COUPON_CARD' | 'QR_PROMOTION' | 'COUNTDOWN_PROMOTION';
  public mediaUrls!: string | null; // JSON array of string URLs
  public headline!: string | null;
  public subheading!: string | null;
  public buttonText!: string | null;
  public destinationUrl!: string | null;
  public whatsappLink!: string | null;
  public facebookLink!: string | null;
  public instagramLink!: string | null;
  public tiktokLink!: string | null;
  public emailLink!: string | null;
  public ctaType!: 'VISIT_WEBSITE' | 'BUY_NOW' | 'CALL_NOW' | 'WHATSAPP' | 'MESSENGER' | 'DOWNLOAD_APP' | 'LEARN_MORE' | 'REDEEM_COUPON' | 'OPEN_MAPS';
  public priority!: number;
  public status!: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'EXPIRED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  public budget!: number; // stored in cents/smallest currency unit
  public spentBudget!: number;
  public displayRules!: string | null; // JSON array: BEFORE_LOGIN, AFTER_LOGIN, DURING_SESSION, LOGOUT, WELCOME, VOUCHER_SUCCESS, PACKAGE_PURCHASE, PAYMENT_SUCCESS
  public startDate!: Date | null;
  public endDate!: Date | null;
  public startTime!: string | null;
  public endTime!: string | null;
  public daysOfWeek!: string | null; // JSON array e.g. ["MON", "TUE"]
  public isRecurring!: boolean;
  public targeting!: string | null; // JSON object: routerIds, locationNames, branchIds, packageIds, subscriberGroups, customerTypes, deviceTypes, OS, browsers, languages, countries, timeOfDay
  public rotationType!: 'SINGLE' | 'RANDOM' | 'PRIORITY' | 'WEIGHTED' | 'SEQUENTIAL';
  public weight!: number;
  public abTestEnabled!: boolean;
  public abVariant!: string | null;
  public abSiblingId!: string | null;
  public marketingTrigger!: string | null; // JSON object: triggers for automated campaigns
  public approvalStatus!: 'PENDING' | 'APPROVED' | 'REJECTED';
  public approvedBy!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

AdCampaign.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  campaignType: {
    type: DataTypes.ENUM(
      'IMAGE_BANNER', 'VIDEO_AD', 'CAROUSEL', 'POPUP', 'FULLSCREEN_SPLASH',
      'HTML_AD', 'GIF_AD', 'TEXT_ANNOUNCEMENT', 'SCROLLING_MARQUEE', 'COUPON_CARD',
      'QR_PROMOTION', 'COUNTDOWN_PROMOTION'
    ),
    defaultValue: 'IMAGE_BANNER'
  },
  mediaUrls: { type: DataTypes.TEXT },
  headline: { type: DataTypes.STRING },
  subheading: { type: DataTypes.STRING },
  buttonText: { type: DataTypes.STRING, defaultValue: 'Learn More' },
  destinationUrl: { type: DataTypes.TEXT },
  whatsappLink: { type: DataTypes.TEXT },
  facebookLink: { type: DataTypes.TEXT },
  instagramLink: { type: DataTypes.TEXT },
  tiktokLink: { type: DataTypes.TEXT },
  emailLink: { type: DataTypes.TEXT },
  ctaType: {
    type: DataTypes.ENUM(
      'VISIT_WEBSITE', 'BUY_NOW', 'CALL_NOW', 'WHATSAPP', 'MESSENGER',
      'DOWNLOAD_APP', 'LEARN_MORE', 'REDEEM_COUPON', 'OPEN_MAPS'
    ),
    defaultValue: 'LEARN_MORE'
  },
  priority: { type: DataTypes.INTEGER, defaultValue: 1 },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'EXPIRED', 'APPROVED', 'REJECTED', 'SUSPENDED'),
    defaultValue: 'RUNNING'
  },
  budget: { type: DataTypes.BIGINT, defaultValue: 0 },
  spentBudget: { type: DataTypes.BIGINT, defaultValue: 0 },
  displayRules: { type: DataTypes.TEXT },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  startTime: { type: DataTypes.STRING },
  endTime: { type: DataTypes.STRING },
  daysOfWeek: { type: DataTypes.TEXT },
  isRecurring: { type: DataTypes.BOOLEAN, defaultValue: false },
  targeting: { type: DataTypes.TEXT },
  rotationType: {
    type: DataTypes.ENUM('SINGLE', 'RANDOM', 'PRIORITY', 'WEIGHTED', 'SEQUENTIAL'),
    defaultValue: 'PRIORITY'
  },
  weight: { type: DataTypes.FLOAT, defaultValue: 1.0 },
  abTestEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  abVariant: { type: DataTypes.STRING },
  abSiblingId: { type: DataTypes.UUID },
  marketingTrigger: { type: DataTypes.TEXT },
  approvalStatus: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    defaultValue: 'APPROVED'
  },
  approvedBy: { type: DataTypes.UUID },
}, { sequelize, modelName: 'ad_campaign' });

export class MediaItem extends Model {
  public id!: string;
  public tenantId!: string;
  public fileName!: string;
  public fileUrl!: string;
  public fileType!: 'IMAGE' | 'VIDEO' | 'GIF' | 'PDF' | 'LOGO' | 'ICON';
  public fileSize!: number;
  public mimeType!: string;
  public dimensions!: string | null;
  public duration!: number | null;
  public thumbnailUrl!: string | null;
  public metadata!: string | null;
}

MediaItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  fileName: { type: DataTypes.STRING, allowNull: false },
  fileUrl: { type: DataTypes.TEXT, allowNull: false },
  fileType: { type: DataTypes.ENUM('IMAGE', 'VIDEO', 'GIF', 'PDF', 'LOGO', 'ICON'), defaultValue: 'IMAGE' },
  fileSize: { type: DataTypes.INTEGER, defaultValue: 0 },
  mimeType: { type: DataTypes.STRING },
  dimensions: { type: DataTypes.STRING },
  duration: { type: DataTypes.INTEGER, defaultValue: 0 },
  thumbnailUrl: { type: DataTypes.TEXT },
  metadata: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'media_item' });

export class MarketingCoupon extends Model {
  public id!: string;
  public tenantId!: string;
  public campaignId!: string | null;
  public couponCode!: string;
  public discountType!: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_PACKAGE';
  public discountValue!: number;
  public validityDays!: number;
  public maxUses!: number;
  public currentUses!: number;
  public expirationDate!: Date | null;
  public applicablePackageIds!: string | null; // JSON array
  public qrCodeUrl!: string | null;
  public status!: 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED';
}

MarketingCoupon.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  campaignId: { type: DataTypes.UUID },
  couponCode: { type: DataTypes.STRING, allowNull: false },
  discountType: { type: DataTypes.ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_PACKAGE'), defaultValue: 'PERCENTAGE' },
  discountValue: { type: DataTypes.BIGINT, defaultValue: 0 },
  validityDays: { type: DataTypes.INTEGER, defaultValue: 30 },
  maxUses: { type: DataTypes.INTEGER, defaultValue: 100 },
  currentUses: { type: DataTypes.INTEGER, defaultValue: 0 },
  expirationDate: { type: DataTypes.DATE },
  applicablePackageIds: { type: DataTypes.TEXT },
  qrCodeUrl: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('ACTIVE', 'EXPIRED', 'EXHAUSTED'), defaultValue: 'ACTIVE' },
}, { sequelize, modelName: 'marketing_coupon' });

export class QRCampaign extends Model {
  public id!: string;
  public tenantId!: string;
  public title!: string;
  public destinationType!: 'WEBSITE' | 'PACKAGE_PURCHASE' | 'WHATSAPP' | 'PAYMENT' | 'LOCATION' | 'PROMOTION';
  public targetUrl!: string;
  public qrCodeUrl!: string;
  public scansCount!: number;
}

QRCampaign.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  destinationType: {
    type: DataTypes.ENUM('WEBSITE', 'PACKAGE_PURCHASE', 'WHATSAPP', 'PAYMENT', 'LOCATION', 'PROMOTION'),
    defaultValue: 'WEBSITE'
  },
  targetUrl: { type: DataTypes.TEXT, allowNull: false },
  qrCodeUrl: { type: DataTypes.TEXT, allowNull: false },
  scansCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'qr_campaign' });

export class MarketingLandingPage extends Model {
  public id!: string;
  public tenantId!: string;
  public slug!: string;
  public title!: string;
  public logoUrl!: string | null;
  public bannerUrl!: string | null;
  public videoUrl!: string | null;
  public headline!: string | null;
  public bodyContent!: string | null;
  public ctaButtonText!: string | null;
  public ctaUrl!: string | null;
  public contactInfo!: string | null; // JSON
  public mapEmbedUrl!: string | null;
  public countdownEndDate!: Date | null;
  public testimonials!: string | null; // JSON array
  public status!: 'DRAFT' | 'PUBLISHED';
  public publishedAt!: Date | null;
}

MarketingLandingPage.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  logoUrl: { type: DataTypes.TEXT },
  bannerUrl: { type: DataTypes.TEXT },
  videoUrl: { type: DataTypes.TEXT },
  headline: { type: DataTypes.STRING },
  bodyContent: { type: DataTypes.TEXT },
  ctaButtonText: { type: DataTypes.STRING, defaultValue: 'Get Started' },
  ctaUrl: { type: DataTypes.TEXT },
  contactInfo: { type: DataTypes.TEXT },
  mapEmbedUrl: { type: DataTypes.TEXT },
  countdownEndDate: { type: DataTypes.DATE },
  testimonials: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('DRAFT', 'PUBLISHED'), defaultValue: 'DRAFT' },
  publishedAt: { type: DataTypes.DATE },
}, { sequelize, modelName: 'marketing_landing_page' });

export class AdAnalytic extends Model {
  public id!: string;
  public tenantId!: string;
  public campaignId!: string;
  public eventType!: 'IMPRESSION' | 'VIEW' | 'UNIQUE_VIEW' | 'CLICK' | 'VIDEO_COMPLETE' | 'CONVERSION';
  public revenue!: number; // stored in cents
  public deviceType!: string | null;
  public browser!: string | null;
  public os!: string | null;
  public country!: string | null;
  public city!: string | null;
  public routerId!: string | null;
  public packageId!: string | null;
  public sessionDuration!: number;
  public ipAddress!: string | null;
  public macAddress!: string | null;
}

AdAnalytic.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  eventType: {
    type: DataTypes.ENUM('IMPRESSION', 'VIEW', 'UNIQUE_VIEW', 'CLICK', 'VIDEO_COMPLETE', 'CONVERSION'),
    allowNull: false
  },
  revenue: { type: DataTypes.BIGINT, defaultValue: 0 },
  deviceType: { type: DataTypes.STRING },
  browser: { type: DataTypes.STRING },
  os: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  routerId: { type: DataTypes.UUID },
  packageId: { type: DataTypes.UUID },
  sessionDuration: { type: DataTypes.INTEGER, defaultValue: 0 },
  ipAddress: { type: DataTypes.STRING },
  macAddress: { type: DataTypes.STRING },
}, { sequelize, modelName: 'ad_analytic' });

export class CustomerSegment extends Model {
  public id!: string;
  public tenantId!: string;
  public name!: string;
  public description!: string | null;
  public rules!: string | null; // JSON object: criteria
  public memberCount!: number;
}

CustomerSegment.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  rules: { type: DataTypes.TEXT },
  memberCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, modelName: 'customer_segment' });

export class MarketingSetting extends Model {
  public id!: string;
  public tenantId!: string;
  public maxUploadSizeBytes!: number;
  public supportedFormats!: string | null; // JSON array
  public defaultImpressionsLimit!: number;
  public autoApproveAds!: boolean;
  public moduleEnabled!: boolean;
}

MarketingSetting.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  maxUploadSizeBytes: { type: DataTypes.BIGINT, defaultValue: 52428800 }, // 50MB
  supportedFormats: { type: DataTypes.TEXT, defaultValue: JSON.stringify(['jpg', 'png', 'gif', 'mp4', 'pdf', 'webp']) },
  defaultImpressionsLimit: { type: DataTypes.INTEGER, defaultValue: 50000 },
  autoApproveAds: { type: DataTypes.BOOLEAN, defaultValue: true },
  moduleEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
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

export class SubscriptionPlan extends Model {
  public id!: string;
  public name!: string;
  public slug!: string;
  public description!: string;
  public monthlyPriceCents!: number; // e.g. 150000 = KSh 1,500
  public yearlyPriceCents!: number; // e.g. 1500000 = KSh 15,000
  public maxActiveUsers!: number; // -1 for unlimited
  public maxRouters!: number;
  public maxStaff!: number;
  public maxSMS!: number;
  public maxWhatsapp!: number;
  public maxCampaigns!: number;
  public maxAdvertisements!: number;
  public maxBranches!: number;
  public maxIntegrations!: number;
  public storageLimitMB!: number;
  public apiAccess!: boolean;
  public marketingFeatures!: boolean;
  public analyticsFeatures!: boolean;
  public whiteLabelFeatures!: boolean;
  public multiBranchFeatures!: boolean;
  public customIntegrations!: boolean;
  public supportLevel!: 'COMMUNITY' | 'STANDARD' | 'PRIORITY' | 'DEDICATED';
  public isPopular!: boolean;
  public isActive!: boolean;
}

SubscriptionPlan.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  monthlyPriceCents: { type: DataTypes.BIGINT, defaultValue: 150000 },
  yearlyPriceCents: { type: DataTypes.BIGINT, defaultValue: 1500000 },
  maxActiveUsers: { type: DataTypes.INTEGER, defaultValue: 500 },
  maxRouters: { type: DataTypes.INTEGER, defaultValue: 5 },
  maxStaff: { type: DataTypes.INTEGER, defaultValue: 3 },
  maxSMS: { type: DataTypes.INTEGER, defaultValue: 200 },
  maxWhatsapp: { type: DataTypes.INTEGER, defaultValue: 0 },
  maxCampaigns: { type: DataTypes.INTEGER, defaultValue: 2 },
  maxAdvertisements: { type: DataTypes.INTEGER, defaultValue: 5 },
  maxBranches: { type: DataTypes.INTEGER, defaultValue: 1 },
  maxIntegrations: { type: DataTypes.INTEGER, defaultValue: 0 },
  storageLimitMB: { type: DataTypes.INTEGER, defaultValue: 1024 },
  apiAccess: { type: DataTypes.BOOLEAN, defaultValue: false },
  marketingFeatures: { type: DataTypes.BOOLEAN, defaultValue: true },
  analyticsFeatures: { type: DataTypes.BOOLEAN, defaultValue: true },
  whiteLabelFeatures: { type: DataTypes.BOOLEAN, defaultValue: false },
  multiBranchFeatures: { type: DataTypes.BOOLEAN, defaultValue: false },
  customIntegrations: { type: DataTypes.BOOLEAN, defaultValue: false },
  supportLevel: { type: DataTypes.ENUM('COMMUNITY', 'STANDARD', 'PRIORITY', 'DEDICATED'), defaultValue: 'STANDARD' },
  isPopular: { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'subscription_plan' });

export class PlatformPricingConfig extends Model {
  public id!: string;
  public baseSubscriptionPriceCents!: number; // Default 150000 = KSh 1,500
  public includedActiveUsers!: number;
  public extraActiveUserPriceCents!: number;
  public adMonthlyFeeCents!: number;
  public adCampaignFeeCents!: number;
  public adVideoFeeCents!: number;
  public adBannerFeeCents!: number;
  public adStorageFeeCents!: number;
  public smsPriceCents!: number;
  public emailPriceCents!: number;
  public whatsappPriceCents!: number;
  public extraRouterPriceCents!: number;
  public vatPercentage!: number;
  public gracePeriodDays!: number;
  public trialPeriodDays!: number;
  public latePaymentFeeCents!: number;
  public subscriptionTillNumber!: string | null;
}

PlatformPricingConfig.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  baseSubscriptionPriceCents: { type: DataTypes.BIGINT, defaultValue: 150000 }, // KSh 1,500
  includedActiveUsers: { type: DataTypes.INTEGER, defaultValue: 100 },
  extraActiveUserPriceCents: { type: DataTypes.BIGINT, defaultValue: 1500 }, // KSh 15
  adMonthlyFeeCents: { type: DataTypes.BIGINT, defaultValue: 500000 }, // KSh 5,000
  adCampaignFeeCents: { type: DataTypes.BIGINT, defaultValue: 100000 }, // KSh 1,000
  adVideoFeeCents: { type: DataTypes.BIGINT, defaultValue: 200000 }, // KSh 2,000
  adBannerFeeCents: { type: DataTypes.BIGINT, defaultValue: 50000 }, // KSh 500
  adStorageFeeCents: { type: DataTypes.BIGINT, defaultValue: 50000 }, // KSh 500 per GB
  smsPriceCents: { type: DataTypes.BIGINT, defaultValue: 200 }, // KSh 2.00
  emailPriceCents: { type: DataTypes.BIGINT, defaultValue: 50 }, // KSh 0.50
  whatsappPriceCents: { type: DataTypes.BIGINT, defaultValue: 300 }, // KSh 3.00
  extraRouterPriceCents: { type: DataTypes.BIGINT, defaultValue: 100000 }, // KSh 1,000
  vatPercentage: { type: DataTypes.FLOAT, defaultValue: 16.0 },
  gracePeriodDays: { type: DataTypes.INTEGER, defaultValue: 7 },
  trialPeriodDays: { type: DataTypes.INTEGER, defaultValue: 14 },
  latePaymentFeeCents: { type: DataTypes.BIGINT, defaultValue: 50000 }, // KSh 500
  subscriptionTillNumber: { type: DataTypes.STRING },
}, { sequelize, modelName: 'platform_pricing_config' });

export class TenantSubscription extends Model {
  public id!: string;
  public tenantId!: string;
  public planId!: string;
  public status!: 'FREE_TRIAL' | 'PENDING_PAYMENT' | 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED' | 'ARCHIVED' | 'TRIAL' | 'OVERDUE';
  public billingCycle!: 'MONTHLY' | 'YEARLY';
  public startDate!: Date;
  public currentPeriodStart!: Date;
  public currentPeriodEnd!: Date;
  public gracePeriodEndDate!: Date | null;
  public cancelledAt!: Date | null;
  public trialEndDate!: Date | null;
  public autoRenew!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public SubscriptionPlan?: SubscriptionPlan;
}

TenantSubscription.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  planId: { type: DataTypes.UUID, allowNull: false },
  status: {
    type: DataTypes.ENUM('FREE_TRIAL', 'PENDING_PAYMENT', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED', 'ARCHIVED', 'TRIAL', 'OVERDUE'),
    defaultValue: 'FREE_TRIAL'
  },
  billingCycle: { type: DataTypes.ENUM('MONTHLY', 'YEARLY'), defaultValue: 'MONTHLY' },
  startDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  currentPeriodStart: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  currentPeriodEnd: { type: DataTypes.DATE },
  gracePeriodEndDate: { type: DataTypes.DATE },
  cancelledAt: { type: DataTypes.DATE },
  trialEndDate: { type: DataTypes.DATE },
  autoRenew: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'tenant_subscription' });

export class TrialAgreement extends Model {
  public id!: string;
  public tenantId!: string;
  public businessName!: string;
  public ownerName!: string;
  public phone!: string;
  public email!: string;
  public businessLocation!: string;
  public expectedSubscriberCount!: number;
  public expectedRouterCount!: number;
  public termsAccepted!: boolean;
  public trialAgreementAccepted!: boolean;
  public agreedAt!: Date;
  public agreedIp!: string;
  public agreedUserAgent!: string;
  public agreedTextHash!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TrialAgreement.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  businessName: { type: DataTypes.STRING, allowNull: false },
  ownerName: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  businessLocation: { type: DataTypes.STRING, allowNull: false },
  expectedSubscriberCount: { type: DataTypes.INTEGER, defaultValue: 50 },
  expectedRouterCount: { type: DataTypes.INTEGER, defaultValue: 2 },
  termsAccepted: { type: DataTypes.BOOLEAN, defaultValue: true },
  trialAgreementAccepted: { type: DataTypes.BOOLEAN, defaultValue: true },
  agreedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  agreedIp: { type: DataTypes.STRING, allowNull: false },
  agreedUserAgent: { type: DataTypes.STRING, allowNull: false },
  agreedTextHash: { type: DataTypes.STRING, allowNull: false },
}, { sequelize, modelName: 'trial_agreement' });

export class FeatureViolationLog extends Model {
  public id!: string;
  public tenantId!: string;
  public featureOrLimitKey!: string;
  public attemptedAction!: string;
  public currentUsage!: number;
  public allowedLimit!: number;
  public subscriptionStatus!: string;
  public requestIp!: string;
  public userAgent!: string;
  public readonly createdAt!: Date;
}

FeatureViolationLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  featureOrLimitKey: { type: DataTypes.STRING, allowNull: false },
  attemptedAction: { type: DataTypes.STRING, allowNull: false },
  currentUsage: { type: DataTypes.INTEGER, defaultValue: 0 },
  allowedLimit: { type: DataTypes.INTEGER, defaultValue: 0 },
  subscriptionStatus: { type: DataTypes.STRING, allowNull: false },
  requestIp: { type: DataTypes.STRING },
  userAgent: { type: DataTypes.STRING },
}, { sequelize, modelName: 'feature_violation_log' });

export class TenantCaptivePortalBranding extends Model {
  public id!: string;
  public tenantId!: string;
  public businessName!: string | null;
  public tagline!: string | null;
  public description!: string | null;
  public supportPhone!: string | null;
  public supportEmail!: string | null;
  public whatsappNumber!: string | null;
  public websiteUrl!: string | null;
  public physicalAddress!: string | null;
  public socialLinks!: string | null; // JSON
  public primaryLogoUrl!: string | null;
  public mobileLogoUrl!: string | null;
  public darkModeLogoUrl!: string | null;
  public lightModeLogoUrl!: string | null;
  public faviconUrl!: string | null;
  public footerLogoUrl!: string | null;
  public loginLogoUrl!: string | null;
  public welcomeScreenLogoUrl!: string | null;
  public primaryColor!: string;
  public secondaryColor!: string;
  public accentColor!: string;
  public buttonColor!: string;
  public navColor!: string;
  public backgroundColor!: string;
  public footerColor!: string;
  public textColor!: string;
  public linkColor!: string;
  public welcomeMessage!: string | null;
  public headline!: string | null;
  public subheadline!: string | null;
  public termsConditions!: string | null;
  public privacyNotice!: string | null;
  public supportInfo!: string | null;
  public footerText!: string | null;
  public copyrightText!: string | null;
  public loginInstructions!: string | null;
  public paymentInstructions!: string | null;
  public voucherInstructions!: string | null;
  public backgroundType!: 'IMAGE' | 'VIDEO' | 'GRADIENT' | 'SOLID';
  public backgroundUrl!: string | null;
  public backgroundVideoUrl!: string | null;
  public gradientStartColor!: string | null;
  public gradientEndColor!: string | null;
  public backgroundBlur!: number;
  public backgroundOverlayOpacity!: number;
  public mobileBackgroundUrl!: string | null;
  public customDomain!: string | null;
  public landingHeroTitle!: string | null;
  public landingHeroSubtitle!: string | null;
  public showLandingHero!: boolean;
  public packageCardLayout!: 'GRID_2COL' | 'GRID_3COL' | 'VERTICAL_LIST' | 'COMPACT_TILES' | 'HORIZONTAL_SCROLL';
  public packageCardStyle!: 'GLASS' | 'SOLID' | 'OUTLINE' | 'GRADIENT_ACCENT';
  public showPackageBadges!: boolean;
  public showSpeedBadges!: boolean;
  public pinnedPackageIds!: string | null; // JSON Array
  public featuredPackageId!: string | null;
  public showPromotions!: boolean;
  public isApproved!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TenantCaptivePortalBranding.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false, unique: true },
  businessName: { type: DataTypes.STRING },
  tagline: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  supportPhone: { type: DataTypes.STRING },
  supportEmail: { type: DataTypes.STRING },
  whatsappNumber: { type: DataTypes.STRING },
  websiteUrl: { type: DataTypes.STRING },
  physicalAddress: { type: DataTypes.TEXT },
  socialLinks: { type: DataTypes.TEXT },
  primaryLogoUrl: { type: DataTypes.TEXT },
  mobileLogoUrl: { type: DataTypes.TEXT },
  darkModeLogoUrl: { type: DataTypes.TEXT },
  lightModeLogoUrl: { type: DataTypes.TEXT },
  faviconUrl: { type: DataTypes.TEXT },
  footerLogoUrl: { type: DataTypes.TEXT },
  loginLogoUrl: { type: DataTypes.TEXT },
  welcomeScreenLogoUrl: { type: DataTypes.TEXT },
  primaryColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  secondaryColor: { type: DataTypes.STRING, defaultValue: '#0f172a' },
  accentColor: { type: DataTypes.STRING, defaultValue: '#38bdf8' },
  buttonColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  navColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  backgroundColor: { type: DataTypes.STRING, defaultValue: '#0f172a' },
  footerColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  textColor: { type: DataTypes.STRING, defaultValue: '#ffffff' },
  linkColor: { type: DataTypes.STRING, defaultValue: '#38bdf8' },
  welcomeMessage: { type: DataTypes.TEXT },
  headline: { type: DataTypes.STRING },
  subheadline: { type: DataTypes.STRING },
  termsConditions: { type: DataTypes.TEXT },
  privacyNotice: { type: DataTypes.TEXT },
  supportInfo: { type: DataTypes.TEXT },
  footerText: { type: DataTypes.TEXT },
  copyrightText: { type: DataTypes.STRING },
  loginInstructions: { type: DataTypes.TEXT },
  paymentInstructions: { type: DataTypes.TEXT },
  voucherInstructions: { type: DataTypes.TEXT },
  backgroundType: { type: DataTypes.ENUM('IMAGE', 'VIDEO', 'GRADIENT', 'SOLID'), defaultValue: 'GRADIENT' },
  backgroundUrl: { type: DataTypes.TEXT },
  backgroundVideoUrl: { type: DataTypes.TEXT },
  gradientStartColor: { type: DataTypes.STRING, defaultValue: '#0f172a' },
  gradientEndColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  backgroundBlur: { type: DataTypes.INTEGER, defaultValue: 0 },
  backgroundOverlayOpacity: { type: DataTypes.FLOAT, defaultValue: 0.2 },
  mobileBackgroundUrl: { type: DataTypes.TEXT },
  customDomain: { type: DataTypes.STRING },
  landingHeroTitle: { type: DataTypes.STRING },
  landingHeroSubtitle: { type: DataTypes.TEXT },
  showLandingHero: { type: DataTypes.BOOLEAN, defaultValue: true },
  packageCardLayout: { type: DataTypes.ENUM('GRID_2COL', 'GRID_3COL', 'VERTICAL_LIST', 'COMPACT_TILES', 'HORIZONTAL_SCROLL'), defaultValue: 'GRID_2COL' },
  packageCardStyle: { type: DataTypes.ENUM('GLASS', 'SOLID', 'OUTLINE', 'GRADIENT_ACCENT'), defaultValue: 'GLASS' },
  showPackageBadges: { type: DataTypes.BOOLEAN, defaultValue: true },
  showSpeedBadges: { type: DataTypes.BOOLEAN, defaultValue: true },
  pinnedPackageIds: { type: DataTypes.TEXT },
  featuredPackageId: { type: DataTypes.STRING },
  showPromotions: { type: DataTypes.BOOLEAN, defaultValue: true },
  isApproved: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'tenant_captive_portal_branding' });

export class TenantAddonModule extends Model {
  public id!: string;
  public tenantId!: string;
  public moduleName!: 'ADVERTISING' | 'SMS' | 'WHATSAPP' | 'EMAIL' | 'ADVANCED_ANALYTICS' | 'API_ACCESS' | 'WHITE_LABEL' | 'EXTRA_ROUTERS' | 'CUSTOM_DOMAINS' | 'BACKUPS';
  public monthlyPriceCents!: number;
  public yearlyPriceCents!: number;
  public status!: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'DISABLED';
  public trialEndsAt!: Date | null;
}

TenantAddonModule.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  moduleName: {
    type: DataTypes.ENUM('ADVERTISING', 'SMS', 'WHATSAPP', 'EMAIL', 'ADVANCED_ANALYTICS', 'API_ACCESS', 'WHITE_LABEL', 'EXTRA_ROUTERS', 'CUSTOM_DOMAINS', 'BACKUPS'),
    allowNull: false
  },
  monthlyPriceCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  yearlyPriceCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  status: { type: DataTypes.ENUM('ACTIVE', 'TRIAL', 'EXPIRED', 'DISABLED'), defaultValue: 'ACTIVE' },
  trialEndsAt: { type: DataTypes.DATE },
}, { sequelize, modelName: 'tenant_addon_module' });

export class SaaSInvoice extends Model {
  public id!: string;
  public tenantId!: string;
  public invoiceNumber!: string;
  public billingPeriodStart!: Date;
  public billingPeriodEnd!: Date;
  public dueDate!: Date;
  public subscriptionAmountCents!: number;
  public usageAmountCents!: number;
  public adAmountCents!: number;
  public smsAmountCents!: number;
  public emailAmountCents!: number;
  public whatsappAmountCents!: number;
  public extraRoutersAmountCents!: number;
  public addonAmountCents!: number;
  public taxAmountCents!: number;
  public discountAmountCents!: number;
  public lateFeeCents!: number;
  public totalAmountCents!: number;
  public paymentStatus!: 'UNPAID' | 'PAID' | 'OVERDUE' | 'FAILED' | 'CANCELLED';
  public paidAt!: Date | null;
  public paymentMethod!: string | null;
  public paymentReference!: string | null;
  public intasendCheckoutUrl!: string | null;
  public invoicePdfUrl!: string | null;
  public metadata!: string | null;
  public subtotalCents!: number;
  public taxCents!: number;
}

SaaSInvoice.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  invoiceNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  billingPeriodStart: { type: DataTypes.DATE, allowNull: false },
  billingPeriodEnd: { type: DataTypes.DATE, allowNull: false },
  dueDate: { type: DataTypes.DATE, allowNull: false },
  subscriptionAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  usageAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  adAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  smsAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  emailAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  whatsappAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  extraRoutersAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  addonAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  taxAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  discountAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  lateFeeCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  totalAmountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  subtotalCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  taxCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  paymentStatus: {
    type: DataTypes.ENUM('UNPAID', 'PAID', 'OVERDUE', 'FAILED', 'CANCELLED'),
    defaultValue: 'UNPAID'
  },
  paidAt: { type: DataTypes.DATE },
  paymentMethod: { type: DataTypes.STRING },
  paymentReference: { type: DataTypes.STRING },
  intasendCheckoutUrl: { type: DataTypes.TEXT },
  invoicePdfUrl: { type: DataTypes.TEXT },
  metadata: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'saas_invoice' });

export class SaaSInvoiceItem extends Model {
  public id!: string;
  public invoiceId!: string;
  public description!: string;
  public category!: 'SUBSCRIPTION' | 'USAGE' | 'ADVERTISING' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'ADDON' | 'TAX' | 'DISCOUNT' | 'LATE_FEE';
  public quantity!: number;
  public unitPriceCents!: number;
  public totalPriceCents!: number;
}

SaaSInvoiceItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  invoiceId: { type: DataTypes.UUID, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  category: {
    type: DataTypes.ENUM('SUBSCRIPTION', 'USAGE', 'ADVERTISING', 'SMS', 'EMAIL', 'WHATSAPP', 'ADDON', 'TAX', 'DISCOUNT', 'LATE_FEE'),
    allowNull: false
  },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  unitPriceCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  totalPriceCents: { type: DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize, modelName: 'saas_invoice_item' });

export class SaaSPayment extends Model {
  public id!: string;
  public tenantId!: string;
  public invoiceId!: string;
  public amountCents!: number;
  public gateway!: 'INTASEND' | 'MPESA' | 'WALLET';
  public transactionReference!: string;
  public rawPayload!: string | null; // JSON
  public status!: 'PENDING' | 'SUCCESS' | 'FAILED';
}

SaaSPayment.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  invoiceId: { type: DataTypes.UUID, allowNull: false },
  amountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  gateway: { type: DataTypes.ENUM('INTASEND', 'MPESA', 'WALLET'), defaultValue: 'INTASEND' },
  transactionReference: { type: DataTypes.STRING, allowNull: false, unique: true },
  rawPayload: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'), defaultValue: 'SUCCESS' },
}, { sequelize, modelName: 'saas_payment' });

export class SaaSNotification extends Model {
  public id!: string;
  public tenantId!: string;
  public type!: 'INVOICE_CREATED' | 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_EXPIRING' | 'SUBSCRIPTION_SUSPENDED' | 'TRIAL_ENDING' | 'GRACE_PERIOD_ENDING' | 'AD_CHARGES_APPLIED';
  public title!: string;
  public message!: string;
  public read!: boolean;
}

SaaSNotification.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  type: {
    type: DataTypes.ENUM('INVOICE_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_SUSPENDED', 'TRIAL_ENDING', 'GRACE_PERIOD_ENDING', 'AD_CHARGES_APPLIED'),
    allowNull: false
  },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
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

export class RefundRequest extends Model {
  public id!: string;
  public tenantId!: string;
  public subscriberId!: string;
  public paymentId!: string | null;
  public packageId!: number | null;
  public type!: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'WALLET_CREDIT' | 'PACKAGE_EXTENSION' | 'VOUCHER_REPLACEMENT' | 'FREE_DATA' | 'MANUAL_COMPENSATION' | 'GOODWILL_CREDIT';
  public category!: 'NETWORK_OUTAGE' | 'ROUTER_FAILURE' | 'POWER_FAILURE' | 'PAYMENT_FAILURE' | 'AUTH_FAILURE' | 'SLOW_INTERNET' | 'MAINTENANCE' | 'GOODWILL' | 'CUSTOM';
  public status!: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  public amount!: number; // In KES cents (e.g. 10000 = 100.00 KES)
  public extensionMinutes!: number | null;
  public freeDataBytes!: number | null;
  public reason!: string;
  public notes!: string | null;
  public evidenceUrl!: string | null;
  public requestedBy!: string;
  public approvedBy!: string | null;
  public rejectedBy!: string | null;
  public rejectionReason!: string | null;
  public completedAt!: Date | null;
  public providerRefundId!: string | null;
  public providerRefundStatus!: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | null;
  public previousBalance!: number;
  public newBalance!: number;
  public idempotencyKey!: string;
}

RefundRequest.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  subscriberId: { type: DataTypes.UUID, allowNull: false },
  paymentId: { type: DataTypes.UUID, allowNull: true },
  packageId: { type: DataTypes.INTEGER, allowNull: true },
  type: {
    type: DataTypes.ENUM(
      'FULL_REFUND', 'PARTIAL_REFUND', 'WALLET_CREDIT', 'PACKAGE_EXTENSION',
      'VOUCHER_REPLACEMENT', 'FREE_DATA', 'MANUAL_COMPENSATION', 'GOODWILL_CREDIT'
    ),
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM(
      'NETWORK_OUTAGE', 'ROUTER_FAILURE', 'POWER_FAILURE', 'PAYMENT_FAILURE',
      'AUTH_FAILURE', 'SLOW_INTERNET', 'MAINTENANCE', 'GOODWILL', 'CUSTOM'
    ),
    defaultValue: 'GOODWILL',
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'),
    defaultValue: 'SUBMITTED',
  },
  amount: { type: DataTypes.BIGINT, defaultValue: 0 },
  extensionMinutes: { type: DataTypes.INTEGER, allowNull: true },
  freeDataBytes: { type: DataTypes.BIGINT, allowNull: true },
  reason: { type: DataTypes.TEXT, allowNull: false },
  notes: { type: DataTypes.TEXT },
  evidenceUrl: { type: DataTypes.TEXT },
  requestedBy: { type: DataTypes.UUID, allowNull: false },
  approvedBy: { type: DataTypes.UUID, allowNull: true },
  rejectedBy: { type: DataTypes.UUID, allowNull: true },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  providerRefundId: { type: DataTypes.STRING, allowNull: true },
  providerRefundStatus: {
    type: DataTypes.ENUM('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'),
    allowNull: true,
  },
  previousBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  newBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  idempotencyKey: { type: DataTypes.STRING, allowNull: false, unique: true },
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

export class CompensationRule extends Model {
  public id!: string;
  public tenantId!: string;
  public name!: string;
  public triggerType!: 'ROUTER_DOWNTIME' | 'HOTSPOT_OUTAGE' | 'AUTH_FAILURES' | 'CUSTOM';
  public downtimeThresholdMinutes!: number;
  public compensationType!: 'PACKAGE_EXTENSION' | 'WALLET_CREDIT' | 'FREE_DATA';
  public compensationValue!: number;
  public autoApprove!: boolean;
  public isEnabled!: boolean;
}

CompensationRule.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  triggerType: {
    type: DataTypes.ENUM('ROUTER_DOWNTIME', 'HOTSPOT_OUTAGE', 'AUTH_FAILURES', 'CUSTOM'),
    defaultValue: 'ROUTER_DOWNTIME',
  },
  downtimeThresholdMinutes: { type: DataTypes.INTEGER, defaultValue: 60 },
  compensationType: {
    type: DataTypes.ENUM('PACKAGE_EXTENSION', 'WALLET_CREDIT', 'FREE_DATA'),
    defaultValue: 'PACKAGE_EXTENSION',
  },
  compensationValue: { type: DataTypes.INTEGER, defaultValue: 60 },
  autoApprove: { type: DataTypes.BOOLEAN, defaultValue: true },
  isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'compensation_rule',
  indexes: [{ fields: ['tenantId'] }],
});

export class RefundAuditLog extends Model {
  public id!: string;
  public tenantId!: string;
  public refundRequestId!: string;
  public subscriberId!: string;
  public type!: string;
  public amount!: number;
  public action!: string;
  public performedBy!: string;
  public ipAddress!: string | null;
  public userAgent!: string | null;
  public previousBalance!: number;
  public newBalance!: number;
  public reason!: string;
}

RefundAuditLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  refundRequestId: { type: DataTypes.UUID, allowNull: false },
  subscriberId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.BIGINT, defaultValue: 0 },
  action: { type: DataTypes.STRING, allowNull: false },
  performedBy: { type: DataTypes.UUID, allowNull: false },
  ipAddress: { type: DataTypes.STRING },
  userAgent: { type: DataTypes.TEXT },
  previousBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  newBalance: { type: DataTypes.BIGINT, defaultValue: 0 },
  reason: { type: DataTypes.TEXT },
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

export class PlatformBranding extends Model {
  public id!: string;
  public platformName!: string;
  public platformTagline!: string;
  public platformDescription!: string;
  public companyName!: string;
  public supportPhone!: string;
  public supportEmail!: string;
  public websiteUrl!: string;
  public socialLinks!: string; // JSON string
  public businessAddress!: string;
  public copyrightInfo!: string;
  public legalInfo!: string;

  // Logos
  public primaryLogoUrl!: string | null;
  public darkModeLogoUrl!: string | null;
  public lightModeLogoUrl!: string | null;
  public faviconUrl!: string | null;
  public mobileLogoUrl!: string | null;
  public invoiceLogoUrl!: string | null;
  public emailLogoUrl!: string | null;
  public captivePortalLogoUrl!: string | null;

  // Colors
  public primaryColor!: string;
  public secondaryColor!: string;
  public accentColor!: string;
  public successColor!: string;
  public warningColor!: string;
  public dangerColor!: string;
  public sidebarColor!: string;
  public navColor!: string;
  public buttonColor!: string;
  public chartColor!: string;
}

PlatformBranding.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  platformName: { type: DataTypes.STRING, defaultValue: 'Jevish Pro' },
  platformTagline: { type: DataTypes.STRING, defaultValue: 'Next-Gen Multi-Tenant WiFi Billing & ISP Management System' },
  platformDescription: { type: DataTypes.TEXT, defaultValue: 'Enterprise WiFi billing, MikroTik integration, bandwidth control, and M-Pesa automated payments for ISPs and hotspot owners.' },
  companyName: { type: DataTypes.STRING, defaultValue: 'Jevish Technologies Ltd' },
  supportPhone: { type: DataTypes.STRING, defaultValue: '0768926965' },
  supportEmail: { type: DataTypes.STRING, defaultValue: 'emmanueloyaro3@gmail.com' },
  websiteUrl: { type: DataTypes.STRING, defaultValue: 'https://jevish.site' },
  socialLinks: { type: DataTypes.TEXT, defaultValue: JSON.stringify({ twitter: '', facebook: '', linkedin: '', whatsapp: 'https://wa.me/254768926965' }) },
  businessAddress: { type: DataTypes.TEXT, defaultValue: 'Nairobi, Kenya' },
  copyrightInfo: { type: DataTypes.STRING, defaultValue: '© 2026 Jevish Technologies Ltd. All rights reserved.' },
  legalInfo: { type: DataTypes.TEXT, defaultValue: 'Jevish is a registered SaaS billing platform for Internet Service Providers.' },

  primaryLogoUrl: { type: DataTypes.TEXT, allowNull: true },
  darkModeLogoUrl: { type: DataTypes.TEXT, allowNull: true },
  lightModeLogoUrl: { type: DataTypes.TEXT, allowNull: true },
  faviconUrl: { type: DataTypes.TEXT, allowNull: true },
  mobileLogoUrl: { type: DataTypes.TEXT, allowNull: true },
  invoiceLogoUrl: { type: DataTypes.TEXT, allowNull: true },
  emailLogoUrl: { type: DataTypes.TEXT, allowNull: true },
  captivePortalLogoUrl: { type: DataTypes.TEXT, allowNull: true },

  primaryColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  secondaryColor: { type: DataTypes.STRING, defaultValue: '#0f172a' },
  accentColor: { type: DataTypes.STRING, defaultValue: '#38bdf8' },
  successColor: { type: DataTypes.STRING, defaultValue: '#10b981' },
  warningColor: { type: DataTypes.STRING, defaultValue: '#f59e0b' },
  dangerColor: { type: DataTypes.STRING, defaultValue: '#ef4444' },
  sidebarColor: { type: DataTypes.STRING, defaultValue: '#0f172a' },
  navColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  buttonColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
  chartColor: { type: DataTypes.STRING, defaultValue: '#0284c7' },
}, {
  sequelize,
  modelName: 'platform_branding'
});

// ENTERPRISE CRM & QUOTATION MODELS
export class EnterpriseLead extends Model {
  public id!: string;
  public leadNumber!: string;
  public companyName!: string;
  public registrationNumber!: string | null;
  public contactPerson!: string;
  public position!: string | null;
  public phone!: string;
  public altPhone!: string | null;
  public email!: string;
  public website!: string | null;
  public country!: string;
  public region!: string | null;
  public physicalAddress!: string | null;
  public currentIspSize!: string | null;
  public expectedGrowth!: string | null;
  public subscriberCount!: number;
  public activeUserCount!: number;
  public routerCount!: number;
  public currentBillingPlatform!: string | null;
  public requiredFeatures!: string | null; // JSON
  public expectedLaunchDate!: string | null;
  public monthlyBudget!: string | null;
  public notes!: string | null;
  public status!: 'NEW' | 'CONTACTED' | 'QUALIFICATION' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'AWAITING_APPROVAL' | 'WON' | 'LOST' | 'ARCHIVED';
  public assignedTo!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EnterpriseLead.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  leadNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  companyName: { type: DataTypes.STRING, allowNull: false },
  registrationNumber: { type: DataTypes.STRING },
  contactPerson: { type: DataTypes.STRING, allowNull: false },
  position: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING, allowNull: false },
  altPhone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, allowNull: false },
  website: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING, defaultValue: 'Kenya' },
  region: { type: DataTypes.STRING },
  physicalAddress: { type: DataTypes.TEXT },
  currentIspSize: { type: DataTypes.STRING },
  expectedGrowth: { type: DataTypes.STRING },
  subscriberCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  activeUserCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  routerCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  currentBillingPlatform: { type: DataTypes.STRING },
  requiredFeatures: { type: DataTypes.TEXT },
  expectedLaunchDate: { type: DataTypes.STRING },
  monthlyBudget: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM('NEW', 'CONTACTED', 'QUALIFICATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'AWAITING_APPROVAL', 'WON', 'LOST', 'ARCHIVED'),
    defaultValue: 'NEW'
  },
  assignedTo: { type: DataTypes.STRING }
}, { sequelize, modelName: 'enterprise_lead' });

export class EnterpriseQuote extends Model {
  public id!: string;
  public quoteNumber!: string;
  public leadId!: string;
  public tenantId!: string | null;
  public monthlyCostCents!: number;
  public setupFeeCents!: number;
  public maxActiveUsers!: number;
  public maxRouters!: number;
  public smsAllocation!: number;
  public whatsappAllocation!: number;
  public storageAllocationMB!: number;
  public customModules!: string | null; // JSON
  public discountCents!: number;
  public taxPercentage!: number;
  public contractDurationMonths!: number;
  public status!: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'EXPIRED';
  public validUntil!: Date | null;
  public termsAndConditions!: string | null;
  public rejectionReason!: string | null;
  public customerNotes!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EnterpriseQuote.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  quoteNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  leadId: { type: DataTypes.UUID, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: true },
  monthlyCostCents: { type: DataTypes.BIGINT, allowNull: false },
  setupFeeCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  maxActiveUsers: { type: DataTypes.INTEGER, defaultValue: -1 },
  maxRouters: { type: DataTypes.INTEGER, defaultValue: -1 },
  smsAllocation: { type: DataTypes.INTEGER, defaultValue: 10000 },
  whatsappAllocation: { type: DataTypes.INTEGER, defaultValue: 5000 },
  storageAllocationMB: { type: DataTypes.INTEGER, defaultValue: 10240 },
  customModules: { type: DataTypes.TEXT },
  discountCents: { type: DataTypes.BIGINT, defaultValue: 0 },
  taxPercentage: { type: DataTypes.FLOAT, defaultValue: 16.0 },
  contractDurationMonths: { type: DataTypes.INTEGER, defaultValue: 12 },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED', 'EXPIRED'),
    defaultValue: 'DRAFT'
  },
  validUntil: { type: DataTypes.DATE },
  termsAndConditions: { type: DataTypes.TEXT },
  rejectionReason: { type: DataTypes.TEXT },
  customerNotes: { type: DataTypes.TEXT }
}, { sequelize, modelName: 'enterprise_quote' });

// Enterprise Relationships
EnterpriseLead.hasMany(EnterpriseQuote, { foreignKey: 'leadId' });
EnterpriseQuote.belongsTo(EnterpriseLead, { foreignKey: 'leadId' });

// =========================================================
// FREERADIUS & RADIUS-FIRST ISP MODELS
// =========================================================

export class Nas extends Model {
  public id!: string;
  public nasname!: string;
  public shortname!: string;
  public type!: string;
  public ports!: number;
  public secret!: string;
  public server!: string | null;
  public community!: string | null;
  public description!: string | null;
  public tenantId!: string;
  public status!: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Nas.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nasname: { type: DataTypes.STRING, allowNull: false, unique: true },
  shortname: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: 'other' },
  ports: { type: DataTypes.INTEGER, defaultValue: 0 },
  secret: { type: DataTypes.STRING, allowNull: false },
  server: { type: DataTypes.STRING },
  community: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE'), defaultValue: 'ACTIVE' }
}, { sequelize, modelName: 'nas', tableName: 'nas' });

export class RadCheck extends Model {
  public id!: number;
  public username!: string;
  public attribute!: string;
  public op!: string;
  public value!: string;
  public tenantId!: string;
}

RadCheck.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false },
  attribute: { type: DataTypes.STRING, allowNull: false },
  op: { type: DataTypes.STRING(2), defaultValue: ':=' },
  value: { type: DataTypes.STRING, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radcheck', tableName: 'radcheck', timestamps: false });

export class RadReply extends Model {
  public id!: number;
  public username!: string;
  public attribute!: string;
  public op!: string;
  public value!: string;
  public tenantId!: string;
}

RadReply.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false },
  attribute: { type: DataTypes.STRING, allowNull: false },
  op: { type: DataTypes.STRING(2), defaultValue: '=' },
  value: { type: DataTypes.STRING, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radreply', tableName: 'radreply', timestamps: false });

export class RadGroupCheck extends Model {
  public id!: number;
  public groupname!: string;
  public attribute!: string;
  public op!: string;
  public value!: string;
  public tenantId!: string;
}

RadGroupCheck.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  groupname: { type: DataTypes.STRING, allowNull: false },
  attribute: { type: DataTypes.STRING, allowNull: false },
  op: { type: DataTypes.STRING(2), defaultValue: ':=' },
  value: { type: DataTypes.STRING, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radgroupcheck', tableName: 'radgroupcheck', timestamps: false });

export class RadGroupReply extends Model {
  public id!: number;
  public groupname!: string;
  public attribute!: string;
  public op!: string;
  public value!: string;
  public tenantId!: string;
}

RadGroupReply.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  groupname: { type: DataTypes.STRING, allowNull: false },
  attribute: { type: DataTypes.STRING, allowNull: false },
  op: { type: DataTypes.STRING(2), defaultValue: '=' },
  value: { type: DataTypes.STRING, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radgroupreply', tableName: 'radgroupreply', timestamps: false });

export class RadUserGroup extends Model {
  public id!: number;
  public username!: string;
  public groupname!: string;
  public priority!: number;
  public tenantId!: string;
}

RadUserGroup.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false },
  groupname: { type: DataTypes.STRING, allowNull: false },
  priority: { type: DataTypes.INTEGER, defaultValue: 1 },
  tenantId: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radusergroup', tableName: 'radusergroup', timestamps: false });

export class RadAcct extends Model {
  public radacctid!: number;
  public acctsessionid!: string;
  public acctuniqueid!: string;
  public username!: string;
  public groupname!: string | null;
  public realm!: string | null;
  public nasipaddress!: string;
  public nasportid!: string | null;
  public nasporttype!: string | null;
  public acctstarttime!: Date | null;
  public acctupdatetime!: Date | null;
  public acctstoptime!: Date | null;
  public acctinterval!: number | null;
  public acctsessiontime!: number | null;
  public acctauthentic!: string | null;
  public connectinfo_start!: string | null;
  public connectinfo_stop!: string | null;
  public acctinputoctets!: number | null;
  public acctoutputoctets!: number | null;
  public calledstationid!: string | null;
  public callingstationid!: string | null;
  public acctterminatecause!: string | null;
  public servicetype!: string | null;
  public framedprotocol!: string | null;
  public framedipaddress!: string | null;
  public tenantId!: string;
}

RadAcct.init({
  radacctid: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  acctsessionid: { type: DataTypes.STRING, allowNull: false },
  acctuniqueid: { type: DataTypes.STRING, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: false },
  groupname: { type: DataTypes.STRING },
  realm: { type: DataTypes.STRING },
  nasipaddress: { type: DataTypes.STRING, allowNull: false },
  nasportid: { type: DataTypes.STRING },
  nasporttype: { type: DataTypes.STRING },
  acctstarttime: { type: DataTypes.DATE },
  acctupdatetime: { type: DataTypes.DATE },
  acctstoptime: { type: DataTypes.DATE },
  acctinterval: { type: DataTypes.INTEGER },
  acctsessiontime: { type: DataTypes.INTEGER, defaultValue: 0 },
  acctauthentic: { type: DataTypes.STRING },
  connectinfo_start: { type: DataTypes.STRING },
  connectinfo_stop: { type: DataTypes.STRING },
  acctinputoctets: { type: DataTypes.BIGINT, defaultValue: 0 },
  acctoutputoctets: { type: DataTypes.BIGINT, defaultValue: 0 },
  calledstationid: { type: DataTypes.STRING },
  callingstationid: { type: DataTypes.STRING },
  acctterminatecause: { type: DataTypes.STRING },
  servicetype: { type: DataTypes.STRING },
  framedprotocol: { type: DataTypes.STRING },
  framedipaddress: { type: DataTypes.STRING },
  tenantId: { type: DataTypes.UUID, allowNull: false }
}, { sequelize, modelName: 'radacct', tableName: 'radacct', timestamps: false });

export class RadPostAuth extends Model {
  public id!: number;
  public username!: string;
  public pass!: string;
  public reply!: string;
  public authdate!: Date;
  public nasipaddress!: string | null;
  public tenantId!: string | null;
  public reason!: string | null;
}

RadPostAuth.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false },
  pass: { type: DataTypes.STRING, defaultValue: '' },
  reply: { type: DataTypes.STRING, allowNull: false },
  authdate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  nasipaddress: { type: DataTypes.STRING },
  tenantId: { type: DataTypes.UUID },
  reason: { type: DataTypes.STRING }
}, { sequelize, modelName: 'radpostauth', tableName: 'radpostauth', timestamps: false });

export class RadiusPolicy extends Model {
  public id!: string;
  public tenantId!: string;
  public name!: string;
  public authType!: 'PAP' | 'CHAP' | 'MSCHAPv2' | 'EAP' | 'MAC';
  public macAuthEnabled!: boolean;
  public voucherAuthEnabled!: boolean;
  public simultaneousUse!: number;
  public sessionTimeout!: number;
  public idleTimeout!: number;
  public rateLimit!: string;
  public fallbackAction!: 'REJECT' | 'ACCEPT_GUEST' | 'REDIRECT_PORTAL';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RadiusPolicy.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  authType: { type: DataTypes.ENUM('PAP', 'CHAP', 'MSCHAPv2', 'EAP', 'MAC'), defaultValue: 'PAP' },
  macAuthEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  voucherAuthEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  simultaneousUse: { type: DataTypes.INTEGER, defaultValue: 1 },
  sessionTimeout: { type: DataTypes.INTEGER, defaultValue: 86400 },
  idleTimeout: { type: DataTypes.INTEGER, defaultValue: 300 },
  rateLimit: { type: DataTypes.STRING, defaultValue: '10M/10M' },
  fallbackAction: { type: DataTypes.ENUM('REJECT', 'ACCEPT_GUEST', 'REDIRECT_PORTAL'), defaultValue: 'REJECT' }
}, { sequelize, modelName: 'radius_policy' });

// SaaSSubscriptionPayment Model definition for platform subscription fees
export class SaaSSubscriptionPayment extends Model {
  public id!: string;
  public tenantId!: string;
  public invoiceId!: string | null;
  public amount!: number;
  public currency!: string;
  public status!: 'PENDING' | 'SUCCESS' | 'FAILED';
  public phoneNumber!: string;
  public mpesaReceiptNumber!: string | null;
  public checkoutRequestId!: string | null;
  public merchantRequestId!: string | null;
  public rawCallback!: string | null;
  public completedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SaaSSubscriptionPayment.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  invoiceId: { type: DataTypes.STRING, allowNull: true },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  currency: { type: DataTypes.STRING, defaultValue: 'KES' },
  status: { type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'), defaultValue: 'PENDING' },
  phoneNumber: { type: DataTypes.STRING, allowNull: false },
  mpesaReceiptNumber: { type: DataTypes.STRING, allowNull: true },
  checkoutRequestId: { type: DataTypes.STRING, allowNull: true },
  merchantRequestId: { type: DataTypes.STRING, allowNull: true },
  rawCallback: { type: DataTypes.TEXT, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true }
}, {
  sequelize,
  modelName: 'SaaSSubscriptionPayment',
  tableName: 'saas_subscription_payments'
});

// MpesaCallbackLog Model definition for comprehensive callback tracking and diagnostics
export class MpesaCallbackLog extends Model {
  public id!: string;
  public checkoutRequestId!: string | null;
  public merchantRequestId!: string | null;
  public rawPayload!: string;
  public validationStatus!: 'VALID' | 'INVALID_PAYLOAD' | 'IP_UNAUTHORIZED' | 'INVALID_SIGNATURE';
  public validationErrors!: string | null;
  public signatureVerified!: boolean;
  public tenantId!: string | null;
  public databaseUpdateStatus!: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING';
  public errorDetails!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MpesaCallbackLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  checkoutRequestId: { type: DataTypes.STRING, allowNull: true },
  merchantRequestId: { type: DataTypes.STRING, allowNull: true },
  rawPayload: { type: DataTypes.TEXT, allowNull: false },
  validationStatus: { type: DataTypes.STRING, defaultValue: 'VALID' },
  validationErrors: { type: DataTypes.TEXT, allowNull: true },
  signatureVerified: { type: DataTypes.BOOLEAN, defaultValue: true },
  tenantId: { type: DataTypes.STRING, allowNull: true },
  databaseUpdateStatus: { type: DataTypes.STRING, defaultValue: 'PENDING' },
  errorDetails: { type: DataTypes.TEXT, allowNull: true }
}, {
  sequelize,
  modelName: 'MpesaCallbackLog',
  tableName: 'mpesa_callback_logs'
});

// Payment Log Model for comprehensive transaction lifecycle audit trail
export class PaymentLog extends Model {
  public id!: string;
  public transactionReference!: string | null;
  public checkoutRequestId!: string | null;
  public merchantRequestId!: string | null;
  public tenantId!: string | null;
  public stage!: string; // STK_INITIATED, CALLBACK_RECEIVED, VALIDATION, DATABASE_UPDATED, SUCCESS, FAILED
  public status!: string; // PENDING, SUCCESS, FAILED
  public amount!: number | null;
  public phoneNumber!: string | null;
  public safaricomResultCode!: string | null;
  public safaricomResultDesc!: string | null;
  public errorDetails!: string | null;
  public rawPayload!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PaymentLog.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  transactionReference: { type: DataTypes.STRING, allowNull: true },
  checkoutRequestId: { type: DataTypes.STRING, allowNull: true },
  merchantRequestId: { type: DataTypes.STRING, allowNull: true },
  tenantId: { type: DataTypes.STRING, allowNull: true },
  stage: { type: DataTypes.STRING, allowNull: false, defaultValue: 'STK_INITIATED' },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PENDING' },
  amount: { type: DataTypes.FLOAT, allowNull: true },
  phoneNumber: { type: DataTypes.STRING, allowNull: true },
  safaricomResultCode: { type: DataTypes.STRING, allowNull: true },
  safaricomResultDesc: { type: DataTypes.TEXT, allowNull: true },
  errorDetails: { type: DataTypes.TEXT, allowNull: true },
  rawPayload: { type: DataTypes.TEXT, allowNull: true }
}, {
  sequelize,
  modelName: 'PaymentLog',
  tableName: 'payment_logs'
});

// PaymentVerificationAudit Model for tracking verification attempts and historical payment reconciliation
class PaymentVerificationAudit extends Model {
  public id!: string;
  public tenantId!: string | null;
  public invoiceId!: string | null;
  public checkoutRequestId!: string | null;
  public status!: 'VERIFIED_SUCCESS' | 'ALREADY_PAID' | 'PENDING_ON_MPESA' | 'FAILED';
  public matchedReceipt!: string | null;
  public verificationSource!: string;
  public details!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PaymentVerificationAudit.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, allowNull: true },
  invoiceId: { type: DataTypes.STRING, allowNull: true },
  checkoutRequestId: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PENDING_ON_MPESA' },
  matchedReceipt: { type: DataTypes.STRING, allowNull: true },
  verificationSource: { type: DataTypes.STRING, defaultValue: 'STK_QUERY' },
  details: { type: DataTypes.TEXT, allowNull: true }
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

export { sequelize, PaymentVerificationAudit };
