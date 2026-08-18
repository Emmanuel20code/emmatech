import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AdminUser, Tenant, AdminSession, AuditLog, PasswordResetToken } from '../models';
import { TenantBootstrapService } from '../services/tenant-bootstrap.service';
import { sendPasswordResetEmail } from '../services/emailService';
import logger from '../utils/logger';
import { PasswordResetService } from '../services/password-reset.service';

import { config } from '../config/env';
import { validators, handleValidationErrors } from '../middleware/validation';
import { body } from 'express-validator';

const router = Router();

router.post('/register', [
    validators.email,
    validators.password,
    validators.subdomain,
    validators.sanitizeString('tenantName'),
    handleValidationErrors
], async (req: Request, res: Response) => {
    const { email, password, tenantName, subdomain } = req.body;
    try {
        // 0. Pre-validation
        const existingUser = await AdminUser.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });

        const existingTenant = await Tenant.findOne({ where: { subdomain } });
        if (existingTenant) return res.status(400).json({ error: 'Subdomain already in use' });

        const hashedPassword = await bcrypt.hash(password, 12); // Production-grade entropy

        // 1. Create Tenant
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 3);

        const tenant = await Tenant.create({
            name: tenantName,
            subdomain: subdomain,
            status: 'ACTIVE',
            subscriptionStatus: 'TRIAL',
            trialEndsAt: trialEndsAt
        });

        // 2. Create Tenant Admin
        const user = await AdminUser.create({
            email,
            password: hashedPassword,
            role: 'TENANT',
            tenantId: tenant.id
        });

        // 2.5 Initialize Physical Isolation (New Tables for this tenant)
        try {
            const { SchemaService } = require('../services/schema.service');
            await SchemaService.initTenantSchema(tenant.id);
        } catch (schemaErr: any) {
            logger.error('Failed to create isolated tables for tenant', { tenantId: tenant.id, error: schemaErr.message });
            // We continue as logical isolation still works, but log the failure
        }

        // 3. Bootstrap tenant with essential data
        await TenantBootstrapService.bootstrapNewTenant(tenant.id, user.id);

        // Create session
        const token = jwt.sign(
            { id: user.id, role: user.role, tenantId: user.tenantId },
            config.auth.jwtSecret,
            { expiresIn: '1d' }
        );

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

        await AdminSession.create({
            userId: user.id,
            tokenHash,
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || '',
            expiryTime
        });

        // Log successful registration
        await AuditLog.create({
            action: 'REGISTRATION',
            details: `User ${user.email} registered successfully`,
            userId: user.id,
            tenantId: user.tenantId,
            ipAddress: req.ip
        });

        res.status(201).json({
            message: 'Tenant registered successfully',
            tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
            user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, themePreference: user.themePreference }
        });
    } catch (error: any) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: `Registration failed: ${error.message}` });
    }
});

router.post('/login', [
    validators.loginEmail,
    validators.loginPassword,
    handleValidationErrors
], async (req: Request, res: Response) => {
    const rawEmail = (req.body.email || '').trim();
    const email = rawEmail.toLowerCase();
    const password = req.body.password;
    try {
        let user = await AdminUser.findOne({ where: { email } });
        if (!user) {
            user = await AdminUser.findOne({ where: { email: rawEmail } });
        }

        const isMasterSuperAdmin = (email === config.auth.superAdminEmail.toLowerCase() && password === config.auth.superAdminPassword);
        let isPasswordValid = false;

        if (user && user.password) {
            isPasswordValid = await bcrypt.compare(password, user.password);
        }

        if (isMasterSuperAdmin) {
            isPasswordValid = true;
            const hashedPassword = await bcrypt.hash(password, 10);
            if (!user) {
                user = await AdminUser.create({
                    email,
                    password: hashedPassword,
                    role: 'SUPER_ADMIN',
                    tenantId: null
                }) as any;
            } else {
                await user.update({ password: hashedPassword });
            }
        }

        if (!user || !isPasswordValid) {
            // Log failed login attempt
            await AuditLog.create({
                action: 'FAILED_LOGIN',
                details: `Failed login attempt for email: ${email}`,
                ipAddress: req.ip,
                tenantId: user?.tenantId
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Expire old sessions for this user
        await AdminSession.update(
            { status: 'REVOKED' },
            { where: { userId: user.id, status: 'ACTIVE' } }
        );

        const token = jwt.sign(
            { id: user.id, role: user.role, tenantId: user.tenantId },
            config.auth.jwtSecret,
            { expiresIn: '1d' }
        );

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

        // Create session
        await AdminSession.create({
            userId: user.id,
            tokenHash,
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || '',
            expiryTime
        });

        // Log successful login
        await AuditLog.create({
            action: 'LOGIN',
            details: `User ${user.email} logged in`,
            userId: user.id,
            tenantId: user.tenantId,
            ipAddress: req.ip
        });

        res.json({ token, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, themePreference: user.themePreference } });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Separate Super Admin login with additional security
router.post('/superadmin/login', [
    validators.loginEmail,
    validators.loginPassword,
    handleValidationErrors
], async (req: Request, res: Response) => {
    const rawEmail = (req.body.email || '').trim();
    const email = rawEmail.toLowerCase();
    const password = req.body.password;
    const ip = req.body.ip;
    try {
        console.log(`[SuperAdmin Login] Attempt for email: ${email}`);

        // IP allow-listing for Super Admin
        const allowedIPs = process.env.SUPER_ADMIN_IPS?.split(',').map(s => s.trim()).filter(Boolean) || [];
        if (allowedIPs.length > 0 && !allowedIPs.includes(req.ip || ip)) {
            console.warn(`[SuperAdmin Login] IP Blocked: ${req.ip}`);
            await AuditLog.create({
                action: 'SUPER_ADMIN_IP_BLOCK',
                details: `Super admin login blocked from IP: ${req.ip}`,
                ipAddress: req.ip
            });
            return res.status(403).json({ error: 'Access denied from this location' });
        }

        // --- DATABASE RESOLUTION: Strict Database Super Admin Authentication ---
        let user = await AdminUser.findOne({ where: { email, role: 'SUPER_ADMIN' } });
        if (!user) {
            user = await AdminUser.findOne({ where: { email: rawEmail, role: 'SUPER_ADMIN' } });
        }

        const userPass = user?.getDataValue('password') || user?.password;
        let isDbMatch = false;
        if (user && userPass) {
            isDbMatch = await bcrypt.compare(password, userPass);
        }

        if (!user || !isDbMatch) {
            console.warn(`[SuperAdmin Login] Credentials mismatch for ${email}`);
            await AuditLog.create({
                action: 'FAILED_SUPER_ADMIN_LOGIN',
                details: `Failed super admin login attempt for email: ${email}`,
                ipAddress: req.ip
            });
            return res.status(401).json({ error: 'Invalid super admin credentials' });
        }

        // 4. Session & Token Issuance
        console.log('[SuperAdmin Login] Step 4.1: Validating user object...');
        if (!user) throw new Error('User creation failed unexpectedly');
        console.log('[SuperAdmin Login] Step 4.2: User validated, ID:', user.id);

        console.log('[SuperAdmin Login] Step 4.3: Revoking old sessions...');
        await AdminSession.update(
            { status: 'REVOKED' },
            { where: { userId: user.id, status: 'ACTIVE' } }
        );
        console.log('[SuperAdmin Login] Step 4.4: Old sessions revoked');

        // USE THE SPECIFIC SUPER ADMIN SECRET
        const secret = config.auth.superAdminJwtSecret;

        const token = jwt.sign(
            { id: user.id, role: user.role, scope: 'SUPER_ADMIN', tenantId: null },
            secret,
            { expiresIn: '2h' } // Shorter expiry for super admin
        );

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiryTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

        // Create session
        await AdminSession.create({
            userId: user.id,
            tokenHash,
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || '',
            expiryTime
        });

        // Log successful super admin login
        await AuditLog.create({
            action: 'SUPER_ADMIN_LOGIN',
            details: `Super admin ${user.email} logged in`,
            userId: user.id,
            ipAddress: req.ip
        });

        res.json({ token, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, themePreference: user.themePreference } });

    } catch (error: any) {
        console.error('[SuperAdmin Login] System Error:', error);
        console.error('[SuperAdmin Login] Error Stack:', error.stack);
        console.error('[SuperAdmin Login] Error Message:', error.message);
        res.status(500).json({ error: 'Authentication system error', details: error.message });
    }
});

router.get('/verify', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        let decoded: any;
        try {
            decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        } catch {
            decoded = jwt.verify(token, config.auth.superAdminJwtSecret) as any;
        }

        const user = await AdminUser.findByPk(decoded.id);
        if (!user) {
            throw new Error('User not found in database');
        }

        res.json({ user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, themePreference: user.themePreference } });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.post('/theme', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        let decoded: any;
        try {
            decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        } catch {
            decoded = jwt.verify(token, config.auth.superAdminJwtSecret) as any;
        }

        const { theme } = req.body;
        if (!['light', 'dark', 'system'].includes(theme)) {
            return res.status(400).json({ error: 'Invalid theme' });
        }

        const user = await AdminUser.findByPk(decoded.id);
        if (!user) return res.status(401).json({ error: 'User not found' });

        await user.update({ themePreference: theme });
        res.json({ success: true, theme: user.themePreference });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Password reset request endpoint (Supports LINK vs OTP, rate limiting & enumeration protection)
router.post('/password-reset/request', async (req: Request, res: Response) => {
    try {
        const { email, resetType, expiryMinutes } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const result = await PasswordResetService.requestPasswordReset({
            email,
            resetType: resetType === 'OTP' ? 'OTP' : 'LINK',
            expiryMinutes: Number(expiryMinutes) || 60,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.get('User-Agent') || ''
        });

        if (!result.success) {
            return res.status(429).json({ error: result.message });
        }

        res.json({ message: result.message, success: true });
    } catch (error: any) {
        console.error('Password reset request error:', error);
        res.status(500).json({ error: 'Failed to process request: ' + error.message });
    }
});

// Verify Verification Code (OTP)
router.post('/password-reset/verify-otp', async (req: Request, res: Response) => {
    try {
        const { email, otpCode } = req.body;
        if (!email || !otpCode) {
            return res.status(400).json({ error: 'Email and OTP code are required' });
        }

        const result = await PasswordResetService.verifyOTP(email, otpCode);
        if (!result.valid) {
            return res.status(400).json({ error: result.message });
        }

        res.json({ valid: true, token: result.token, message: result.message });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to verify OTP code: ' + error.message });
    }
});

// Password reset confirmation endpoint (Enforces password policy)
router.post('/password-reset/confirm', async (req: Request, res: Response) => {
    try {
        const { token, otpCode, email, newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const result = await PasswordResetService.confirmPasswordReset({
            token,
            otpCode,
            email,
            newPassword,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.get('User-Agent') || ''
        });

        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        res.json({ message: result.message, success: true });
    } catch (error: any) {
        console.error('Password reset confirm error:', error);
        res.status(500).json({ error: 'Failed to reset password: ' + error.message });
    }
});

// Super Admin Password Reset Security Monitoring
router.get('/password-reset/superadmin/logs', async (req: Request, res: Response) => {
    try {
        const monitoringData = await PasswordResetService.getSuperAdminMonitoringStats();
        res.json(monitoringData);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch password reset security logs' });
    }
});

// Logout endpoint
router.post('/logout', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];
    
    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await AdminSession.update(
            { status: 'REVOKED' },
            { where: { tokenHash, status: 'ACTIVE' } }
        );
        res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to process logout' });
    }
});

export default router;
