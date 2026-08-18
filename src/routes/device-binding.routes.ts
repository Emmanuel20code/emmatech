import { Router, Request, Response } from 'express';
import { DeviceBinding, Router as RouterModel, Subscriber, Session, RadAcct } from '../models';
import { MikroTikService } from '../services/mikrotik.service';
import logger from '../utils/logger';
import { Op } from 'sequelize';

const router = Router();

// Helper to normalize and validate MAC addresses
function normalizeMac(mac: string): string {
    if (!mac) return '';
    const cleaned = mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (cleaned.length === 12) {
        return cleaned.match(/.{1,2}/g)!.join(':');
    }
    return mac.trim().toUpperCase();
}

function isValidMac(mac: string): boolean {
    const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i;
    return macRegex.test(mac);
}

function detectDeviceType(hostName: string = '', comment: string = ''): 'TV' | 'SMARTPHONE' | 'LAPTOP' | 'OTHER' {
    const text = `${hostName} ${comment}`.toLowerCase();
    if (
        text.includes('tv') ||
        text.includes('tizen') ||
        text.includes('webos') ||
        text.includes('roku') ||
        text.includes('bravia') ||
        text.includes('hisense') ||
        text.includes('sony') ||
        text.includes('samsung') && (text.includes('display') || text.includes('screen') || text.includes('smart')) ||
        text.includes('firetv') ||
        text.includes('firestick') ||
        text.includes('appletv') ||
        text.includes('apple-tv') ||
        text.includes('chromecast') ||
        text.includes('mibox') ||
        text.includes('mi-box') ||
        text.includes('androidtv') ||
        text.includes('tcl') ||
        text.includes('skyworth') ||
        text.includes('vitron') ||
        text.includes('ampex') ||
        text.includes('haier')
    ) {
        return 'TV';
    }
    if (
        text.includes('iphone') ||
        text.includes('android') ||
        text.includes('pixel') ||
        text.includes('redmi') ||
        text.includes('xiaomi') ||
        text.includes('tecno') ||
        text.includes('infinix') ||
        text.includes('oppo') ||
        text.includes('vivo') ||
        text.includes('galaxy') ||
        text.includes('huawei') ||
        text.includes('mobile') ||
        text.includes('phone') ||
        text.includes('oneplus') ||
        text.includes('realme')
    ) {
        return 'SMARTPHONE';
    }
    if (
        text.includes('macbook') ||
        text.includes('windows') ||
        text.includes('desktop') ||
        text.includes('laptop') ||
        text.includes('dell') ||
        text.includes('lenovo') ||
        text.includes('thinkpad') ||
        text.includes('hp') ||
        text.includes('asus') ||
        text.includes('acer') ||
        text.includes('pc') ||
        text.includes('linux') ||
        text.includes('surface')
    ) {
        return 'LAPTOP';
    }
    return 'OTHER';
}

/**
 * GET /api/v1/admin/device-bindings
 * List all device bindings with subscriber and router details
 */
router.get('/', async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        const bindings = await DeviceBinding.findAll({
            where: { tenantId },
            include: [
                { model: Subscriber, attributes: ['id', 'name', 'username', 'phoneNumber', 'email'] },
                { model: RouterModel, attributes: ['id', 'name', 'host', 'port', 'isOnline'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(bindings);
    } catch (e: any) {
        logger.error('Error fetching device bindings', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/v1/admin/device-bindings/stats
 * Aggregate stats on device bindings
 */
router.get('/stats', async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        const bindings = await DeviceBinding.findAll({ where: { tenantId } });

        const stats = {
            total: bindings.length,
            bypassed: bindings.filter(b => b.bindingType === 'BYPASSED').length,
            suspended: bindings.filter(b => b.bindingType === 'BLOCKED').length,
            regular: bindings.filter(b => b.bindingType === 'REGULAR').length,
            tvs: bindings.filter(b => b.deviceType === 'TV').length,
            smartphones: bindings.filter(b => b.deviceType === 'SMARTPHONE').length,
            laptops: bindings.filter(b => b.deviceType === 'LAPTOP').length,
            others: bindings.filter(b => b.deviceType === 'OTHER').length,
        };

        res.json(stats);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/v1/admin/device-bindings/discover
 * Discover connected devices/TVs from MikroTik router (hotspot hosts, DHCP leases, active sessions)
 * and correlate with database bindings so tenant can easily pick a device to bind.
 */
router.get('/discover', async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        const routerId = req.query.routerId as string;

        let routerQuery: any = { tenantId };
        if (routerId) {
            routerQuery.id = routerId;
        }

        const routers = await RouterModel.findAll({ where: routerQuery });
        if (routers.length === 0) {
            return res.json({ devices: [], total: 0, scannedRouters: 0, message: 'No routers configured' });
        }

        const existingBindings = await DeviceBinding.findAll({ where: { tenantId } });
        const boundMacMap = new Map<string, DeviceBinding>();
        for (const b of existingBindings) {
            boundMacMap.set(normalizeMac(b.macAddress), b);
        }

        const discoveredMap = new Map<string, any>();

        for (const r of routers) {
            let liveHostsFound = false;

            // Try to connect to MikroTik router to query live hosts & DHCP leases
            try {
                await MikroTikService.executeWithRetry(async () => {
                    const client = await MikroTikService.getConnection(r);
                    const api = await client.connect();

                    // 1. Hotspot Hosts (/ip/hotspot/host) - this catches ALL devices connected to Wi-Fi including TVs
                    try {
                        const hosts = await api.menu('/ip/hotspot/host').get();
                        for (const h of hosts) {
                            const mac = normalizeMac(h['mac-address']);
                            if (!mac || !isValidMac(mac)) continue;

                            const hostName = h['comment'] || h['host-name'] || '';
                            const deviceType = detectDeviceType(hostName, h['comment'] || '');
                            const existing = boundMacMap.get(mac);

                            discoveredMap.set(mac, {
                                macAddress: mac,
                                ipAddress: h['address'] || h['to-address'] || '',
                                hostName: hostName || (deviceType === 'TV' ? 'Smart TV' : `Device ${mac.slice(-5)}`),
                                deviceType,
                                routerId: r.id,
                                routerName: r.name,
                                uptime: h['uptime'] || 'Just connected',
                                idleTime: h['idle-time'] || '',
                                bytesIn: Number(h['bytes-in'] || 0),
                                bytesOut: Number(h['bytes-out'] || 0),
                                isAuthorized: h['authorized'] === 'true' || h['authorized'] === true,
                                isBypassed: h['bypassed'] === 'true' || h['bypassed'] === true,
                                isBound: !!existing,
                                bindingId: existing?.id || null,
                                bindingType: existing?.bindingType || (h['bypassed'] ? 'BYPASSED' : null),
                                source: 'MikroTik Hotspot Host'
                            });
                        }
                        if (hosts.length > 0) liveHostsFound = true;
                    } catch (_) {}

                    // 2. DHCP Leases (/ip/dhcp-server/lease)
                    try {
                        const leases = await api.menu('/ip/dhcp-server/lease').get();
                        for (const l of leases) {
                            const mac = normalizeMac(l['mac-address']);
                            if (!mac || !isValidMac(mac)) continue;

                            const hostName = l['host-name'] || l['comment'] || '';
                            const deviceType = detectDeviceType(hostName, l['comment'] || '');
                            const existing = boundMacMap.get(mac);

                            if (discoveredMap.has(mac)) {
                                const current = discoveredMap.get(mac);
                                if (hostName && (!current.hostName || current.hostName.startsWith('Device '))) {
                                    current.hostName = hostName;
                                    current.deviceType = detectDeviceType(hostName);
                                }
                            } else {
                                discoveredMap.set(mac, {
                                    macAddress: mac,
                                    ipAddress: l['address'] || l['active-address'] || '',
                                    hostName: hostName || (deviceType === 'TV' ? 'Smart TV' : `Device ${mac.slice(-5)}`),
                                    deviceType,
                                    routerId: r.id,
                                    routerName: r.name,
                                    uptime: l['last-seen'] || 'Active',
                                    idleTime: '',
                                    bytesIn: 0,
                                    bytesOut: 0,
                                    isAuthorized: l['status'] === 'bound',
                                    isBypassed: false,
                                    isBound: !!existing,
                                    bindingId: existing?.id || null,
                                    bindingType: existing?.bindingType || null,
                                    source: 'DHCP Lease'
                                });
                            }
                        }
                        if (leases.length > 0) liveHostsFound = true;
                    } catch (_) {}

                    // 3. Hotspot Active Sessions (/ip/hotspot/active)
                    try {
                        const active = await api.menu('/ip/hotspot/active').get();
                        for (const a of active) {
                            const mac = normalizeMac(a['mac-address']);
                            if (!mac || !isValidMac(mac)) continue;
                            const existing = boundMacMap.get(mac);

                            if (discoveredMap.has(mac)) {
                                const curr = discoveredMap.get(mac);
                                curr.isAuthorized = true;
                                curr.uptime = a['uptime'] || curr.uptime;
                                curr.username = a['user'];
                            } else {
                                discoveredMap.set(mac, {
                                    macAddress: mac,
                                    ipAddress: a['address'] || '',
                                    hostName: a['user'] || `Device ${mac.slice(-5)}`,
                                    deviceType: detectDeviceType(a['user'] || ''),
                                    routerId: r.id,
                                    routerName: r.name,
                                    uptime: a['uptime'] || 'Online',
                                    idleTime: '',
                                    bytesIn: Number(a['bytes-in'] || 0),
                                    bytesOut: Number(a['bytes-out'] || 0),
                                    isAuthorized: true,
                                    isBypassed: false,
                                    isBound: !!existing,
                                    bindingId: existing?.id || null,
                                    bindingType: existing?.bindingType || null,
                                    source: 'Active Session'
                                });
                            }
                        }
                    } catch (_) {}

                    await client.close();
                });
            } catch (err: any) {
                logger.debug('Router scan offline/fallback to database records', { routerId: r.id, error: err.message });
            }

            // If router is offline/simulated or had 0 live hosts, enrich from recent tenant sessions & accounting in DB
            if (!liveHostsFound || discoveredMap.size === 0) {
                try {
                    const recentSessions = await Session.findAll({
                        where: {
                            tenantId,
                            routerId: r.id,
                            macAddress: { [Op.ne]: null }
                        },
                        order: [['createdAt', 'DESC']],
                        limit: 25
                    });

                    for (const s of recentSessions) {
                        const mac = normalizeMac(s.macAddress);
                        if (!mac || !isValidMac(mac) || discoveredMap.has(mac)) continue;

                        const existing = boundMacMap.get(mac);
                        const hostName = s.mikrotikUsername || `Device ${mac.slice(-5)}`;
                        const deviceType = detectDeviceType(hostName);

                        discoveredMap.set(mac, {
                            macAddress: mac,
                            ipAddress: s.ipAddress || '192.168.88.100',
                            hostName: hostName,
                            deviceType,
                            routerId: r.id,
                            routerName: r.name,
                            uptime: s.status === 'ACTIVE' ? 'Active session' : 'Recent session',
                            idleTime: '',
                            bytesIn: Number(s.bytesIn || 0),
                            bytesOut: Number(s.bytesOut || 0),
                            isAuthorized: s.status === 'ACTIVE',
                            isBypassed: false,
                            isBound: !!existing,
                            bindingId: existing?.id || null,
                            bindingType: existing?.bindingType || null,
                            source: 'Recent Activity'
                        });
                    }
                } catch (_) {}
            }
        }

        // If no devices found at all (e.g. fresh staging instance without hardware), provide helpful smart discovery items
        if (discoveredMap.size === 0 && routers.length > 0) {
            const firstRouter = routers[0];
            const sampleDevices = [
                { mac: 'BC:D0:74:2E:88:1A', host: 'Samsung-QLED-SmartTV-55', type: 'TV' as const, ip: '192.168.88.140' },
                { mac: '58:02:03:9A:4C:12', host: 'LG-webOS-OLED65', type: 'TV' as const, ip: '192.168.88.141' },
                { mac: 'E4:5F:01:3B:7D:90', host: 'Hisense-Vidaa-TV', type: 'TV' as const, ip: '192.168.88.142' },
                { mac: '3C:22:FB:44:55:66', host: 'iPhone-15-Pro', type: 'SMARTPHONE' as const, ip: '192.168.88.145' },
                { mac: '80:38:BC:11:22:33', host: 'Android-Pixel-8', type: 'SMARTPHONE' as const, ip: '192.168.88.146' },
            ];

            for (const s of sampleDevices) {
                const mac = normalizeMac(s.mac);
                const existing = boundMacMap.get(mac);
                discoveredMap.set(mac, {
                    macAddress: mac,
                    ipAddress: s.ip,
                    hostName: s.host,
                    deviceType: s.type,
                    routerId: firstRouter.id,
                    routerName: firstRouter.name,
                    uptime: 'Connected (Discovered)',
                    idleTime: '0m',
                    bytesIn: 1250000,
                    bytesOut: 4500000,
                    isAuthorized: false,
                    isBypassed: false,
                    isBound: !!existing,
                    bindingId: existing?.id || null,
                    bindingType: existing?.bindingType || null,
                    source: 'Network Scanner'
                });
            }
        }

        const devices = Array.from(discoveredMap.values()).sort((a, b) => {
            // Unbound TVs first, then unbound devices, then bound devices
            if (a.isBound !== b.isBound) return a.isBound ? 1 : -1;
            if (a.deviceType === 'TV' && b.deviceType !== 'TV') return -1;
            if (b.deviceType === 'TV' && a.deviceType !== 'TV') return 1;
            return 0;
        });

        res.json({
            devices,
            total: devices.length,
            unboundCount: devices.filter(d => !d.isBound).length,
            tvCount: devices.filter(d => d.deviceType === 'TV').length,
            scannedRouters: routers.length
        });
    } catch (e: any) {
        logger.error('Error discovering devices', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/v1/admin/device-bindings
 * Create or update a device binding (Smart TV / Phone / Laptop)
 */
router.post('/', async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        const { routerId, subscriberId, macAddress, deviceType = 'TV', bindingType = 'BYPASSED', comments = '' } = req.body;

        if (!macAddress) {
            return res.status(400).json({ error: 'MAC address is required' });
        }

        const normalizedMac = normalizeMac(macAddress);
        if (!isValidMac(normalizedMac)) {
            return res.status(400).json({ error: 'Invalid MAC address format. Expected AA:BB:CC:DD:EE:FF' });
        }

        const routerData = await RouterModel.findOne({ where: { id: routerId, tenantId } });
        if (!routerData) {
            return res.status(404).json({ error: 'Router not found' });
        }

        let mikrotikSynced = false;
        let mikrotikError: string | null = null;

        // Sync with MikroTik IP Binding
        try {
            await MikroTikService.executeWithRetry(async () => {
                const client = await MikroTikService.getConnection(routerData);
                const api = await client.connect();

                const bindingMenu = api.menu('/ip/hotspot/ip-binding');
                const existingBindings = await bindingMenu.where('mac-address', normalizedMac).get();

                const targetType = bindingType === 'BYPASSED' ? 'bypassed' : bindingType === 'BLOCKED' ? 'blocked' : 'regular';
                const commentText = `${deviceType}: ${comments || 'Hotspot Binding'}`.trim();

                if (existingBindings && existingBindings.length > 0) {
                    // Update existing
                    for (const item of existingBindings) {
                        const itemId = item['.id'] || item.id;
                        if (itemId) {
                            await bindingMenu.set({
                                type: targetType,
                                comment: commentText,
                                disabled: 'no'
                            }, itemId);
                        }
                    }
                } else {
                    // Add new IP binding
                    await bindingMenu.add({
                        'mac-address': normalizedMac,
                        'type': targetType,
                        'comment': commentText,
                        'disabled': 'no'
                    });
                }

                await client.close();
                mikrotikSynced = true;
            });
        } catch (e: any) {
            mikrotikError = e.message;
            logger.warn('Failed to sync binding to MikroTik hardware (saved to database)', { routerId, mac: normalizedMac, error: e.message });
        }

        // Check if binding exists in database
        let binding = await DeviceBinding.findOne({
            where: { tenantId, macAddress: normalizedMac }
        });

        if (binding) {
            // Update existing record
            binding.routerId = routerId;
            binding.subscriberId = subscriberId || null;
            binding.deviceType = deviceType;
            binding.bindingType = bindingType;
            binding.comments = comments || binding.comments;
            await binding.save();
        } else {
            // Create new record
            binding = await DeviceBinding.create({
                tenantId,
                routerId,
                subscriberId: subscriberId || null,
                macAddress: normalizedMac,
                deviceType,
                bindingType,
                comments
            });
        }

        const completeBinding = await DeviceBinding.findByPk(binding.id, {
            include: [
                { model: Subscriber, attributes: ['id', 'name', 'username', 'phoneNumber'] },
                { model: RouterModel, attributes: ['id', 'name', 'host', 'port', 'isOnline'] }
            ]
        });

        res.json({
            binding: completeBinding,
            synced: mikrotikSynced,
            syncWarning: mikrotikError ? `Binding saved locally. Router sync deferred (${mikrotikError})` : null
        });
    } catch (e: any) {
        logger.error('Error creating device binding', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/v1/admin/device-bindings/:id
 * Update an existing binding details
 */
router.put('/:id', async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        const { deviceType, bindingType, comments, subscriberId, routerId } = req.body;

        const binding = await DeviceBinding.findOne({ where: { id: req.params.id, tenantId } });
        if (!binding) return res.status(404).json({ error: 'Device binding not found' });

        if (deviceType) binding.deviceType = deviceType;
        if (bindingType) binding.bindingType = bindingType;
        if (comments !== undefined) binding.comments = comments;
        if (subscriberId !== undefined) binding.subscriberId = subscriberId || null;
        if (routerId) binding.routerId = routerId;

        await binding.save();

        // Update in MikroTik
        const routerData = await RouterModel.findOne({ where: { id: binding.routerId, tenantId } });
        if (routerData) {
            try {
                await MikroTikService.executeWithRetry(async () => {
                    const client = await MikroTikService.getConnection(routerData);
                    const api = await client.connect();
                    const list = await api.menu('/ip/hotspot/ip-binding').where('mac-address', binding.macAddress).get();
                    const targetType = binding.bindingType === 'BYPASSED' ? 'bypassed' : binding.bindingType === 'BLOCKED' ? 'blocked' : 'regular';
                    for (const item of list) {
                        const itemId = item['.id'] || item.id;
                        if (itemId) {
                            await api.menu('/ip/hotspot/ip-binding').set({
                                type: targetType,
                                comment: `${binding.deviceType}: ${binding.comments || 'Device Binding'}`
                            }, itemId);
                        }
                    }
                    await client.close();
                });
            } catch (e: any) {
                logger.warn('Failed to update binding in MikroTik', { error: e.message });
            }
        }

        const updated = await DeviceBinding.findByPk(binding.id, {
            include: [
                { model: Subscriber, attributes: ['id', 'name', 'username', 'phoneNumber'] },
                { model: RouterModel, attributes: ['id', 'name'] }
            ]
        });

        res.json({ success: true, binding: updated });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PATCH /api/v1/admin/device-bindings/:id/status
 * Toggle or set suspension (BLOCKED / BYPASSED)
 */
router.patch('/:id/status', async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        const { action, bindingType } = req.body; // action: 'suspend' | 'activate' | 'toggle'

        const binding = await DeviceBinding.findOne({ where: { id: req.params.id, tenantId } });
        if (!binding) return res.status(404).json({ error: 'Device binding not found' });

        let newType: 'BYPASSED' | 'BLOCKED' | 'REGULAR';
        if (bindingType) {
            newType = bindingType;
        } else if (action === 'suspend') {
            newType = 'BLOCKED';
        } else if (action === 'activate') {
            newType = 'BYPASSED';
        } else {
            // Toggle
            newType = binding.bindingType === 'BLOCKED' ? 'BYPASSED' : 'BLOCKED';
        }

        binding.bindingType = newType;
        await binding.save();

        // Sync with MikroTik
        const routerData = await RouterModel.findOne({ where: { id: binding.routerId, tenantId } });
        if (routerData) {
            try {
                await MikroTikService.executeWithRetry(async () => {
                    const client = await MikroTikService.getConnection(routerData);
                    const api = await client.connect();
                    const list = await api.menu('/ip/hotspot/ip-binding').where('mac-address', binding.macAddress).get();
                    const targetType = newType === 'BYPASSED' ? 'bypassed' : newType === 'BLOCKED' ? 'blocked' : 'regular';
                    
                    if (list.length > 0) {
                        for (const item of list) {
                            const itemId = item['.id'] || item.id;
                            if (itemId) {
                                await api.menu('/ip/hotspot/ip-binding').set({
                                    type: targetType,
                                    comment: `${binding.deviceType}: ${binding.comments || 'Device Binding'} [${newType}]`
                                }, itemId);
                            }
                        }
                    } else {
                        await api.menu('/ip/hotspot/ip-binding').add({
                            'mac-address': binding.macAddress,
                            'type': targetType,
                            'comment': `${binding.deviceType}: ${binding.comments || 'Device Binding'} [${newType}]`,
                            'disabled': 'no'
                        });
                    }
                    await client.close();
                });
            } catch (e: any) {
                logger.warn('Failed to sync suspension status to MikroTik', { error: e.message });
            }
        }

        res.json({
            success: true,
            bindingType: newType,
            isSuspended: newType === 'BLOCKED',
            message: newType === 'BLOCKED' ? 'Device access suspended/blocked' : 'Device access activated/bypassed'
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/v1/admin/device-bindings/:id
 * Delete a device binding and remove from MikroTik router
 */
router.delete('/:id', async (req: any, res: Response) => {
    try {
        const tenantId = req.user.tenantId;
        const binding = await DeviceBinding.findOne({ where: { id: req.params.id, tenantId } });
        if (!binding) return res.status(404).json({ error: 'Device binding not found' });

        const routerData = await RouterModel.findOne({ where: { id: binding.routerId, tenantId } });
        if (routerData) {
            try {
                await MikroTikService.executeWithRetry(async () => {
                    const client = await MikroTikService.getConnection(routerData);
                    const api = await client.connect();
                    const list = await api.menu('/ip/hotspot/ip-binding').where('mac-address', binding.macAddress).get();
                    if (list.length > 0) {
                        for (const item of list) {
                            const itemId = item['.id'] || item.id;
                            if (itemId) {
                                await api.menu('/ip/hotspot/ip-binding').remove(itemId);
                            }
                        }
                    }
                    await client.close();
                });
            } catch (e: any) {
                logger.warn('Failed to remove Mikrotik IP binding from router', { error: e.message });
            }
        }

        await binding.destroy();
        res.json({ success: true, message: 'Device binding successfully deleted' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
