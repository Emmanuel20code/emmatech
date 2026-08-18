"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const audit_service_1 = require("./audit.service");
const logger_1 = __importDefault(require("../utils/logger"));
class VerificationService {
    static { this.otpStore = new Map(); }
    /**
     * Generate and send OTP
     */
    static async sendOTP(target, type, tenantId, userId) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
        this.otpStore.set(`${userId}:${target}`, { otp, expires });
        logger_1.default.info(`OTP generated for ${target}: ${otp}`);
        // In a real system, send via Mailer or SMS Gateway
        // For now, we log it and assume it's sent
        await audit_service_1.AuditService.log('OTP_SENT', `OTP sent to ${target} via ${type}`, tenantId, userId);
        return true;
    }
    /**
     * Verify OTP
     */
    static async verifyOTP(target, otp, userId) {
        const key = `${userId}:${target}`;
        const stored = this.otpStore.get(key);
        if (!stored)
            return false;
        if (Date.now() > stored.expires) {
            this.otpStore.delete(key);
            return false;
        }
        if (stored.otp === otp) {
            this.otpStore.delete(key);
            return true;
        }
        return false;
    }
}
exports.VerificationService = VerificationService;
