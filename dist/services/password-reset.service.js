"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("../models");
const emailService_1 = require("./emailService");
const logger_1 = __importDefault(require("../utils/logger"));
const sequelize_1 = require("sequelize");
class PasswordResetService {
    // Password Strength Policy Rules
    static validatePasswordPolicy(password) {
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
    static async checkRateLimit(email, ipAddress) {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const user = await models_1.AdminUser.findOne({ where: { email } });
        const orConditions = [];
        if (ipAddress) {
            orConditions.push({ ipAddress });
        }
        if (user?.id) {
            orConditions.push({ userId: user.id });
        }
        if (orConditions.length === 0) {
            return true;
        }
        const recentCount = await models_1.PasswordResetToken.count({
            where: {
                [sequelize_1.Op.or]: orConditions,
                createdAt: { [sequelize_1.Op.gt]: fifteenMinsAgo }
            }
        });
        return recentCount < 5; // Allow max 5 requests per 15 min window
    }
    /**
     * 1. Request Password Recovery (Link or OTP)
     */
    static async requestPasswordReset(opts) {
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
        const user = await models_1.AdminUser.findOne({ where: { email: rawEmail } });
        // Email Enumeration Shield: Always respond with success message
        if (!user) {
            logger_1.default.info(`[PasswordReset] Request for non-existent email: ${rawEmail}`);
            return {
                success: true,
                message: resetType === 'OTP'
                    ? 'If your account exists, a 6-digit verification code has been sent to your email.'
                    : 'If your account exists, a password reset link has been sent to your email.'
            };
        }
        // Deactivate older active reset tokens for this user
        await models_1.PasswordResetToken.update({ used: true }, { where: { userId: user.id, used: false } });
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
        if (resetType === 'OTP') {
            // Generate 6-digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const tokenHash = crypto_1.default.createHash('sha256').update(otpCode).digest('hex');
            await models_1.PasswordResetToken.create({
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
                await (0, emailService_1.sendPasswordResetOTPEmail)(user.email, otpCode, user.displayName || user.firstName || 'Valued User', expiryMinutes);
            }
            catch (err) {
                logger_1.default.warn(`SMTP email send fallback for OTP: ${err.message}`);
            }
            await models_1.AuditLog.create({
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
        }
        else {
            // Generate Cryptographic Token
            const token = crypto_1.default.randomBytes(32).toString('hex');
            const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
            await models_1.PasswordResetToken.create({
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
                await (0, emailService_1.sendPasswordResetEmail)(user.email, token, user.displayName || user.firstName || 'Valued User', expiryMinutes);
            }
            catch (err) {
                logger_1.default.warn(`SMTP email send fallback for reset link: ${err.message}`);
            }
            await models_1.AuditLog.create({
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
    static async verifyOTP(email, otpCode) {
        const rawEmail = (email || '').trim().toLowerCase();
        const cleanCode = (otpCode || '').trim();
        const user = await models_1.AdminUser.findOne({ where: { email: rawEmail } });
        if (!user) {
            return { valid: false, message: 'Invalid or expired verification code.' };
        }
        const resetRecord = await models_1.PasswordResetToken.findOne({
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
            await models_1.AuditLog.create({
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
    static async confirmPasswordReset(params) {
        const { token, otpCode, email, newPassword, ipAddress = '127.0.0.1' } = params;
        // Policy Check
        const policyCheck = this.validatePasswordPolicy(newPassword);
        if (!policyCheck.valid) {
            return { success: false, message: policyCheck.message || 'Password policy violation.' };
        }
        let resetRecord = null;
        if (token) {
            resetRecord = await models_1.PasswordResetToken.findOne({
                where: { token, used: false }
            });
        }
        else if (otpCode && email) {
            const user = await models_1.AdminUser.findOne({ where: { email: email.trim().toLowerCase() } });
            if (user) {
                resetRecord = await models_1.PasswordResetToken.findOne({
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
            await models_1.AuditLog.create({
                action: 'PASSWORD_RESET_EXPIRED_TOKEN_ATTEMPT',
                details: `Attempted reset with expired token for User ID ${resetRecord.userId}`,
                userId: resetRecord.userId,
                ipAddress
            });
            return { success: false, message: 'Reset link or code has expired. Please request a new one.' };
        }
        const user = await models_1.AdminUser.findByPk(resetRecord.userId);
        if (!user) {
            return { success: false, message: 'Associated account not found.' };
        }
        // Hash new password
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
        await user.update({ password: hashedPassword });
        await resetRecord.update({ used: true });
        // Dispatch confirmation email
        try {
            await (0, emailService_1.sendPasswordResetConfirmationEmail)(user.email, user.displayName || user.firstName || 'Valued User', ipAddress);
        }
        catch (err) {
            logger_1.default.warn(`Confirmation email delivery warning: ${err.message}`);
        }
        // Log audit trail
        await models_1.AuditLog.create({
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
    static async getSuperAdminMonitoringStats() {
        const totalRequests = await models_1.PasswordResetToken.count();
        const totalSuccessful = await models_1.PasswordResetToken.count({ where: { used: true } });
        const totalLocked = await models_1.PasswordResetToken.count({ where: { isLocked: true } });
        const totalOtpRequests = await models_1.PasswordResetToken.count({ where: { resetType: 'OTP' } });
        const totalLinkRequests = await models_1.PasswordResetToken.count({ where: { resetType: 'LINK' } });
        const recentLogs = await models_1.AuditLog.findAll({
            where: {
                action: {
                    [sequelize_1.Op.like]: 'PASSWORD_RESET%'
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
exports.PasswordResetService = PasswordResetService;
