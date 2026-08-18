"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = __importDefault(require("../utils/logger"));
class SocketService {
    static { this.io = null; }
    /**
     * Initialize Socket.io with an HTTP server
     */
    static init(server) {
        if (this.io)
            return this.io;
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
                methods: ['GET', 'POST']
            }
        });
        this.io.on('connection', (socket) => {
            const tenantId = socket.handshake.query.tenantId;
            if (tenantId) {
                socket.join(tenantId);
                logger_1.default.info('Socket client connected to tenant room', {
                    tenantId,
                    socketId: socket.id
                });
            }
            socket.on('disconnect', () => {
                logger_1.default.debug('Socket client disconnected', { socketId: socket.id });
            });
        });
        logger_1.default.info('Socket.io service initialized');
        return this.io;
    }
    /**
     * Emit an event to all clients in a specific tenant room
     */
    static emitToTenant(tenantId, event, data) {
        if (!this.io) {
            logger_1.default.warn('Socket.io not initialized, cannot emit event', { event, tenantId });
            return;
        }
        this.io.to(tenantId).emit(event, data);
    }
    /**
     * Emit an event to all connected clients (Global)
     */
    static emitToAll(event, data) {
        if (!this.io)
            return;
        this.io.emit(event, data);
    }
}
exports.SocketService = SocketService;
