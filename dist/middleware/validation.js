"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipRateLimit = exports.ipRateLimitMap = exports.validators = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
/**
 * Validation middleware to check for validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
/**
 * Common validation rules
 */
exports.validators = {
    // Phone number validation (Kenyan format)
    phoneNumber: (0, express_validator_1.body)('phoneNumber')
        .trim()
        .matches(/^(?:254|\+254|0)?[17]\d{8}$/)
        .withMessage('Invalid phone number format'),
    // Login Email validation (no normalization)
    loginEmail: (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .withMessage('Invalid email address'),
    // Email validation
    email: (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email address'),
    // UUID validation
    uuid: (field) => (0, express_validator_1.param)(field)
        .isUUID()
        .withMessage(`Invalid ${field} format`),
    // Amount validation (positive integer in cents)
    amount: (0, express_validator_1.body)('amount')
        .isInt({ min: 1 })
        .withMessage('Amount must be a positive integer'),
    // Pagination
    pagination: [
        (0, express_validator_1.query)('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        (0, express_validator_1.query)('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be non-negative')
    ],
    // Sanitize string inputs
    sanitizeString: (field) => (0, express_validator_1.body)(field)
        .trim()
        .escape()
        .isLength({ min: 1, max: 255 })
        .withMessage(`${field} must be between 1 and 255 characters`),
    // Password strength
    password: (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and number'),
    // Login Password validation (presence check)
    loginPassword: (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required'),
    // Tenant subdomain
    subdomain: (0, express_validator_1.body)('subdomain')
        .trim()
        .toLowerCase()
        .matches(/^[a-z0-9-]{3,30}$/)
        .withMessage('Subdomain must be 3-30 characters, lowercase alphanumeric and hyphens only'),
    // MAC address
    macAddress: (0, express_validator_1.body)('macAddress')
        .optional()
        .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
        .withMessage('Invalid MAC address format'),
    // IP address
    ipAddress: (0, express_validator_1.body)('ipAddress')
        .optional()
        .isIP()
        .withMessage('Invalid IP address'),
};
/**
 * Rate limiting by IP for specific endpoints
 */
exports.ipRateLimitMap = new Map();
const ipRateLimit = (maxRequests, windowMs) => {
    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const record = exports.ipRateLimitMap.get(ip);
        if (record && now < record.resetTime) {
            if (record.count >= maxRequests) {
                return res.status(429).json({
                    error: 'Too many requests from this IP',
                    retryAfter: Math.ceil((record.resetTime - now) / 1000)
                });
            }
            record.count++;
        }
        else {
            exports.ipRateLimitMap.set(ip, {
                count: 1,
                resetTime: now + windowMs
            });
        }
        next();
    };
};
exports.ipRateLimit = ipRateLimit;
/**
 * Clean up expired IP rate limit entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of exports.ipRateLimitMap.entries()) {
        if (now >= record.resetTime) {
            exports.ipRateLimitMap.delete(ip);
        }
    }
}, 60000); // Clean up every minute
