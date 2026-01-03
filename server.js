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

    // Socket.IO event handlers
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        // Subscribe to match updates
        socket.on('match:subscribe', ({ matchId }) => {
            socket.join(`match:${matchId}`);
            console.log(`[Socket.IO] Client ${socket.id} subscribed to match ${matchId}`);
            socket.emit('match:subscribed', { matchId });
        });

        // Unsubscribe from match
        socket.on('match:unsubscribe', ({ matchId }) => {
            socket.leave(`match:${matchId}`);
            console.log(`[Socket.IO] Client ${socket.id} unsubscribed from match ${matchId}`);
            socket.emit('match:unsubscribed', { matchId });
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
