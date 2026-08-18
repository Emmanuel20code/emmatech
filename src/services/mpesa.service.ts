import axios from 'axios';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { Tenant, Payment, PlatformSetting, PlatformPricingConfig, SaaSSubscriptionPayment, SaaSInvoice } from '../models';
import { encrypt, decrypt } from '../utils/encryption';
import { config } from '../config/env';
import { normalizeKenyanPhone } from '../utils/phone';

interface CachedToken {
    token: string;
    expiry: number;
    env: string;
}

export class MpesaService {
    private static tokenCache = new Map<string, CachedToken>();

    public static invalidateCache(tenantId?: string) {
        if (tenantId) {
            this.tokenCache.delete(tenantId);
        } else {
            this.tokenCache.clear();
        }
    }

    private static getBaseUrl(env: string | null = 'production') {
        const normalized = (env || '').toLowerCase().trim();
        if (normalized === 'sandbox') {
            return 'https://sandbox.safaricom.co.ke';
        }
        // Strictly live Safaricom API production endpoint
        return 'https://api.safaricom.co.ke';
    }

    /**
     * Formats date timestamp strictly matching Safaricom Daraja requirement (YYYYMMDDHHmmss)
     */
    private static getTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    /**
     * Resolves the publicly accessible callback URL dynamically based on current request headers or environment configuration
     */
    private static getCallbackUrl(path: string, req?: any): string {
        let callbackBase = '';

        if (req && req.headers) {
            const proto = req.headers['x-forwarded-proto'] || 'https';
            const host = req.headers['x-forwarded-host'] || req.headers['host'];
            if (host) {
                callbackBase = `${proto}://${host}`;
            }
        }

        if (!callbackBase || callbackBase.includes('localhost') || callbackBase.includes('127.0.0.1')) {
            callbackBase = process.env.MPESA_CALLBACK_BASE_URL || config.app.url || 'https://ais-dev-brrp7uv5khdrix2cw24irx-164318647384.europe-west2.run.app';
        }

        // Ensure https
        if (!callbackBase.startsWith('http://') && !callbackBase.startsWith('https://')) {
            callbackBase = `https://${callbackBase}`;
        }
        return `${callbackBase.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
    }

    /**
     * Get Master / Super Admin M-Pesa Daraja Credentials
     * Master Initiator for all platform payments, SaaS invoices, and fallback tenant checkouts
     */
    public static async getSuperAdminCredentials() {
        try {
            const settings = await PlatformSetting.findAll({
                where: {
                    key: [
                        'SUPERADMIN_MPESA_CONSUMER_KEY',
                        'SUPERADMIN_MPESA_CONSUMER_SECRET',
                        'SUPERADMIN_MPESA_SHORTCODE',
                        'SUPERADMIN_MPESA_PASSKEY',
                        'SUPERADMIN_MPESA_ENV',
                        'SUPERADMIN_MPESA_INITIATOR_NAME',
                        'SUPERADMIN_MPESA_INITIATOR_PASSWORD',
                        'SUPERADMIN_MPESA_TILL',
                        'SUPERADMIN_MPESA_PAYBILL'
                    ]
                }
            }).catch(() => []);

            const sMap: Record<string, string> = {};
            settings.forEach(s => {
                sMap[s.key] = s.value;
            });

            let saTenant: any = null;
            if (!sMap['SUPERADMIN_MPESA_CONSUMER_KEY'] || !sMap['SUPERADMIN_MPESA_CONSUMER_SECRET']) {
                saTenant = await Tenant.findOne({ where: { role: 'SUPER_ADMIN' } }).catch(() => null);
                if (!saTenant) {
                    saTenant = await Tenant.findOne({ where: { mpesaConsumerKey: { [Op.ne]: null } } }).catch(() => null);
                }
            }

            const rawKey = sMap['SUPERADMIN_MPESA_CONSUMER_KEY'] || process.env.MPESA_CONSUMER_KEY || saTenant?.mpesaConsumerKey || '';
            const consumerKey = rawKey ? (rawKey.includes('****') ? '' : decrypt(rawKey)) : '';

            const rawSecret = sMap['SUPERADMIN_MPESA_CONSUMER_SECRET'] || process.env.MPESA_CONSUMER_SECRET || saTenant?.mpesaConsumerSecret || '';
            const consumerSecret = rawSecret ? (rawSecret.includes('****') ? '' : decrypt(rawSecret)) : '';

            const rawPasskey = sMap['SUPERADMIN_MPESA_PASSKEY'] || process.env.MPESA_PASSKEY || saTenant?.mpesaPasskey || '';
            const passkey = rawPasskey ? (rawPasskey.includes('****') ? '' : decrypt(rawPasskey)) : '';

            const shortcode = sMap['SUPERADMIN_MPESA_SHORTCODE'] || sMap['SUPERADMIN_MPESA_PAYBILL'] || process.env.MPESA_SHORTCODE || saTenant?.mpesaShortcode || saTenant?.mpesaPaybillNumber || '';
            const env = sMap['SUPERADMIN_MPESA_ENV'] || process.env.MPESA_ENVIRONMENT || saTenant?.mpesaEnvironment || 'production';

            const initiatorName = sMap['SUPERADMIN_MPESA_INITIATOR_NAME'] || process.env.MPESA_INITIATOR_NAME || saTenant?.mpesaInitiatorName || '';
            const rawInitPass = sMap['SUPERADMIN_MPESA_INITIATOR_PASSWORD'] || process.env.MPESA_SECURITY_CREDENTIAL || saTenant?.mpesaInitiatorPassword || '';
            const initiatorPassword = rawInitPass ? (rawInitPass.includes('****') ? '' : decrypt(rawInitPass)) : '';

            const tillNumber = sMap['SUPERADMIN_MPESA_TILL'] || saTenant?.mpesaTillNumber || '';
            const paybillNumber = sMap['SUPERADMIN_MPESA_PAYBILL'] || saTenant?.mpesaPaybillNumber || shortcode;

            return {
                consumerKey: consumerKey.trim(),
                consumerSecret: consumerSecret.trim(),
                shortcode: shortcode.trim(),
                passkey: passkey.trim(),
                env: env.trim().toLowerCase(),
                initiatorName: initiatorName.trim(),
                initiatorPassword: initiatorPassword.trim(),
                tillNumber: tillNumber.trim(),
                paybillNumber: paybillNumber.trim()
            };
        } catch (e) {
            return {
                consumerKey: (process.env.MPESA_CONSUMER_KEY || '').trim(),
                consumerSecret: (process.env.MPESA_CONSUMER_SECRET || '').trim(),
                shortcode: (process.env.MPESA_SHORTCODE || '').trim(),
                passkey: (process.env.MPESA_PASSKEY || '').trim(),
                env: (process.env.MPESA_ENVIRONMENT || 'production').trim().toLowerCase(),
                initiatorName: (process.env.MPESA_INITIATOR_NAME || '').trim(),
                initiatorPassword: (process.env.MPESA_SECURITY_CREDENTIAL || '').trim(),
                tillNumber: '',
                paybillNumber: (process.env.MPESA_SHORTCODE || '').trim()
            };
        }
    }

    /**
     * Alias for getSuperAdminCredentials
     */
    public static async getMasterInitiatorCredentials() {
        return this.getSuperAdminCredentials();
    }

    /**
     * Save / Update Master M-Pesa Daraja Credentials
     */
    public static async saveMasterCredentials(data: {
        consumerKey?: string;
        consumerSecret?: string;
        shortcode?: string;
        passkey?: string;
        env?: string;
        initiatorName?: string;
        initiatorPassword?: string;
        tillNumber?: string;
        paybillNumber?: string;
    }) {
        const updateMap: Record<string, string> = {};

        if (data.consumerKey !== undefined) {
            updateMap['SUPERADMIN_MPESA_CONSUMER_KEY'] = data.consumerKey.trim();
        }
        if (data.consumerSecret !== undefined && data.consumerSecret && !data.consumerSecret.includes('****')) {
            updateMap['SUPERADMIN_MPESA_CONSUMER_SECRET'] = encrypt(data.consumerSecret.trim());
        }
        if (data.shortcode !== undefined) {
            updateMap['SUPERADMIN_MPESA_SHORTCODE'] = data.shortcode.trim();
        }
        if (data.passkey !== undefined && data.passkey && !data.passkey.includes('****')) {
            updateMap['SUPERADMIN_MPESA_PASSKEY'] = encrypt(data.passkey.trim());
        }
        if (data.env !== undefined) {
            updateMap['SUPERADMIN_MPESA_ENV'] = data.env.trim().toLowerCase();
        }
        if (data.initiatorName !== undefined) {
            updateMap['SUPERADMIN_MPESA_INITIATOR_NAME'] = data.initiatorName.trim();
        }
        if (data.initiatorPassword !== undefined && data.initiatorPassword && !data.initiatorPassword.includes('****')) {
            updateMap['SUPERADMIN_MPESA_INITIATOR_PASSWORD'] = encrypt(data.initiatorPassword.trim());
        }
        if (data.tillNumber !== undefined) {
            updateMap['SUPERADMIN_MPESA_TILL'] = data.tillNumber.trim();
        }
        if (data.paybillNumber !== undefined) {
            updateMap['SUPERADMIN_MPESA_PAYBILL'] = data.paybillNumber.trim();
        }

        for (const [key, val] of Object.entries(updateMap)) {
            const [setting, created] = await PlatformSetting.findOrCreate({
                where: { key },
                defaults: { value: val }
            });
            if (!created) {
                await setting.update({ value: val });
            }
        }

        this.invalidateCache();
        logger.info('[MpesaService] Master Daraja API Initiator credentials updated and cache invalidated');
        return await this.getMasterStatus();
    }

    /**
     * Get Master M-Pesa Daraja Configuration Status (Masked for Security)
     */
    public static async getMasterStatus() {
        const creds = await this.getSuperAdminCredentials();
        const isConfigured = Boolean(
            creds.consumerKey &&
            creds.consumerSecret &&
            creds.shortcode &&
            creds.passkey
        );

        return {
            isConfigured,
            isMasterInitiatorActive: isConfigured,
            consumerKeyMasked: creds.consumerKey ? `${creds.consumerKey.slice(0, 4)}••••${creds.consumerKey.slice(-4)}` : '',
            hasConsumerSecret: Boolean(creds.consumerSecret),
            shortcode: creds.shortcode,
            tillNumber: creds.tillNumber,
            paybillNumber: creds.paybillNumber,
            hasPasskey: Boolean(creds.passkey),
            initiatorName: creds.initiatorName,
            hasInitiatorPassword: Boolean(creds.initiatorPassword),
            env: creds.env || 'production',
            gatewayRole: 'MASTER_DARAJA_API_INITIATOR'
        };
    }

    /**
     * Get OAuth Access Token from Safaricom Daraja
     */
    private static async getAccessToken(tenantId: string, forceRefresh: boolean = false): Promise<{ token: string; env: string }> {
        let consumerKey = '';
        let consumerSecret = '';
        let env = 'production';

        const isMaster = tenantId === 'superadmin' || tenantId === 'platform' || tenantId === 'master';

        if (isMaster) {
            const saCreds = await this.getSuperAdminCredentials();
            consumerKey = saCreds.consumerKey;
            consumerSecret = saCreds.consumerSecret;
            env = saCreds.env || 'production';
        } else {
            const tenant = await Tenant.findByPk(tenantId);
            if (tenant && tenant.mpesaConsumerKey && tenant.mpesaConsumerSecret) {
                consumerKey = decrypt(tenant.mpesaConsumerKey);
                consumerSecret = decrypt(tenant.mpesaConsumerSecret);
                env = tenant.mpesaEnvironment || 'production';
            } else {
                // Route through Master M-Pesa Daraja API Initiator
                const saCreds = await this.getSuperAdminCredentials();
                consumerKey = saCreds.consumerKey;
                consumerSecret = saCreds.consumerSecret;
                env = saCreds.env || 'production';
            }
        }

        const cacheKey = isMaster ? 'master' : tenantId;

        if (!forceRefresh) {
            const cache = this.tokenCache.get(cacheKey);
            if (cache && cache.token && cache.expiry > Date.now() && cache.env === env) {
                return { token: cache.token, env: cache.env };
            }
        } else {
            this.tokenCache.delete(cacheKey);
        }

        if (!consumerKey || !consumerSecret) {
            logger.error('[MpesaService] Live M-Pesa Consumer Key/Secret is missing or not configured.', { tenantId, env });
            throw new Error('Live Safaricom M-Pesa Consumer Key and Consumer Secret are required. Please configure your Master Daraja API credentials in platform settings.');
        }

        const auth = Buffer.from(`${consumerKey.trim()}:${consumerSecret.trim()}`).toString('base64');
        const baseUrl = this.getBaseUrl(env);

        try {
            const response = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: { 
                    Authorization: `Basic ${auth}`,
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache'
                },
                timeout: 15000
            });

            if (!response.data || !response.data.access_token) {
                throw new Error('Live Safaricom Daraja authorization server did not return an access token');
            }

            const rawToken = String(response.data.access_token).trim();
            const expiresIn = Number(response.data.expires_in) || 3600;
            this.tokenCache.set(cacheKey, {
                token: rawToken,
                expiry: Date.now() + (expiresIn - 60) * 1000,
                env
            });

            return { token: rawToken, env };
        } catch (error: any) {
            const darajaError = error.response?.data?.errorMessage || error.response?.data?.error || error.response?.data?.fault?.faultstring || error.message;
            logger.error('[MpesaService] Failed to obtain live access token from Safaricom Daraja', { error: darajaError, env, tenantId });
            this.tokenCache.delete(cacheKey);
            throw new Error(`Safaricom live OAuth authentication failed: ${darajaError}`);
        }
    }

    /**
     * Test live master connection credentials
     */
    static async testMasterConnection(): Promise<{ success: boolean; message: string; env: string; tokenExpiry?: string }> {
        try {
            const { token, env } = await this.getAccessToken('master', true);
            if (!token) throw new Error('Token was empty');
            return {
                success: true,
                message: `Master M-Pesa Daraja API Initiator connected successfully to Safaricom (${env.toUpperCase()})!`,
                env
            };
        } catch (error: any) {
            const errMsg = error.response?.data?.errorMessage || error.message || 'Master M-Pesa connection test failed';
            logger.error('[MpesaService] Master Daraja connection test failed', { error: errMsg });
            throw new Error(errMsg);
        }
    }

    /**
     * Test live connection credentials for any tenant or master
     */
    static async testConnection(tenantId: string): Promise<boolean> {
        try {
            const { token } = await this.getAccessToken(tenantId, true);
            return !token;
        } catch (error: any) {
            const errMsg = error.response?.data?.errorMessage || error.message || 'M-Pesa live connection test failed';
            logger.error('M-Pesa connection test failed', { tenantId, error: errMsg });
            throw new Error(errMsg);
        }
    }

    /**
     * Initiates live STK Push for Wi-Fi Hotspot or ISP Client Checkout
     * Uses Master M-Pesa Daraja API Initiator if tenant has no custom credentials
     */
    static async initiateStkPush(phoneNumber: string, amount: number, tenantId: string, userId: string = 'guest', packageId: string = '1') {
        const phoneValidation = normalizeKenyanPhone(phoneNumber);
        if (!phoneValidation.isValid) {
            throw new Error(phoneValidation.error || 'Invalid Kenyan phone number for M-Pesa STK Push');
        }
        const formattedPhone = phoneValidation.formatted;

        try {
            const tenant = await Tenant.findByPk(tenantId);
            const saCreds = await this.getSuperAdminCredentials();

            let businessShortcode = saCreds.shortcode;
            let passkey = saCreds.passkey;
            let env = saCreds.env || 'production';
            let partyB = saCreds.tillNumber || saCreds.shortcode;
            let transactionType = saCreds.tillNumber ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
            let authTenantId = 'master';

            // Check if tenant has their own verified Till/Paybill credentials
            if (tenant && tenant.mpesaConsumerKey && tenant.mpesaConsumerSecret && (tenant.mpesaTillNumber || tenant.mpesaPaybillNumber)) {
                authTenantId = tenantId;
                if (tenant.mpesaTillNumber) {
                    transactionType = 'CustomerBuyGoodsOnline';
                    partyB = tenant.mpesaTillNumber;
                    businessShortcode = tenant.mpesaTillNumber;
                } else if (tenant.mpesaPaybillNumber) {
                    transactionType = 'CustomerPayBillOnline';
                    partyB = tenant.mpesaPaybillNumber;
                    businessShortcode = tenant.mpesaPaybillNumber;
                }
                if (tenant.mpesaPasskey) {
                    passkey = decrypt(tenant.mpesaPasskey);
                }
                if (tenant.mpesaEnvironment) {
                    env = tenant.mpesaEnvironment;
                }
            } else if (tenant && (tenant.mpesaTillNumber || tenant.mpesaPaybillNumber)) {
                // Use master credentials but route funds to tenant's Till/Paybill
                // This requires the master shortcode to be an aggregator (Head Office) linked to the tenant's Till/Paybill
                if (tenant.mpesaTillNumber) {
                    transactionType = 'CustomerBuyGoodsOnline';
                    partyB = tenant.mpesaTillNumber;
                    // businessShortcode remains master's shortcode
                } else if (tenant.mpesaPaybillNumber) {
                    transactionType = 'CustomerPayBillOnline';
                    partyB = tenant.mpesaPaybillNumber;
                    // For PayBill, Safaricom usually expects BusinessShortCode == PartyB unless it's an aggregator
                }
            }

            if (!businessShortcode || !passkey) {
                throw new Error('Live Safaricom Business Shortcode and Online Passkey must be configured in Master Daraja Settings.');
            }

            let { token: accessToken, env: tokenEnv } = await this.getAccessToken(authTenantId);
            env = tokenEnv || env;

            const timestamp = this.getTimestamp();
            const password = Buffer.from(`${businessShortcode}${passkey}${timestamp}`).toString('base64');
            const callbackUrl = this.getCallbackUrl(`/api/v1/payment-callback/mpesa/stk-push/${tenantId}`);

            // Safaricom limits: AccountReference <= 12 chars, TransactionDesc <= 13 chars
            const safeRef = `WIFI${packageId.replace(/[^0-9A-Z]/gi, '')}`.slice(0, 12).toUpperCase();
            const safeDesc = `WiFi Payment`.slice(0, 13);

            const payload = {
                BusinessShortCode: businessShortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: transactionType,
                Amount: Math.max(1, Math.round(amount)),
                PartyA: formattedPhone,
                PartyB: partyB || businessShortcode,
                PhoneNumber: formattedPhone,
                CallBackURL: callbackUrl,
                AccountReference: safeRef,
                TransactionDesc: safeDesc,
            };

            let response: any;

            try {
                response = await axios.post(
                    `${this.getBaseUrl(env)}/mpesa/stkpush/v1/processrequest`,
                    payload,
                    {
                        headers: { 
                            Authorization: `Bearer ${accessToken.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 20000
                    }
                );
            } catch (postErr: any) {
                const errData = postErr.response?.data;
                const errStatus = postErr.response?.status;
                const errStr = typeof errData === 'string' ? errData : JSON.stringify(errData || {});
                const isTokenError = errStatus === 401 || errStatus === 403 ||
                    errStr.toLowerCase().includes('token') ||
                    errStr.toLowerCase().includes('invalid access token') ||
                    errStr.toLowerCase().includes('unauthorized');

                if (isTokenError) {
                    logger.warn('[MpesaService] Invalid access token during live STK Push. Retrying with freshly requested token...', { tenantId });
                    this.invalidateCache();
                    const refreshed = await this.getAccessToken(authTenantId, true);
                    accessToken = refreshed.token;
                    env = refreshed.env;

                    response = await axios.post(
                        `${this.getBaseUrl(env)}/mpesa/stkpush/v1/processrequest`,
                        payload,
                        {
                            headers: { 
                                Authorization: `Bearer ${accessToken.trim()}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 20000
                        }
                    );
                } else {
                    throw postErr;
                }
            }

            logger.info('[MpesaService] Live STK Push Sent Successfully via Master Initiator', {
                tenantId,
                phoneNumber: formattedPhone,
                amount,
                businessShortcode,
                checkoutId: response.data.CheckoutRequestID
            });

            return {
                ...response.data,
                destinationAccount: partyB || businessShortcode,
                destinationType: transactionType === 'CustomerBuyGoodsOnline' ? 'Till Number' : 'Paybill'
            };
        } catch (error: any) {
            const darajaError = error.response?.data?.errorMessage || error.response?.data?.ResponseDescription || error.response?.data?.CustomerMessage || error.response?.data?.fault?.faultstring || error.response?.data?.error || error.message;
            logger.error('[MpesaService] Live STK Push Request Failed', { tenantId, phone: formattedPhone, error: darajaError });
            throw new Error(`Live M-Pesa STK Push error: ${darajaError}`);
        }
    }

    /**
     * Live STK Push for Tenant Monthly SaaS Subscription Payments (Paid to Platform / SuperAdmin Account)
     */
    static async initiateStkPushForSaaSInvoice(invoiceId: string, tenantId: string, phoneNumber: string, amount: number, req?: any) {
        const phoneValidation = normalizeKenyanPhone(phoneNumber);
        if (!phoneValidation.isValid) {
            throw new Error(phoneValidation.error || 'Invalid Kenyan phone number for M-Pesa STK Push');
        }
        const formattedPhone = phoneValidation.formatted;

        try {
            const saCreds = await this.getSuperAdminCredentials();
            let { token: accessToken, env } = await this.getAccessToken('master');

            const businessShortcode = saCreds.shortcode;
            const passkey = saCreds.passkey;

            if (!businessShortcode || !passkey) {
                throw new Error('Super Admin Live M-Pesa Shortcode and Passkey are not configured in platform settings.');
            }

            const pricingConfig = await PlatformPricingConfig.findOne().catch(() => null);
            const partyB = pricingConfig?.subscriptionTillNumber || saCreds.tillNumber || saCreds.paybillNumber || saCreds.shortcode;
            const transactionType = (pricingConfig?.subscriptionTillNumber || saCreds.tillNumber) ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline";

            const timestamp = this.getTimestamp();
            const password = Buffer.from(`${businessShortcode}${passkey}${timestamp}`).toString('base64');
            const callbackUrl = this.getCallbackUrl('/api/v1/payment-callback/mpesa/stk-push/superadmin', req);

            const safeRef = `INV${invoiceId.replace(/[^0-9A-Z]/gi, '')}`.slice(0, 12).toUpperCase();
            const safeDesc = `SaaS Sub`.slice(0, 13);

            const payload = {
                BusinessShortCode: businessShortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: transactionType,
                Amount: Math.max(1, Math.round(amount)),
                PartyA: formattedPhone,
                PartyB: partyB || businessShortcode,
                PhoneNumber: formattedPhone,
                CallBackURL: callbackUrl,
                AccountReference: safeRef,
                TransactionDesc: safeDesc,
            };

            let response: any;

            try {
                response = await axios.post(
                    `${this.getBaseUrl(env)}/mpesa/stkpush/v1/processrequest`,
                    payload,
                    {
                        headers: { 
                            Authorization: `Bearer ${accessToken.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 20000
                    }
                );
            } catch (postErr: any) {
                const errData = postErr.response?.data;
                const errStatus = postErr.response?.status;
                const errStr = typeof errData === 'string' ? errData : JSON.stringify(errData || {});
                const isTokenError = errStatus === 401 || errStatus === 403 ||
                    errStr.toLowerCase().includes('token') ||
                    errStr.toLowerCase().includes('invalid access token') ||
                    errStr.toLowerCase().includes('unauthorized');

                if (isTokenError) {
                    logger.warn('[MpesaService] Invalid access token during live SaaS STK Push. Retrying with refreshed token...');
                    this.invalidateCache();
                    const refreshed = await this.getAccessToken('master', true);
                    accessToken = refreshed.token;
                    env = refreshed.env;

                    response = await axios.post(
                        `${this.getBaseUrl(env)}/mpesa/stkpush/v1/processrequest`,
                        payload,
                        {
                            headers: { 
                                Authorization: `Bearer ${accessToken.trim()}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 20000
                        }
                    );
                } else {
                    throw postErr;
                }
            }

            const checkoutId = response.data.CheckoutRequestID || `LIVE-${Date.now()}`;
            const merchantReqId = response.data.MerchantRequestID || `MR-${Date.now()}`;

            // Create Pending SaaS Subscription Payment record linked to invoice
            await SaaSSubscriptionPayment.create({
                id: uuidv4(),
                tenantId: tenantId,
                invoiceId: invoiceId,
                amount: amount,
                currency: 'KES',
                status: 'PENDING',
                phoneNumber: formattedPhone,
                checkoutRequestId: checkoutId,
                merchantRequestId: merchantReqId,
                rawCallback: JSON.stringify({ invoiceId, type: 'LIVE_SAAS_STK_PUSH' })
            }).catch(e => {
                logger.warn('[MpesaService] Failed to create pending SaaSSubscriptionPayment record', { error: e.message });
            });

            logger.info('[MpesaService] Live SaaS Subscription STK Push Initiated via Master Initiator', {
                invoiceId,
                tenantId,
                phoneNumber: formattedPhone,
                amount,
                checkoutId
            });

            return response.data;
        } catch (error: any) {
            const darajaError = error.response?.data?.errorMessage || error.response?.data?.ResponseDescription || error.response?.data?.CustomerMessage || error.response?.data?.fault?.faultstring || error.response?.data?.error || error.message;
            logger.error('[MpesaService] Live SaaS STK Push Failed', { invoiceId, tenantId, error: darajaError });
            throw new Error(`Live SaaS STK Push failed: ${darajaError}`);
        }
    }

    /**
     * B2C Payout / Disbursement Initiator (Disbursements, Refunds, Partner Settlements)
     */
    static async initiateB2CDisbursement(params: {
        phoneNumber: string;
        amount: number;
        remarks: string;
        occasion?: string;
        commandId?: 'SalaryPayment' | 'BusinessPayment' | 'PromotionPayment';
    }) {
        const phoneValidation = normalizeKenyanPhone(params.phoneNumber);
        if (!phoneValidation.isValid) {
            throw new Error(phoneValidation.error || 'Invalid phone number for B2C disbursement');
        }
        const formattedPhone = phoneValidation.formatted;

        const saCreds = await this.getSuperAdminCredentials();
        if (!saCreds.initiatorName || !saCreds.initiatorPassword) {
            throw new Error('Master Daraja B2C Initiator Name and Security Credential/Password must be configured in Master Settings.');
        }

        const { token: accessToken, env } = await this.getAccessToken('master');
        const baseUrl = this.getBaseUrl(env);

        const callbackUrl = this.getCallbackUrl('/api/v1/payment-callback/mpesa/b2c/result');
        const timeoutUrl = this.getCallbackUrl('/api/v1/payment-callback/mpesa/b2c/timeout');

        const payload = {
            InitiatorName: saCreds.initiatorName,
            SecurityCredential: saCreds.initiatorPassword,
            CommandID: params.commandId || 'BusinessPayment',
            Amount: Math.max(1, Math.round(params.amount)),
            PartyA: saCreds.shortcode || saCreds.paybillNumber,
            PartyB: formattedPhone,
            Remarks: (params.remarks || 'Disbursement').slice(0, 100),
            QueueTimeOutURL: timeoutUrl,
            ResultURL: callbackUrl,
            Occasion: (params.occasion || 'Payout').slice(0, 100)
        };

        const response = await axios.post(`${baseUrl}/mpesa/b2c/v1/paymentrequest`, payload, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 20000
        });

        logger.info('[MpesaService] Live B2C Disbursement Initiated via Master Initiator', {
            phone: formattedPhone,
            amount: params.amount,
            conversationId: response.data.ConversationID
        });

        return response.data;
    }

    /**
     * Live verification via Safaricom Transaction Status Query API
     */
    static async checkTransactionStatus(checkoutRequestID: string, targetTenantId?: string) {
        try {
            let tenantId = targetTenantId;
            let paymentRecord: any = await Payment.findOne({ where: { checkoutRequestId: checkoutRequestID } });
            if (!paymentRecord) {
                paymentRecord = await SaaSSubscriptionPayment.findOne({ where: { checkoutRequestId: checkoutRequestID } });
            }

            if (paymentRecord) {
                tenantId = tenantId || paymentRecord.tenantId;
            }

            if (!tenantId) {
                const firstTenant = await Tenant.findOne({ order: [['createdAt', 'ASC']] });
                tenantId = firstTenant?.id;
            }

            if (!tenantId) return null;

            const { token: accessToken, env } = await this.getAccessToken(tenantId);

            const saCreds = await this.getSuperAdminCredentials();
            const tenant = await Tenant.findByPk(tenantId);

            const businessShortcode = tenant?.mpesaPaybillNumber || saCreds.shortcode;
            const passkey = tenant?.mpesaPasskey ? decrypt(tenant.mpesaPasskey) : saCreds.passkey;

            if (!businessShortcode || !passkey) return null;

            const timestamp = this.getTimestamp();
            const password = Buffer.from(`${businessShortcode}${passkey}${timestamp}`).toString('base64');

            const baseUrl = this.getBaseUrl(env);
            const response = await axios.post(
                `${baseUrl}/mpesa/stkpushquery/v1/query`,
                {
                    BusinessShortCode: businessShortcode,
                    Password: password,
                    Timestamp: timestamp,
                    CheckoutRequestID: checkoutRequestID
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    timeout: 15000
                }
            );

            return response.data;
        } catch (error: any) {
            const errMsg = error.response?.data || error.message;
            logger.warn('[MpesaService] Live STK Query Failed or In Progress', { checkoutRequestID, error: errMsg });
            return null;
        }
    }
}


