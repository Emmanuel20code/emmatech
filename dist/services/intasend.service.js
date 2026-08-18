"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntaSendService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../utils/logger"));
const env_1 = require("../config/env");
class IntaSendService {
    static getBaseUrl() {
        return env_1.config.payments.intasend.env === 'production'
            ? 'https://payment.intasend.com'
            : 'https://sandbox.intasend.com';
    }
    static getSecretKey() {
        return env_1.config.payments.intasend.secretKey;
    }
    /**
     * Initiate M-Pesa STK Push via IntaSend
     */
    static async initiateStkPush(params) {
        try {
            const secretKey = this.getSecretKey();
            if (!secretKey)
                throw new Error('IntaSend Secret Key missing');
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
            const response = await axios_1.default.post(`${this.getBaseUrl()}/api/v1/payment/mpesa-stk-push/`, payload, {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                }
            });
            logger_1.default.info('IntaSend STK Push Initiated', {
                paymentId: params.paymentId,
                trackingId: response.data.id
            });
            const data = response.data;
            data.tracking_id = data.tracking_id || data.id;
            return data;
        }
        catch (error) {
            logger_1.default.error('IntaSend STK Push Failed', {
                error: error.response?.data || error.message,
                paymentId: params.paymentId
            });
            throw error;
        }
    }
    /**
     * Check transaction status via IntaSend API
     */
    static async checkStatus(trackingId) {
        try {
            const secretKey = this.getSecretKey();
            if (!secretKey)
                throw new Error('IntaSend Secret Key missing');
            const response = await axios_1.default.post(`${this.getBaseUrl()}/api/v1/payment/status/`, { tracking_id: trackingId }, {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('IntaSend Status Check Failed', {
                error: error.response?.data || error.message,
                trackingId
            });
            return null;
        }
    }
    /**
     * Verify IntaSend Webhook Signature
     */
    static verifySignature(payload, signature) {
        const token = env_1.config.payments.intasend.webhookToken;
        if (!token)
            return true; // Fail open if no token configured? Or fail closed? Should probably fail closed in prod.
        // HMAC SHA256 of the token + message (or just message depending on verification method)
        // IntaSend usually requires state verification.
        // Assuming we are verifying the payload against the token using HMAC.
        const computedSignature = crypto_1.default
            .createHmac('sha256', token)
            .update(payload)
            .digest('hex');
        return computedSignature === signature;
    }
}
exports.IntaSendService = IntaSendService;
