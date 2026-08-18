import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Validation middleware to check for validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

/**
 * Common validation rules
 */
export const validators = {
    // Phone number validation (Kenyan format)
    phoneNumber: body('phoneNumber')
        .trim()
        .matches(/^(?:254|\+254|0)?[17]\d{8}$/)
        .withMessage('Invalid phone number format'),

    // Login Email validation (no normalization)
    loginEmail: body('email')
        .trim()
        .isEmail()
        .withMessage('Invalid email address'),

    // Email validation
    email: body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email address'),

    // UUID validation
    uuid: (field: string) => param(field)
        .isUUID()
        .withMessage(`Invalid ${field} format`),

    // Amount validation (positive integer in cents)
    amount: body('amount')
        .isInt({ min: 1 })
        .withMessage('Amount must be a positive integer'),

    // Pagination
    pagination: [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be non-negative')
    ],

    // Sanitize string inputs
    sanitizeString: (field: string) => body(field)
        .trim()
        .escape()
        .isLength({ min: 1, max: 255 })
        .withMessage(`${field} must be between 1 and 255 characters`),

    // Password strength
    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and number'),

    // Login Password validation (presence check)
    loginPassword: body('password')
        .notEmpty()
        .withMessage('Password is required'),

    // Tenant subdomain
    subdomain: body('subdomain')
        .trim()
        .toLowerCase()
        .matches(/^[a-z0-9-]{3,30}$/)
        .withMessage('Subdomain must be 3-30 characters, lowercase alphanumeric and hyphens only'),

    // MAC address
    macAddress: body('macAddress')
        .optional()
        .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
        .withMessage('Invalid MAC address format'),

    // IP address
    ipAddress: body('ipAddress')
        .optional()
        .isIP()
        .withMessage('Invalid IP address'),
};

/**
 * Rate limiting by IP for specific endpoints
 */
export const ipRateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const ipRateLimit = (maxRequests: number, windowMs: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const record = ipRateLimitMap.get(ip);

        if (record && now < record.resetTime) {
            if (record.count >= maxRequests) {
                return res.status(429).json({
                    error: 'Too many requests from this IP',
                    retryAfter: Math.ceil((record.resetTime - now) / 1000)
                });
            }
            record.count++;
        } else {
            ipRateLimitMap.set(ip, {
                count: 1,
                resetTime: now + windowMs
            });
        }

        next();
    };
};

/**
 * Clean up expired IP rate limit entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipRateLimitMap.entries()) {
        if (now >= record.resetTime) {
            ipRateLimitMap.delete(ip);
        }
    }
}, 60000); // Clean up every minute
