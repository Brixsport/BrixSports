// Loaded by Vitest BEFORE any integration test file's own imports are
// evaluated (vitest.integration.config.ts's setupFiles). This ordering
// matters: src/db/index.ts calls bare `dotenv.config()` (loads .env, which
// doesn't exist in this project -- only .env.local does), so anything that
// statically imports src/db (directly, or transitively via e.g.
// src/lib/match-logger-helpers.ts) needs TURSO_CONNECTION_URL/AUTH_TOKEN
// already sitting in process.env by the time that import chain evaluates,
// or it silently connects to nothing / a local file DB instead of staging.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
