"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const radius_service_1 = require("../services/radius.service");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * GET /api/v1/radius/overview
 * Get RADIUS platform overview metrics and NAS device list
 */
router.get('/overview', async (req, res) => {
    try {
        const tenantId = req.user?.role === 'SUPER_ADMIN' && req.query.tenantId
            ? String(req.query.tenantId)
            : req.user?.tenantId;
        const overview = await radius_service_1.RadiusService.getRadiusOverview(tenantId);
        return res.json(overview);
    }
    catch (err) {
        logger_1.default.error(`Error fetching RADIUS overview: ${err.message}`);
        return res.status(500).json({ error: 'Failed to fetch RADIUS overview' });
    }
});
/**
 * POST /api/v1/radius/authenticate
 * External RADIUS AAA Access-Request authentication endpoint
 */
router.post('/authenticate', async (req, res) => {
    try {
        const { username, password, macAddress, voucherCode, nasIp, serviceType, tenantId } = req.body;
        const reqTenantId = tenantId || req.user?.tenantId;
        if (!username || !nasIp || !reqTenantId) {
            return res.status(400).json({ error: 'username, nasIp, and tenantId are required' });
        }
        const result = await radius_service_1.RadiusService.authenticateSubscriber({
            username,
            password,
            macAddress,
            voucherCode,
            nasIp,
            serviceType,
            tenantId: reqTenantId
        });
        return res.json(result);
    }
    catch (err) {
        logger_1.default.error(`RADIUS authentication endpoint error: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/v1/radius/accounting
 * External RADIUS AAA Accounting-Request endpoint (Start, Interim-Update, Stop)
 */
router.post('/accounting', async (req, res) => {
    try {
        const { acctsessionid, acctuniqueid, username, nasipaddress, acctstatusType, acctsessiontime, acctinputoctets, acctoutputoctets, framedipaddress, tenantId } = req.body;
        const reqTenantId = tenantId || req.user?.tenantId;
        if (!acctsessionid || !username || !nasipaddress || !acctstatusType || !reqTenantId) {
            return res.status(400).json({ error: 'acctsessionid, username, nasipaddress, acctstatusType, and tenantId are required' });
        }
        const result = await radius_service_1.RadiusService.processAccounting({
            acctsessionid,
            acctuniqueid,
            username,
            nasipaddress,
            acctstatusType,
            acctsessiontime: Number(acctsessiontime || 0),
            acctinputoctets: Number(acctinputoctets || 0),
            acctoutputoctets: Number(acctoutputoctets || 0),
            framedipaddress,
            tenantId: reqTenantId
        });
        return res.json(result);
    }
    catch (err) {
        logger_1.default.error(`RADIUS accounting endpoint error: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/v1/radius/sync-subscriber
 * Force sync subscriber RADIUS attributes
 */
router.post('/sync-subscriber', async (req, res) => {
    try {
        const { subscriberId } = req.body;
        const tenantId = req.user?.tenantId;
        if (!subscriberId) {
            return res.status(400).json({ error: 'subscriberId is required' });
        }
        const result = await radius_service_1.RadiusService.syncSubscriberAttributes(subscriberId, tenantId);
        return res.json(result);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/v1/radius/nas
 * List NAS devices for tenant
 */
router.get('/nas', async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        const nasList = await models_1.Nas.findAll({ where: { tenantId } });
        return res.json({ nasList });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch NAS list' });
    }
});
/**
 * POST /api/v1/radius/nas
 * Register new NAS device
 */
router.post('/nas', async (req, res) => {
    try {
        const { nasname, shortname, type = 'other', ports = 0, secret, description } = req.body;
        const tenantId = req.user?.tenantId;
        if (!nasname || !shortname || !secret) {
            return res.status(400).json({ error: 'nasname, shortname, and secret are required' });
        }
        const nas = await models_1.Nas.create({
            nasname,
            shortname,
            type,
            ports: Number(ports),
            secret,
            description,
            tenantId,
            status: 'ACTIVE'
        });
        await models_1.AuditLog.create({
            tenantId,
            userId: req.user?.id,
            action: 'CREATE_NAS_DEVICE',
            resource: 'Nas',
            details: `Registered NAS device ${shortname} (${nasname})`
        });
        return res.status(201).json({ message: 'NAS device registered successfully', nas });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/v1/radius/sessions/:sessionId/disconnect
 * Issue Packet-of-Disconnect (PoD / DM)
 */
router.post('/sessions/:sessionId/disconnect', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const tenantId = req.user?.tenantId;
        const session = await models_1.RadAcct.findOne({ where: { acctsessionid: sessionId, tenantId } });
        if (!session) {
            return res.status(404).json({ error: 'Active RADIUS session not found' });
        }
        const nas = await models_1.Nas.findOne({ where: { nasname: session.nasipaddress, tenantId } });
        const secret = nas ? nas.secret : (process.env.RADIUS_SECRET || 'testing123');
        const result = await radius_service_1.RadiusService.sendDisconnectMessage({
            nasIp: session.nasipaddress,
            secret,
            username: session.username,
            sessionId: session.acctsessionid,
            framedIp: session.framedipaddress || undefined
        });
        // Mark session stopped in database
        await session.update({
            acctstoptime: new Date(),
            acctterminatecause: 'Admin-Reset'
        });
        return res.json(result);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/v1/radius/sessions/:sessionId/coa
 * Issue Change-of-Authorization (CoA) rate-limit update
 */
router.post('/sessions/:sessionId/coa', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { rateLimit } = req.body;
        const tenantId = req.user?.tenantId;
        if (!rateLimit) {
            return res.status(400).json({ error: 'rateLimit (e.g. 20M/20M) is required' });
        }
        const session = await models_1.RadAcct.findOne({ where: { acctsessionid: sessionId, tenantId } });
        if (!session) {
            return res.status(404).json({ error: 'Active RADIUS session not found' });
        }
        const nas = await models_1.Nas.findOne({ where: { nasname: session.nasipaddress, tenantId } });
        const secret = nas ? nas.secret : (process.env.RADIUS_SECRET || 'testing123');
        const result = await radius_service_1.RadiusService.sendCoAMessage({
            nasIp: session.nasipaddress,
            secret,
            username: session.username,
            rateLimit,
            sessionId: session.acctsessionid
        });
        return res.json(result);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/v1/radius/postauth
 * View authentication logs (Access-Accept & Access-Reject)
 */
router.get('/postauth', async (req, res) => {
    try {
        const tenantId = req.user?.role === 'SUPER_ADMIN' && req.query.tenantId
            ? String(req.query.tenantId)
            : req.user?.tenantId;
        const logs = await models_1.RadPostAuth.findAll({
            where: tenantId ? { tenantId } : {},
            order: [['authdate', 'DESC']],
            limit: 50
        });
        return res.json({ logs });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch auth logs' });
    }
});
/**
 * GET /api/v1/radius/superadmin/servers
 * Super Admin cross-tenant RADIUS overview
 */
router.get('/superadmin/servers', async (req, res) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Access denied. Super Admin only.' });
        }
        const overview = await radius_service_1.RadiusService.getRadiusOverview();
        return res.json(overview);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch Super Admin RADIUS servers' });
    }
});
exports.default = router;
