"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validatePaymentEnvDiagnostics = validatePaymentEnvDiagnostics;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env file
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const rawSupabaseUrl = process.env.SUPABASE_URL || '';
let supabaseProjectRef = '';
if (rawSupabaseUrl) {
    try {
        const parsed = new URL(rawSupabaseUrl.startsWith('http') ? rawSupabaseUrl : `https://${rawSupabaseUrl}`);
        supabaseProjectRef = parsed.hostname.split('.')[0];
    }
    catch {
        supabaseProjectRef = rawSupabaseUrl.replace(/^https?:\/\//, '').split('.')[0];
    }
}
const derivedDbHost = process.env.DB_HOST || (supabaseProjectRef ? `db.${supabaseProjectRef}.supabase.co` : '');
const derivedDbPort = Number(process.env.DB_PORT) || (rawSupabaseUrl ? 6543 : 5432); // Default to pooler for Supabase
const derivedDbType = process.env.DB_TYPE || (rawSupabaseUrl ? 'supabase' : 'postgres');
const derivedDbName = process.env.DB_NAME || 'postgres';
const derivedDbUser = process.env.DB_USER || 'postgres';
function validateEnv() {
    const missingVars = [];
    const envConfig = {};
    const requiredKeys = ['JWT_SECRET', 'SUPER_ADMIN_JWT_SECRET', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'];
    if (!rawSupabaseUrl && !process.env.DATABASE_URL) {
        requiredKeys.push('DB_TYPE', 'DB_NAME', 'DB_USER', 'DB_HOST');
    }
    for (const key of requiredKeys) {
        const value = process.env[key];
        if (!value) {
            missingVars.push(key);
            envConfig[key] = '';
        }
        else {
            envConfig[key] = value;
        }
    }
    if (missingVars.length > 0) {
        console.warn('⚠️ WARNING: Missing recommended environment variables:');
        missingVars.forEach(key => console.warn(` - ${key}`));
    }
    return envConfig;
}
// Validate immediately on import
validateEnv();
exports.config = {
    app: {
        port: Number(process.env.PORT) || 3000,
        env: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        url: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || process.env.SUPABASE_ANON_KEY || 'default_jwt_secret',
        superAdminJwtSecret: process.env.SUPER_ADMIN_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default_super_admin_jwt_secret',
        superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
        superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || 'admin123',
    },
    db: {
        type: derivedDbType,
        name: derivedDbName,
        user: derivedDbUser,
        pass: process.env.DB_PASS || '', // Do NOT default to Service Role Key for DB connection
        host: derivedDbHost,
        port: derivedDbPort,
    },
    security: {
        corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
        rateLimitWindow: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
        rateLimitMax: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    },
    payments: {
        payhero: {
            apiKey: process.env.PAYHERO_API_KEY || '',
            apiSecret: process.env.PAYHERO_API_SECRET || '',
            channelId: process.env.PAYHERO_CHANNEL_ID || '',
            env: process.env.PAYHERO_ENV || 'sandbox',
            callbackUrl: process.env.PAYHERO_CALLBACK_URL || '',
        },
        intasend: {
            publishableKey: process.env.INTASEND_PUBLISHABLE_KEY,
            secretKey: process.env.INTASEND_SECRET_KEY,
            webhookToken: process.env.INTASEND_WEBHOOK_TOKEN,
            isMock: process.env.INTASEND_MOCK === 'true',
            env: process.env.INTASEND_ENV || 'sandbox',
        },
        mpesa: {
            consumerKey: process.env.MPESA_CONSUMER_KEY,
            consumerSecret: process.env.MPESA_CONSUMER_SECRET,
            shortcode: process.env.MPESA_SHORTCODE,
            passkey: process.env.MPESA_PASSKEY,
            env: process.env.MPESA_ENV || 'sandbox',
        }
    },
    email: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    sms: {
        provider: process.env.SMS_PROVIDER || 'GENERIC',
        username: process.env.SMS_USERNAME,
        apiKey: process.env.SMS_API_KEY,
        senderId: process.env.SMS_SENDER_ID,
        encryptionKey: process.env.SMS_ENCRYPTION_KEY,
    }
};
function validatePaymentEnvDiagnostics() {
    const issues = [];
    let intasendConfigured = true;
    let mpesaConfigured = true;
    if (!process.env.INTASEND_PUBLISHABLE_KEY) {
        issues.push('INTASEND_PUBLISHABLE_KEY is missing');
        intasendConfigured = false;
    }
    if (!process.env.INTASEND_SECRET_KEY) {
        issues.push('INTASEND_SECRET_KEY is missing');
        intasendConfigured = false;
    }
    if (!process.env.MPESA_CONSUMER_KEY) {
        issues.push('MPESA_CONSUMER_KEY is missing (using sandbox fallback)');
        mpesaConfigured = false;
    }
    if (!process.env.MPESA_CONSUMER_SECRET) {
        issues.push('MPESA_CONSUMER_SECRET is missing (using sandbox fallback)');
        mpesaConfigured = false;
    }
    return { intasendConfigured, mpesaConfigured, issues };
}
