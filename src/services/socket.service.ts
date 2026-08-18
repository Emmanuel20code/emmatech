import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger';

export class SocketService {
    private static io: SocketServer | null = null;

    /**
     * Initialize Socket.io with an HTTP server
     */
    static init(server: HttpServer) {
        if (this.io) return this.io;

        this.io = new SocketServer(server, {
            cors: {
                origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket: Socket) => {
            const tenantId = socket.handshake.query.tenantId as string;

            if (tenantId) {
                socket.join(tenantId);
                logger.info('Socket client connected to tenant room', {
                    tenantId,
                    socketId: socket.id
                });
            }

            socket.on('disconnect', () => {
                logger.debug('Socket client disconnected', { socketId: socket.id });
            });
        });

        logger.info('Socket.io service initialized');
        return this.io;
    }

    /**
     * Emit an event to all clients in a specific tenant room
     */
    static emitToTenant(tenantId: string, event: string, data: any) {
        if (!this.io) {
            logger.warn('Socket.io not initialized, cannot emit event', { event, tenantId });
            return;
        }
        this.io.to(tenantId).emit(event, data);
    }

    /**
     * Emit an event to all connected clients (Global)
     */
    static emitToAll(event: string, data: any) {
        if (!this.io) return;
        this.io.emit(event, data);
    }
}
