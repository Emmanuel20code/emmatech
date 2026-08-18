"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateSeeder = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
class TemplateSeeder {
    static async seedDefaults() {
        try {
            logger_1.default.info('Checking for missing WhatsApp templates...');
            const tenants = await models_1.Tenant.findAll();
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
                    const [_temp, created] = await models_1.MessageTemplate.findOrCreate({
                        where: { name: t.name, tenantId: t.tenantId, channel: 'WHATSAPP' },
                        defaults: t
                    });
                    if (created) {
                        logger_1.default.info(`Seeded template '${t.name}' for tenant ${tenant.name}`);
                    }
                }
            }
            logger_1.default.info('WhatsApp template check complete.');
        }
        catch (error) {
            logger_1.default.error('Failed to seed templates on startup:', error);
        }
    }
}
exports.TemplateSeeder = TemplateSeeder;
