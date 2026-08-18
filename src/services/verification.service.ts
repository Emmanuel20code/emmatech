import { AuditService } from './audit.service';
import logger from '../utils/logger';

export class VerificationService {
    private static otpStore: Map<string, { otp: string; expires: number }> = new Map();

    /**
     * Generate and send OTP
     */
    static async sendOTP(target: string, type: 'EMAIL' | 'SMS', tenantId: string, userId: string): Promise<boolean> {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

        this.otpStore.set(`${userId}:${target}`, { otp, expires });

        logger.info(`OTP generated for ${target}: ${otp}`);

        // In a real system, send via Mailer or SMS Gateway
        // For now, we log it and assume it's sent
        await AuditService.log('OTP_SENT', `OTP sent to ${target} via ${type}`, tenantId, userId);

        return true;
    }

    /**
     * Verify OTP
     */
    static async verifyOTP(target: string, otp: string, userId: string): Promise<boolean> {
        const key = `${userId}:${target}`;
        const stored = this.otpStore.get(key);

        if (!stored) return false;
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
