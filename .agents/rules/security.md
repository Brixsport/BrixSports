---
activation: always_on
---

# Security Rules — Enforced in All Sessions

> **ENFORCE: Violations are blocking — deny the run, fix before proceeding.**

## 1. No Hardcoded Secrets

NEVER hardcode any of the following in scripts, source files, or CLI commands:

- Database connection URLs or auth tokens
- JWT secrets
- API keys (Cloudinary, AWS, Sentry, Vercel, etc.)
- OAuth client secrets
- Email credentials
- WebSocket API keys

Always read from `process.env`. Values live in `.env.local` (local dev)
or Vercel/Railway env vars (deployed environments).

Scope: this applies to one-off scripts under `/dev/` (outside the Next.js app boundary). Application code under `src/` must never read `process.env` directly — see `CLAUDE.md` → Environment Variables (`src/lib/env.ts` only). Two different scopes, not a contradiction.

## 2. No Secrets in Git

- `.env.local` is gitignored — never remove it from `.gitignore`
- Never `console.log` or `JSON.stringify` env vars containing secrets
- If a secret is accidentally committed, rotate it immediately —
  git history is permanent

## 3. Script Pattern for DB Operations

All dev/ scripts that connect to Turso must use:

```js
import 'dotenv/config'; // loads .env.local
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
```

Never pass connection strings or tokens as inline arguments.

## 4. Auth Tokens in API Calls

When making API calls (Vercel, Turso Platform API, GitHub),
read the token from env vars or GitHub Secrets. Never inline.

---
*This file is read at session start. Violations are blocking —
deny the run and fix before proceeding.*
