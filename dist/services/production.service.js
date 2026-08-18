"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionService = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const audit_service_1 = require("./audit.service");
class ProductionService {
    /**
     * Run a comprehensive production readiness checklist for a tenant
     */
    static async getReadinessChecklist(tenantId) {
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant)
            throw new Error('Tenant not found');
        const [routers, packages, payments] = await Promise.all([
            models_1.Router.findAll({ where: { tenantId } }),
            models_1.Package.findAll({ where: { tenantId } }),
            models_1.Payment.findOne({ where: { tenantId } })
        ]);
        const checks = {
            routerConnected: routers.some(r => r.validationStatus === 'VALIDATED'),
            packagesExist: packages.length > 0,
            paymentConfigured: !!(tenant.intasendPublishableKey && tenant.intasendSecretKey),
            hasTestActivity: !!payments,
            brandingSet: !!(tenant.logoUrl && tenant.primaryColor),
            commissionValidated: tenant.commissionPercentage !== undefined && tenant.commissionPercentage > 0
        };
        const isReady = checks.routerConnected && checks.packagesExist && checks.paymentConfigured && checks.commissionValidated;
        return {
            isReady,
            checks,
            summary: isReady ? 'Your system meets all technical requirements for production.' : 'Several configuration steps are missing before you can go live.'
        };
    }
    /**
     * "Clean for Production" - Purge all test data for a tenant
     * Reversible only by Super Admin (logic to be implemented in restore)
     */
    static async sanitizeForProduction(tenantId, performedBy) {
        const transaction = await models_1.sequelize.transaction();
        try {
            // 1. Log the intent first
            await audit_service_1.AuditService.log('PRODUCTION_SANITIZATION_START', `Tenant ${tenantId} starting production sanitization`, tenantId, performedBy);
            // 2. Delete test data
            // We keep the Tenant record and AdminUsers
            await models_1.Payment.destroy({ where: { tenantId }, transaction });
            await models_1.Session.destroy({ where: { tenantId }, transaction });
            // Delete INACTIVE/FAILED routers? No, let user manage.
            // But we should delete test subscribers
            const { Subscriber } = require('../models');
            await Subscriber.destroy({ where: { tenantId }, transaction });
            // 3. Update tenant status
            await models_1.Tenant.update({
                lastSanitizedAt: new Date(),
                isGoLiveChecked: true
            }, { where: { id: tenantId }, transaction });
            await transaction.commit();
            logger_1.default.info('Production sanitization completed', { tenantId, performedBy });
            await audit_service_1.AuditService.log('PRODUCTION_SANITIZED', `Tenant ${tenantId} successfully sanitized for production`, tenantId, performedBy);
            return { success: true, message: 'Existing data purged. System is now clean.' };
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Sanitization failed', { tenantId, error: error.message });
            throw error;
        }
    }
    /**
     * Toggle production mode
     * Blocks if not ready or not sanitized
     */
    static async toggleProductionMode(tenantId, status, performedBy) {
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant)
            throw new Error('Tenant not found');
        if (status === true) {
            const readiness = await this.getReadinessChecklist(tenantId);
            if (!readiness.isReady) {
                throw new Error('System is not production-ready. Please complete the checklist.');
            }
        }
        await tenant.update({
            isProduction: status,
            productionReadyAt: status ? new Date() : tenant.productionReadyAt
        });
        await audit_service_1.AuditService.log('PRODUCTION_MODE_TOGGLE', `Tenant ${tenantId} set production mode to ${status}`, tenantId, performedBy);
        return { success: true, isProduction: tenant.isProduction };
    }
    /**
     * Periodically purge old/unused data (Background task)
     * Deletes expired sessions and anonymous subscribers with no recent activity
     */
    static async purgeOldData() {
        try {
            const { Op } = require('sequelize');
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            // 1. Purge expired sessions older than 30 days
            const sessionsDeleted = await models_1.Session.destroy({
                where: {
                    status: 'EXPIRED',
                    expiryTime: { [Op.lt]: thirtyDaysAgo }
                }
            });
            // 2. Purge inactive subscribers with no payments in 90 days
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const { Subscriber } = require('../models');
            const subscribersDeleted = await Subscriber.destroy({
                where: {
                    lastPaymentDate: { [Op.lt]: ninetyDaysAgo }
                }
            });
            if (sessionsDeleted > 0 || subscribersDeleted > 0) {
                logger_1.default.info('Background Purge Completed', { sessionsDeleted, subscribersDeleted });
            }
        }
        catch (error) {
            logger_1.default.error('Background purge failed', { error });
        }
    }
}
exports.ProductionService = ProductionService;
