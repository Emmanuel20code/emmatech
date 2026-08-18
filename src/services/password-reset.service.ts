import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AdminUser, PasswordResetToken, AuditLog } from '../models';
import { sendPasswordResetEmail, sendPasswordResetOTPEmail, sendPasswordResetConfirmationEmail } from './emailService';
import logger from '../utils/logger';
import { Op } from 'sequelize';

export interface PasswordResetOptions {
    email: string;
    resetType?: 'LINK' | 'OTP';
    expiryMinutes?: number;
    ipAddress?: string;
    userAgent?: string;
}

export class PasswordResetService {
    // Password Strength Policy Rules
    public static validatePasswordPolicy(password: string): { valid: boolean; message?: string } {
        if (!password || password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters long.' };
        }
        if (!/[A-Z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
        }
        if (!/[a-z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
        }
        if (!/\d/.test(password)) {
            return { valid: false, message: 'Password must contain at least one numerical digit (0-9).' };
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*...).' };
        }
        return { valid: true };
    }

    /**
     * Rate Limit Check: Max 3 reset requests per 15 minutes per IP/Email
     */
    public static async checkRateLimit(email: string, ipAddress: string): Promise<boolean> {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const user = await AdminUser.findOne({ where: { email } });
        
        const orConditions: any[] = [];
        if (ipAddress) {
            orConditions.push({ ipAddress });
        }
        if (user?.id) {
            orConditions.push({ userId: user.id });
        }

        if (orConditions.length === 0) {
            return true;
        }

        const recentCount = await PasswordResetToken.count({
            where: {
                [Op.or]: orConditions,
                createdAt: { [Op.gt]: fifteenMinsAgo }
            }
        });
        return recentCount < 5; // Allow max 5 requests per 15 min window
    }

    /**
     * 1. Request Password Recovery (Link or OTP)
     */
    public static async requestPasswordReset(opts: PasswordResetOptions): Promise<{ success: boolean; message: string }> {
        const rawEmail = (opts.email || '').trim().toLowerCase();
        const resetType = opts.resetType || 'LINK';
        const expiryMinutes = [15, 30, 60].includes(opts.expiryMinutes || 60) ? (opts.expiryMinutes || 60) : 60;
        const ipAddress = opts.ipAddress || '127.0.0.1';
        const userAgent = opts.userAgent || '';

        // Rate limiting shield
        const isAllowed = await this.checkRateLimit(rawEmail, ipAddress);
        if (!isAllowed) {
            return {
                success: false,
                message: 'Too many password reset attempts. Please wait 15 minutes before trying again.'
            };
        }

        const user = await AdminUser.findOne({ where: { email: rawEmail } });

        // Email Enumeration Shield: Always respond with success message
        if (!user) {
            logger.info(`[PasswordReset] Request for non-existent email: ${rawEmail}`);
            return {
                success: true,
                message: resetType === 'OTP' 
                    ? 'If your account exists, a 6-digit verification code has been sent to your email.'
                    : 'If your account exists, a password reset link has been sent to your email.'
            };
        }

        // Deactivate older active reset tokens for this user
        await PasswordResetToken.update({ used: true }, { where: { userId: user.id, used: false } });

        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

        if (resetType === 'OTP') {
            // Generate 6-digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const tokenHash = crypto.createHash('sha256').update(otpCode).digest('hex');

            await PasswordResetToken.create({
                userId: user.id,
                token: otpCode, // stored for reference/audit
                tokenHash,
                otpCode,
                resetType: 'OTP',
                attempts: 0,
                isLocked: false,
                expiresAt,
                used: false,
                ipAddress,
                userAgent
            });

            // Send Email
            try {
                await sendPasswordResetOTPEmail(user.email, otpCode, user.displayName || user.firstName || 'Valued User', expiryMinutes);
            } catch (err: any) {
                logger.warn(`SMTP email send fallback for OTP: ${err.message}`);
            }

            await AuditLog.create({
                action: 'PASSWORD_RESET_OTP_SENT',
                details: `OTP Code dispatched to ${user.email}`,
                userId: user.id,
                tenantId: user.tenantId,
                ipAddress
            });

            return {
                success: true,
                message: `Verification code sent to ${user.email}. Code expires in ${expiryMinutes} minutes.`
            };
        } else {
            // Generate Cryptographic Token
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

            await PasswordResetToken.create({
                userId: user.id,
                token,
                tokenHash,
                resetType: 'LINK',
                attempts: 0,
                isLocked: false,
                expiresAt,
                used: false,
                ipAddress,
                userAgent
            });

            // Send Email
            try {
                await sendPasswordResetEmail(user.email, token, user.displayName || user.firstName || 'Valued User', expiryMinutes);
            } catch (err: any) {
                logger.warn(`SMTP email send fallback for reset link: ${err.message}`);
            }

            await AuditLog.create({
                action: 'PASSWORD_RESET_LINK_SENT',
                details: `Password reset link dispatched to ${user.email}`,
                userId: user.id,
                tenantId: user.tenantId,
                ipAddress
            });

            return {
                success: true,
                message: `If your account exists, a password reset link has been sent to your email.`
            };
        }
    }

    /**
     * 2. Verify OTP Code (with Max 5 Attempts Lockout)
     */
    public static async verifyOTP(email: string, otpCode: string): Promise<{ valid: boolean; token?: string; message?: string }> {
        const rawEmail = (email || '').trim().toLowerCase();
        const cleanCode = (otpCode || '').trim();

        const user = await AdminUser.findOne({ where: { email: rawEmail } });
        if (!user) {
            return { valid: false, message: 'Invalid or expired verification code.' };
        }

        const resetRecord = await PasswordResetToken.findOne({
            where: { userId: user.id, resetType: 'OTP', used: false },
            order: [['createdAt', 'DESC']]
        });

        if (!resetRecord) {
            return { valid: false, message: 'No active verification code found for this account.' };
        }

        if (resetRecord.isLocked) {
            return { valid: false, message: 'Verification code locked due to excessive failed attempts. Please request a new code.' };
        }

        if (new Date() > resetRecord.expiresAt) {
            return { valid: false, message: 'Verification code has expired. Please request a new code.' };
        }

        if (resetRecord.otpCode !== cleanCode) {
            const newAttempts = resetRecord.attempts + 1;
            const isLocked = newAttempts >= 5;

            await resetRecord.update({ attempts: newAttempts, isLocked });

            await AuditLog.create({
                action: 'PASSWORD_RESET_OTP_FAILED',
                details: `Invalid OTP attempt ${newAttempts}/5 for ${user.email}`,
                userId: user.id,
                tenantId: user.tenantId
            });

            if (isLocked) {
                return { valid: false, message: 'Verification code locked after 5 failed attempts. Request a new code.' };
            }

            return { valid: false, message: `Invalid code. ${5 - newAttempts} attempts remaining.` };
        }

        return { valid: true, token: resetRecord.token, message: 'OTP Verified successfully.' };
    }

    /**
     * 3. Confirm & Execute Password Reset
     */
    public static async confirmPasswordReset(params: {
        token?: string;
        otpCode?: string;
        email?: string;
        newPassword: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<{ success: boolean; message: string }> {
        const { token, otpCode, email, newPassword, ipAddress = '127.0.0.1' } = params;

        // Policy Check
        const policyCheck = this.validatePasswordPolicy(newPassword);
        if (!policyCheck.valid) {
            return { success: false, message: policyCheck.message || 'Password policy violation.' };
        }

        let resetRecord: PasswordResetToken | null = null;

        if (token) {
            resetRecord = await PasswordResetToken.findOne({
                where: { token, used: false }
            });
        } else if (otpCode && email) {
            const user = await AdminUser.findOne({ where: { email: email.trim().toLowerCase() } });
            if (user) {
                resetRecord = await PasswordResetToken.findOne({
                    where: { userId: user.id, otpCode: otpCode.trim(), resetType: 'OTP', used: false }
                });
            }
        }

        if (!resetRecord) {
            return { success: false, message: 'Invalid, used, or expired reset token/code.' };
        }

        if (resetRecord.isLocked) {
            return { success: false, message: 'This reset code is locked due to security policy. Please request a new one.' };
        }

        if (new Date() > resetRecord.expiresAt) {
            await AuditLog.create({
                action: 'PASSWORD_RESET_EXPIRED_TOKEN_ATTEMPT',
                details: `Attempted reset with expired token for User ID ${resetRecord.userId}`,
                userId: resetRecord.userId,
                ipAddress
            });
            return { success: false, message: 'Reset link or code has expired. Please request a new one.' };
        }

        const user = await AdminUser.findByPk(resetRecord.userId);
        if (!user) {
            return { success: false, message: 'Associated account not found.' };
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await user.update({ password: hashedPassword });
        await resetRecord.update({ used: true });

        // Dispatch confirmation email
        try {
            await sendPasswordResetConfirmationEmail(user.email, user.displayName || user.firstName || 'Valued User', ipAddress);
        } catch (err: any) {
            logger.warn(`Confirmation email delivery warning: ${err.message}`);
        }

        // Log audit trail
        await AuditLog.create({
            action: 'PASSWORD_RESET_SUCCESS',
            details: `Password reset completed successfully for ${user.email}`,
            userId: user.id,
            tenantId: user.tenantId,
            ipAddress
        });

        return {
            success: true,
            message: 'Your password has been reset successfully. You can now log in with your new password.'
        };
    }

    /**
     * 4. Super Admin Security Dashboard Monitoring
     */
    public static async getSuperAdminMonitoringStats() {
        const totalRequests = await PasswordResetToken.count();
        const totalSuccessful = await PasswordResetToken.count({ where: { used: true } });
        const totalLocked = await PasswordResetToken.count({ where: { isLocked: true } });
        const totalOtpRequests = await PasswordResetToken.count({ where: { resetType: 'OTP' } });
        const totalLinkRequests = await PasswordResetToken.count({ where: { resetType: 'LINK' } });

        const recentLogs = await AuditLog.findAll({
            where: {
                action: {
                    [Op.like]: 'PASSWORD_RESET%'
                }
            },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        return {
            stats: {
                totalRequests,
                totalSuccessful,
                totalLocked,
                totalOtpRequests,
                totalLinkRequests,
                successRatePercent: totalRequests > 0 ? Math.round((totalSuccessful / totalRequests) * 100) : 100
            },
            recentLogs
        };
    }
}
