import { MessageTemplate, Tenant } from '../models';
import logger from '../utils/logger';

export class TemplateSeeder {
    static async seedDefaults() {
        try {
            logger.info('Checking for missing WhatsApp templates...');
            const tenants = await Tenant.findAll();

            for (const tenant of tenants) {
                const templates = [
                    {
                        name: 'Welcome Message',
                        content: 'Hello {name}, welcome to Hotspot! We hope you enjoy our services.',
                        channel: 'WHATSAPP',
                        status: 'APPROVED',
                        tenantId: tenant.id
                    },
                    {
                        name: 'Payment Reminder',
                        content: 'Hi {name}, your hotspot subscription is about to expire. Top up now to stay connected!',
                        channel: 'WHATSAPP',
                        status: 'APPROVED',
                        tenantId: tenant.id
                    },
                    {
                        name: 'Promotion Alert',
                        content: 'Special Weekend Offer! Get 24 Hours for only KES 40. Buy now at the dashboard.',
                        channel: 'WHATSAPP',
                        status: 'APPROVED',
                        tenantId: tenant.id
                    }
                ];

                for (const t of templates) {
                    const [_temp, created] = await MessageTemplate.findOrCreate({
                        where: { name: t.name, tenantId: t.tenantId, channel: 'WHATSAPP' },
                        defaults: t
                    });
                    if (created) {
                        logger.info(`Seeded template '${t.name}' for tenant ${tenant.name}`);
                    }
                }
            }
            logger.info('WhatsApp template check complete.');
        } catch (error: any) {
            logger.error('Failed to seed templates on startup:', error);
        }
    }
}
