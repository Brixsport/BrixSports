# BrixSports WebSocket Server

Standalone Socket.IO server for real-time features. Deployed separately from the main Next.js app (which runs on Vercel).

## Architecture

```
┌────────────────────┐       ┌──────────────────────┐
│   Vercel (Next.js) │       │   Railway (WS Server) │
│   brixsports.com   │       │   ws.brixsports.com   │
│                    │       │                      │
│  API Routes ───────────────▶ POST /broadcast       │
│  (save to DB +     │ HTTP  │ (triggers Socket.IO   │
│   trigger broadcast)│       │  emit to clients)    │
│                    │       │                      │
└────────────────────┘       └──────────┬───────────┘
                                        │ WebSocket
                              ┌─────────┴─────────┐
                              │    Browser Clients  │
                              │  (Socket.IO client) │
                              └─────────────────────┘
```

## Deploy to Railway (5 minutes)

### 1. Push to GitHub
Make sure the `ws-server/` folder is committed and pushed.

### 2. Create Railway Project
1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repo (the same one Vercel uses)
4. **Important:** Go to **Settings** → **Root Directory** → set to `ws-server`

### 3. Set Environment Variables in Railway
In your Railway service → Variables tab:

```
WS_API_KEY=<generate-a-random-key>
NEXT_PUBLIC_APP_URL=https://brixsports.com
JWT_SECRET_STAGING=<copy from the staging Vercel project's JWT_SECRET>
JWT_SECRET_PROD=<copy from the prod Vercel project's JWT_SECRET>
```

Generate an API key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Important — this one Railway instance serves both staging and prod**  but each environment's Vercel project signs logger JWTs with its own, different `JWT_SECRET`. Both `JWT_SECRET_STAGING` and `JWT_SECRET_PROD` must be set here — copy each one exactly from its own Vercel project's Environment Variables page, not from a local `.env` file. If either is missing or doesn't match, logger-only actions (`event:log`, `match:time:update`, `match:status:change`, etc.) will be silently rejected for real loggers on that environment — the socket still connects, they just lose logger privileges. See `.env.example` for the full list of vars this service reads.

### 4. Deploy
Railway auto-deploys when you push. It will:
- Detect `package.json` in `ws-server/`
- Run `npm install`
- Run `npm start` (which runs `node index.js`)

### 5. Get Your Railway URL
After deployment, Railway gives you a URL like:
`https://brix-ws-server-production-xxxx.up.railway.app`

### 6. Custom Domain (Optional)
In Railway → Settings → Domains → Add custom domain:
`ws.brixsports.com`

Then add a CNAME record in Hostinger DNS pointing `ws` to your Railway URL.

### 7. Configure Vercel
Go to your **Vercel project** → Settings → Environment Variables. Add:

```
NEXT_PUBLIC_WS_URL=https://brix-ws-server-production-xxxx.up.railway.app
WS_API_KEY=<same-key-from-step-3>
WS_SERVER_URL=https://brix-ws-server-production-xxxx.up.railway.app
```

(If using custom domain: `NEXT_PUBLIC_WS_URL=https://ws.brixsports.com`)

### 8. Redeploy Vercel
Trigger a redeploy in Vercel so it picks up the new env vars.

## Test Locally

```bash
cd ws-server
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

Server starts on `http://localhost:3001`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Server status + connection count |
| GET | `/health` | Health check for Railway |
| POST | `/broadcast` | Trigger a broadcast (requires `x-api-key` header) |

## How It Works

1. **Viewers** connect to the WS server via Socket.IO and subscribe to matches — no authentication required, scores are public
2. **Logger** saves events via Vercel API routes (which save to DB) and separately connects to this WS server with their logger JWT attached (`auth: { token }` on the Socket.IO client) for instant updates
3. **Vercel API routes** call `/broadcast` on the WS server (`x-api-key` header) to push events to viewers after a confirmed DB write
4. **Logger client** also emits events directly via Socket.IO — these are gated: a connection socket-authenticated as a real logger (valid JWT verified against the connecting environment's `JWT_SECRET_STAGING`/`JWT_SECRET_PROD`) can emit `event:log`/`match:time:update`/etc.; any other connection gets an `error` event and the emit is dropped. Per-match assignment authorization (is *this* logger actually assigned to *this* match) still happens only at the REST layer — this WS-level check answers a narrower question: is the thing emitting these events a genuine logged-in logger at all, not an arbitrary WebSocket client

## Environment Variables

See `.env.example` for the full list. Two things worth knowing before touching this file:
- This is **one shared instance serving both staging and prod** (`BUG-074`) — every env var that needs to differ by environment (`JWT_SECRET_STAGING`/`JWT_SECRET_PROD`) is doubled up rather than a single var, and every Socket.IO room is prefixed `staging:`/`prod:` based on the connecting browser's Origin header (see `getEnvFromOrigin()` in `index.js`).
- `NEXT_PUBLIC_ENV` (used elsewhere in the app to detect staging vs prod) **cannot be trusted here or anywhere env-detection matters** — staging deliberately keeps that value off `'staging'` to bypass `middleware.ts`'s staging-wide JWT gate. This file uses Origin-header matching instead, precisely to avoid that trap.
