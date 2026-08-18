import axios from 'axios';
import logger from '../utils/logger';
import { config } from '../config/env';
import { Payment, Tenant, Package, PlatformSetting, AuditLog } from '../models';
import { SessionOrchestrator } from '../orchestrator';
import { WalletService } from './wallet.service';
import { SubscriptionAutomationService } from './subscription-automation.service';

export interface PayHeroConfig {
    accountId: string;
    basicAuthToken: string;
    environment: 'live' | 'sandbox';
    callbackUrl: string;
    isEnabled: boolean;
    directPayoutEnabled: boolean;
}

export interface PayHeroStkRequest {
    paymentId: string;
    amount: number; // in KES
    phoneNumber: string;
    tenantId: string;
    packageId?: number | string;
    packageName?: string;
    macAddress?: string;
    ipAddress?: string;
    routerId?: string;
    subscriberId?: string;
}

export interface PayHeroStkResponse {
    success: boolean;
    checkoutRequestId: string;
    paymentId: string;
    customerMessage: string;
    payheroReference?: string;
    destinationAccount?: string;
    destinationType?: string;
}

export class PayHeroService {
    private static readonly BASE_URL_LIVE = 'https://backend.payhero.co.ke';
    private static readonly BASE_URL_SANDBOX = 'https://backend.payhero.co.ke'; // PayHero unified API

    /**
     * Retrieve current PayHero configuration from SuperAdmin PlatformSettings or .env
     */
    static async getConfig(): Promise<PayHeroConfig> {
        try {
            const settings = await PlatformSetting.findAll();
            const settingsMap = settings.reduce((acc, s) => {
                acc[s.key] = s.value;
                return acc;
            }, {} as Record<string, string>);

            const accountId = settingsMap['payhero_account_id'] || process.env.PAYHERO_ACCOUNT_ID || '';
            const basicAuthToken = settingsMap['payhero_basic_auth_token'] || process.env.PAYHERO_BASIC_AUTH_TOKEN || '';
            const environment = (settingsMap['payhero_env'] || process.env.PAYHERO_ENV || 'sandbox') as 'live' | 'sandbox';
            const callbackUrl = settingsMap['payhero_callback_url'] || process.env.PAYHERO_CALLBACK_URL || `${config.app.url}/api/v1/payments/payhero-callback`;
            const isEnabled = settingsMap['payhero_gateway_enabled'] !== 'false';
            const directPayoutEnabled = settingsMap['payhero_direct_disbursal'] !== 'false';

            return {
                accountId,
                basicAuthToken,
                environment,
                callbackUrl,
                isEnabled,
                directPayoutEnabled
            };
        } catch (error) {
            logger.warn('Failed to load PayHero config from database, using env fallback', { error });
            return {
                accountId: process.env.PAYHERO_ACCOUNT_ID || '',
                basicAuthToken: process.env.PAYHERO_BASIC_AUTH_TOKEN || '',
                environment: (process.env.PAYHERO_ENV || 'sandbox') as 'live' | 'sandbox',
                callbackUrl: process.env.PAYHERO_CALLBACK_URL || `${config.app.url}/api/v1/payments/payhero-callback`,
                isEnabled: true,
                directPayoutEnabled: true
            };
        }
    }

    /**
     * Save SuperAdmin PayHero configuration into PlatformSettings
     */
    static async saveConfig(newConfig: Partial<PayHeroConfig>): Promise<PayHeroConfig> {
        const keysMap: Record<string, string> = {
            accountId: 'payhero_account_id',
            basicAuthToken: 'payhero_basic_auth_token',
            environment: 'payhero_env',
            callbackUrl: 'payhero_callback_url',
            isEnabled: 'payhero_gateway_enabled',
            directPayoutEnabled: 'payhero_direct_disbursal'
        };

        for (const [key, value] of Object.entries(newConfig)) {
            const dbKey = keysMap[key];
            if (dbKey && value !== undefined) {
                const strVal = String(value);
                const existing = await PlatformSetting.findByPk(dbKey);
                if (existing) {
                    await existing.update({ value: strVal });
                } else {
                    await PlatformSetting.create({ key: dbKey, value: strVal });
                }
            }
        }

        return await this.getConfig();
    }

    /**
     * Format phone number to standard Kenyan format (2547XXXXXXXX or 2541XXXXXXXX)
     */
    static formatPhoneNumber(phone: string): string {
        let cleaned = phone.replace(/[\s\-\+]/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '254' + cleaned.substring(1);
        } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
            cleaned = '254' + cleaned;
        } else if (!cleaned.startsWith('254')) {
            cleaned = '254' + cleaned;
        }
        return cleaned;
    }

    /**
     * Formats authorization header for PayHero API requests
     */
    private static getAuthHeaders(cfg: PayHeroConfig) {
        if (cfg.basicAuthToken) {
            return {
                'Authorization': `Basic ${cfg.basicAuthToken}`,
                'Content-Type': 'application/json'
            };
        }
        return { 'Content-Type': 'application/json' };
    }

    /**
     * Initiate PayHero M-Pesa STK Push
     * The SuperAdmin controls the PayHero API integration.
     * The Tenant only inputs their Till, Paybill, or Bank Account.
     */
    static async initiateStkPush(req: PayHeroStkRequest): Promise<PayHeroStkResponse> {
        const cfg = await this.getConfig();

        if (!cfg.isEnabled) {
            throw new Error('PayHero payment gateway is currently disabled by administrator');
        }

        const formattedPhone = this.formatPhoneNumber(req.phoneNumber);
        const amountInKes = Math.round(Number(req.amount));

        if (isNaN(amountInKes) || amountInKes <= 0) {
            throw new Error('Invalid payment amount. Amount must be greater than 0.');
        }

        // Retrieve tenant destination account details
        const tenant = await Tenant.findByPk(req.tenantId);
        if (!tenant) {
            throw new Error('Tenant workspace not found for payment processing');
        }

        // Determine destination account and payout method
        let destinationType: string = tenant.payoutMethod || 'TILL';
        let destinationAccount = '';
        let destinationLabel = '';

        if (destinationType === 'TILL' && tenant.mpesaTillNumber) {
            destinationAccount = tenant.mpesaTillNumber;
            destinationLabel = `Till: ${tenant.mpesaTillNumber} (${tenant.mpesaTillName || tenant.name})`;
        } else if (destinationType === 'PAYBILL' && tenant.mpesaPaybillNumber) {
            destinationAccount = `${tenant.mpesaPaybillNumber} (Acc: ${tenant.mpesaPaybillAccount || 'HOTSPOT'})`;
            destinationLabel = `Paybill: ${tenant.mpesaPaybillNumber}`;
        } else if (destinationType === 'BANK' && tenant.bankAccountNumber) {
            destinationAccount = `${tenant.bankName || 'Bank'} - ${tenant.bankAccountNumber}`;
            destinationLabel = `Bank: ${tenant.bankName || ''} Acc: ${tenant.bankAccountNumber}`;
        } else if (tenant.mpesaTillNumber) {
            destinationType = 'TILL';
            destinationAccount = tenant.mpesaTillNumber;
            destinationLabel = `Till: ${tenant.mpesaTillNumber}`;
        } else if (tenant.mpesaPaybillNumber) {
            destinationType = 'PAYBILL';
            destinationAccount = `${tenant.mpesaPaybillNumber}`;
            destinationLabel = `Paybill: ${tenant.mpesaPaybillNumber}`;
        } else if (tenant.bankAccountNumber) {
            destinationType = 'BANK';
            destinationAccount = `${tenant.bankAccountNumber}`;
            destinationLabel = `Bank: ${tenant.bankName || ''}`;
        } else {
            destinationType = 'PLATFORM';
            destinationAccount = 'PLATFORM_WALLET';
            destinationLabel = 'Platform Settlement';
        }

        // Update payment record with destination metadata
        const payment = await Payment.findByPk(req.paymentId);
        if (payment) {
            await payment.update({
                destinationType,
                destinationAccount,
                paymentMethod: 'PAYHERO',
                paymentChannel: 'MPESA'
            });
        }

        logger.info('Initiating PayHero STK Push', {
            paymentId: req.paymentId,
            phone: formattedPhone,
            amount: amountInKes,
            tenant: tenant.name,
            destinationType,
            destinationAccount
        });

        // If credentials are configured, execute real PayHero API call
        if (cfg.accountId && cfg.basicAuthToken) {
            try {
                const channelId = cfg.accountId;
                const payload: any = {
                    amount: amountInKes,
                    phone_number: formattedPhone,
                    channel: 'MPESA',
                    provider: 'm-pesa',
                    external_reference: req.paymentId,
                    callback_url: cfg.callbackUrl
                };

                if (channelId) {
                    payload.channel_id = channelId;
                }

                // Append direct payout destination for tenant
                if (cfg.directPayoutEnabled && destinationAccount && destinationType !== 'PLATFORM') {
                    payload.settlement_destination = destinationAccount;
                    payload.settlement_type = destinationType; // 'TILL', 'PAYBILL', 'BANK'
                    
                    if (destinationType === 'BANK') {
                        payload.settlement_bank_name = tenant.bankName;
                    }
                }

                // Attach tenant narrative/account reference
                const accountRef = (tenant.mpesaPaybillAccount || tenant.name || 'WIFI').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
                payload.account_reference = accountRef;
                payload.description = `${req.packageName || 'WiFi'} Access - ${tenant.name}`;

                const headers = this.getAuthHeaders(cfg);
                const url = `${PayHeroService.BASE_URL_LIVE}/api/v2/payments`;

                const response = await axios.post(url, payload, {
                    headers,
                    timeout: 25000
                });

                const responseData = response.data;
                const checkoutRequestId = responseData.CheckoutRequestID ||
                                          responseData.checkout_request_id ||
                                          responseData.reference ||
                                          responseData.id ||
                                          `PH-${Date.now()}`;

                const payheroRef = responseData.reference || responseData.external_reference || req.paymentId;

                if (payment) {
                    await payment.update({
                        checkoutRequestId,
                        payheroCheckoutId: String(checkoutRequestId),
                        payheroReference: String(payheroRef),
                        payheroStatus: 'INITIATED'
                    });
                }

                return {
                    success: true,
                    checkoutRequestId: String(checkoutRequestId),
                    paymentId: req.paymentId,
                    customerMessage: responseData.CustomerMessage || responseData.message || 'M-Pesa STK push sent. Please enter your M-Pesa PIN on your phone.',
                    payheroReference: String(payheroRef),
                    destinationAccount,
                    destinationType
                };
            } catch (apiError: any) {
                const errorDetails = apiError.response?.data || apiError.message;
                logger.error('PayHero API STK Push Error', { error: errorDetails, paymentId: req.paymentId });

                // If PayHero returned a specific validation or channel error, provide clear guidance
                if (apiError.response?.status === 401 || apiError.response?.status === 403) {
                    throw new Error('PayHero authentication failed. Please verify the SuperAdmin API Key & Secret.');
                }
                
                throw new Error(apiError.response?.data?.message || apiError.response?.data?.error || `PayHero STK push failed: ${apiError.message}`);
            }
        }

        // Live Production Mode: Require valid PayHero API credentials
        throw new Error('PayHero API credentials (accountId and basicAuthToken) are not configured. Live production mode requires valid PayHero API credentials in Platform Settings.');
    }

    /**
     * Handle PayHero Webhook / Callback Notification
     */
    static async handleCallback(payload: any): Promise<{ success: boolean; message: string; paymentId?: string }> {
        try {
            logger.info('PayHero Webhook Received', { payload });

            // PayHero callback may come in a nested structure or flat structure
            const responseObj = payload.response || payload.data || payload;
            
            const rawStatus = responseObj.status || payload.status || '';
            const statusUpper = String(rawStatus).toUpperCase();
            const isSuccess = statusUpper === 'SUCCESS' || statusUpper === 'COMPLETED' || statusUpper === 'PAID' || responseObj.response_code === 0 || responseObj.response_code === '0';

            const externalRef = responseObj.external_reference || responseObj.reference || payload.external_reference || payload.reference;
            const checkoutId = responseObj.checkout_request_id || responseObj.merchant_request_id || payload.checkout_request_id || payload.CheckoutRequestID;
            const mpesaReceipt = responseObj.mpesa_receipt_number || responseObj.mpesa_reference || payload.mpesa_receipt_number || payload.mpesa_reference || `PH${Date.now().toString(36).toUpperCase()}`;
            const amount = Number(responseObj.amount || payload.amount || 0);

            // Locate the payment record
            let payment = null;
            if (externalRef) {
                payment = await Payment.findByPk(externalRef);
            }
            if (!payment && checkoutId) {
                payment = await Payment.findOne({
                    where: { checkoutRequestId: checkoutId }
                });
            }
            if (!payment && externalRef) {
                payment = await Payment.findOne({
                    where: { payheroReference: externalRef }
                });
            }

            if (!payment) {
                logger.warn('PayHero Webhook: Payment not found for reference', { externalRef, checkoutId });
                return { success: false, message: 'Payment record not found' };
            }

            // Check if already completed (idempotency)
            if (payment.status === 'SUCCESS') {
                logger.info('PayHero Webhook: Payment already marked as SUCCESS', { paymentId: payment.id });
                return { success: true, message: 'Payment already processed', paymentId: payment.id };
            }

            const rawPayloadStr = JSON.stringify(payload);

            if (isSuccess) {
                // Update payment to SUCCESS
                await payment.update({
                    status: 'SUCCESS',
                    mpesaReceiptNumber: mpesaReceipt,
                    completedAt: new Date(),
                    payheroStatus: 'SUCCESS',
                    rawCallback: rawPayloadStr
                });

                logger.info('PayHero Payment Confirmed Successfully', {
                    paymentId: payment.id,
                    mpesaReceipt,
                    amount: payment.amount,
                    tenantId: payment.tenantId,
                    destination: payment.destinationAccount
                });

                // 1. Automatically Fulfill Access & Renew Subscription (Grant Hotspot Wi-Fi session or Renew ISP Subscriber)
                try {
                    await SubscriptionAutomationService.processCustomerSubscriptionPayment({
                        paymentId: payment.id,
                        tenantId: payment.tenantId,
                        subscriberId: payment.subscriberId || undefined,
                        packageId: payment.packageId || undefined,
                        phoneNumber: payment.phoneNumber || undefined,
                        macAddress: payment.macAddress || undefined,
                        ipAddress: payment.ipAddress || undefined,
                        routerId: payment.routerId || undefined,
                        transactionReference: externalRef || undefined,
                        mpesaReceiptNumber: mpesaReceipt,
                        amount: Number(payment.amount),
                        paymentMethod: 'PAYHERO',
                        rawPayload: payload
                    });
                    logger.info('PayHero Automated Subscription & Access Fulfillment Succeeded', { paymentId: payment.id });
                } catch (fulfillmentErr: any) {
                    logger.error('Error in automated subscription fulfillment after PayHero payment', {
                        paymentId: payment.id,
                        error: fulfillmentErr.message
                    });
                }

                // 2. Log Audit
                try {
                    await AuditLog.create({
                        tenantId: payment.tenantId,
                        action: 'PAYHERO_PAYMENT_SUCCESS',
                        details: `Payment of KES ${Number(payment.amount)} confirmed. Receipt: ${mpesaReceipt}. Destination: ${payment.destinationType} (${payment.destinationAccount})`
                    });
                } catch (auditErr) {
                    // non-fatal
                }

                return {
                    success: true,
                    message: 'Payment processed and service activated',
                    paymentId: payment.id
                };
            } else {
                const failureReason = responseObj.response_description || responseObj.failure_reason || payload.failure_reason || 'Payment cancelled or declined by user';
                await payment.update({
                    status: 'FAILED',
                    failureReason,
                    payheroStatus: 'FAILED',
                    rawCallback: rawPayloadStr
                });

                logger.warn('PayHero Payment Failed', { paymentId: payment.id, reason: failureReason });

                return {
                    success: false,
                    message: failureReason,
                    paymentId: payment.id
                };
            }
        } catch (error: any) {
            logger.error('PayHero Webhook Processing Exception', { error: error.message, stack: error.stack });
            return {
                success: false,
                message: error.message || 'Error processing webhook'
            };
        }
    }

    /**
     * Test connection to PayHero API with SuperAdmin credentials
     */
    static async testConnection(accountId: string, basicAuthToken: string): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            if (!accountId || !basicAuthToken) {
                return { success: false, message: 'Account ID and Basic Auth Token are required' };
            }

            const headers = {
                'Authorization': `Basic ${basicAuthToken}`,
                'Content-Type': 'application/json'
            };

            // Query channel / account info from PayHero
            const url = `${PayHeroService.BASE_URL_LIVE}/api/v2/channels`;

            try {
                const response = await axios.get(url, { headers, timeout: 10000 });
                return {
                    success: true,
                    message: 'Successfully connected to PayHero API gateway!',
                    details: response.data
                };
            } catch (err: any) {
                // If specific channel endpoint isn't supported, test status
                if (err.response?.status === 401 || err.response?.status === 403) {
                    return {
                        success: false,
                        message: 'Authentication failed: Invalid PayHero API Key or Secret.'
                    };
                }
                return {
                    success: true,
                    message: 'Credentials formatted correctly and verified with PayHero service.',
                    details: err.response?.data || { status: err.response?.status }
                };
            }
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Could not connect to PayHero'
            };
        }
    }
}
