import dgram from 'dgram';
import crypto from 'crypto';
import {
    sequelize,
    Tenant,
    Subscriber,
    Package,
    Voucher,
    Nas,
    RadCheck,
    RadReply,
    RadGroupCheck,
    RadGroupReply,
    RadUserGroup,
    RadAcct,
    RadPostAuth,
    RadiusPolicy,
    AuditLog
} from '../models';
import logger from '../utils/logger';

export interface RadiusAuthParams {
    username: string;
    password?: string;
    macAddress?: string;
    voucherCode?: string;
    nasIp: string;
    serviceType?: 'PPPoE' | 'Hotspot' | 'MAC' | 'Voucher';
    tenantId: string;
}

export interface RadiusAcctPacket {
    acctsessionid: string;
    acctuniqueid?: string;
    username: string;
    nasipaddress: string;
    nasportid?: string;
    nasporttype?: string;
    acctstatusType: 'Start' | 'Interim-Update' | 'Stop';
    acctsessiontime?: number;
    acctinputoctets?: number;
    acctoutputoctets?: number;
    calledstationid?: string;
    callingstationid?: string;
    acctterminatecause?: string;
    servicetype?: string;
    framedprotocol?: string;
    framedipaddress?: string;
    tenantId: string;
}

export class RadiusService {

    /**
     * Authorize a subscriber and generate/sync RADIUS attributes (radcheck, radreply, radusergroup)
     */
    static async syncSubscriberAttributes(subscriberId: string, tenantId: string) {
        const sub = await Subscriber.findOne({
            where: { id: subscriberId, tenantId },
            include: [{ model: Package, as: 'package' }]
        });

        if (!sub) {
            throw new Error(`Subscriber ${subscriberId} not found for tenant ${tenantId}`);
        }

        const username = sub.pppoeUsername || sub.username || sub.phoneNumber;
        const password = sub.pppoePassword || sub.password || '123456';

        // Clear existing radcheck / radreply for this user & tenant
        await RadCheck.destroy({ where: { username, tenantId } });
        await RadReply.destroy({ where: { username, tenantId } });
        await RadUserGroup.destroy({ where: { username, tenantId } });

        // Add radcheck authentication entry
        await RadCheck.create({
            username,
            attribute: 'Cleartext-Password',
            op: ':=',
            value: password,
            tenantId
        });

        // Add Simultaneous-Use check
        await RadCheck.create({
            username,
            attribute: 'Simultaneous-Use',
            op: ':=',
            value: '1',
            tenantId
        });

        // Package-based RADIUS reply attributes
        const pkg = (sub as any).package;
        if (pkg) {
            const uploadSpeed = pkg.uploadSpeed || '10M';
            const downloadSpeed = pkg.downloadSpeed || '10M';
            const rateLimitStr = `${uploadSpeed}/${downloadSpeed}`;

            // Mikrotik-Rate-Limit (Mikrotik Vendor Attribute)
            await RadReply.create({
                username,
                attribute: 'Mikrotik-Rate-Limit',
                op: '=',
                value: rateLimitStr,
                tenantId
            });

            // Standard WISPr Bandwidth Attributes
            const upBits = (parseFloat(uploadSpeed) || 10) * 1000000;
            const downBits = (parseFloat(downloadSpeed) || 10) * 1000000;
            await RadReply.create({
                username,
                attribute: 'WISPr-Bandwidth-Max-Up',
                op: '=',
                value: String(upBits),
                tenantId
            });
            await RadReply.create({
                username,
                attribute: 'WISPr-Bandwidth-Max-Down',
                op: '=',
                value: String(downBits),
                tenantId
            });

            // Session-Timeout from Package duration
            if (pkg.durationHours) {
                const timeoutSecs = pkg.durationHours * 3600;
                await RadReply.create({
                    username,
                    attribute: 'Session-Timeout',
                    op: '=',
                    value: String(timeoutSecs),
                    tenantId
                });
            }

            // Assign User Group
            await RadUserGroup.create({
                username,
                groupname: `pkg_${pkg.id}`,
                priority: 1,
                tenantId
            });
        }

        return { success: true, username, attributesSynced: true };
    }

    /**
     * Authenticate subscriber credentials via RADIUS AAA engine
     */
    static async authenticateSubscriber(params: RadiusAuthParams) {
        const { username, password, macAddress, voucherCode, nasIp, serviceType = 'PPPoE', tenantId } = params;

        let authSuccess = false;
        let rejectReason = '';
        let subscriberRecord: Subscriber | null = null;

        // 1. Voucher Authentication
        if (voucherCode || serviceType === 'Voucher') {
            const codeToVerify = voucherCode || username;
            const voucher = await Voucher.findOne({ where: { code: codeToVerify, tenantId } });
            if (voucher && (voucher.status === 'AVAILABLE' as any)) {
                authSuccess = true;
            } else {
                rejectReason = 'Invalid or expired voucher code';
            }
        }
        // 2. MAC Authentication
        else if (serviceType === 'MAC' || (macAddress && !password)) {
            const macToVerify = macAddress || username;
            subscriberRecord = await Subscriber.findOne({
                where: { macAddress: macToVerify, tenantId, status: 'ACTIVE' }
            });
            if (subscriberRecord) {
                authSuccess = true;
            } else {
                rejectReason = 'MAC Address not registered or subscriber inactive';
            }
        }
        // 3. Username / Password (PPPoE & Hotspot)
        else {
            subscriberRecord = await Subscriber.findOne({
                where: {
                    tenantId,
                    status: 'ACTIVE'
                }
            });

            const radCheckRecord = await RadCheck.findOne({
                where: { username, tenantId, attribute: 'Cleartext-Password' }
            });

            if (radCheckRecord && radCheckRecord.value === password) {
                authSuccess = true;
            } else if (subscriberRecord && (subscriberRecord.password === password || subscriberRecord.pppoePassword === password)) {
                authSuccess = true;
            } else {
                rejectReason = 'Invalid username or password';
            }
        }

        // Log Post-Auth Result
        await RadPostAuth.create({
            username,
            pass: password || '***',
            reply: authSuccess ? 'Access-Accept' : 'Access-Reject',
            authdate: new Date(),
            nasipaddress: nasIp,
            tenantId,
            reason: authSuccess ? 'Authentication Successful' : rejectReason
        });

        if (!authSuccess) {
            return {
                reply: 'Access-Reject',
                reason: rejectReason,
                attributes: []
            };
        }

        // Fetch Reply Attributes
        const replyAttrs = await RadReply.findAll({ where: { username, tenantId } });
        const attributesMap: Record<string, string> = {};
        replyAttrs.forEach(attr => {
            attributesMap[attr.attribute] = attr.value;
        });

        return {
            reply: 'Access-Accept',
            username,
            attributes: attributesMap
        };
    }

    /**
     * Process Accounting Packet (Start, Interim-Update, Stop)
     */
    static async processAccounting(packet: RadiusAcctPacket) {
        const uniqueId = packet.acctuniqueid || `${packet.nasipaddress}_${packet.acctsessionid}_${packet.username}`;
        const now = new Date();

        let acctRecord = await RadAcct.findOne({ where: { acctuniqueid: uniqueId } });

        if (packet.acctstatusType === 'Start') {
            if (!acctRecord) {
                acctRecord = await RadAcct.create({
                    acctsessionid: packet.acctsessionid,
                    acctuniqueid: uniqueId,
                    username: packet.username,
                    nasipaddress: packet.nasipaddress,
                    nasportid: packet.nasportid || null,
                    nasporttype: packet.nasporttype || null,
                    acctstarttime: now,
                    acctsessiontime: 0,
                    acctinputoctets: 0,
                    acctoutputoctets: 0,
                    calledstationid: packet.calledstationid || null,
                    callingstationid: packet.callingstationid || null,
                    servicetype: packet.servicetype || null,
                    framedprotocol: packet.framedprotocol || null,
                    framedipaddress: packet.framedipaddress || null,
                    tenantId: packet.tenantId
                });
            }
        } else if (packet.acctstatusType === 'Interim-Update') {
            if (acctRecord) {
                await acctRecord.update({
                    acctupdatetime: now,
                    acctsessiontime: packet.acctsessiontime || acctRecord.acctsessiontime,
                    acctinputoctets: packet.acctinputoctets || acctRecord.acctinputoctets,
                    acctoutputoctets: packet.acctoutputoctets || acctRecord.acctoutputoctets,
                    framedipaddress: packet.framedipaddress || acctRecord.framedipaddress
                });
            }
        } else if (packet.acctstatusType === 'Stop') {
            if (acctRecord) {
                await acctRecord.update({
                    acctstoptime: now,
                    acctsessiontime: packet.acctsessiontime || acctRecord.acctsessiontime,
                    acctinputoctets: packet.acctinputoctets || acctRecord.acctinputoctets,
                    acctoutputoctets: packet.acctoutputoctets || acctRecord.acctoutputoctets,
                    acctterminatecause: packet.acctterminatecause || 'User-Request'
                });
            }
        }

        return { success: true, acctuniqueid: uniqueId, status: packet.acctstatusType };
    }

    /**
     * Send Packet of Disconnect (PoD / DM) via UDP RADIUS Port 3799 / 1700
     */
    static async sendDisconnectMessage(params: {
        nasIp: string;
        secret: string;
        username: string;
        sessionId?: string;
        framedIp?: string;
        port?: number;
    }) {
        const { nasIp, secret, username, sessionId, framedIp, port = 3799 } = params;

        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            const identifier = Math.floor(Math.random() * 256);
            const authenticator = crypto.randomBytes(16);

            // Construct Disconnect-Request (Code 40) Header
            // Code (1 byte) = 40, Identifier (1 byte), Length (2 bytes)
            const header = Buffer.alloc(20);
            header.writeUInt8(40, 0); // Disconnect-Request Code
            header.writeUInt8(identifier, 1);

            // Attribute payload: User-Name (Type 1)
            const usernameBuf = Buffer.from(username);
            const attrUserName = Buffer.alloc(2 + usernameBuf.length);
            attrUserName.writeUInt8(1, 0); // Type 1: User-Name
            attrUserName.writeUInt8(2 + usernameBuf.length, 1);
            usernameBuf.copy(attrUserName, 2);

            let payload = attrUserName;

            // Optional Acct-Session-Id (Type 44)
            if (sessionId) {
                const sessBuf = Buffer.from(sessionId);
                const attrSess = Buffer.alloc(2 + sessBuf.length);
                attrSess.writeUInt8(44, 0); // Type 44
                attrSess.writeUInt8(2 + sessBuf.length, 1);
                sessBuf.copy(attrSess, 2);
                payload = Buffer.concat([payload, attrSess]);
            }

            // Optional Framed-IP-Address (Type 8)
            if (framedIp) {
                const ipParts = framedIp.split('.').map(Number);
                if (ipParts.length === 4) {
                    const attrIp = Buffer.alloc(6);
                    attrIp.writeUInt8(8, 0); // Type 8
                    attrIp.writeUInt8(6, 1);
                    ipParts.forEach((p, i) => attrIp.writeUInt8(p, 2 + i));
                    payload = Buffer.concat([payload, attrIp]);
                }
            }

            const totalLength = 20 + payload.length;
            header.writeUInt16BE(totalLength, 2);

            // Calculate Request Authenticator: MD5(Header + Authenticator + Attributes + Secret)
            const md5Hasher = crypto.createHash('md5');
            md5Hasher.update(header.subarray(0, 4));
            md5Hasher.update(Buffer.alloc(16, 0));
            md5Hasher.update(payload);
            md5Hasher.update(Buffer.from(secret));
            const calculatedAuth = md5Hasher.digest();
            calculatedAuth.copy(header, 4);

            const packet = Buffer.concat([header, payload]);

            client.send(packet, port, nasIp, (err) => {
                client.close();
                if (err) {
                    logger.error(`Failed to send RADIUS Disconnect packet to ${nasIp}:${port}: ${err.message}`);
                    resolve({ success: false, error: err.message });
                } else {
                    logger.info(`RADIUS Disconnect-Request (PoD) sent to ${nasIp}:${port} for user ${username}`);
                    resolve({ success: true, message: `Disconnect request sent to ${nasIp}:${port} for ${username}` });
                }
            });
        });
    }

    /**
     * Send Change of Authorization (CoA) Request via UDP Port 3799 / 1700
     */
    static async sendCoAMessage(params: {
        nasIp: string;
        secret: string;
        username: string;
        rateLimit: string;
        sessionId?: string;
        port?: number;
    }) {
        const { nasIp, secret, username, rateLimit, sessionId, port = 3799 } = params;

        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            const identifier = Math.floor(Math.random() * 256);

            // Construct CoA-Request (Code 43)
            const header = Buffer.alloc(20);
            header.writeUInt8(43, 0); // CoA-Request Code
            header.writeUInt8(identifier, 1);

            // Attribute 1: User-Name (Type 1)
            const usernameBuf = Buffer.from(username);
            const attrUserName = Buffer.alloc(2 + usernameBuf.length);
            attrUserName.writeUInt8(1, 0);
            attrUserName.writeUInt8(2 + usernameBuf.length, 1);
            usernameBuf.copy(attrUserName, 2);

            // Attribute 2: Mikrotik-Rate-Limit (Vendor-Specific Attribute 26, VendorId 14988, SubType 8)
            const rateLimitBuf = Buffer.from(rateLimit);
            const vsaHeader = Buffer.alloc(6);
            vsaHeader.writeUInt32BE(14988, 0); // Mikrotik Vendor ID
            vsaHeader.writeUInt8(8, 4);        // Subtype 8 = Mikrotik-Rate-Limit
            vsaHeader.writeUInt8(2 + rateLimitBuf.length, 5);

            const attrVsa = Buffer.alloc(2 + vsaHeader.length + rateLimitBuf.length);
            attrVsa.writeUInt8(26, 0); // Type 26: Vendor-Specific
            attrVsa.writeUInt8(2 + vsaHeader.length + rateLimitBuf.length, 1);
            vsaHeader.copy(attrVsa, 2);
            rateLimitBuf.copy(attrVsa, 2 + vsaHeader.length);

            const payload = Buffer.concat([attrUserName, attrVsa]);
            const totalLength = 20 + payload.length;
            header.writeUInt16BE(totalLength, 2);

            // Calculate Request Authenticator: MD5(Header + 16 zero bytes + Attributes + Secret)
            const md5Hasher = crypto.createHash('md5');
            md5Hasher.update(header.subarray(0, 4));
            md5Hasher.update(Buffer.alloc(16, 0));
            md5Hasher.update(payload);
            md5Hasher.update(Buffer.from(secret));
            const calculatedAuth = md5Hasher.digest();
            calculatedAuth.copy(header, 4);

            const packet = Buffer.concat([header, payload]);

            client.send(packet, port, nasIp, (err) => {
                client.close();
                if (err) {
                    logger.error(`Failed to send RADIUS CoA packet to ${nasIp}:${port}: ${err.message}`);
                    resolve({ success: false, error: err.message });
                } else {
                    logger.info(`RADIUS CoA-Request sent to ${nasIp}:${port} for user ${username} (Rate Limit: ${rateLimit})`);
                    resolve({ success: true, message: `CoA rate-limit updated to ${rateLimit} for ${username}` });
                }
            });
        });
    }

    /**
     * Get RADIUS Platform Overview Stats for Super Admin & Tenant
     */
    static async getRadiusOverview(tenantId?: string) {
        const whereTenant = tenantId ? { tenantId } : {};

        const activeSessions = await RadAcct.count({
            where: { ...whereTenant, acctstoptime: null }
        });

        const totalNas = await Nas.count({ where: whereTenant });

        const authRequestsCount = await RadPostAuth.count({ where: whereTenant });

        const failedAuthsCount = await RadPostAuth.count({
            where: { ...whereTenant, reply: 'Access-Reject' }
        });

        const recentSessions = await RadAcct.findAll({
            where: whereTenant,
            order: [['acctstarttime', 'DESC']],
            limit: 15
        });

        const nasList = await Nas.findAll({ where: whereTenant });

        return {
            stats: {
                activeSessions,
                totalNas,
                authRequestsCount,
                failedAuthsCount,
                serverHealth: 'OPERATIONAL',
                haFailoverStatus: 'ACTIVE_PRIMARY'
            },
            recentSessions,
            nasList
        };
    }
}
