/**
 * Webhook Security Middleware
 * 
 * Provides bank-level security for webhook callbacks:
 * - Signature verification (HMAC-SHA256)
 * - IP whitelist validation
 * - Timestamp validation (prevent replay attacks)
 * - Request body size limits
 * 
 * This is CRITICAL for a fintech system handling real money.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify webhook signature from payment aggregators
 * Uses HMAC-SHA256 signature verification
 */
const verifyWebhookSignature = (
    secretKey,
    signatureHeader = 'x-signature',
    timestampHeader = 'x-timestamp',
    maxAgeMs = 300000 // 5 minutes
) => {
    return (req, res, next) => {
        const signature = req.headers[signatureHeader];
        const timestamp = req.headers[timestampHeader];
        const body = JSON.stringify(req.body);

        // Check required headers
        if (!signature) {
            logger.warn('Webhook missing signature header', {
                ip: req.ip,
                path: req.path
            });
            return res.status(401).json({ error: 'Missing signature' });
        }

        // Verify timestamp to prevent replay attacks
        if (timestamp) {
            const requestTime = parseInt(timestamp, 10);
            const now = Date.now();

            if (isNaN(requestTime) || Math.abs(now - requestTime) > maxAgeMs) {
                logger.warn('Webhook timestamp expired or invalid', {
                    ip: req.ip,
                    path: req.path,
                    timestamp,
                    maxAgeMs
                });
                return res.status(401).json({ error: 'Request expired' });
            }
        }

        // Compute expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secretKey)
            .update(body)
            .digest('hex');

        // Constant-time comparison to prevent timing attacks
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (signatureBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            logger.warn('Webhook signature verification failed', {
                ip: req.ip,
                path: req.path,
                hasSignature: !!signature
            });
            return res.status(401).json({ error: 'Invalid signature' });
        }

        next();
    };
};

/**
 * IP Whitelist Middleware for Admin Routes
 * Restricts admin access to trusted IPs only
 */
const ipWhitelist = (allowedIps) => {
    return (req, res, next) => {
        const clientIp = req.ip || req.socket.remoteAddress || '';
        const cleanIp = clientIp.replace(/^::ffff:/, ''); // Remove IPv6 prefix

        // Bypass for local development
        if (process.env.NODE_ENV === 'development' &&
            (cleanIp === '127.0.0.1' || cleanIp === '::1')) {
            return next();
        }

        if (!allowedIps.includes(cleanIp)) {
            logger.warn('Unauthorized IP access attempt', {
                ip: cleanIp,
                path: req.path,
                method: req.method
            });
            return res.status(403).json({ error: 'Access denied from this IP' });
        }

        next();
    };
};

/**
 * Rate Limiting Configuration
 * Per-endpoint rate limits for sensitive operations
 */
const rateLimitConfig = {
    // Authentication endpoints
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
        message: 'Too many authentication attempts'
    },
    // Payment endpoints
    payment: {
        windowMs: 60 * 1000, // 1 minute
        max: 20, // 20 requests per minute
        message: 'Too many payment requests'
    },
    // Webhook callbacks (more lenient)
    webhook: {
        windowMs: 60 * 1000,
        max: 100,
        message: 'Too many webhook calls'
    },
    // General API
    default: {
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests'
    }
};

/**
 * Request Size Limit Middleware
 * Prevents large payload attacks
 */
const requestSizeLimit = (maxSize = '1mb') => {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0', 10);
        const limit = parseSize(maxSize);

        if (contentLength > limit) {
            logger.warn('Request too large', {
                ip: req.ip,
                path: req.path,
                contentLength,
                limit
            });
            return res.status(413).json({ error: 'Request payload too large' });
        }

        next();
    };
};

function parseSize(size) {
    const units = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
    if (!match) return 1024 * 1024; // Default 1MB

    const value = parseInt(match[1], 10);
    const unit = match[2] || 'b';
    return value * units[unit];
}

/**
 * Security Headers Middleware
 * Adds bank-level security headers
 */
const securityHeaders = (req, res, next) => {
    // Prevent XSS attacks
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // HSTS for HTTPS enforcement
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'");

    // Prevent caching sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    next();
};

/**
 * JWT Token Security Enhancements
 */
const jwtSecurityConfig = {
    // Access token expiration
    accessTokenExpiresIn: '15m', // 15 minutes - short-lived for security

    // Refresh token expiration
    refreshTokenExpiresIn: '7d',

    // Token algorithms
    algorithms: ['HS256'],

    // Token issuer
    issuer: 'billing-platform',

    // Audience
    audience: 'billing-platform-users'
};

/**
 * Generate secure random tokens
 */
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data for storage
 */
function hashSensitiveData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Encrypt sensitive fields (for database storage)
 * Uses AES-256-GCM
 */
function encryptSensitiveField(value, encryptionKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(encryptionKey.padEnd(32).slice(0, 32)),
        iv
    );

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive fields
 */
function decryptSensitiveField(encryptedValue, encryptionKey) {
    const [ivHex, authTagHex, encrypted] = encryptedValue.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(encryptionKey.padEnd(32).slice(0, 32)),
        iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

module.exports = {
    verifyWebhookSignature,
    ipWhitelist,
    rateLimitConfig,
    requestSizeLimit,
    securityHeaders,
    jwtSecurityConfig,
    generateSecureToken,
    hashSensitiveData,
    encryptSensitiveField,
    decryptSensitiveField
};
