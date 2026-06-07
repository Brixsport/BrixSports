# BrixSports — Staging Environment Plan
**Status:** PROPOSED — not implemented
**Filed:** 2026-06-07
**Relates to:** BACKLOG-005 Phase 1

Do not implement until Richard explicitly approves this plan.

---

## Objective

Establish a staging environment that is a complete, isolated mirror of
production — separate DB, separate WS server, separate deployment —
so that destructive or high-risk work (BACKLOG-019 post-match automation,
BUG-011 dedup audit, standings recalculation, schema migrations) can be
validated before touching the live system.

---

## Component Plan

### 1. Git Branching Strategy

```
main        ← production (Vercel prod deployment, prod DB)
dev         ← staging (Vercel staging deployment, staging DB)
feature/*   ← feature branches, always branch off dev
hotfix/*    ← branch off main, merged to both main AND dev
```

**Rules:**
- No direct commits to `main` — PRs only, merged from `dev` or `hotfix/*`
- `dev` is always deployable — do not break it
- Feature branches merge to `dev`, never directly to `main`
- Hotfixes that land on `main` must immediately be cherry-picked or merged back to `dev`

---

### 2. Vercel Project Config

Two separate Vercel projects (not preview deployments — different env vars):

| Project | Branch | URL |
|---------|--------|-----|
| `brixsports-prod` | `main` | brixsport.com |
| `brixsports-staging` | `dev` | staging.brixsport.com (or Vercel subdomain) |

**Per-project env vars in Vercel dashboard:**

Staging project overrides:
```
TURSO_CONNECTION_URL=libsql://brixsportv2-staging.turso.io   ← separate DB
TURSO_AUTH_TOKEN=<staging token>
NEXT_PUBLIC_WS_URL=https://brixsports-ws-staging.railway.app  ← separate WS
SENTRY_DSN=<staging Sentry project DSN>
NEXT_PUBLIC_SENTRY_DSN=<staging Sentry project DSN>
NODE_ENV=production                                            ← same as prod
NEXT_PUBLIC_APP_URL=https://staging.brixsport.com
NEXT_PUBLIC_BASE_URL=https://staging.brixsport.com
```

All other env vars (JWT_SECRET, VAPID keys, Cloudinary, etc.) use
separate staging values — never share secrets between prod and staging.

---

### 3. Turso Database (Staging)

Create a new Turso database for staging:
```
turso db create brixsportv2-staging
turso db tokens create brixsportv2-staging
```

Apply the current schema to it:
```
TURSO_CONNECTION_URL=<staging url> TURSO_AUTH_TOKEN=<staging token> npm run db:push
```

**Seed staging DB** with a representative subset of production data:
- 1–2 competitions
- A handful of teams and players per competition
- 2–3 matches in various states (UPCOMING, LIVE, FINISHED)
- 1 admin user, 1 logger user

Do NOT copy production data wholesale — staging should never hold real
player PII (emails, profiles) except for known test accounts.

---

### 4. Railway WebSocket Server (Staging)

Deploy a separate Railway service for the WS server:
- New Railway service, same `ws-server/` directory
- Set env vars: `PORT`, `WS_API_KEY` (different key from prod), `VERCEL_URL` pointing to staging Vercel URL
- Service name: `brixsports-ws-staging`

Both prod and staging WS services should be independently restartable
without affecting each other.

---

### 5. Environment Parity Checklist

Before any staging work is trusted, verify:

- [ ] `tsc --noEmit` exits 0 on `dev` branch
- [ ] `npm run db:push` applies cleanly to staging DB
- [ ] Admin login works on staging (JWT auth)
- [ ] Match creation → logger assignment → public livescore all function (Three Critical Flows)
- [ ] Logger can log an event; public score updates within 5 seconds
- [ ] Sentry captures a test error on staging (separate Sentry project, not prod)
- [ ] WS server reconnects after a manual Railway restart
- [ ] No prod env vars referenced in staging deployment (audit Vercel env diff)
- [ ] Staging Turso DB is confirmed as a different DB (different URL)

---

### 6. Implementation Order

1. Create `dev` branch from current `main`
2. Create staging Turso DB + apply schema
3. Create staging Railway WS service
4. Create staging Vercel project pointed at `dev` branch
5. Set all staging env vars in Vercel dashboard
6. Verify parity checklist
7. Merge all future feature work to `dev` first, promote to `main` after staging verification

---

### 7. What This Unlocks

Once staging is confirmed:
- BACKLOG-019 — post-match lifecycle automation (safe to test on staging)
- BUG-011 — playerStats dedup audit + fix (run against staging data first)
- Schema migrations (test `db:push` on staging before prod)
- Load testing (k6 scripts already written — run against staging only)

---

## Open Questions (resolve before implementation)

1. **Subdomain:** Is `staging.brixsport.com` available and DNS-manageable?
   Or use the auto-generated Vercel subdomain for now?
2. **Seed data:** Should staging use anonymised prod data or hand-crafted test fixtures?
3. **Staging WS API key:** Should this be in the same Railway team or a separate project?
4. **Sentry:** One Sentry org with two projects (prod + staging), or separate orgs?
