"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * GET /api/v1/routers/onboard/:token/script
 * Public endpoint for MikroTik router /tool fetch to download onboarding .rsc script
 */
router.get('/:token/script', async (req, res) => {
    try {
        const { token } = req.params;
        const routerRecord = await models_1.Router.findOne({
            where: { onboardToken: token }
        });
        if (!routerRecord) {
            return res.status(404).type('text/plain').send('# Error: Router onboarding token invalid or expired');
        }
        if (!routerRecord.autoConfigScript) {
            return res.status(404).type('text/plain').send('# Error: Auto-config script not ready');
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="jevish.rsc"');
        res.send(routerRecord.autoConfigScript);
    }
    catch (error) {
        logger_1.default.error('Failed to serve public onboarding script', { error: error.message });
        res.status(500).type('text/plain').send('# Error: Internal Server Error');
    }
});
/**
 * GET / POST /api/v1/routers/onboard/:token/register
 * Phone-home webhook called by MikroTik router upon executing script
 */
const handleRegister = async (req, res) => {
    try {
        const { token } = req.params;
        const version = req.query.version || req.body?.version || 'v7';
        const identity = req.query.identity || req.body?.identity;
        // Extract client IP address
        let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
        if (typeof rawIp === 'string' && rawIp.includes(',')) {
            rawIp = rawIp.split(',')[0].trim();
        }
        if (typeof rawIp === 'string' && rawIp.startsWith('::ffff:')) {
            rawIp = rawIp.substring(7);
        }
        const routerRecord = await models_1.Router.findOne({
            where: { onboardToken: token }
        });
        if (!routerRecord) {
            return res.status(404).send('ERROR: Invalid Token');
        }
        const routerIp = (rawIp && rawIp !== '::1' && rawIp !== '127.0.0.1') ? rawIp : routerRecord.host;
        await routerRecord.update({
            autoConfigStatus: 'CONFIGURED',
            validationStatus: 'VALIDATED',
            isOnline: true,
            lastSeen: new Date(),
            version: String(version),
            identity: identity ? String(identity) : routerRecord.identity || `Jevish_${routerRecord.location}`,
            host: routerIp && routerIp !== '0.0.0.0' ? routerIp : routerRecord.host,
            autoConfigError: null
        });
        try {
            await models_1.RouterConnectionLog.create({
                routerId: routerRecord.id,
                tenantId: routerRecord.tenantId,
                action: 'VERIFY',
                status: 'SUCCESS',
                details: `Automated onboarding completed from IP ${routerIp}`,
                metadata: JSON.stringify({ version, identity, ip: routerIp })
            });
        }
        catch (_) { }
        logger_1.default.info(`Automated router onboarding registered successfully: ${routerRecord.name} (${routerIp})`);
        res.status(200).send(`OK: Router [${routerRecord.name}] Onboarded Successfully`);
    }
    catch (error) {
        logger_1.default.error('Failed to process router phone-home registration', { error: error.message });
        res.status(500).send('ERROR: Server Processing Error');
    }
};
router.get('/:token/register', handleRegister);
router.post('/:token/register', handleRegister);
/**
 * GET /api/v1/routers/onboard/:token/status
 * Public status endpoint for onboarding UI polling
 */
router.get('/:token/status', async (req, res) => {
    try {
        const { token } = req.params;
        const routerRecord = await models_1.Router.findOne({
            where: { onboardToken: token },
            attributes: ['id', 'name', 'location', 'host', 'port', 'isOnline', 'autoConfigStatus', 'validationStatus', 'version', 'identity', 'lastSeen']
        });
        if (!routerRecord) {
            return res.status(404).json({ error: 'Router not found' });
        }
        const isConfigured = routerRecord.autoConfigStatus === 'CONFIGURED' || routerRecord.validationStatus === 'VALIDATED';
        res.json({
            isConfigured,
            isOnline: routerRecord.isOnline,
            router: routerRecord
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check status' });
    }
});
exports.default = router;
