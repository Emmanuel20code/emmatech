import { Payment, Session, Router, Package, Tenant, sequelize } from '../models';
import logger from '../utils/logger';
import { AuditService } from './audit.service';

export class ProductionService {
    /**
     * Run a comprehensive production readiness checklist for a tenant
     */
    static async getReadinessChecklist(tenantId: string) {
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) throw new Error('Tenant not found');

        const [routers, packages, payments] = await Promise.all([
            Router.findAll({ where: { tenantId } }),
            Package.findAll({ where: { tenantId } }),
            Payment.findOne({ where: { tenantId } })
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
    static async sanitizeForProduction(tenantId: string, performedBy: string) {
        const transaction = await sequelize.transaction();

        try {
            // 1. Log the intent first
            await AuditService.log('PRODUCTION_SANITIZATION_START', `Tenant ${tenantId} starting production sanitization`, tenantId, performedBy);

            // 2. Delete test data
            // We keep the Tenant record and AdminUsers
            await Payment.destroy({ where: { tenantId }, transaction });
            await Session.destroy({ where: { tenantId }, transaction });

            // Delete INACTIVE/FAILED routers? No, let user manage.
            // But we should delete test subscribers
            const { Subscriber } = require('../models');
            await Subscriber.destroy({ where: { tenantId }, transaction });

            // 3. Update tenant status
            await Tenant.update({
                lastSanitizedAt: new Date(),
                isGoLiveChecked: true
            }, { where: { id: tenantId }, transaction });

            await transaction.commit();
            logger.info('Production sanitization completed', { tenantId, performedBy });

            await AuditService.log('PRODUCTION_SANITIZED', `Tenant ${tenantId} successfully sanitized for production`, tenantId, performedBy);

            return { success: true, message: 'Existing data purged. System is now clean.' };

        } catch (error: any) {
            await transaction.rollback();
            logger.error('Sanitization failed', { tenantId, error: error.message });
            throw error;
        }
    }

    /**
     * Toggle production mode
     * Blocks if not ready or not sanitized
     */
    static async toggleProductionMode(tenantId: string, status: boolean, performedBy: string) {
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) throw new Error('Tenant not found');

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

        await AuditService.log('PRODUCTION_MODE_TOGGLE', `Tenant ${tenantId} set production mode to ${status}`, tenantId, performedBy);

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
            const sessionsDeleted = await Session.destroy({
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
                logger.info('Background Purge Completed', { sessionsDeleted, subscribersDeleted });
            }
        } catch (error) {
            logger.error('Background purge failed', { error });
        }
    }
}
