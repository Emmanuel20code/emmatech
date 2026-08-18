"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class ErrorHandler {
    static async handleTenantError(err, req, res, next) {
        if (err.name === 'SequelizeForeignKeyConstraintError' && err.message.includes('tenantId')) {
            // Handle tenant resolution errors
            logger_1.default.error('Tenant resolution error', { error: err.message, userId: req.user?.id });
            return res.status(403).json({
                error: 'Workspace access required',
                action: 'SELECT_WORKSPACE',
                message: 'Please select or create a workspace to continue'
            });
        }
        if (err.name === 'Error' && err.message.includes('TENANT_ID_REQUIRED')) {
            // Handle missing tenantId validation
            logger_1.default.error('Missing tenantId error', { error: err.message, userId: req.user?.id });
            return res.status(403).json({
                error: 'You don\'t have a workspace yet',
                action: 'NAVIGATE_TO_SETUP',
                path: '/tenant/setup',
                message: 'Please create a workspace to continue'
            });
        }
        next(err);
    }
    static async handleGeneralError(err, req, res, _next) {
        logger_1.default.error('Unhandled error', { error: err.message, stack: err.stack, userId: req.user?.id });
        res.status(500).json({
            error: 'System error',
            message: 'Please try again or contact support'
        });
    }
}
exports.ErrorHandler = ErrorHandler;
