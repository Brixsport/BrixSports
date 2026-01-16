const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const io = new Server(httpServer, {
        path: '/api/socket',
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    // In-memory cache for match times
    const matchTimes = new Map();

    // Socket.IO event handlers
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        // Subscribe to match updates
        socket.on('match:subscribe', ({ matchId }) => {
            socket.join(`match:${matchId}`);
            console.log(`[Socket.IO] Client ${socket.id} subscribed to match ${matchId}`);
            socket.emit('match:subscribed', { matchId });

            // Send cached time if available
            if (matchTimes.has(matchId)) {
                socket.emit('match:time:updated', matchTimes.get(matchId));
            }

            // Broadcast new viewer count
            const roomSize = io.sockets.adapter.rooms.get(`match:${matchId}`)?.size || 0;
            io.to(`match:${matchId}`).emit('match:viewers', { matchId, count: roomSize });
        });

        // Unsubscribe from match
        socket.on('match:unsubscribe', ({ matchId }) => {
            socket.leave(`match:${matchId}`);
            console.log(`[Socket.IO] Client ${socket.id} unsubscribed from match ${matchId}`);
            socket.emit('match:unsubscribed', { matchId });

            // Broadcast new viewer count
            const roomSize = io.sockets.adapter.rooms.get(`match:${matchId}`)?.size || 0;
            io.to(`match:${matchId}`).emit('match:viewers', { matchId, count: roomSize });
        });

        // Log event (from logger)
        socket.on('event:log', async (data) => {
            try {
                console.log(`[Socket.IO] Event logged:`, data);

                // Broadcast to all subscribers of this match
                io.to(`match:${data.matchId}`).emit('event:new', {
                    ...data,
                    timestamp: new Date().toISOString(),
                });

                // GLOBAL NOTIFICATION: If it's a Goal, broadcast to EVERYONE connected (e.g. for "Goal in other match" toasts)
                if (data.type === 'Goal') {
                    io.emit('notification:global', {
                        type: 'GOAL',
                        matchId: data.matchId,
                        detail: data.detail,
                        teamId: data.teamId,
                        message: `GOAL! ${data.detail} scores!`
                    });
                }

                // Acknowledge to sender
                socket.emit('event:logged', {
                    success: true,
                    eventId: data.id || `evt_${Date.now()}`
                });
            } catch (error) {
                console.error('[Socket.IO] Error logging event:', error);
                socket.emit('error', {
                    message: error.message,
                    type: 'event:log:error'
                });
            }
        });

        // Update match score
        socket.on('match:score:update', (data) => {
            console.log(`[Socket.IO] Score update:`, data);
            io.to(`match:${data.matchId}`).emit('match:score:updated', data);
        });

        // Update player rating
        socket.on('rating:update', (data) => {
            console.log(`[Socket.IO] Rating update:`, data);
            io.to(`match:${data.matchId}`).emit('rating:updated', data);
        });

        // Update team statistics
        socket.on('stats:update', (data) => {
            console.log(`[Socket.IO] Stats update:`, data);
            io.to(`match:${data.matchId}`).emit('stats:updated', data);
        });

        // Eye Point awarded
        socket.on('eyepoint:award', (data) => {
            console.log(`[Socket.IO] Eye Point awarded:`, data);
            io.to(`match:${data.matchId}`).emit('eyepoint:awarded', data);
        });

        // Substitution event
        socket.on('substitution:log', (data) => {
            console.log(`[Socket.IO] Substitution:`, data);
            io.to(`match:${data.matchId}`).emit('substitution:logged', data);
        });

        // Match status change
        socket.on('match:status:change', (data) => {
            console.log(`[Socket.IO] Match status change:`, data);
            io.to(`match:${data.matchId}`).emit('match:status:changed', data);
        });

        // Match time update
        socket.on('match:time:update', (data) => {
            // console.log(`[Socket.IO] Match time update:`, data); // Optional logging
            matchTimes.set(data.matchId, data);
            io.to(`match:${data.matchId}`).emit('match:time:updated', data);
        });

        // Match lineup update
        socket.on('match:lineup:update', (data) => {
            console.log(`[Socket.IO] Lineup update:`, data);
            io.to(`match:${data.matchId}`).emit('match:lineup:updated', data);
        });

        // Chat: Join Room
        socket.on('chat:join', ({ matchId }) => {
            socket.join(`chat:${matchId}`);
            console.log(`[Socket.IO] Client ${socket.id} joined chat for match ${matchId}`);
        });

        // Chat: Leave Room
        socket.on('chat:leave', ({ matchId }) => {
            socket.leave(`chat:${matchId}`);
            console.log(`[Socket.IO] Client ${socket.id} left chat for match ${matchId}`);
        });

        // Chat: Message
        socket.on('chat:message', (data) => {
            // data should include: matchId, userId, userName, message, timestamp
            console.log(`[Socket.IO] Chat message in match ${data.matchId}:`, data.message);
            io.to(`chat:${data.matchId}`).emit('chat:message', data);
        });

        // Admin: Subscribe to Logger Updates
        socket.on('admin:subscribe', () => {
            socket.join('admin:loggers');
            console.log(`[Socket.IO] Client ${socket.id} subscribed to admin:loggers`);
        });

        // Admin: Subscribe to Livestream Updates
        socket.on('admin:livestream:subscribe', () => {
            socket.join('admin:livestreams');
            console.log(`[Socket.IO] Client ${socket.id} subscribed to admin:livestreams`);
        });

        // Logger: Status Update (broadcast to admin)
        socket.on('logger:status:update', (data) => {
            // data: loggerId, status, isAvailable, etc.
            io.to('admin:loggers').emit('logger:updated', data);
        });

        // Poll: New Vote
        socket.on('poll:vote', (data) => {
            // data: matchId, optionId
            console.log(`[Socket.IO] New vote in match ${data.matchId}`);
            // Broadcast to update charts for everyone
            io.to(`match:${data.matchId}`).emit('poll:updated', data);
        });

        // Prediction: New Submission
        socket.on('prediction:submit', (data) => {
            // data: matchId
            console.log(`[Socket.IO] New prediction in match ${data.matchId}`);
            // Broadcast to update stats for everyone
            io.to(`match:${data.matchId}`).emit('prediction:updated', data);
        });

        // Ping/Pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // Disconnect handler
        socket.on('disconnect', (reason) => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
        });

        // Error handler
        socket.on('error', (error) => {
            console.error(`[Socket.IO] Socket error for ${socket.id}:`, error);
        });
    });

    // Make io accessible globally for API routes
    global.io = io;

    httpServer
        .once('error', (err) => {
            console.error('[Server] Error:', err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
            console.log(`> Socket.IO ready on path /api/socket`);
            console.log(`> Environment: ${dev ? 'development' : 'production'}`);
        });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
        console.log('[Server] HTTP server closed');
    });
});

process.on('SIGINT', () => {
    console.log('[Server] SIGINT signal received: closing HTTP server');
    httpServer.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });
});
