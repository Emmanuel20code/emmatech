import { Router } from 'express';
import { Router as RouterModel, RouterConnectionLog } from '../models';
import { authMiddleware } from '../middleware/auth';
import { MikroTikService } from '../services/mikrotik.service';
import logger from '../utils/logger';

const router = Router();

const ensureString = (value: any): string => {
    if (Array.isArray(value)) return value[0] as string;
    return value as string;
};

/** Helper: get router by ID scoped to tenant */
async function getRouter(id: string, tenantId: string) {
    const r = await RouterModel.findOne({ where: { id, tenantId } });
    return r;
}

// ─── HOTSPOT USERS ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/users
 * List all hotspot users on the router
 */
router.get('/:id/users', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const users = await MikroTikService.getHotspotUsers(routerRecord);
        res.json({ users, total: (users as any[]).length });
    } catch (error: any) {
        logger.error('Failed to list users', { error: error.message });
        res.status(500).json({ error: 'Failed to list users', message: error.message });
    }
});

/**
 * POST /api/v1/routers/:id/users
 * Create a hotspot user
 */
router.post('/:id/users', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const userId = (req as any).user.id;
        const { username, password, macAddress, ipAddress, limitBytes, limitTime } = req.body;

        if (!username || !password || !macAddress) {
            return res.status(400).json({ error: 'Missing required fields: username, password, macAddress' });
        }

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.createHotspotUser(routerRecord, username, password, macAddress);

        await RouterConnectionLog.create({
            routerId: routerRecord.id, tenantId, action: 'SYNC', status: 'SUCCESS',
            details: `Created hotspot user: ${username}`,
            metadata: JSON.stringify({ username, macAddress }), userId
        });

        res.json({ success: true, message: 'Hotspot user created successfully', user: { username, macAddress, ipAddress, limitBytes, limitTime } });
    } catch (error: any) {
        logger.error('Failed to create user', { error: error.message });
        res.status(500).json({ error: 'Failed to create user', message: error.message });
    }
});

/**
 * PUT /api/v1/routers/:id/users/:username
 * Update hotspot user (enable/disable)
 */
router.put('/:id/users/:username', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const username = ensureString(req.params.username);
        const { enabled } = req.body;

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        // Enable/disable user via MikroTik API
        await MikroTikService.toggleHotspotUser(routerRecord, username, !!enabled);

        res.json({ success: true, message: `User ${username} ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error: any) {
        const parsedMsg = MikroTikService.parseError(error);
        logger.error('Failed to update user', { error: parsedMsg });
        res.status(500).json({ error: 'Failed to update user', message: parsedMsg });
    }
});

/**
 * DELETE /api/v1/routers/:id/users/:username
 * Delete hotspot user
 */
router.delete('/:id/users/:username', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const userId = (req as any).user.id;
        const username = ensureString(req.params.username);
        const ipAddress = req.query.ipAddress ? ensureString(req.query.ipAddress) : undefined;

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.disconnectHotspotUser(routerRecord, username);

        await RouterConnectionLog.create({
            routerId: routerRecord.id, tenantId, action: 'SYNC', status: 'SUCCESS',
            details: `Deleted hotspot user: ${username}`,
            metadata: JSON.stringify({ username, ipAddress }), userId
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error: any) {
        logger.error('Failed to delete user', { error: error.message });
        res.status(500).json({ error: 'Failed to delete user', message: error.message });
    }
});

// ─── SESSIONS ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/sessions
 * Get active hotspot sessions from the router
 */
router.get('/:id/sessions', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const sessions = await MikroTikService.getActiveSessions(routerRecord);
        res.json({ sessions, total: (sessions as any[]).length, router: { id: routerRecord.id, name: routerRecord.name } });
    } catch (error: any) {
        logger.error('Failed to get sessions', { error: error.message });
        res.status(500).json({ error: 'Failed to get sessions', message: error.message });
    }
});

/**
 * POST /api/v1/routers/:id/users/:username/disconnect
 * Disconnect active user session
 */
router.post('/:id/users/:username/disconnect', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const userId = (req as any).user.id;
        const username = ensureString(req.params.username);
        const { ipAddress } = req.body;

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.disconnectHotspotUser(routerRecord, username);

        await RouterConnectionLog.create({
            routerId: routerRecord.id, tenantId, action: 'SYNC', status: 'SUCCESS',
            details: `Disconnected user session: ${username}`,
            metadata: JSON.stringify({ username, ipAddress }), userId
        });

        res.json({ success: true, message: 'User disconnected successfully' });
    } catch (error: any) {
        logger.error('Failed to disconnect user', { error: error.message });
        res.status(500).json({ error: 'Failed to disconnect user', message: error.message });
    }
});

/**
 * POST /api/v1/routers/:id/sessions/:sessionId/disconnect
 * Disconnect specific session by ID
 */
router.post('/:id/sessions/:sessionId/disconnect', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const sessionId = ensureString(req.params.sessionId);

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        // Disconnect session by removing from active hotspot
        await MikroTikService.executeWithRetry(async () => {
            const client = await MikroTikService.getConnection(routerRecord);
            const api = await client.connect();
            await api.menu('/ip/hotspot/active').remove(sessionId);
            await client.close();
        });

        res.json({ success: true, message: 'Session disconnected successfully' });
    } catch (error: any) {
        const parsedMsg = MikroTikService.parseError(error);
        logger.error('Failed to disconnect session', { error: parsedMsg });
        res.status(500).json({ error: 'Failed to disconnect session', message: parsedMsg });
    }
});

// ─── PPPoE MANAGEMENT ────────────────────────────────────────────────────────
/**
 * GET /api/v1/routers/:id/pppoe/secrets
 * List all PPPoE secrets on the router
 */
router.get('/:id/pppoe/secrets', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const secrets = await MikroTikService.getPPPoESecrets(routerRecord);
        res.json({ secrets, total: (secrets as any[]).length });
    } catch (error: any) {
        logger.error('Failed to list PPPoE secrets', { error: error.message });
        res.status(500).json({ error: 'Failed to list PPPoE secrets', message: error.message });
    }
});

/**
 * POST /api/v1/routers/:id/pppoe/secrets
 * Create a PPPoE secret
 */
router.post('/:id/pppoe/secrets', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const userId = (req as any).user.id;
        const { username, password, profile, comment, service } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Missing required fields: username, password' });
        }

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.createPPPoESecret(routerRecord, username, password, service || 'pppoe', profile || 'default', comment || 'Created by Jevish');

        await RouterConnectionLog.create({
            routerId: routerRecord.id, tenantId, action: 'SYNC', status: 'SUCCESS',
            details: `Created PPPoE secret: ${username}`,
            metadata: JSON.stringify({ username, profile }), userId
        });

        res.json({ success: true, message: 'PPPoE secret created successfully' });
    } catch (error: any) {
        logger.error('Failed to create PPPoE secret', { error: error.message });
        res.status(500).json({ error: 'Failed to create PPPoE secret', message: error.message });
    }
});

/**
 * PUT /api/v1/routers/:id/pppoe/secrets/:username
 * Toggle PPPoE secret (enable/disable)
 */
router.put('/:id/pppoe/secrets/:username', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const username = ensureString(req.params.username);
        const { enabled } = req.body;

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.togglePPPoESecret(routerRecord, username, !!enabled);
        res.json({ success: true, message: `PPPoE secret ${username} ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error: any) {
        const parsedMsg = MikroTikService.parseError(error);
        logger.error('Failed to update PPPoE secret', { error: parsedMsg });
        res.status(500).json({ error: 'Failed to update PPPoE secret', message: parsedMsg });
    }
});

/**
 * DELETE /api/v1/routers/:id/pppoe/secrets/:username
 * Delete PPPoE secret
 */
router.delete('/:id/pppoe/secrets/:username', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const username = ensureString(req.params.username);

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.removePPPoESecret(routerRecord, username);
        res.json({ success: true, message: 'PPPoE secret removed successfully' });
    } catch (error: any) {
        logger.error('Failed to remove PPPoE secret', { error: error.message });
        res.status(500).json({ error: 'Failed to remove PPPoE secret', message: error.message });
    }
});

/**
 * GET /api/v1/routers/:id/pppoe/profiles
 * Get PPPoE profiles
 */
router.get('/:id/pppoe/profiles', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const profiles = await MikroTikService.getPPPoEProfiles(routerRecord);
        res.json({ profiles, total: (profiles as any[]).length });
    } catch (error: any) {
        logger.error('Failed to get PPPoE profiles', { error: error.message });
        res.status(500).json({ error: 'Failed to get PPPoE profiles', message: error.message });
    }
});

/**
 * GET /api/v1/routers/:id/pppoe/sessions
 * Get active PPPoE sessions
 */
router.get('/:id/pppoe/sessions', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const sessions = await MikroTikService.getActivePPPoESessions(routerRecord);
        res.json({ sessions, total: (sessions as any[]).length });
    } catch (error: any) {
        logger.error('Failed to get PPPoE sessions', { error: error.message });
        res.status(500).json({ error: 'Failed to get PPPoE sessions', message: error.message });
    }
});

/**
 * POST /api/v1/routers/:id/pppoe/sessions/:username/disconnect
 * Disconnect active PPPoE user session
 */
router.post('/:id/pppoe/sessions/:username/disconnect', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const username = ensureString(req.params.username);

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.disconnectPPPoEUser(routerRecord, username);
        res.json({ success: true, message: 'PPPoE session disconnected successfully' });
    } catch (error: any) {
        logger.error('Failed to disconnect PPPoE session', { error: error.message });
        res.status(500).json({ error: 'Failed to disconnect PPPoE session', message: error.message });
    }
});

// ─── SYSTEM RESOURCES ────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/resources
 * Get real system resources: CPU, RAM, disk, uptime
 */
router.get('/:id/resources', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const resources = await MikroTikService.getSystemResources(routerRecord);
        res.json({ resources, router: { id: routerRecord.id, name: routerRecord.name, isOnline: routerRecord.isOnline } });
    } catch (error: any) {
        logger.error('Failed to get resources', { error: error.message });
        res.status(500).json({ error: 'Failed to get resources', message: error.message });
    }
});

/**
 * GET /api/v1/routers/:id/stats
 * Get router statistics (sessions + resource summary)
 */
router.get('/:id/stats', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const [sessions, resources] = await Promise.allSettled([
            MikroTikService.getActiveSessions(routerRecord),
            MikroTikService.getSystemResources(routerRecord),
        ]);

        res.json({
            sessions: sessions.status === 'fulfilled' ? sessions.value : [],
            resources: resources.status === 'fulfilled' ? resources.value : null,
            router: { id: routerRecord.id, name: routerRecord.name, version: routerRecord.version, identity: routerRecord.identity }
        });
    } catch (error: any) {
        logger.error('Failed to get stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get stats', message: error.message });
    }
});

// ─── INTERFACES ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/interfaces
 * Get real interface list and status
 */
router.get('/:id/interfaces', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const interfaces = await MikroTikService.getInterfaces(routerRecord);
        res.json({ interfaces, total: (interfaces as any[]).length });
    } catch (error: any) {
        logger.error('Failed to get interfaces', { error: error.message });
        res.status(500).json({ error: 'Failed to get interfaces', message: error.message });
    }
});

// ─── QUEUES ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/queues
 * Get simple queue list
 */
router.get('/:id/queues', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const queues = await MikroTikService.getQueues(routerRecord);
        res.json({ queues, total: (queues as any[]).length });
    } catch (error: any) {
        logger.error('Failed to list queues', { error: error.message });
        res.status(500).json({ error: 'Failed to list queues', message: error.message });
    }
});

// ─── FIREWALL ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/firewall
 * Get firewall filter rules
 */
router.get('/:id/firewall', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const rules = await MikroTikService.getFirewallRules(routerRecord);
        res.json({ rules, total: (rules as any[]).length });
    } catch (error: any) {
        logger.error('Failed to get firewall rules', { error: error.message });
        res.status(500).json({ error: 'Failed to get firewall rules', message: error.message });
    }
});

// ─── DHCP ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/dhcp
 * Get DHCP lease table
 */
router.get('/:id/dhcp', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const leases = await MikroTikService.getDhcpLeases(routerRecord);
        res.json({ leases, total: (leases as any[]).length });
    } catch (error: any) {
        logger.error('Failed to get DHCP leases', { error: error.message });
        res.status(500).json({ error: 'Failed to get DHCP leases', message: error.message });
    }
});

// ─── LOGS ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/logs
 * Get router system logs
 */
router.get('/:id/logs', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const logs = await MikroTikService.getSystemLogs(routerRecord);
        res.json({ logs, total: (logs as any[]).length });
    } catch (error: any) {
        logger.error('Failed to get logs', { error: error.message });
        res.status(500).json({ error: 'Failed to get logs', message: error.message });
    }
});

// ─── SPEED LIMIT ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/routers/:id/users/:username/speed
 * Apply speed limit to user via queue
 */
router.post('/:id/users/:username/speed', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const username = ensureString(req.params.username);
        const { uploadSpeed, downloadSpeed } = req.body;

        if (!uploadSpeed || !downloadSpeed) {
            return res.status(400).json({ error: 'Missing required fields: uploadSpeed, downloadSpeed' });
        }

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        // Apply via simple queue
        const { RouterOSClient } = require('routeros-client');
        const client = new RouterOSClient({
            host: routerRecord.host, user: routerRecord.username,
            password: routerRecord.password, port: routerRecord.port || 8728, timeout: 10
        });
        const api = await client.connect();
        const queues = await api.menu('/queue/simple').get({ name: `jevish-${username}` });
        const maxLimit = `${uploadSpeed}/${downloadSpeed}`;
        if (queues.length > 0) {
            await api.menu('/queue/simple').set({ 'max-limit': maxLimit }, queues[0]['.id']);
        } else {
            await api.menu('/queue/simple').add({ name: `jevish-${username}`, target: username, 'max-limit': maxLimit });
        }
        await client.close();

        res.json({ success: true, message: 'Speed limit applied successfully', limits: { upload: uploadSpeed, download: downloadSpeed } });
    } catch (error: any) {
        logger.error('Failed to apply speed limit', { error: error.message });
        res.status(500).json({ error: 'Failed to apply speed limit', message: error.message });
    }
});

// ─── SYSTEM CONTROL ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/routers/:id/system/reboot
 * Reboot the router
 */
router.post('/:id/system/reboot', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.rebootRouter(routerRecord);
        await MikroTikService.logRouterAction(routerRecord.id, tenantId, 'REBOOT', 'SUCCESS', 'Router reboot initiated');
        res.json({ success: true, message: 'Router reboot command sent' });
    } catch (error: any) {
        logger.error('Failed to reboot router', { error: error.message });
        res.status(500).json({ error: 'Failed to reboot router', message: error.message });
    }
});

// ─── BACKUP ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/routers/:id/backup/generate
 * Generate a backup on the router
 */
router.post('/:id/backup/generate', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const backupName = `jevish-${routerRecord.name.replace(/\s/g, '-')}-${Date.now()}`;
        const result = await MikroTikService.generateBackup(routerRecord, backupName);
        await MikroTikService.logRouterAction(routerRecord.id, tenantId, 'BACKUP', 'SUCCESS', `Backup generated: ${backupName}`);
        res.json(result);
    } catch (error: any) {
        logger.error('Failed to generate backup', { error: error.message });
        res.status(500).json({ error: 'Failed to generate backup', message: error.message });
    }
});

/**
 * GET /api/v1/routers/:id/backup/list
 * List backup files on the router
 */
router.get('/:id/backup/list', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const allFiles = await MikroTikService.listFiles(routerRecord);
        const backups = (allFiles as any[]).filter(f => f.name && f.name.endsWith('.backup'));
        res.json({ backups, total: backups.length });
    } catch (error: any) {
        logger.error('Failed to list backups', { error: error.message });
        res.status(500).json({ error: 'Failed to list backups', message: error.message });
    }
});

// ─── FILE MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/routers/:id/files
 * List all files on the router
 */
router.get('/:id/files', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        const files = await MikroTikService.listFiles(routerRecord);
        res.json({ files, total: (files as any[]).length });
    } catch (error: any) {
        logger.error('Failed to list files', { error: error.message });
        res.status(500).json({ error: 'Failed to list files', message: error.message });
    }
});

/**
 * DELETE /api/v1/routers/:id/files/:fileId
 * Delete a file from the router
 */
router.delete('/:id/files/:fileId', authMiddleware, async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const fileId = ensureString(req.params.fileId);

        const routerRecord = await getRouter(ensureString(req.params.id), tenantId);
        if (!routerRecord) return res.status(404).json({ error: 'Router not found' });

        await MikroTikService.deleteFile(routerRecord, fileId);
        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error: any) {
        logger.error('Failed to delete file', { error: error.message });
        res.status(500).json({ error: 'Failed to delete file', message: error.message });
    }
});

export default router;
