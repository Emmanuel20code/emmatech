"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.sendPasswordResetConfirmationEmail = exports.sendPasswordResetOTPEmail = exports.sendPasswordResetEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("../utils/logger"));
const models_1 = require("../models");
dotenv_1.default.config();
/**
 * Production-grade Email Service
 * Uses SMTP configuration from .env with fallback handling
 */
const sendPasswordResetEmail = async (to, token, userName = 'Valued User', expiryMinutes = 60) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    const subject = '🔐 Reset Your Jevish Password';
    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px;">
            <h2 style="color: #0284c7; margin-top: 0;">Password Reset Request</h2>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>We received a request to reset your Jevish Pro account password associated with <strong>${to}</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 800; display: inline-block; font-size: 15px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
                    Reset Password
                </a>
            </div>

            <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; color: #475569;">
                    ⏳ <strong>Expiry Notice:</strong> This reset link is single-use and will expire in <strong>${expiryMinutes} minutes</strong>.
                </p>
            </div>

            <p style="color: #64748b; font-size: 13px;">
                If you did not request this change, no action is required. Your account remains secure.
            </p>
        </div>
    `;
    return (0, exports.sendEmail)({ to, subject, html, action: 'PASSWORD_RESET_LINK' });
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const sendPasswordResetOTPEmail = async (to, otpCode, userName = 'Valued User', expiryMinutes = 15) => {
    const subject = '🔑 Your Jevish Password Reset Code: ' + otpCode;
    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px;">
            <h2 style="color: #0284c7; margin-top: 0;">Verification Code Required</h2>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Use the following 6-digit verification code to complete your password reset for <strong>${to}</strong>:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-family: monospace; background-color: #0f172a; color: #38bdf8; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px; border: 1px solid #1e293b; display: inline-block;">
                    ${otpCode}
                </span>
            </div>

            <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; color: #475569;">
                    ⚠️ <strong>Security Notice:</strong> Do not share this code with anyone. Jevish support will never ask for your verification code. Code expires in <strong>${expiryMinutes} minutes</strong>.
                </p>
            </div>
        </div>
    `;
    return (0, exports.sendEmail)({ to, subject, html, action: 'PASSWORD_RESET_OTP' });
};
exports.sendPasswordResetOTPEmail = sendPasswordResetOTPEmail;
const sendPasswordResetConfirmationEmail = async (to, userName = 'Valued User', ipAddress = 'Unknown IP') => {
    const subject = '🛡️ Password Successfully Changed - Jevish Security';
    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px;">
            <h2 style="color: #10b981; margin-top: 0;">Password Successfully Updated</h2>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>This email confirms that the password for your Jevish Pro account (<strong>${to}</strong>) was successfully changed.</p>
            
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; color: #166534; font-size: 13px;">
                <p style="margin: 0 0 6px 0;"><strong>Security Activity Log:</strong></p>
                <p style="margin: 0;">• Date & Time: ${new Date().toUTCString()}</p>
                <p style="margin: 0;">• Request IP Address: ${ipAddress}</p>
            </div>

            <p style="color: #64748b; font-size: 13px;">
                If you did not perform this change, please contact Jevish Security immediately at <strong>emmanueloyaro3@gmail.com</strong> or phone <strong>0768926965</strong>.
            </p>
        </div>
    `;
    return (0, exports.sendEmail)({ to, subject, html, action: 'PASSWORD_RESET_SUCCESS_NOTIF' });
};
exports.sendPasswordResetConfirmationEmail = sendPasswordResetConfirmationEmail;
const sendEmail = async ({ to, subject, html, text, tenantId, userId, action }) => {
    try {
        const transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        // Wrap HTML in Branded Template
        const brandedHtml = html ? `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background: #0284c7; padding: 20px text-align: center; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Jevish Pro</h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Enterprise WiFi Billing & ISP Management</p>
                </div>
                <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
                    ${html}
                </div>
                <div style="background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
                    <p style="margin: 0 0 8px 0;">Need help? Phone: <strong>0768926965</strong> | Email: <strong>emmanueloyaro3@gmail.com</strong></p>
                    <p style="margin: 0;">© 2026 Jevish Technologies Ltd. All rights reserved.</p>
                </div>
            </div>
        ` : undefined;
        const info = await transporter.sendMail({
            from: `"Jevish Support" <${process.env.SMTP_USER || 'emmanueloyaro3@gmail.com'}>`,
            to,
            subject,
            text,
            html: brandedHtml || html,
        });
        logger_1.default.info(`Email sent to ${to}: ${info.messageId}`);
        if (action) {
            await models_1.AuditLog.create({
                action: `EMAIL_${action}`,
                details: `Email sent to ${to}. Subject: ${subject}`,
                tenantId,
                userId,
            });
        }
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        logger_1.default.error(`Failed to send email to ${to}: ${error.message}`);
        if (action) {
            await models_1.AuditLog.create({
                action: `EMAIL_${action}_FAILURE`,
                details: `Failed to send email to ${to}. Error: ${error.message}`,
                tenantId,
                userId,
            });
        }
        throw new Error(`Email delivery failed: ${error.message}`);
    }
};
exports.sendEmail = sendEmail;
