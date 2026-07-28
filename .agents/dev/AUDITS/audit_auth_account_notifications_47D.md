# Audit — Auth / Account / Notification-Delivery Cross-Cutting Layer

**Session:** 47D (continuation) &nbsp;|&nbsp; **Date:** 2026-07-28 &nbsp;|&nbsp; **Scope:** account-lifecycle and notification-delivery FEATURES built on top of `src/lib/auth.ts` / `middleware.ts` / `admin/layout.tsx` (mechanics already verified sound earlier tonight — not re-checked here).

**Method:** static code read only, no live/DB testing. Every verdict below is code-confirmed, not live-tested — treat as SHIPPED-level evidence at best, not RESOLVED-level.

**Out of scope per brief:** BUG-147 (auth-gate fixes in progress on ~16 routes, including `src/app/api/users/[id]/route.ts` and `src/app/api/notifications/send/route.ts`) — not re-flagged here even where their current state was visible during this read. BUG-086/087/088/089 — confirmed still open by a prior sweep tonight, not re-diagnosed. BACKLOG-140 (separate `loggers` table architecture question) — not re-litigated, only mapped.

---

## 1. Signup flow (email/password, Google OAuth)

**Files:** `src/app/signup/page.tsx`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/google/route.ts`, `src/app/api/auth/[...nextauth]/route.ts`

**Email/password path — WORKS.** `register/route.ts` validates email format, password length ≥6, checks for existing user (case-insensitive), hashes with bcrypt (cost 10), inserts, fires a non-blocking welcome email, generates a JWT via `generateToken()`, and sets both a response-body `token` and an `httpOnly` `authToken` cookie (7-day, `secure` when HTTPS, `sameSite: lax`). Client (`signup/page.tsx`) stores the token in `localStorage` under `authToken` and `user`, then opens `OnboardingModal`. End-to-end this is sound.

**Google OAuth path — BROKEN, not merely unverified.** Two independent, uncoordinated Google OAuth implementations exist in this codebase:
- `src/app/api/auth/google/route.ts` — a hand-rolled redirect-only handler. It builds a Google consent URL with `redirect_uri = {origin}/api/auth/google/callback` and redirects. **No route file exists at `src/app/api/auth/google/callback`** (confirmed via directory listing — only `route.ts` exists under `src/app/api/auth/google/`). Any user who clicks "Continue with Google" on `/signup` or `/login` (both wired to `window.location.href = '/api/auth/google'` — `signup/page.tsx:75`, `login/page.tsx:52`) will be sent to Google, consent, and then hit a 404 on return. This flow cannot complete.
- `src/app/api/auth/[...nextauth]/route.ts` — a fully separate, working NextAuth.js config (`GoogleProvider`, upserts into `users` table on `signIn`, `NEXTAUTH_SECRET`-signed session). This is the flow the project's own docs (`GOOGLE_OAUTH_SETUP.md`, `GOOGLE_SIGNIN_VERCEL_FIX.md`, and BACKLOG-025's redirect URI `https://staging.brixsports.com/api/auth/callback/google`) assume is live — but **no UI anywhere calls `signIn('google')` or links to NextAuth's own routes.** It is present in the codebase and would technically function if invoked, but nothing invokes it, and even if it were invoked, NextAuth issues its own session cookie (`next-auth.session-token`, keyed to `NEXTAUTH_SECRET`) — **not** the app's `authToken` cookie. `AuthContext.checkAuth()` and every API route's `getAuthUser()` only recognize `authToken`. A user who did sign in via this path would not be recognized as logged in anywhere else in the app.

**Net effect:** Google sign-in is fully non-functional today, and even a hypothetical fix to the callback-route gap would still not integrate with the rest of the app's session model without further work. This directly contradicts the assumption in this session's brief ("tonight's privacy-policy fix confirmed a live Google OAuth flow exists") — the route *file* exists and is reachable, but the flow it starts cannot complete.

**Verdict: BROKEN.** No existing BACKLOG entry found for this specific defect (BACKLOG-025 assumes the NextAuth path is the operative one and only addresses redirect-URI whitelisting for staging — it does not know about the dead custom-flow callback or the two-systems divergence). **This is new** and worth its own BUG entry; not filed here (read-only audit).

---

## 2. Login flow, session establishment, cookie/localStorage token handling

**Files:** `src/app/login/page.tsx`, `src/app/api/auth/login/route.ts`, `src/contexts/AuthContext.tsx`

**Verdict: WORKS**, with a structural fragility worth flagging.

`login/route.ts` looks up by case-insensitive email, distinguishes "user not found" / "OAuth-only account, no password" / "wrong password" with distinct error codes, verifies via bcrypt, issues JWT + `authToken` cookie identical in shape to register. `AuthContext.checkAuth()` tries the cookie first (`credentials: 'include'` on `/api/auth/me`), falls back to a `Bearer` header built from `localStorage.authToken` if the cookie attempt 401s. Auto-refresh runs every 15 minutes via `/api/auth/refresh` while a user is set.

**Fragility:** the app has at least three independent, divergent implementations of "am I logged in":
1. `AuthContext.tsx` (`useAuth` from `@/contexts/AuthContext`) — the intended single source of truth, cookie-first with localStorage fallback.
2. `src/hooks/useAuth.ts` — a **second, separate** `useAuth()` hook (not re-exporting the context one) that only checks the cookie (`fetch('/api/auth/me')`, no `credentials` option set explicitly, no localStorage fallback) and has no `login`/`register`/`logout` methods. `src/app/profile/settings/page.tsx` imports from `@/hooks/useAuth`, not `@/contexts/AuthContext`.
3. `src/app/profile/page.tsx` bypasses both hooks entirely — its own `useEffect` reads `localStorage.getItem('authToken')` directly and manually calls `/api/auth/me` with a `Bearer` header, with no cookie fallback at all.

Two hooks sharing the name `useAuth` resolved via different import paths is a maintenance hazard on its own (easy to import the wrong one and silently lose `login`/`logout`/`register`). No BACKLOG entry found for this specific duplication — **new finding**.

**Confirmed bug, `src/app/profile/page.tsx:226`:** on failed auth fetch, the catch block runs `localStorage.removeItem('token')` — but the key used everywhere else in the app is `'authToken'`, never `'token'`. This line is dead code; an invalid/expired token left in `localStorage.authToken` is never cleared on this page's failure path, so a stale token can persist indefinitely. Small but real — **new finding**, not in BACKLOG.

---

## 3. Password reset / forgot-password flow

**Files:** `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/api/auth/forgot-password/route.ts`

**Verdict: WORKS.** `POST` generates a 32-byte hex token, stores it with a 1-hour expiry in `passwordResetTokens`, sends via `sendPasswordResetEmail` (failure is logged but does not fail the request — avoids email-enumeration leakage), and always returns a generic success message regardless of whether the account exists (correct anti-enumeration practice). Debug fields (`resetToken`, `resetLink`) are only included when `NODE_ENV === 'development'`. `GET` verifies token validity/expiry for the reset-password page's initial check (though the reset-password page itself doesn't actually call `GET` first — it just tries `PATCH` directly and handles the invalid-token error there, so the `GET` verifier appears unused by the current UI, which is harmless but means `GET` is dead code from the client's perspective). `PATCH` re-validates token+expiry, re-checks password length, hashes with bcrypt, updates, and deletes the used token (single-use, correctly enforced).

No BACKLOG entry found for this flow — matches expectation, not previously flagged, and this read found nothing wrong.

---

## 4. Profile view/edit

**Files:** `src/app/profile/page.tsx`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/[id]/preferences/route.ts`

**Verdict: PARTIALLY WORKS**, with one gap outside BUG-147's named scope.

Avatar/cover/bio/favorite-team edits all PATCH `/api/users/[id]` with a `Bearer` token from `localStorage`. `PATCH` and `DELETE` on `/api/users/[id]/route.ts` both call `getAuthUser` + ownership/admin check (`authUser.id !== userId && authUser.role !== 'admin'`) — sound, and per the brief this route is already in BUG-147's active fix set so not re-flagged further. **`GET` on the same file has no auth check at all** — any caller who knows a `userId` can fetch that user's full profile (email, bio, avatar, coverImage, preferences, stats) unauthenticated. This wasn't named as one of the specific verbs under BUG-147 in the brief (only the route file was named); flagging in case the in-progress fix is scoped to PATCH/DELETE only and doesn't cover GET.

**New finding, not covered by BUG-147 as briefed:** `src/app/api/users/[id]/preferences/route.ts` has **zero auth checks on GET, PATCH, or DELETE** — no `getAuthUser` import at all in the file. Any request bearing a valid `userId` can read, overwrite, or reset another user's preferences (theme, notification toggles, `profileVisibility`, etc.) with no authentication whatsoever. This is a distinct route file from the one named in the brief (`/api/users/[id]/route.ts`) and was not called out as in-progress — worth a dedicated BUG entry.

Avatar/cover images are stored as base64 data URIs directly in the `users` row (`handleAvatarChange`/`handleCoverChange` in `profile/page.tsx` use `FileReader.readAsDataURL` then PATCH the raw base64 string) rather than uploaded to Cloudinary despite Cloudinary being a documented key library in CLAUDE.md's stack — functionally works but bypasses the intended image pipeline, and will bloat the `users` table row size over time. Not in BACKLOG — noting as a design smell, not filing.

---

## 5. Logger login (separate identity system)

**Files:** `src/app/api/loggers/auth/route.ts`, `src/app/api/loggers/me/route.ts`, `src/app/api/auth/refresh/route.ts`

**Verdict: WORKS**, and the 120-minute session requirement (CLAUDE.md, PWA rules) is comfortably met.

`loggers/auth/route.ts` authenticates by email-or-name against `loggers` table, bcrypt-verifies, has a simple in-memory per-IP rate limit (5 attempts / 15 min, explicitly documented as resetting on cold start — "acceptable for MVP," references BUG-053), signs a JWT with `{ id, email, role }` (deliberately `id` not `userId` — logger tokens have a different shape than user tokens), sets `expiresIn: '7d'`, and — notably — also sets the shared `authToken` cookie so `getAuthUser()` recognizes logger requests on the same protected routes as regular users. 7 days vastly exceeds the 120-minute requirement.

`src/app/api/auth/refresh/route.ts` (shared refresh endpoint, no separate `/api/loggers/refresh` exists — there is only the one refresh route) correctly branches on `payload.role === 'logger'` vs. default, normalizing the `userId ?? id` field mismatch between the two token shapes (comment at line 38 explicitly documents this), looks up the right table, and re-signs with the correct shape (`{ id, ... }` for loggers, `{ userId, ... }` for users). This is a clean, deliberate handling of the two-identity-system split described in BACKLOG-140 — confirms BACKLOG-140's architecture concern is real (two identity tables) but shows the refresh endpoint itself is not naively broken by it.

`loggers/me/route.ts` requires `authUser.role === 'logger'` explicitly (not just presence of a token), strips `password` before returning, and includes computed stats (event count, assignment count) with `.limit()`-bounded or count-aggregate queries — no unbounded scan.

No BACKLOG entry contradicts this; matches BACKLOG-140's framing (architecture concern, not a functional break) — not re-investigating the "should this be unified with `users`" question per the brief.

---

## 6. Push notification opt-in (enrollment paths)

**Files:** `src/components/SettingsOverlay.tsx`, `src/components/OnboardingModal.tsx`, `src/components/NotificationPermission.tsx`, `src/components/notifications/NotificationPrompt.tsx`, `src/hooks/useNotificationPrompt.ts`

**Verdict: PARTIALLY WORKS — BUG-084's retraction needs a correction.** BUG-084 (BACKLOG.md line ~318) was retracted 2026-07-01 on the claim that three enrollment paths are active:

1. **`SettingsOverlay.tsx`** — confirmed live. Rendered from the app (imported by `src/app/signup/page.tsx` is NOT where it's used — it's mounted via `src/app/page.tsx`, confirmed by grep). Calls `pushService.requestPermission()` → `pushService.subscribe(user.id)` on an explicit "Enable" button. **WORKS.**
2. **`OnboardingModal.tsx`** — confirmed live, mounted from `src/app/signup/page.tsx` immediately after successful registration (step 4 of onboarding is a dedicated "Get Match Alerts" push-enrollment screen). **WORKS.**
3. **`NotificationPermission.tsx`** (the auto-show banner component named in BUG-084's retraction) and its sibling `src/components/notifications/NotificationPrompt.tsx` + `src/hooks/useNotificationPrompt.ts` — **none of these three files are imported anywhere in the codebase outside of their own definitions** (verified via a repo-wide grep for each symbol name; only self-references found, no consumer). The banner/prompt logic is fully written — dismissal cooldown, permission-state branching, server-subscription-status check — but **it is dead code, never mounted in any layout, page, or provider.** A real user today will never see this auto-prompt.

**Net:** 2 of 3 documented enrollment paths are live; the third exists in source but does not run for any user. This should update BUG-084's retraction note rather than stand as a fresh bug — flagging as a correction to an existing (closed) entry, not a new BUG number.

---

## 7. Push notification delivery correctness

**Files:** `src/lib/notifications/event-driven-notifier.ts`, `src/lib/notifications/push-service.ts`, `src/app/api/notifications/send/route.ts`, `src/app/api/notifications/subscribe/route.ts`

**BUG-085 fix (dedup) — confirmed sound, no regression.** `event-driven-notifier.ts`'s `handleEvent`/`handlePeriodEvent` now key on `${matchId}_${event.id}` / `${matchId}_${periodEventType}` with no `Date.now()` suffix (previously the bug). Timestamps are tracked separately in the `Map` value purely for the 7-day cleanup sweep, not as part of the dedup key. `loadSentNotifications()` additionally discards any old-format flat-array-of-strings entries on load (a defensive migration for data written under the old broken scheme) — a nice touch that prevents stale bad state from a prior session leaking forward. This is syntactically and logically correct.

**BUG-086/087/088/089 — not re-diagnosed, per brief.** `notifications/route.ts:185` still hardcodes `unreadCount: 0` as BUG-088 describes — confirmed present, no regression, not re-flagging further.

**New finding, auth gap in `notifications/subscribe/route.ts`, not named in BUG-147 as briefed:** `POST` correctly calls `getAuthUser` and gates on it. **`DELETE` and `GET` do not** — `DELETE` deletes all push subscriptions for any `userId` supplied in the body with zero auth check (anyone can unsubscribe any other user), and `GET` returns any `userId`'s subscription status/endpoint list to an unauthenticated caller (`?userId=` query param, no `getAuthUser` call). Since only `notifications/send` and `users/[id]` were named as in-progress under BUG-147, this route's `DELETE`/`GET` gap does not appear to be covered — worth verifying against the actual BUG-147 route list before filing a duplicate.

`notifications/send/route.ts` — no `getAuthUser` call anywhere in the file (confirmed by read); this matches the brief's statement that it's part of the active BUG-147 fix set, so not re-flagged as new. Noting for completeness only: as read tonight, any caller can trigger a real `web-push` send to the full subscriber base or a targeted team-follower audience with no authentication — this is presumably exactly what BUG-147 is closing.

---

## 8. Favorites/follows (teams, players)

**Files:** `src/hooks/useFavorites.ts`, `src/app/api/users/favorites/route.ts`, `src/app/api/users/follows/route.ts`, `src/app/api/teams/[id]/follow/route.ts`, `src/app/profile/favorites/page.tsx`

**Backend routes — WORKS**, and BUG-091's first remediation item appears to already be done. Both `src/app/api/users/favorites/route.ts` and `src/app/api/teams/[id]/follow/route.ts` now call `resolveEffectiveUserId(user)` (confirmed present in both, imported from `@/lib/auth`) — BUG-091's text (BACKLOG.md line 344) describes this as still-outstanding BACKLOG-118 work ("both routes are listed under BACKLOG-118 remaining work as not yet having `resolveEffectiveUserId` applied"); as of this read, both routes already have it. `follows/route.ts` additionally enforces `effectiveId !== userId && role !== 'admin' → 403` on every verb (GET/POST/DELETE/PATCH), which is stricter than favorites' routes (favorites derives the effective ID server-side from the auth token itself rather than trusting a client-supplied `userId`, so it doesn't need the same check — a reasonable but inconsistent pattern between the two files worth noting, not filing).

**BUG-091's second remediation item is still outstanding.** `useFavorites.ts`'s `toggleTeam`/`togglePlayer` both do the optimistic `setState` + `localStorage` write immediately, fire-and-forget the API call, and on error just `console.error` — the comment literally says `// Revert on error? For now, keep optimistic` (lines 94, 132). No rollback, no toast, matching BUG-091's part (b) exactly as still open. **Recommend BUG-091 move from OPEN to "partially resolved"** (auth-scoping done, UI-rollback not done) rather than staying as a flat OPEN — the current single OPEN status undersells that half the fix already landed.

**`src/app/profile/favorites/page.tsx` — DOESN'T EXIST as a real feature, separate from BUG-091.** This page is 100% hardcoded mock data (`mockFavorites` object, lines 8–25) with no API calls anywhere in the file. `removeFavorite` only mutates local React state. This is a different, more severe gap than BUG-091 (which concerns the match-detail-page heart button, which does hit real APIs via `useFavorites`) — this dedicated `/profile/favorites` page has never been wired to `useFavorites` or any backend route at all. **No BACKLOG entry found for this specific page** — new finding, distinct from BUG-091.

---

## 9. Session bleed between roles (BUG-128)

**Files:** `src/contexts/AuthContext.tsx`, `src/app/api/auth/login/route.ts`, `src/lib/auth.ts` (not re-read in depth per brief — mechanics already verified sound tonight)

**Confirmed still accurate, not re-investigated in depth per brief.** BACKLOG.md's existing BUG-128 writeup (session 47C investigation) is thorough and matches everything observed in this pass: single universal `authToken` cookie set at `path: '/'` with no role/app scoping, `AuthContext.checkAuth()` and every `getAuthUser()` call site treating it identically regardless of which "app" (viewer/admin/logger) issued it. This read additionally confirms the same bleed vector exists via the `localStorage.authToken`/`localStorage.user` fallback used directly by `profile/page.tsx`, `SettingsOverlay.tsx`, `OnboardingModal.tsx`, and `useFavorites.ts` — all read/write the identical unscoped `localStorage` keys, so the bleed BUG-128 describes for the cookie path applies equally to every one of these components' localStorage fallback path. This is consistent with, not an expansion of, BUG-128's existing scope (the entry already generalizes to "every viewer-surface route that calls `getAuthUser()`") — not filing as new, just confirming the blast radius includes the account/notification features audited here too.

---

## 10. Account settings/preferences UI

**Files:** `src/app/profile/settings/page.tsx`, `src/components/SettingsOverlay.tsx`

**Verdict: WORKS**, with one inconsistency worth noting. `profile/settings/page.tsx` loads user data + preferences via `GET /api/users/{id}` and `GET /api/users/{id}/preferences` (no auth headers sent at all — relies purely on cookie, which works for same-origin fetch but is inconsistent with the Bearer-header pattern used elsewhere in the same file's sibling components), and saves via two sequential PATCH calls. The in-page `ChangePasswordModal` correctly posts to `/api/auth/change-password`, which itself is properly gated (`getAuthUser` + bcrypt-verify current password + reject if `dbUser.password` is null i.e. OAuth-only account) — this route is sound.

**Privacy/Terms links — confirmed rendering correctly**, per the brief's ask to verify tonight's privacy-policy addition still renders in context: `SettingsOverlay.tsx:270-272` renders `<Link href="/privacy">` and `<Link href="/terms">` at the bottom of the overlay, both present and correctly pathed. `profile/page.tsx:482` also links to `/profile/settings#privacy`, which correctly anchors to the "Privacy & Security" `SettingsSection` (`id="privacy"` present on that section, `scroll-mt-24` class applied for anchor-scroll offset) — the anchor link and target both exist and match.

---

## 11. Other sub-features found during this pass

- **`GlobalNotificationListener.tsx`** (mounted globally in `src/app/layout.tsx:228`) — a WebSocket-driven **in-app** toast notification path, entirely separate from browser push. Filters on favorite team/player via `useFavorites`, always shows goals, shows cards/period-changes only for followed entities. **WORKS**, not previously documented as its own sub-feature — distinct from the push-notification system audited in sections 6-7.
- **`src/app/api/notifications/history/route.ts`** — admin-only (`getAuthUser` + `role === 'admin'` check present, correctly gated), but stores history in a **module-level in-memory array**, explicitly commented `// In-memory store... (replace with DB table in production)`. This resets on every cold start/deploy and is not shared across serverless instances — functions as intended for a single warm instance only. Not in BACKLOG; flagging as a known-limitation, MVP-acceptable per the file's own comment, not filing as a bug.
- **`src/app/api/notifications/diagnose/route.ts` and `src/app/api/notifications/match-reminders/route.ts`** — present in the route tree but not read in depth this pass (outside the explicit file list in the brief); noting their existence for completeness of the inventory table below. Not assessed.
- **Two competing `useAuth` hooks** (`src/hooks/useAuth.ts` vs. `src/contexts/AuthContext.tsx`'s exported `useAuth`) — see Section 2. Structural risk, not yet a proven live bug.

---

## Inventory Table

| # | Sub-feature | Files | Verdict | BACKLOG match |
|---|---|---|---|---|
| 1a | Signup — email/password | `signup/page.tsx`, `api/auth/register` | WORKS | none |
| 1b | Signup — Google OAuth | `api/auth/google/route.ts`, `api/auth/[...nextauth]` | **BROKEN** — dead callback route, and a second unrelated NextAuth flow that's wired to nothing in the UI and doesn't share the app's session cookie | **New** — not covered by BACKLOG-025 |
| 2 | Login + session establishment | `login/page.tsx`, `api/auth/login`, `AuthContext.tsx` | WORKS (with duplicate-`useAuth`-hook fragility) | New (hook duplication); dead-key bug at `profile/page.tsx:226` also new |
| 3 | Forgot/reset password | `forgot-password`, `reset-password`, `api/auth/forgot-password` | WORKS | none |
| 4a | Profile view/edit | `profile/page.tsx`, `api/users/[id]` | PARTIALLY WORKS — `GET` unauthenticated | Adjacent to BUG-147 (verify GET is in scope) |
| 4b | User preferences API | `api/users/[id]/preferences` | **BROKEN (no auth at all)** | **New** — not named in BUG-147 as briefed |
| 5 | Logger login + session | `api/loggers/auth`, `api/loggers/me`, `api/auth/refresh` | WORKS — 120min req exceeded (7d) | Consistent with BACKLOG-140 (architecture note only) |
| 6 | Push opt-in enrollment paths | `SettingsOverlay`, `OnboardingModal`, `NotificationPermission`/`NotificationPrompt`/`useNotificationPrompt` | PARTIALLY WORKS — 2 of 3 paths live, 3rd is dead/unmounted code | Correction to closed BUG-084's retraction |
| 7a | Push delivery — dedup | `event-driven-notifier.ts` | WORKS — BUG-085 fix confirmed sound | BUG-085 (fixed tonight, confirmed) |
| 7b | Push delivery — send/subscribe auth | `api/notifications/send`, `api/notifications/subscribe` | send: in progress (BUG-147); subscribe `DELETE`/`GET`: **unauthenticated** | subscribe gap possibly **new**, verify against BUG-147's route list |
| 8a | Favorites/follows backend | `api/users/favorites`, `api/users/follows`, `api/teams/[id]/follow` | WORKS — `resolveEffectiveUserId` already applied | BUG-091 part (a) appears done |
| 8b | Favorites UI rollback | `useFavorites.ts` | PARTIALLY WORKS — no error rollback | BUG-091 part (b) still open — recommend status update |
| 8c | `/profile/favorites` page | `profile/favorites/page.tsx` | **DOESN'T EXIST** — 100% mock data, zero API wiring | **New**, distinct from BUG-091 |
| 9 | Role session bleed | `AuthContext.tsx`, cookie + localStorage | Confirmed still accurate; blast radius includes every component audited here | BUG-128 (OPEN, unchanged) |
| 10 | Settings UI + privacy/terms links | `profile/settings/page.tsx`, `SettingsOverlay.tsx` | WORKS — links render correctly in context | none |
| 11a | In-app WS notifications | `GlobalNotificationListener.tsx` | WORKS | none, newly documented |
| 11b | Notification history storage | `api/notifications/history` | WORKS but in-memory (MVP-acceptable) | none |

---

## Summary of items recommended for BACKLOG follow-up (not filed by this audit — read-only)

1. **Google OAuth is fully broken** end-to-end (dead callback route + orphaned NextAuth flow disconnected from the app's session model). Highest-priority new finding — affects a primary signup/login path advertised in the UI.
2. **`api/users/[id]/preferences` has no auth on any verb** — full read/write/reset of any user's preferences by ID alone. Independent of BUG-147's named scope.
3. **`api/notifications/subscribe` `DELETE`/`GET` have no auth** — verify overlap with BUG-147 before filing separately.
4. **`/profile/favorites` page is fully mock** — no backend wiring at all, distinct from BUG-091's heart-button scope.
5. **BUG-091 should move from flat OPEN to partially-resolved** — the `resolveEffectiveUserId` half of its fix already landed; only UI rollback-on-error remains.
6. **BUG-084's retraction should be corrected** — the third enrollment path it credits (`NotificationPermission.tsx`) is unmounted dead code, not live.
7. **Two divergent `useAuth` hooks** and the `localStorage.removeItem('token')` typo in `profile/page.tsx:226` — minor but real, worth a quick cleanup pass.
