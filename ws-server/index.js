/**
 * BrixSports Standalone WebSocket Server
 * Deployed separately (e.g. Railway) to handle real-time features
 * since Vercel's serverless architecture doesn't support WebSockets.
 *
 * This is extracted from server.js and runs independently.
 */

require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── HTTP Server ────────────────────────────────────────────────
// Also provides a simple REST API so Vercel API routes can trigger broadcasts
const httpServer = http.createServer((req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'BrixSports WebSocket Server',
            uptime: process.uptime(),
            connections: io.engine?.clientsCount || 0,
        }));
        return;
    }

    // Health check endpoint for Railway/Render
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy' }));
        return;
    }

    // ─── REST API: Broadcast from Vercel API routes ─────────────
    // POST /broadcast - Allows Vercel API routes to trigger WebSocket broadcasts
    if (req.method === 'POST' && req.url === '/broadcast') {
        // Verify API key
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.WS_API_KEY) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { room, event, data } = JSON.parse(body);
                if (room && event) {
                    io.to(room).emit(event, { ...data, timestamp: Date.now() });
                    console.log(`[Broadcast API] ${event} → ${room}`);
                } else if (event) {
                    // Global broadcast
                    io.emit(event, { ...data, timestamp: Date.now() });
                    console.log(`[Broadcast API] ${event} → global`);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
        });
        return;
    }

    // 404 for anything else
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── Socket.IO Server ──────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'https://brixsports.com',
    'https://www.brixsports.com',
    // Add your Vercel preview URLs
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_APP_URL,
    // Local development
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
].filter(Boolean);

const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, etc.)
            if (!origin) return callback(null, true);
            if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
                callback(null, true);
            } else {
                console.warn(`[CORS] Blocked: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
});

// ─── In-Memory State ───────────────────────────────────────────
const matchTimes = new Map();

// ─── Socket.IO Event Handlers ──────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[WS] Connected: ${socket.id}`);

    // ── Match Subscription ──────────────────────────────────────
    socket.on('match:subscribe', ({ matchId }) => {
        socket.join(`match:${matchId}`);
        console.log(`[WS] ${socket.id} → match:${matchId}`);
        socket.emit('match:subscribed', { matchId });

        // Send cached time if available
        if (matchTimes.has(matchId)) {
            socket.emit('match:time:updated', matchTimes.get(matchId));
        }

        // Broadcast viewer count
        const roomSize = io.sockets.adapter.rooms.get(`match:${matchId}`)?.size || 0;
        io.to(`match:${matchId}`).emit('match:viewers', { matchId, count: roomSize });
    });

    socket.on('match:unsubscribe', ({ matchId }) => {
        socket.leave(`match:${matchId}`);
        socket.emit('match:unsubscribed', { matchId });

        const roomSize = io.sockets.adapter.rooms.get(`match:${matchId}`)?.size || 0;
        io.to(`match:${matchId}`).emit('match:viewers', { matchId, count: roomSize });
    });

    // ── Event Logging (from Logger client) ──────────────────────
    socket.on('event:log', (data) => {
        try {
            console.log(`[WS] Event logged: ${data.type} in match ${data.matchId}`);

            // Broadcast to all subscribers of this match
            io.to(`match:${data.matchId}`).emit('event:new', {
                ...data,
                timestamp: Date.now(),
            });

            // Global goal notification
            if (data.type === 'Goal' || data.type === 'GOAL') {
                io.emit('notification:global', {
                    type: 'GOAL',
                    matchId: data.matchId,
                    detail: data.detail,
                    teamId: data.teamId,
                    message: `GOAL! ${data.detail || 'Goal scored'}!`,
                });
            }

            // Acknowledge to sender
            socket.emit('event:logged', {
                success: true,
                eventId: data.id || `evt_${Date.now()}`,
            });
        } catch (error) {
            console.error('[WS] Error logging event:', error);
            socket.emit('error', { message: error.message, type: 'event:log:error' });
        }
    });

    // ── Event Deletion ──────────────────────────────────────────
    socket.on('event:delete', (data) => {
        console.log(`[WS] Event deleted: ${data.eventId} in match ${data.matchId}`);
        io.to(`match:${data.matchId}`).emit('event:deleted', {
            matchId: data.matchId,
            eventId: data.eventId,
        });
    });

    // ── Score Updates ───────────────────────────────────────────
    socket.on('match:score:update', (data) => {
        console.log(`[WS] Score: ${data.homeScore}-${data.awayScore} in ${data.matchId}`);
        io.to(`match:${data.matchId}`).emit('match:score:updated', data);
    });

    // ── Player Rating Updates ───────────────────────────────────
    socket.on('rating:update', (data) => {
        io.to(`match:${data.matchId}`).emit('rating:updated', data);
    });

    // ── Team Stats Updates ──────────────────────────────────────
    socket.on('stats:update', (data) => {
        io.to(`match:${data.matchId}`).emit('stats:updated', data);
    });

    // ── Eye Point ───────────────────────────────────────────────
    socket.on('eyepoint:award', (data) => {
        io.to(`match:${data.matchId}`).emit('eyepoint:awarded', data);
    });

    // ── Substitution ────────────────────────────────────────────
    socket.on('substitution:log', (data) => {
        io.to(`match:${data.matchId}`).emit('substitution:logged', data);
    });

    // ── Match Status ────────────────────────────────────────────
    socket.on('match:status:change', (data) => {
        console.log(`[WS] Status: ${data.status} for ${data.matchId}`);
        io.to(`match:${data.matchId}`).emit('match:status:changed', data);
    });

    // ── Match Time ──────────────────────────────────────────────
    socket.on('match:time:update', (data) => {
        matchTimes.set(data.matchId, data);
        io.to(`match:${data.matchId}`).emit('match:time:updated', data);
    });

    // ── Lineup Updates ──────────────────────────────────────────
    socket.on('match:lineup:update', (data) => {
        console.log(`[WS] Lineup update for ${data.matchId}`);
        io.to(`match:${data.matchId}`).emit('match:lineup:updated', data);
    });

    // ── Match General Update ────────────────────────────────────
    socket.on('match:update', (data) => {
        io.to(`match:${data.matchId}`).emit('match:updated', data);
    });

    // ── Live Chat ───────────────────────────────────────────────
    socket.on('chat:join', ({ matchId }) => {
        socket.join(`chat:${matchId}`);
    });

    socket.on('chat:leave', ({ matchId }) => {
        socket.leave(`chat:${matchId}`);
    });

    socket.on('chat:message', (data) => {
        io.to(`chat:${data.matchId}`).emit('chat:message', data);
    });

    // ── Competition / Standings ─────────────────────────────────
    socket.on('join-competition', (competitionId) => {
        socket.join(`competition:${competitionId}`);
        console.log(`[WS] ${socket.id} → competition:${competitionId}`);
    });

    socket.on('leave-competition', (competitionId) => {
        socket.leave(`competition:${competitionId}`);
    });

    // ── Admin Channels ──────────────────────────────────────────
    socket.on('admin:subscribe', () => {
        socket.join('admin:loggers');
    });

    socket.on('admin:livestream:subscribe', () => {
        socket.join('admin:livestreams');
    });

    socket.on('logger:status:update', (data) => {
        io.to('admin:loggers').emit('logger:updated', data);
    });

    // ── Multi-Logger Real-time Sync ─────────────────────────────
    // Tracks which loggers are active in each match room
    socket.on('logger:join', ({ matchId, loggerId, loggerName }) => {
        const room = `logger:${matchId}`;
        socket.join(room);
        // Store logger info on the socket for disconnect handling
        socket.data.loggerInfo = { matchId, loggerId, loggerName };

        console.log(`[WS] Logger ${loggerName} (${loggerId}) joined match ${matchId}`);

        // Notify others in the room
        socket.to(room).emit('logger-joined', { loggerId, loggerName });

        // Send back the list of active loggers in this room
        const roomSockets = io.sockets.adapter.rooms.get(room);
        const loggers = [];
        if (roomSockets) {
            for (const socketId of roomSockets) {
                const s = io.sockets.sockets.get(socketId);
                if (s?.data?.loggerInfo) {
                    loggers.push({
                        loggerId: s.data.loggerInfo.loggerId,
                        loggerName: s.data.loggerInfo.loggerName,
                    });
                }
            }
        }
        socket.emit('sync-response', { loggers });
    });

    socket.on('logger:leave', ({ matchId, loggerId }) => {
        const room = `logger:${matchId}`;
        socket.leave(room);
        console.log(`[WS] Logger ${loggerId} left match ${matchId}`);
        socket.to(room).emit('logger-left', { loggerId });
        socket.data.loggerInfo = null;
    });

    socket.on('logger:broadcast-event', ({ matchId, event }) => {
        const room = `logger:${matchId}`;
        // Broadcast to all other loggers in this match room (not the sender)
        socket.to(room).emit('logger:event', event);
    });

    // ── Polls & Predictions ─────────────────────────────────────
    socket.on('poll:vote', (data) => {
        io.to(`match:${data.matchId}`).emit('poll:updated', data);
    });

    socket.on('prediction:submit', (data) => {
        io.to(`match:${data.matchId}`).emit('prediction:updated', data);
    });

    // ── Heartbeat ───────────────────────────────────────────────
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });

    // ── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', (reason) => {
        console.log(`[WS] Disconnected: ${socket.id} (${reason})`);

        // Clean up logger room if this socket was a logger
        if (socket.data.loggerInfo) {
            const { matchId, loggerId } = socket.data.loggerInfo;
            const room = `logger:${matchId}`;
            socket.to(room).emit('logger-left', { loggerId });
            console.log(`[WS] Logger ${loggerId} disconnected from match ${matchId}`);
        }
    });

    socket.on('error', (error) => {
        console.error(`[WS] Error ${socket.id}:`, error);
    });
});

// ─── Start Server ───────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`\n🚀 BrixSports WebSocket Server`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Socket.IO path: /api/socket`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}\n`);
});

// ─── Graceful Shutdown ──────────────────────────────────────────
const shutdown = (signal) => {
    console.log(`\n[WS] ${signal} received, shutting down...`);
    io.close(() => {
        httpServer.close(() => {
            console.log('[WS] Server closed.');
            process.exit(0);
        });
    });
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
