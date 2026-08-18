import { PlatformSetting, Tenant } from '../models';
import logger from '../utils/logger';

export async function enforceLiveMpesaMode() {
    logger.info('Enforcing LIVE mode across all M-Pesa API client instances...');

    // 1. Update PlatformSettings to enforce production environment
    await PlatformSetting.upsert({
        key: 'SUPERADMIN_MPESA_ENV',
        value: 'production',
        description: 'Enforced Live Production Environment for M-Pesa'
    });

    // 2. Update all tenants with mpesaEnvironment set to sandbox to production
    await Tenant.update(
        { mpesaEnvironment: 'production' },
        { where: { mpesaEnvironment: 'sandbox' } }
    );

    logger.info('M-Pesa Live Mode enforcement completed successfully. Sandbox settings ignored, using production environment https://api.safaricom.co.ke.');
}

if (require.main === module) {
    enforceLiveMpesaMode()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Failed to enforce M-Pesa live mode:', err);
            process.exit(1);
        });
}
