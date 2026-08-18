import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Sensitive fields to redact from logs
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie'];

/**
 * Custom format to redact sensitive information
 */
const redactSensitiveData = winston.format((info) => {
    const redactObject = (obj: unknown): unknown => {
        if (typeof obj !== 'object' || obj === null) return obj;

        let redacted = Array.isArray(obj) ? [...obj] : { ...obj as Record<string, unknown> };

        for (const key in redacted as Record<string, unknown>) {
            if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
                (redacted as Record<string, unknown>)[key] = '[REDACTED]';
            } else if (typeof (redacted as Record<string, unknown>)[key] === 'object' && (redacted as Record<string, unknown>)[key] !== null) {
                (redacted as Record<string, unknown>)[key] = redactObject((redacted as Record<string, unknown>)[key]);
            }
        }

        return redacted;
    };

    return redactObject(info) as winston.Logform.TransformableInfo;
});

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Daily rotate file transport for errors
const errorRotateTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d', // Keep error logs for 30 days
    zippedArchive: true,
});

// Daily rotate file transport for combined logs
const combinedRotateTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep combined logs for 14 days
    zippedArchive: true,
});

// Daily rotate file transport for audit logs (payment, auth, critical operations)
const auditRotateTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'audit-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    maxSize: '50m',
    maxFiles: '90d', // Keep audit logs for 90 days (compliance)
    zippedArchive: true,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        redactSensitiveData(),
        winston.format.json()
    ),
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
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
        ),
    }));
}

// Export audit logger for critical operations
export const auditLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'billing-system-audit',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [auditRotateTransport],
    exitOnError: false,
});

export default logger;

