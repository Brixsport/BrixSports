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
```

Generate an API key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

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

1. **Viewers** connect to the WS server via Socket.IO and subscribe to matches
2. **Logger** saves events via Vercel API routes (which save to DB)
3. **Vercel API routes** call `/broadcast` on the WS server to push events to viewers
4. **Logger client** also emits events directly via Socket.IO for instant updates
