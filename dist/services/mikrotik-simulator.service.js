"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikrotikSimulatorService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../utils/logger"));
class MikrotikSimulatorService {
    static { this.hotspotUsers = [
        { id: '*1', username: 'guest_test_01', profile: 'Staging 1 Hour Quick Pass', uptime: '00:14:22', bytesIn: 1542000, bytesOut: 8940000, macAddress: 'AA:BB:CC:11:22:33', ipAddress: '192.168.88.201', comment: 'Simulated Hotspot User' },
        { id: '*2', username: 'guest_test_02', profile: 'Staging 24 Hour Unlimited', uptime: '02:45:10', bytesIn: 45000000, bytesOut: 120000000, macAddress: 'AA:BB:CC:44:55:66', ipAddress: '192.168.88.202', comment: 'Simulated Hotspot User' },
    ]; }
    static { this.pppUsers = [
        { id: '*P1', username: 'fiber_client_01', service: 'pppoe', profile: 'Staging Monthly ISP Fiber 20Mbps', remoteAddress: '10.10.0.50', callerId: 'DE:AD:BE:EF:00:01', disabled: false },
    ]; }
    static { this.queues = [
        { id: '*Q1', name: 'queue-guest_test_01', target: '192.168.88.201', maxLimit: '5M/5M', burstLimit: '8M/8M' },
        { id: '*Q2', name: 'queue-fiber_client_01', target: '10.10.0.50', maxLimit: '20M/20M', burstLimit: '30M/30M' },
    ]; }
    /**
     * Test router connectivity simulation.
     */
    static async pingRouter(host, port) {
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
    static async createHotspotUser(input) {
        const newUser = {
            id: `*${this.hotspotUsers.length + 1}`,
            username: input.username,
            profile: input.profile,
            uptime: '00:00:00',
            bytesIn: 0,
            bytesOut: 0,
            macAddress: `AA:BB:CC:${crypto_1.default.randomBytes(3).toString('hex').toUpperCase().match(/.{2}/g)?.join(':')}`,
            ipAddress: `192.168.88.${Math.floor(Math.random() * 200) + 10}`,
            comment: input.comment || 'Created via Jevish Staging Simulator',
        };
        this.hotspotUsers.push(newUser);
        logger_1.default.info('[MikrotikSimulator] Created Hotspot User', { username: input.username, profile: input.profile });
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
    static async getHotspotUsers() {
        return this.hotspotUsers;
    }
    /**
     * List all PPP users.
     */
    static async getPppUsers() {
        return this.pppUsers;
    }
    /**
     * List all simple queues.
     */
    static async getQueues() {
        return this.queues;
    }
    /**
     * Simulate RADIUS authentication test.
     */
    static async simulateRadiusAuth(username, macAddress) {
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
    static async generateSimulatedVouchers(count, packageId) {
        const vouchers = [];
        for (let i = 0; i < count; i++) {
            vouchers.push({
                code: `STG-${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`,
                status: 'AVAILABLE',
            });
        }
        return vouchers;
    }
}
exports.MikrotikSimulatorService = MikrotikSimulatorService;
