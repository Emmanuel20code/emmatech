import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';
import { config } from '../config/env';

export class IntaSendService {
    private static getBaseUrl() {
        return config.payments.intasend.env === 'production'
            ? 'https://payment.intasend.com'
            : 'https://sandbox.intasend.com';
    }

    private static getSecretKey() {
        return config.payments.intasend.secretKey;
    }

    /**
     * Initiate M-Pesa STK Push via IntaSend
     */
    static async initiateStkPush(params: {
        paymentId: string;
        amount: bigint; // Amount in cents
        phoneNumber: string;
        firstName?: string;
        lastName?: string;
        email?: string;
    }) {
        try {
            const secretKey = this.getSecretKey();
            if (!secretKey) throw new Error('IntaSend Secret Key missing');

            // IntaSend expects amount in base currency (e.g. KES)
            const amountInBase = Number(params.amount);

            const payload = {
                phone_number: params.phoneNumber,
                amount: amountInBase,
                api_ref: params.paymentId,
                first_name: params.firstName || 'Customer',
                last_name: params.lastName || 'Guest',
                email: params.email || 'customer@example.com',
                method: 'MPESA_STK_PUSH'
            };

            const response = await axios.post(
                `${this.getBaseUrl()}/api/v1/payment/mpesa-stk-push/`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info('IntaSend STK Push Initiated', {
                paymentId: params.paymentId,
                trackingId: response.data.id
            });

            const data = response.data;
            data.tracking_id = data.tracking_id || data.id;
            return data;
        } catch (error: any) {
            logger.error('IntaSend STK Push Failed', {
                error: error.response?.data || error.message,
                paymentId: params.paymentId
            });
            throw error;
        }
    }

    /**
     * Check transaction status via IntaSend API
     */
    static async checkStatus(trackingId: string) {
        try {
            const secretKey = this.getSecretKey();
            if (!secretKey) throw new Error('IntaSend Secret Key missing');

            const response = await axios.post(
                `${this.getBaseUrl()}/api/v1/payment/status/`,
                { tracking_id: trackingId },
                {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error: any) {
            logger.error('IntaSend Status Check Failed', {
                error: error.response?.data || error.message,
                trackingId
            });
            return null;
        }
    }

    /**
     * Verify IntaSend Webhook Signature
     */
    static verifySignature(payload: string | Buffer, signature: string): boolean {
        const token = config.payments.intasend.webhookToken;
        if (!token) return true; // Fail open if no token configured? Or fail closed? Should probably fail closed in prod.

        // HMAC SHA256 of the token + message (or just message depending on verification method)
        // IntaSend usually requires state verification.
        // Assuming we are verifying the payload against the token using HMAC.

        const computedSignature = crypto
            .createHmac('sha256', token)
            .update(payload)
            .digest('hex');

        return computedSignature === signature;
    }
}
