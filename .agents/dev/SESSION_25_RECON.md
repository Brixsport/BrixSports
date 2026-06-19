# Session 25 — Reconciliation Read
Date: 2026-06-19

---

## 1. BACKLOG-059 — SW suppression, double-registration, sw.js retirement

**VERDICT: RESOLVED**

Commits present:
- `4977e42` — fix(pwa): BACKLOG-059 — fix SW suppression timing, remove double-registration, retire sw.js
  Files: `src/components/pwa/PWAProvider.tsx`, `src/hooks/usePWA.ts`, `src/lib/notifications/push-service.ts`
- `d0f2733` — chore(pwa): delete retired sw.js - replaced by sw-user.js
  Files: `public/sw.js` (deleted, 151 lines removed)

Evidence that all three promised changes landed:
- `public/sw.js` does NOT exist on disk — only `sw-user.js` and `sw-admin.js`
- `usePWA.ts:13-16` — path guard blocks sw-user.js from registering on `/admin` or `/logger` paths
- `push-service.ts:40` — uses `getRegistration('/')` not `register()` — no double-registration

---

## 2. Current SW state — ground truth

**sw.js:** DOES NOT EXIST on disk. ✅

**sw-user.js:**
- Registered via `<PWAProvider swPath="/sw-user.js">` in `src/app/layout.tsx:240`
- Path guard in `usePWA.ts:13-16` — returns early (does not register) if path starts with `/admin` or `/logger`
- Covers all public pages: `/`, `/live`, `/football`, `/basketball`, `/matches/[id]`, etc.

**sw-admin.js:**
- Registered via `<PWAProvider swPath="/sw-admin.js">` in `src/app/admin/layout.tsx:49`
- Covers `/admin/*` routes only

**⚠️ CRITICAL GAP — /logger has NO service worker:**
- `src/app/logger/` has only `page.tsx` — no layout.tsx, no PWAProvider
- Root layout wraps it with sw-user.js, but usePWA.ts:13-16 explicitly blocks that registration on `/logger` paths
- Result: loggers run with zero service worker coverage
- Impact: no offline caching, no background sync, no push notifications for logger role
- The PWA_IMPLEMENTATION_GUIDE.md claim "Logger: Logger interface — already configured" is FALSE

**push-service.ts:**
- Does NOT call `register()` — uses `getRegistration('/')` at line 40 ✅ (no double-registration)
- `init()` returns `false` if no registration found — push silently fails for loggers since they have no SW

---

## 3. BACKLOG-058 — Offline event logging (IndexedDB + background sync)

**VERDICT: NOT STARTED** (library exists, unwired)

What exists:
- `src/lib/offline-queue.ts` — full IndexedDB implementation with `storeEvent`, `syncUnsyncedEvents`, `markAsSynced`
- `src/lib/offline/queue-manager.ts` — secondary queue manager also with IndexedDB

What does NOT exist:
- FootballLogger.tsx catch block at line 530: `console.error("Propagation API Error:", e)` — no IndexedDB write, no retry
- No `registration.sync.register('sync-match-events')` call anywhere in FootballLogger
- MatchLoggerUI.tsx uses an in-memory React state array (`offlineQueue` useState) with a manual "Sync" button — this is NOT the persistent IndexedDB queue; it evaporates on page reload

The offline-queue library is completely unwired from the actual logger components.

Additionally: logger has no service worker (see §2), so even if the offline queue were wired, background sync would not fire.

---

## 4. BACKLOG-044 Phase B — Match config on mount (event validation, sub rules)

**VERDICT: NOT STARTED**

FootballLogger.tsx checks:
- No import of `eventValidation.ts` or `substitution-manager.ts` (neither file found in component imports)
- No `fetch` to `/api/competitions/[id]/match-settings` or similar on mount
- No timer ceiling wired to a config value — timer is free-running
- No sub counter wired to a max-subs config — substitution count is unconstrained
- BasketballLogger.tsx has hardcoded quarter durations (8/10/12 min buttons at line 1273) — not fetched from match config

Neither eventValidation.ts nor substitution-manager.ts appear to be imported anywhere in logger components.

---

## 5. Git status

**VERDICT: CLEAN (with expected local diff)**

```
On branch dev
Your branch is up to date with 'origin/dev'.
Changes not staged for commit:
  modified:   .agents/dev/BACKLOG.md   ← session 25 audit edits, unstaged intentionally
HEAD: 0632266 chore: session 24 wrap — BUG-034/035 auth gates, basketball college teams, BACKLOG-075-092 filed
```

No uncommitted code changes. BACKLOG.md edits from this session are unstaged.

---

## PWA Guide vs Actual System — Discrepancy Register

| Claim in PWA_IMPLEMENTATION_GUIDE.md | Actual state |
|--------------------------------------|-------------|
| "Logger: Logger interface — already configured" | FALSE — no SW on /logger paths |
| "Offline Logging: IndexedDB storage for match events" | FALSE — offline-queue.ts unwired |
| "Background Sync: Automatic data synchronization for loggers" | FALSE — no SW, no sync.register() call |
| "Push notifications for loggers" | FALSE — push-service init() returns false (no SW) |
| "No data loss during temporary disconnections" | FALSE — catch block just console.errors |
| sw-admin.js described as covering logger scope | FALSE — admin layout covers /admin only |

The PWA_IMPLEMENTATION_GUIDE.md describes the intended architecture, not the implemented one. It is a design document that was written ahead of the actual wiring. Do not trust it as ground truth.
