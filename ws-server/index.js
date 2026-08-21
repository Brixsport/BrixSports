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
const jwt = require('jsonwebtoken');

const PORT = parseInt(process.env.PORT || '3001', 10);

if (!process.env.JWT_SECRET_STAGING || !process.env.JWT_SECRET_PROD) {
    console.warn('[WS Auth] WARNING: JWT_SECRET_STAGING and/or JWT_SECRET_PROD not set — logger sockets for the affected environment(s) will connect as unauthenticated viewers, all logger-only actions rejected for real loggers.');
}

// ─── HTTP Server ────────────────────────────────────────────────
// Also provides a simple REST API so Vercel API routes can trigger broadcasts
const httpServer = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

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

    // ─── REST API: Infrastructure endpoint updates ─────────────
    // POST /infrastructure/endpoint - Broadcast endpoint status to admin clients
    if (req.method === 'POST' && req.url === '/infrastructure/endpoint') {
        handleInfrastructureEndpointUpdate(req, res);
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
                const { room, event, data, env } = JSON.parse(body);
                // BUG-074: this endpoint is the one entry point into this shared
                // Railway instance that has no browser Origin header to read env from
                // (server-to-server call from Vercel) — the caller (src/lib/socket.ts)
                // sends env explicitly instead. Same defensive default as the socket
                // connection handler below: unrecognized/missing values land in 'prod'.
                const scopedEnv = env === 'staging' ? 'staging' : 'prod';
                if (room && event) {
                    const scopedRoom = `${scopedEnv}:${room}`;
                    io.to(scopedRoom).emit(event, { ...data, timestamp: Date.now() });
                    console.log(`[Broadcast API] ${event} → ${scopedRoom}`);
                } else if (event) {
                    // Global broadcast — scoped to the caller's environment, not truly global
                    io.to(scopedEnv).emit(event, { ...data, timestamp: Date.now() });
                    console.log(`[Broadcast API] ${event} → ${scopedEnv} (global)`);
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

// BUG-074: staging and prod share this single Railway instance. Env is
// determined per-connection from the Origin header the browser sends
// automatically during the WS handshake, no client code change needed.
// Unrecognized/missing origins default to 'prod' (the harmful direction is
// staging leaking into prod, not the reverse, so an unmatched origin
// landing in prod's namespace is the safe default). Shared by the auth
// middleware below and the connection handler, so both always agree.
function getEnvFromOrigin(socket) {
    const origin = socket.handshake.headers.origin || '';
    return (origin.includes('staging.brixsports.com') || origin.includes('brixsports-staging.vercel.app'))
        ? 'staging'
        : 'prod';
}

// ─── Logger Socket Authentication ──────────────────────────────
// Viewer sockets are correctly unauthenticated (public scores) -- this only
// tags whether a connection is a genuine logged-in logger. Per-match
// assignment authorization already happens at the REST layer
// (POST /api/matches/[id]/events checks matchLoggerAssignments) -- this
// middleware answers a narrower question: is the thing emitting event:log/
// match:time:update/etc. a real logger at all, not an arbitrary WS client.
// No token -> anonymous viewer, allowed through. Invalid/expired token ->
// same, degrades to viewer rather than rejecting the connection outright,
// so a logger whose token expires mid-match doesn't get their whole tab
// disconnected -- they just lose logger privileges until they refresh.
//
// Staging and prod sign logger JWTs with DIFFERENT secrets (CLAUDE.md:
// "JWT_SECRET and CRON_SECRET are different per environment") -- but this
// is one shared Railway instance serving both. A single hardcoded secret
// here could only ever verify one environment's tokens; the other
// environment's real loggers would silently fail this check. Select the
// right secret using the same Origin-based env detection BUG-074 already
// established, rather than trying to guess or accepting either blindly.
const JWT_SECRETS = {
    staging: process.env.JWT_SECRET_STAGING,
    prod: process.env.JWT_SECRET_PROD,
};

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        socket.data.isLogger = false;
        return next();
    }
    const env = getEnvFromOrigin(socket);
    const secret = JWT_SECRETS[env];
    if (!secret) {
        console.warn(`[WS Auth] No JWT secret configured for env=${env} (JWT_SECRET_${env.toUpperCase()} unset) -- treating connection as unauthenticated`);
        socket.data.isLogger = false;
        return next();
    }
    try {
        const payload = jwt.verify(token, secret);
        socket.data.isLogger = payload.role === 'logger' || payload.role === 'admin';
        socket.data.isAdmin = payload.role === 'admin';
        socket.data.loggerId = payload.id;
    } catch (err) {
        console.warn(`[WS Auth] Rejected token at handshake (${socket.id}, env=${env}): ${err.message}`);
        socket.data.isLogger = false;
    }
    next();
});

// ─── In-Memory State ───────────────────────────────────────────
const matchTimes = new Map();

// ─── Single-Writer Enforcement (clock authority) ────────────────
// Only one logger's match:time:update per match gets relayed to viewers,
// to stop two loggers' independently-ticking clocks from flickering
// against each other (SYSTEM_CRITICALITY_MAP.md §5 /
// LIVE_CLOCK_V2_ARCHITECTURE.md §5). Two layers:
// (1) is this socket a logger genuinely ASSIGNED to THIS match, not just
//     any authenticated logger (BUG-120's JWT check proved "real logger,"
//     not "assigned to this match") -- checked once per (socket, matchId)
//     pair via the internal Vercel endpoint, cached, not a per-emit DB hit.
// (2) among assigned loggers, whoever's match:time:update arrives first
//     for a match becomes that match's clock authority for as long as
//     they stay connected -- a session-based tie-break, not an
//     admin-designated "primary" role (see BACKSCOPE.md for why the
//     admin-UI version wasn't built: the schema's role='primary' field
//     exists but nothing ever assigns anything else, so every assignment
//     already looks the same today -- fixing that was a separate,
//     bigger feature, not needed for this specific flicker problem).
const clockAuthority = new Map(); // matchId -> socketId
const assignmentCache = new Map(); // `${socketId}:${matchId}` -> boolean

const APP_URLS = {
    staging: 'https://brixsports-staging.vercel.app',
    prod: 'https://brixsports.com',
};

async function isAssignedLogger(socket, matchId) {
    const cacheKey = `${socket.id}:${matchId}`;
    if (assignmentCache.has(cacheKey)) return assignmentCache.get(cacheKey);

    const env = getEnvFromOrigin(socket);
    const appUrl = APP_URLS[env];
    try {
        const res = await fetch(
            `${appUrl}/api/internal/logger-assignment-check?matchId=${encodeURIComponent(matchId)}&loggerId=${encodeURIComponent(socket.data.loggerId)}`,
            { headers: { 'x-api-key': process.env.WS_API_KEY } }
        );
        const data = await res.json();
        assignmentCache.set(cacheKey, !!data.assigned);
        return !!data.assigned;
    } catch (err) {
        console.warn(`[Single-Writer] Assignment check failed for logger ${socket.data.loggerId} on match ${matchId}: ${err.message}`);
        assignmentCache.set(cacheKey, false);
        return false;
    }
}

// ─── Socket.IO Event Handlers ──────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[WS] Connected: ${socket.id}`);

    // BUG-074: staging and prod share this single Railway instance — a staging test
    // match with a colliding ID would otherwise broadcast straight to prod viewers.
    // getEnvFromOrigin() defined above, shared with the auth middleware so both
    // always agree on which environment a given connection belongs to.
    const env = getEnvFromOrigin(socket);
    const room = (name) => `${env}:${name}`;
    socket.join(env);

    // Gate for logger-only actions (event mutation/broadcast triggers) --
    // does not apply to read-only subscribe actions, which stay open to
    // any viewer. See the io.use() middleware above for how isLogger is set.
    const requireLogger = (handler) => (data) => {
        if (!socket.data.isLogger) {
            socket.emit('error', { message: 'Unauthorized: logger authentication required', type: 'auth:required' });
            return;
        }
        return handler(data);
    };

    // BUG-235: admin:subscribe/admin:livestream:subscribe/admin:infrastructure:subscribe
    // had NO role check at all -- any anonymous viewer socket (viewers connect with no
    // token, by design) could join these rooms and receive logger:updated broadcasts
    // (which include loggerId, a field CLAUDE.md explicitly bans from any public
    // response) and real server uptime/connection-count telemetry. requireLogger()
    // above isn't strict enough here since these are admin-only channels, not
    // logger-only ones.
    const requireAdmin = (handler) => (data) => {
        if (!socket.data.isAdmin) {
            socket.emit('error', { message: 'Unauthorized: admin authentication required', type: 'auth:required' });
            return;
        }
        return handler(data);
    };

    // ── Match Subscription ──────────────────────────────────────
    socket.on('match:subscribe', ({ matchId }) => {
        socket.join(room(`match:${matchId}`));
        console.log(`[WS] ${socket.id} → ${room(`match:${matchId}`)}`);
        socket.emit('match:subscribed', { matchId });

        // Send cached time if available
        const cacheKey = room(matchId);
        if (matchTimes.has(cacheKey)) {
            socket.emit('match:time:updated', matchTimes.get(cacheKey));
        }

        // Broadcast viewer count
        const roomSize = io.sockets.adapter.rooms.get(room(`match:${matchId}`))?.size || 0;
        io.to(room(`match:${matchId}`)).emit('match:viewers', { matchId, count: roomSize });
    });

    socket.on('match:unsubscribe', ({ matchId }) => {
        socket.leave(room(`match:${matchId}`));
        socket.emit('match:unsubscribed', { matchId });

        const roomSize = io.sockets.adapter.rooms.get(room(`match:${matchId}`))?.size || 0;
        io.to(room(`match:${matchId}`)).emit('match:viewers', { matchId, count: roomSize });
    });

    // ── Event Logging (from Logger client) ──────────────────────
    // Found session 50 (BUG-210 investigation): this handler used to ALSO
    // broadcast 'event:new' to the match room and (for goals) 'notification:global'
    // -- both now genuinely duplicate what already happens server-side: 'event:new'
    // via events/route.ts's after(broadcastMatchEvent(...)) (the BUG-108/116 fix),
    // and 'notification:global' via the same route's after() now also calling
    // broadcastGlobalNotification() (BUG-210's fix). Left in place, every real
    // football event with an active WS connection would have double-rendered in
    // viewers' live feeds and double-toasted for goals -- same double-send class
    // as BUG-205, just at the WS layer instead of push. This handler is now purely
    // an ack back to the sending logger; the server-side REST-triggered broadcasts
    // are the single source of truth for what viewers actually see.
    socket.on('event:log', requireLogger((data) => {
        try {
            console.log(`[WS] Event logged (ack only, broadcast is server-side): ${data.type} in match ${data.matchId}`);
            socket.emit('event:logged', {
                success: true,
                eventId: data.id || `evt_${Date.now()}`,
            });
        } catch (error) {
            console.error('[WS] Error logging event:', error);
            socket.emit('error', { message: error.message, type: 'event:log:error' });
        }
    }));

    // ── Event Deletion ──────────────────────────────────────────
    socket.on('event:delete', requireLogger((data) => {
        console.log(`[WS] Event deleted: ${data.eventId} in match ${data.matchId}`);
        io.to(room(`match:${data.matchId}`)).emit('event:deleted', {
            matchId: data.matchId,
            eventId: data.eventId,
        });
    }));

    // ── Score Updates ───────────────────────────────────────────
    socket.on('match:score:update', requireLogger((data) => {
        console.log(`[WS] Score: ${data.homeScore}-${data.awayScore} in ${data.matchId}`);
        io.to(room(`match:${data.matchId}`)).emit('match:score:updated', data);
    }));

    // ── Player Rating Updates ───────────────────────────────────
    socket.on('rating:update', requireLogger((data) => {
        io.to(room(`match:${data.matchId}`)).emit('rating:updated', data);
    }));

    // ── Team Stats Updates ──────────────────────────────────────
    socket.on('stats:update', requireLogger((data) => {
        io.to(room(`match:${data.matchId}`)).emit('stats:updated', data);
    }));

    // ── Eye Point ───────────────────────────────────────────────
    socket.on('eyepoint:award', requireLogger((data) => {
        io.to(room(`match:${data.matchId}`)).emit('eyepoint:awarded', data);
    }));

    // ── Substitution ────────────────────────────────────────────
    socket.on('substitution:log', requireLogger((data) => {
        io.to(room(`match:${data.matchId}`)).emit('substitution:logged', data);
    }));

    // ── Match Status ────────────────────────────────────────────
    socket.on('match:status:change', requireLogger((data) => {
        console.log(`[WS] Status: ${data.status} for ${data.matchId}`);
        io.to(room(`match:${data.matchId}`)).emit('match:status:changed', data);
    }));

    // ── Match Time ──────────────────────────────────────────────
    // Single-writer enforcement lives only here -- it's specifically the
    // clock-flicker problem, not a general logger-mutation gate. event:log
    // and everything else stay as requireLogger() alone (BUG-120).
    socket.on('match:time:update', requireLogger(async (data) => {
        const { matchId } = data;

        const assigned = await isAssignedLogger(socket, matchId);
        if (!assigned) {
            socket.emit('error', { message: 'Not assigned to this match', type: 'clock:not-assigned' });
            return;
        }

        const currentAuthority = clockAuthority.get(matchId);
        if (!currentAuthority) {
            clockAuthority.set(matchId, socket.id);
        } else if (currentAuthority !== socket.id) {
            // Another logger already claimed this match's clock this session --
            // drop the emit, one-time notice back to the sender so they're not
            // left guessing why their clock isn't propagating (per the design
            // doc's own suggestion).
            socket.emit('clock:authority:denied', {
                matchId,
                message: "Another session is currently controlling this match's clock",
            });
            return;
        }

        matchTimes.set(room(matchId), data);
        io.to(room(`match:${matchId}`)).emit('match:time:updated', data);
    }));

    // ── Lineup Updates ──────────────────────────────────────────
    socket.on('match:lineup:update', requireLogger((data) => {
        console.log(`[WS] Lineup update for ${data.matchId}`);
        io.to(room(`match:${data.matchId}`)).emit('match:lineup:updated', data);
    }));

    // ── Match General Update ────────────────────────────────────
    socket.on('match:update', requireLogger((data) => {
        io.to(room(`match:${data.matchId}`)).emit('match:updated', data);
    }));

    // ── Live Chat ───────────────────────────────────────────────
    socket.on('chat:join', ({ matchId }) => {
        socket.join(room(`chat:${matchId}`));
    });

    socket.on('chat:leave', ({ matchId }) => {
        socket.leave(room(`chat:${matchId}`));
    });

    socket.on('chat:message', (data) => {
        io.to(room(`chat:${data.matchId}`)).emit('chat:message', data);
    });

    // ── Competition / Standings ─────────────────────────────────
    socket.on('join-competition', (competitionId) => {
        socket.join(room(`competition:${competitionId}`));
        console.log(`[WS] ${socket.id} → ${room(`competition:${competitionId}`)}`);
    });

    socket.on('leave-competition', (competitionId) => {
        socket.leave(room(`competition:${competitionId}`));
    });

    // ── Admin Channels ──────────────────────────────────────────
    socket.on('admin:subscribe', requireAdmin(() => {
        socket.join(room('admin:loggers'));
    }));

    socket.on('admin:livestream:subscribe', requireAdmin(() => {
        socket.join(room('admin:livestreams'));
    }));

    // ── Infrastructure Monitoring ───────────────────────────────
    // Deliberately NOT env-scoped (BUG-074's room() helper is not applied here):
    // this reports the health of the single physical Railway process itself
    // (uptime, memory, io.engine.clientsCount), which is already shared across
    // staging and prod by construction — scoping the room wouldn't scope the
    // underlying data, since clientsCount counts every connected socket regardless.
    socket.on('admin:infrastructure:subscribe', requireAdmin(() => {
        socket.join('admin:infrastructure');
        console.log(`[WS] ${socket.id} subscribed to infrastructure updates`);

        // Send current system status immediately
        socket.emit('infrastructure:update', {
            status: 'operational',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            connections: io.engine?.clientsCount || 0,
        });
    }));

    socket.on('admin:infrastructure:unsubscribe', () => {
        socket.leave('admin:infrastructure');
        console.log(`[WS] ${socket.id} unsubscribed from infrastructure updates`);
    });

    socket.on('logger:status:update', requireLogger((data) => {
        io.to(room('admin:loggers')).emit('logger:updated', data);
    }));

    // ── Multi-Logger Real-time Sync ─────────────────────────────
    // Tracks which loggers are active in each match room
    socket.on('logger:join', requireLogger(({ matchId, loggerId, loggerName }) => {
        const loggerRoom = room(`logger:${matchId}`);
        socket.join(loggerRoom);
        // Store logger info on the socket for disconnect handling
        socket.data.loggerInfo = { matchId, loggerId, loggerName };

        console.log(`[WS] Logger ${loggerName} (${loggerId}) joined match ${matchId}`);

        // Notify others in the room
        socket.to(loggerRoom).emit('logger-joined', { loggerId, loggerName });

        // Send back the list of active loggers in this room
        const roomSockets = io.sockets.adapter.rooms.get(loggerRoom);
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
    }));

    socket.on('logger:leave', requireLogger(({ matchId, loggerId }) => {
        const loggerRoom = room(`logger:${matchId}`);
        socket.leave(loggerRoom);
        console.log(`[WS] Logger ${loggerId} left match ${matchId}`);
        socket.to(loggerRoom).emit('logger-left', { loggerId });
        socket.data.loggerInfo = null;
    }));

    socket.on('logger:broadcast-event', requireLogger(({ matchId, event }) => {
        const loggerRoom = room(`logger:${matchId}`);
        // Broadcast to all other loggers in this match room (not the sender)
        socket.to(loggerRoom).emit('logger:event', event);
    }));

    // ── Polls & Predictions ─────────────────────────────────────
    socket.on('poll:vote', (data) => {
        io.to(room(`match:${data.matchId}`)).emit('poll:updated', data);
    });

    socket.on('prediction:submit', (data) => {
        io.to(room(`match:${data.matchId}`)).emit('prediction:updated', data);
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
            socket.to(room(`logger:${matchId}`)).emit('logger-left', { loggerId });
            console.log(`[WS] Logger ${loggerId} disconnected from match ${matchId}`);
        }

        // Single-writer: release clock authority for any match this socket
        // held, so the next logger to emit match:time:update becomes the
        // new authority instead of that match's clock staying stuck silent.
        for (const [matchId, authoritySocketId] of clockAuthority.entries()) {
            if (authoritySocketId === socket.id) {
                clockAuthority.delete(matchId);
                console.log(`[Single-Writer] Released clock authority for match ${matchId} (${socket.id} disconnected)`);
            }
        }
        for (const key of assignmentCache.keys()) {
            if (key.startsWith(`${socket.id}:`)) assignmentCache.delete(key);
        }
    });

    socket.on('error', (error) => {
        console.error(`[WS] Error ${socket.id}:`, error);
    });
});

// ─── Infrastructure Monitoring ────────────────────────────────
// Periodic health broadcasts to admin:infrastructure room
const INFRASTRUCTURE_INTERVAL = 30000; // 30 seconds

function broadcastInfrastructureUpdate() {
    const update = {
        status: 'operational',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connections: io.engine?.clientsCount || 0,
        memory: process.memoryUsage(),
    };
    
    io.to('admin:infrastructure').emit('infrastructure:update', update);
}

// Start periodic broadcasts
const infrastructureInterval = setInterval(broadcastInfrastructureUpdate, INFRASTRUCTURE_INTERVAL);

// ─── Match Reminder Trigger ───────────────────────────────────
// /api/reminders/check (30/15-minute-before-kickoff push) has always existed
// on the Vercel app but had no scheduler invoking it -- vercel.json has no
// crons block, and Vercel Cron on non-Pro plans is capped at once-daily
// anyway, too coarse for a "starting in 15 minutes" check. This already-
// always-on Railway process can run a real interval with no such limit, the
// same way it already does for broadcastInfrastructureUpdate above. Same
// staging/prod split this file already uses everywhere else (BUG-074) --
// CRON_SECRET is per-environment (CLAUDE.md), so both must be called
// separately with their own secret, not one shared value.
const REMINDER_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes -- frequent enough to catch a 15-min-before window without excessive load
const CRON_SECRETS = {
    staging: process.env.CRON_SECRET_STAGING,
    prod: process.env.CRON_SECRET_PROD,
};

async function checkMatchReminders(env) {
    const secret = CRON_SECRETS[env];
    if (!secret) {
        console.warn(`[Reminders] CRON_SECRET_${env.toUpperCase()} not set -- skipping ${env} reminder check`);
        return;
    }
    try {
        const res = await fetch(`${APP_URLS[env]}/api/reminders/check`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${secret}` },
        });
        const data = await res.json();
        if (data.sent > 0) {
            console.log(`[Reminders] ${env}: sent ${data.sent}/${data.processed} reminders`);
        }
    } catch (err) {
        console.warn(`[Reminders] ${env} check failed: ${err.message}`);
    }
}

function checkAllMatchReminders() {
    checkMatchReminders('staging');
    checkMatchReminders('prod');
}

const reminderInterval = setInterval(checkAllMatchReminders, REMINDER_CHECK_INTERVAL);

// ─── Start Server ───────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`\n🚀 BrixSports WebSocket Server`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Socket.IO path: /api/socket`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Infrastructure API: POST http://localhost:${PORT}/infrastructure/endpoint`);
    console.log(`   Broadcast API: POST http://localhost:${PORT}/broadcast`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}\n`);
});

// ─── Graceful Shutdown ──────────────────────────────────────────
const shutdown = (signal) => {
    console.log(`\n[WS] ${signal} received, shutting down...`);
    clearInterval(infrastructureInterval);
    clearInterval(reminderInterval);
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

// ─── HTTP API: Infrastructure Endpoint Updates ────────────────
// This allows Vercel API routes to broadcast endpoint status changes
// POST /infrastructure/endpoint - Broadcast endpoint update to admin clients
function handleInfrastructureEndpointUpdate(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

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
            const { path, status, responseTime, error } = JSON.parse(body);
            
            if (!path || !status) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields: path, status' }));
                return;
            }

            // Broadcast to all admin:infrastructure subscribers
            io.to('admin:infrastructure').emit('infrastructure:endpoint', {
                path,
                status,
                responseTime: responseTime || 0,
                error: error || null,
                timestamp: Date.now(),
            });

            console.log(`[Infrastructure API] Endpoint update: ${path} → ${status}`);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, broadcast: true }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
    });
}

// Add to HTTP server route handling (requires modifying the http.createServer callback)
// This is handled by adding a check at the top of the existing request handler
