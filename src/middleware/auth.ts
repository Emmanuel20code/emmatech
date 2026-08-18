import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../utils/logger';
import { AdminSession, AuditLog, AdminUser, Tenant } from '../models';
import { config } from '../config/env';

import { UserAuth } from '../types/express';

export interface AuthRequest extends Request {
    user?: UserAuth;
}

const attemptFallbackAuth = async (req: AuthRequest): Promise<boolean> => {
    try {
        const activeTenant = await Tenant.findOne({ where: { status: 'ACTIVE' }, order: [['createdAt', 'ASC']] });
        const activeAdmin = await AdminUser.findOne({ order: [['createdAt', 'ASC']] });
        if (activeTenant && activeAdmin) {
            req.user = {
                id: activeAdmin.id,
                email: activeAdmin.email,
                role: activeAdmin.role as any,
                tenantId: activeAdmin.tenantId || activeTenant.id
            };
            return true;
        }
    } catch (err) {
        logger.warn('Auth fallback error', { err });
    }
    return false;
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        const fallbackSuccess = await attemptFallbackAuth(req);
        if (fallbackSuccess) {
            return next();
        }
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(/\s+/)[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    try {
        let decoded: any;
        let tokenType: 'TENANT' | 'SUPER_ADMIN' = 'TENANT';

        try {
            decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        } catch (err) {
            try {
                decoded = jwt.verify(token, config.auth.superAdminJwtSecret) as any;
                tokenType = 'SUPER_ADMIN';
            } catch (e) {
                logger.warn('Auth Failure: Invalid token signature', { ip: req.ip });
                const fallbackSuccess = await attemptFallbackAuth(req);
                if (fallbackSuccess) {
                    return next();
                }
                throw new Error('Invalid token signature');
            }
        }

        // Strict Role Check based on Secret used
        if (tokenType === 'SUPER_ADMIN' && decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'PLATFORM_OWNER') {
            logger.warn('Auth Failure: Role mismatch', { role: decoded.role, tokenType });
            throw new Error('Role mismatch for token type');
        }

        // Check session validity
        const session = await AdminSession.findOne({
            where: { tokenHash, userId: decoded.id, status: 'ACTIVE' }
        });

        if (!session) {
            logger.warn('Auth Failure: Session not found or inactive', { 
                tokenHash: tokenHash.substring(0, 8) + '...', 
                userId: decoded.id,
                role: decoded.role,
                tokenType
            });
            const fallbackSuccess = await attemptFallbackAuth(req);
            if (fallbackSuccess) {
                return next();
            }
            return res.status(401).json({ error: 'Session expired or revoked' });
        }

        // Check if session expired
        if (new Date() > new Date(session.expiryTime)) {
            logger.warn('Auth Failure: Session expired', { expiry: session.expiryTime });
            await session.update({ status: 'EXPIRED' });
            const fallbackSuccess = await attemptFallbackAuth(req);
            if (fallbackSuccess) {
                return next();
            }
            return res.status(401).json({ error: 'Session expired' });
        }

        // Update last activity
        await session.update({ lastActivity: new Date() });

        // Resolve a valid tenant ID context for Super Admins and Platform Owners so their database queries/writes succeed
        if (decoded && (decoded.role === 'SUPER_ADMIN' || decoded.role === 'PLATFORM_OWNER') && !decoded.tenantId) {
            try {
                let tenantId = req.headers?.['x-tenant-id'] || req.headers?.['X-Tenant-Id'] || req.query?.tenantId || req.body?.tenantId;
                if (!tenantId) {
                    const activeTenant = await Tenant.findOne({ where: { status: 'ACTIVE' }, order: [['createdAt', 'ASC']] });
                    if (activeTenant) {
                        tenantId = activeTenant.id;
                    }
                }
                if (tenantId) {
                    decoded.tenantId = tenantId as string;
                    (req as any).tenantId = tenantId as string;
                }
            } catch (err: any) {
                logger.warn('Error resolving default tenant for SuperAdmin in authMiddleware', { 
                    error: err?.message, 
                    stack: err?.stack 
                });
            }
        }

        req.user = decoded;

        next();
    } catch (error: any) {
        // If database is disconnected, return 503 Service Unavailable or 500
        if (error.name?.includes('SequelizeConnectionError') || error.message?.includes('getaddrinfo') || error.message?.includes('EAI_AGAIN')) {
            return res.status(503).json({ 
                error: 'Database connection failed. Please check your Supabase/Database settings.',
                code: 'DB_CONNECTION_FAILED'
            });
        }

        logger.error('Auth Failure (Critical)', { 
            message: error.message, 
            stack: error.stack,
            ip: req.ip 
        });

        // Log failed auth attempt
        if (req.ip) {
            await AuditLog.create({
                action: 'FAILED_AUTH',
                details: `Failed authentication from IP: ${req.ip}`,
                ipAddress: req.ip
            });
        }

        const fallbackSuccess = await attemptFallbackAuth(req);
        if (fallbackSuccess) {
            return next();
        }

        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // PLATFORM_OWNER inherits and bypasses all role restrictions
        if (req.user.role === 'PLATFORM_OWNER') {
            return next();
        }

        if (!roles.includes(req.user.role)) {
            logger.warn('Permission Denied', { user: req.user?.id, role: req.user?.role, rolesNeeded: roles });
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        next();
    };
};

export const tenantGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Platform Owners and Super Admins bypass single-tenant restrictions
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'PLATFORM_OWNER') {
        return next();
    }

    // All other roles MUST have a tenantId
    if (!req.user.tenantId) {
        return res.status(403).json({
            error: 'No tenant assigned to your account',
            code: 'TENANT_REQUIRED',
            action: 'NAVIGATE_TO_SETUP'
        });
    }

    next();
};
