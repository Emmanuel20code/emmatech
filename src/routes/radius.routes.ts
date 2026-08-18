import { Router } from 'express';
import { RadiusService } from '../services/radius.service';
import { Nas, RadAcct, RadPostAuth, RadiusPolicy, AuditLog } from '../models';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/radius/overview
 * Get RADIUS platform overview metrics and NAS device list
 */
router.get('/overview', async (req: any, res: any) => {
    try {
        const tenantId = req.user?.role === 'SUPER_ADMIN' && req.query.tenantId
            ? String(req.query.tenantId)
            : req.user?.tenantId;

        const overview = await RadiusService.getRadiusOverview(tenantId);
        return res.json(overview);
    } catch (err: any) {
        logger.error(`Error fetching RADIUS overview: ${err.message}`);
        return res.status(500).json({ error: 'Failed to fetch RADIUS overview' });
    }
});

/**
 * POST /api/v1/radius/authenticate
 * External RADIUS AAA Access-Request authentication endpoint
 */
router.post('/authenticate', async (req: any, res: any) => {
    try {
        const { username, password, macAddress, voucherCode, nasIp, serviceType, tenantId } = req.body;
        const reqTenantId = tenantId || req.user?.tenantId;

        if (!username || !nasIp || !reqTenantId) {
            return res.status(400).json({ error: 'username, nasIp, and tenantId are required' });
        }

        const result = await RadiusService.authenticateSubscriber({
            username,
            password,
            macAddress,
            voucherCode,
            nasIp,
            serviceType,
            tenantId: reqTenantId
        });

        return res.json(result);
    } catch (err: any) {
        logger.error(`RADIUS authentication endpoint error: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/v1/radius/accounting
 * External RADIUS AAA Accounting-Request endpoint (Start, Interim-Update, Stop)
 */
router.post('/accounting', async (req: any, res: any) => {
    try {
        const { acctsessionid, acctuniqueid, username, nasipaddress, acctstatusType, acctsessiontime, acctinputoctets, acctoutputoctets, framedipaddress, tenantId } = req.body;
        const reqTenantId = tenantId || req.user?.tenantId;

        if (!acctsessionid || !username || !nasipaddress || !acctstatusType || !reqTenantId) {
            return res.status(400).json({ error: 'acctsessionid, username, nasipaddress, acctstatusType, and tenantId are required' });
        }

        const result = await RadiusService.processAccounting({
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
    } catch (err: any) {
        logger.error(`RADIUS accounting endpoint error: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/v1/radius/sync-subscriber
 * Force sync subscriber RADIUS attributes
 */
router.post('/sync-subscriber', async (req: any, res: any) => {
    try {
        const { subscriberId } = req.body;
        const tenantId = req.user?.tenantId;

        if (!subscriberId) {
            return res.status(400).json({ error: 'subscriberId is required' });
        }

        const result = await RadiusService.syncSubscriberAttributes(subscriberId, tenantId);
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/v1/radius/nas
 * List NAS devices for tenant
 */
router.get('/nas', async (req: any, res: any) => {
    try {
        const tenantId = req.user?.tenantId;
        const nasList = await Nas.findAll({ where: { tenantId } });
        return res.json({ nasList });
    } catch (err: any) {
        return res.status(500).json({ error: 'Failed to fetch NAS list' });
    }
});

/**
 * POST /api/v1/radius/nas
 * Register new NAS device
 */
router.post('/nas', async (req: any, res: any) => {
    try {
        const { nasname, shortname, type = 'other', ports = 0, secret, description } = req.body;
        const tenantId = req.user?.tenantId;

        if (!nasname || !shortname || !secret) {
            return res.status(400).json({ error: 'nasname, shortname, and secret are required' });
        }

        const nas = await Nas.create({
            nasname,
            shortname,
            type,
            ports: Number(ports),
            secret,
            description,
            tenantId,
            status: 'ACTIVE'
        });

        await AuditLog.create({
            tenantId,
            userId: req.user?.id,
            action: 'CREATE_NAS_DEVICE',
            resource: 'Nas',
            details: `Registered NAS device ${shortname} (${nasname})`
        });

        return res.status(201).json({ message: 'NAS device registered successfully', nas });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/v1/radius/sessions/:sessionId/disconnect
 * Issue Packet-of-Disconnect (PoD / DM)
 */
router.post('/sessions/:sessionId/disconnect', async (req: any, res: any) => {
    try {
        const { sessionId } = req.params;
        const tenantId = req.user?.tenantId;

        const session = await RadAcct.findOne({ where: { acctsessionid: sessionId, tenantId } });
        if (!session) {
            return res.status(404).json({ error: 'Active RADIUS session not found' });
        }

        const nas = await Nas.findOne({ where: { nasname: session.nasipaddress, tenantId } });
        const secret = nas ? nas.secret : (process.env.RADIUS_SECRET || 'testing123');

        const result = await RadiusService.sendDisconnectMessage({
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
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/v1/radius/sessions/:sessionId/coa
 * Issue Change-of-Authorization (CoA) rate-limit update
 */
router.post('/sessions/:sessionId/coa', async (req: any, res: any) => {
    try {
        const { sessionId } = req.params;
        const { rateLimit } = req.body;
        const tenantId = req.user?.tenantId;

        if (!rateLimit) {
            return res.status(400).json({ error: 'rateLimit (e.g. 20M/20M) is required' });
        }

        const session = await RadAcct.findOne({ where: { acctsessionid: sessionId, tenantId } });
        if (!session) {
            return res.status(404).json({ error: 'Active RADIUS session not found' });
        }

        const nas = await Nas.findOne({ where: { nasname: session.nasipaddress, tenantId } });
        const secret = nas ? nas.secret : (process.env.RADIUS_SECRET || 'testing123');

        const result = await RadiusService.sendCoAMessage({
            nasIp: session.nasipaddress,
            secret,
            username: session.username,
            rateLimit,
            sessionId: session.acctsessionid
        });

        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/v1/radius/postauth
 * View authentication logs (Access-Accept & Access-Reject)
 */
router.get('/postauth', async (req: any, res: any) => {
    try {
        const tenantId = req.user?.role === 'SUPER_ADMIN' && req.query.tenantId
            ? String(req.query.tenantId)
            : req.user?.tenantId;

        const logs = await RadPostAuth.findAll({
            where: tenantId ? { tenantId } : {},
            order: [['authdate', 'DESC']],
            limit: 50
        });

        return res.json({ logs });
    } catch (err: any) {
        return res.status(500).json({ error: 'Failed to fetch auth logs' });
    }
});

/**
 * GET /api/v1/radius/superadmin/servers
 * Super Admin cross-tenant RADIUS overview
 */
router.get('/superadmin/servers', async (req: any, res: any) => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Access denied. Super Admin only.' });
        }

        const overview = await RadiusService.getRadiusOverview();
        return res.json(overview);
    } catch (err: any) {
        return res.status(500).json({ error: 'Failed to fetch Super Admin RADIUS servers' });
    }
});

export default router;
