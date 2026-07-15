const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let httpServer;

app.prepare().then(() => {
    httpServer = createServer(async (req, res) => {
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
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl)
                if (!origin) return callback(null, true);

                const allowedOrigins = [
                    process.env.NEXT_PUBLIC_APP_URL,
                    process.env.NEXT_PUBLIC_BASE_URL,
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'http://localhost:3002',
                    'https://brixsports.com',
                    'https://www.brixsports.com',
                    'https://staging.brixsports.com',
                ].filter(Boolean);

                const isVercelPreview = origin?.endsWith('.vercel.app');

                if (allowedOrigins.includes(origin) || isVercelPreview || dev) {
                    callback(null, true);
                } else {
                    console.warn(`[Socket.IO] Blocked connection from unauthorized origin: ${origin}`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
    });

    // In-memory cache for match times
    const matchTimes = new Map();

    // Socket.IO event handlers
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        // BUG-074: staging and prod share this single Railway instance — a staging test
        // match with a colliding ID would otherwise broadcast straight to prod viewers.
        // Environment is determined per-connection (there's no single process-wide env
        // var that could tell them apart, since one process serves both) from the Origin
        // header the browser sends automatically during the WS handshake — no client
        // code change needed, can't drift out of sync with what a client "declares".
        // Unrecognized/missing origins default to 'prod' (the far more common real case;
        // the harmful direction this bug describes is staging leaking into prod, not the
        // reverse, so an unmatched origin landing in prod's namespace is the safe default).
        const origin = socket.handshake.headers.origin || '';
        const env = (origin.includes('staging.brixsports.com') || origin.includes('brixsports-staging.vercel.app'))
            ? 'staging'
            : 'prod';
        const room = (name) => `${env}:${name}`;
        // Every socket joins its own environment's broadcast room, replacing the old
        // true-global io.emit('notification:global', ...) calls below — those previously
        // reached every connected socket regardless of environment.
        socket.join(env);

        // Match Room Management
        socket.on('match:subscribe', ({ matchId }) => {
            console.log(`[Socket.IO] Client ${socket.id} subscribing to Match ${matchId} (${env})`);
            socket.join(room(`match:${matchId}`));
            console.log(`[Socket.IO] Client ${socket.id} joined room ${room(`match:${matchId}`)}`);
            socket.emit('match:subscribed', { matchId });

            // Send cached time if available
            const cacheKey = room(matchId);
            if (matchTimes.has(cacheKey)) {
                socket.emit('match:time:updated', matchTimes.get(cacheKey));
            }

            // Broadcast new viewer count
            const roomSize = io.sockets.adapter.rooms.get(room(`match:${matchId}`))?.size || 0;
            io.to(room(`match:${matchId}`)).emit('match:viewers', { matchId, count: roomSize });
        });

        // Unsubscribe from match
        socket.on('match:unsubscribe', ({ matchId }) => {
            socket.leave(room(`match:${matchId}`));
            console.log(`[Socket.IO] Client ${socket.id} unsubscribed from match ${matchId} (${env})`);
            socket.emit('match:unsubscribed', { matchId });

            // Broadcast new viewer count
            const roomSize = io.sockets.adapter.rooms.get(room(`match:${matchId}`))?.size || 0;
            io.to(room(`match:${matchId}`)).emit('match:viewers', { matchId, count: roomSize });
        });

        // Log event (from logger)
        socket.on('event:log', async (data) => {
            try {
                console.log(`[Socket.IO] Event logging request received for Match ${data.matchId} (${env}):`, data);

                // Broadcast to all subscribers of this match
                io.to(room(`match:${data.matchId}`)).emit('event:new', {
                    ...data,
                    timestamp: new Date().toISOString(),
                });
                console.log(`[Socket.IO] Broadcasted event:new to room ${room(`match:${data.matchId}`)}`);

                // Broadcast important events to everyone in this environment (was a true
                // global io.emit — scoped to env now, see comment at top of connection handler)
                if (data.type === 'Goal') {
                    try {
                        const { matches, teams } = await import('./src/db/schema');
                        const matchRecord = await db.select().from(matches).where(eq(matches.id, data.matchId)).get();

                        if (matchRecord) {
                            const homeTeam = await db.select().from(teams).where(eq(teams.id, matchRecord.homeTeamId)).get();
                            const awayTeam = await db.select().from(teams).where(eq(teams.id, matchRecord.awayTeamId)).get();

                            io.to(env).emit('notification:global', {
                                type: 'GOAL',
                                matchId: data.matchId,
                                message: `${data.detail || 'Goal!'} for ${data.teamId === matchRecord.homeTeamId ? (homeTeam?.name || 'Home') : (awayTeam?.name || 'Away')}`,
                                score: { home: matchRecord.homeScore, away: matchRecord.awayScore }
                            });
                        }
                    } catch (err) {
                        console.error('Error fetching data for global notification:', err);
                        io.to(env).emit('notification:global', {
                            type: 'GOAL',
                            matchId: data.matchId,
                            message: `GOAL! ${data.detail || ''}`,
                            score: data.score
                        });
                    }
                } else if (data.type === 'Yellow Card' || data.type === 'Red Card') {
                    io.to(env).emit('notification:global', {
                        playerId: data.event?.playerId,
                        playerName: data.detail,
                        teamId: data.teamId,
                        message: `${data.type.toUpperCase()}: ${data.detail} booked.`
                    });
                }

                // Acknowledge to sender
                socket.emit('event:logged', {
                    success: true,
                    eventId: data.id || `evt_${Date.now()}`
                });
            } catch (error) {
                console.error(`[Socket.IO] Error logging event:`, error);
                socket.emit('error', {
                    message: error.message,
                    type: 'event:log:error'
                });
            }
        });

        // Undo last event
        socket.on('event:undo', (data) => {
            try {
                console.log(`[Socket.IO] Undo event request received for Match ${data.matchId} (${env}):`, data);
                io.to(room(`match:${data.matchId}`)).emit('event:deleted', {
                    matchId: data.matchId,
                    eventId: data.eventId,
                    score: data.score,
                    stats: data.stats,
                    lineups: data.lineups,
                    teamRatings: data.teamRatings,
                    timestamp: new Date().toISOString(),
                });
                console.log(`[Socket.IO] Broadcasted event:deleted to room ${room(`match:${data.matchId}`)}`);
            } catch (error) {
                console.error(`[Socket.IO] Error undoing event:`, error);
            }
        });

        // Update match score
        socket.on('match:score:update', (data) => {
            console.log(`[Socket.IO] Score update received for Match ${data.matchId} (${env}):`, data);
            io.to(room(`match:${data.matchId}`)).emit('match:score:updated', data);
            console.log(`[Socket.IO] Broadcasted match:score:updated to room ${room(`match:${data.matchId}`)}`);
        });

        // Update player rating
        socket.on('rating:update', (data) => {
            console.log(`[Socket.IO] Rating update:`, data);
            io.to(room(`match:${data.matchId}`)).emit('rating:updated', data);
        });

        // Update team statistics
        socket.on('stats:update', (data) => {
            console.log(`[Socket.IO] Stats update:`, data);
            io.to(room(`match:${data.matchId}`)).emit('stats:updated', data);
        });

        // Eye Point awarded
        socket.on('eyepoint:award', (data) => {
            console.log(`[Socket.IO] Eye Point awarded:`, data);
            io.to(room(`match:${data.matchId}`)).emit('eyepoint:awarded', data);
        });

        // Substitution event
        socket.on('substitution:log', (data) => {
            console.log(`[Socket.IO] Substitution:`, data);
            io.to(room(`match:${data.matchId}`)).emit('substitution:logged', data);
        });

        // Match status change
        socket.on('match:status:change', (data) => {
            console.log(`[Socket.IO] Match status change:`, data);
            io.to(room(`match:${data.matchId}`)).emit('match:status:changed', data);

            // Global notification for Kick-off and Full-time
            if (data.status === 'LIVE' || data.status === 'FIRST_HALF') {
                io.to(env).emit('notification:global', {
                    type: 'MATCH_START',
                    matchId: data.matchId,
                    homeTeamId: data.homeTeamId,
                    awayTeamId: data.awayTeamId,
                    homeTeam: data.homeTeam,
                    awayTeam: data.awayTeam,
                    message: `KICK-OFF! ${data.homeTeam || 'Home'} vs ${data.awayTeam || 'Away'} has started!`
                });
            } else if (data.status === 'FINISHED') {
                io.to(env).emit('notification:global', {
                    type: 'MATCH_END',
                    matchId: data.matchId,
                    homeTeamId: data.homeTeamId,
                    awayTeamId: data.awayTeamId,
                    homeTeam: data.homeTeam,
                    awayTeam: data.awayTeam,
                    message: `FULL TIME: ${data.homeTeam || 'Home'} ${data.homeScore || 0} - ${data.awayScore || 0} ${data.awayTeam || 'Away'}`
                });
            }
        });

        // Match time update
        socket.on('match:time:update', (data) => {
            const cacheKey = room(data.matchId);
            const prevTime = matchTimes.get(cacheKey);

            // Period Change Notification
            if (prevTime && prevTime.period !== data.period) {
                let periodName = data.period;
                let msg = '';

                if (data.period === 'HALFTIME') {
                    msg = 'Half-time reached.';
                } else if (data.period === 'SECOND_HALF') {
                    msg = 'Second half underway!';
                } else if (data.period === 'FIRST_HALF') {
                    msg = 'Match has started!';
                }

                if (msg) {
                    io.to(env).emit('notification:global', {
                        type: 'PERIOD_CHANGE',
                        period: data.period,
                        matchId: data.matchId,
                        message: msg
                    });
                }
            }

            matchTimes.set(cacheKey, data);
            io.to(room(`match:${data.matchId}`)).emit('match:time:updated', data);
        });

        // Match lineup update
        socket.on('match:lineup:update', (data) => {
            console.log(`[Socket.IO] Lineup update:`, data);
            io.to(room(`match:${data.matchId}`)).emit('match:lineup:updated', data);

            // Global notification for Lineup publication
            if (data.status === 'published') {
                io.to(env).emit('notification:global', {
                    type: 'LINEUP_PUBLISHED',
                    matchId: data.matchId,
                    homeTeamId: data.homeTeamId,
                    awayTeamId: data.awayTeamId,
                    homeTeam: data.homeTeam,
                    awayTeam: data.awayTeam,
                    message: `Lineups are out for ${data.homeTeam || 'Home'} vs ${data.awayTeam || 'Away'}!`
                });
            }
        });

        // Chat: Join Room
        socket.on('chat:join', ({ matchId }) => {
            socket.join(room(`chat:${matchId}`));
            console.log(`[Socket.IO] Client ${socket.id} joined chat for match ${matchId} (${env})`);
        });

        // Chat: Leave Room
        socket.on('chat:leave', ({ matchId }) => {
            socket.leave(room(`chat:${matchId}`));
            console.log(`[Socket.IO] Client ${socket.id} left chat for match ${matchId} (${env})`);
        });

        // Chat: Message
        socket.on('chat:message', (data) => {
            // data should include: matchId, userId, userName, message, timestamp
            console.log(`[Socket.IO] Chat message in match ${data.matchId}:`, data.message);
            io.to(room(`chat:${data.matchId}`)).emit('chat:message', data);
        });

        // Admin: Subscribe to Logger Updates
        socket.on('admin:subscribe', () => {
            socket.join(room('admin:loggers'));
            console.log(`[Socket.IO] Client ${socket.id} subscribed to ${room('admin:loggers')}`);
        });

        // Admin: Subscribe to Livestream Updates
        socket.on('admin:livestream:subscribe', () => {
            socket.join(room('admin:livestreams'));
            console.log(`[Socket.IO] Client ${socket.id} subscribed to ${room('admin:livestreams')}`);
        });

        // Logger: Status Update (broadcast to admin)
        socket.on('logger:status:update', (data) => {
            // data: loggerId, status, isAvailable, etc.
            io.to(room('admin:loggers')).emit('logger:updated', data);
        });

        // Poll: New Vote
        socket.on('poll:vote', (data) => {
            // data: matchId, optionId
            console.log(`[Socket.IO] New vote in match ${data.matchId}`);
            // Broadcast to update charts for everyone
            io.to(room(`match:${data.matchId}`)).emit('poll:updated', data);
        });

        // Prediction: New Submission
        socket.on('prediction:submit', (data) => {
            // data: matchId
            console.log(`[Socket.IO] New prediction in match ${data.matchId}`);
            // Broadcast to update stats for everyone
            io.to(room(`match:${data.matchId}`)).emit('prediction:updated', data);
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

    httpServer.timeout = 0;
    httpServer.keepAliveTimeout = 120000; // 2 minutes
    httpServer.headersTimeout = 121000;

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
