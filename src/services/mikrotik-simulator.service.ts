import crypto from 'crypto';
import logger from '../utils/logger';

export interface SimulatedHotspotUser {
    id: string;
    username: string;
    profile: string;
    uptime: string;
    bytesIn: number;
    bytesOut: number;
    macAddress: string;
    ipAddress: string;
    comment: string;
}

export interface SimulatedPppUser {
    id: string;
    username: string;
    service: 'pppoe' | 'any';
    profile: string;
    remoteAddress: string;
    callerId: string;
    disabled: boolean;
}

export interface SimulatedQueue {
    id: string;
    name: string;
    target: string;
    maxLimit: string; // e.g. "10M/10M"
    burstLimit: string;
}

export class MikrotikSimulatorService {
    private static hotspotUsers: SimulatedHotspotUser[] = [
        { id: '*1', username: 'guest_test_01', profile: 'Staging 1 Hour Quick Pass', uptime: '00:14:22', bytesIn: 1542000, bytesOut: 8940000, macAddress: 'AA:BB:CC:11:22:33', ipAddress: '192.168.88.201', comment: 'Simulated Hotspot User' },
        { id: '*2', username: 'guest_test_02', profile: 'Staging 24 Hour Unlimited', uptime: '02:45:10', bytesIn: 45000000, bytesOut: 120000000, macAddress: 'AA:BB:CC:44:55:66', ipAddress: '192.168.88.202', comment: 'Simulated Hotspot User' },
    ];

    private static pppUsers: SimulatedPppUser[] = [
        { id: '*P1', username: 'fiber_client_01', service: 'pppoe', profile: 'Staging Monthly ISP Fiber 20Mbps', remoteAddress: '10.10.0.50', callerId: 'DE:AD:BE:EF:00:01', disabled: false },
    ];

    private static queues: SimulatedQueue[] = [
        { id: '*Q1', name: 'queue-guest_test_01', target: '192.168.88.201', maxLimit: '5M/5M', burstLimit: '8M/8M' },
        { id: '*Q2', name: 'queue-fiber_client_01', target: '10.10.0.50', maxLimit: '20M/20M', burstLimit: '30M/30M' },
    ];

    /**
     * Test router connectivity simulation.
     */
    static async pingRouter(host: string, port: number): Promise<{ success: boolean; latencyMs: number; identity: string; version: string }> {
        return {
            success: true,
            latencyMs: Math.floor(Math.random() * 10) + 2, // 2-12ms latency
            identity: `Staging-MikroTik-Simulator-[${host}]`,
            version: '7.12.1 (stable)',
        };
    }

    /**
     * Create Hotspot user in simulation state.
     */
    static async createHotspotUser(input: { username: string; password?: string; profile: string; limitUptime?: string; comment?: string }): Promise<SimulatedHotspotUser> {
        const newUser: SimulatedHotspotUser = {
            id: `*${this.hotspotUsers.length + 1}`,
            username: input.username,
            profile: input.profile,
            uptime: '00:00:00',
            bytesIn: 0,
            bytesOut: 0,
            macAddress: `AA:BB:CC:${crypto.randomBytes(3).toString('hex').toUpperCase().match(/.{2}/g)?.join(':')}`,
            ipAddress: `192.168.88.${Math.floor(Math.random() * 200) + 10}`,
            comment: input.comment || 'Created via Jevish Staging Simulator',
        };

        this.hotspotUsers.push(newUser);
        logger.info('[MikrotikSimulator] Created Hotspot User', { username: input.username, profile: input.profile });

        // Auto-create queue for bandwidth profile
        this.queues.push({
            id: `*Q${this.queues.length + 1}`,
            name: `queue-${input.username}`,
            target: newUser.ipAddress,
            maxLimit: input.profile.includes('20Mbps') ? '20M/20M' : '10M/10M',
            burstLimit: '15M/15M',
        });

        return newUser;
    }

    /**
     * List all active simulated Hotspot users.
     */
    static async getHotspotUsers(): Promise<SimulatedHotspotUser[]> {
        return this.hotspotUsers;
    }

    /**
     * List all PPP users.
     */
    static async getPppUsers(): Promise<SimulatedPppUser[]> {
        return this.pppUsers;
    }

    /**
     * List all simple queues.
     */
    static async getQueues(): Promise<SimulatedQueue[]> {
        return this.queues;
    }

    /**
     * Simulate RADIUS authentication test.
     */
    static async simulateRadiusAuth(username: string, macAddress: string): Promise<{
        authenticated: boolean;
        accessGranted: boolean;
        assignedIp: string;
        sessionTimeoutSeconds: number;
        rateLimit: string;
    }> {
        return {
            authenticated: true,
            accessGranted: true,
            assignedIp: '192.168.88.199',
            sessionTimeoutSeconds: 3600,
            rateLimit: '10M/10M 15M/15M 8M/8M 8/8 8 5M/5M',
        };
    }

    /**
     * Generate simulated vouchers.
     */
    static async generateSimulatedVouchers(count: number, packageId: number): Promise<Array<{ code: string; status: string }>> {
        const vouchers = [];
        for (let i = 0; i < count; i++) {
            vouchers.push({
                code: `STG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
                status: 'AVAILABLE',
            });
        }
        return vouchers;
    }
}
