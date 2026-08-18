"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
// Sensitive fields to redact from logs
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie'];
/**
 * Custom format to redact sensitive information
 */
const redactSensitiveData = winston_1.default.format((info) => {
    const redactObject = (obj) => {
        if (typeof obj !== 'object' || obj === null)
            return obj;
        let redacted = Array.isArray(obj) ? [...obj] : { ...obj };
        for (const key in redacted) {
            if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
                redacted[key] = '[REDACTED]';
            }
            else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
                redacted[key] = redactObject(redacted[key]);
            }
        }
        return redacted;
    };
    return redactObject(info);
});
// Create logs directory if it doesn't exist
const logsDir = path_1.default.join(process.cwd(), 'logs');
// Daily rotate file transport for errors
const errorRotateTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d', // Keep error logs for 30 days
    zippedArchive: true,
});
// Daily rotate file transport for combined logs
const combinedRotateTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep combined logs for 14 days
    zippedArchive: true,
});
// Daily rotate file transport for audit logs (payment, auth, critical operations)
const auditRotateTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'audit-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    maxSize: '50m',
    maxFiles: '90d', // Keep audit logs for 90 days (compliance)
    zippedArchive: true,
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
});
const logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), redactSensitiveData(), winston_1.default.format.json()),
    defaultMeta: {
        service: 'billing-system',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        errorRotateTransport,
        combinedRotateTransport,
    ],
    // Prevent crashes from logging errors
    exitOnError: false,
});
// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })),
    }));
}
// Export audit logger for critical operations
exports.auditLogger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    defaultMeta: {
        service: 'billing-system-audit',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [auditRotateTransport],
    exitOnError: false,
});
exports.default = logger;
