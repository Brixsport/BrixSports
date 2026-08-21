# PWA Limitations — BrixSports

**Filed:** 2026-06-25  
**Context:** Discovered during KIN vs JOG test match audit (session 33). Logger ran on iPhone (iOS 18.5, Chrome UA). Console logs and HAR captured.

---

## iOS — Hard Broken

These features do not work on iOS, full stop.

### Background Sync API

`ServiceWorkerRegistration.sync.register('sync-match-events')` is not supported on iOS Safari. The call either throws or silently no-ops — the sync event never fires.

**Impact on BrixSports:** The entire offline queue drain mechanism in `public/sw-admin.js` does nothing on iPhone. If a logger on iOS loses network, events write correctly to `BrixsportAdminDB.pendingMatchEvents` in IndexedDB, but they stay there indefinitely. The drain only fires automatically on Android Chrome.

**Confirmed:** 2026-06-25 test match. No SW sync events observed in HAR on iOS device.

**Fix required:** Add a `window.addEventListener('online', drainQueue)` handler and a `document.addEventListener('visibilitychange', ...)` handler in `FootballLogger.tsx` that drains the IndexedDB queue directly from the page context — no SW needed. This works on iOS and Android alike and replaces Background Sync as the primary drain trigger. Background Sync on Android can remain as a secondary fallback. Tracked: **BACKLOG-107**.

---

### Push Notifications from Browser Tab

Zero support from Safari browser tab on any iOS version. Push notifications only work when:
1. The PWA is installed to the Home Screen (not opened from Safari)
2. iOS version is 16.4 or later

**Impact on BrixSports:** Viewers and loggers accessing the site from Safari receive no push notifications regardless of permission grants. Loggers assigned a match will not receive assignment notifications on iOS unless they have the app installed to Home Screen.

---

### `beforeinstallprompt` Event

Does not exist on iOS. There is no programmatic way to prompt the logger to install the PWA. The user must independently find Share → Add to Home Screen in Safari.

**Impact on BrixSports:** No install banner on iOS. No way to coach loggers into installing from within the app. Any install prompt UI built for Android will silently never appear on iPhone.

---

### Persistent Storage

`navigator.storage.persist()` is not supported on iOS. iOS can purge PWA data (Service Worker cache, IndexedDB) at any time under storage pressure with no warning.

**Impact on BrixSports:** Cached match state, offline queue, and SW caches can be evicted mid-match on a low-storage iPhone. No mitigation exists — design around this by minimising what is stored and ensuring the server is the source of truth after each event POST.

---

## iOS — Works Differently

### Cookie Isolation in Home Screen PWA

When a PWA is installed to the Home Screen on iOS, it runs in an isolated browser context with its own cookie jar — completely separate from Safari. The `authToken` cookie set during a Safari login session does not carry into the installed PWA.

**Impact on BrixSports:** A logger who logs in via Safari and then opens the installed PWA must log in again inside the PWA. This is expected iOS behaviour, not a bug, but loggers need to be told to log in directly from the installed app.

---

### Service Worker Lifetime

iOS aggressively terminates Service Workers after approximately 30 seconds of inactivity (app backgrounded, screen locked, tab switched). When the logger returns to the app after backgrounding, the SW may be dead.

**Impact on BrixSports:**
- The `SYNC_COMPLETE` postMessage from SW to page may never arrive if the SW was killed between the queue write and the drain attempt.
- The queued event badge count (`N Queued`) in the logger UI may not reset even after a successful drain.
- The SW re-registers on next page interaction, but any in-flight sync that was interrupted is not retried automatically.

**Mitigation:** The `online`/`visibilitychange` drain fallback (BACKLOG-107) covers this — drain runs from the page context when the logger returns, independent of SW state.

---

### IndexedDB in SW Context

IndexedDB is available in the SW context on iOS 14.5+ but has had historical reliability issues. Reads from the SW context (in `syncMatchEvents()`) can fail silently on older iOS versions.

**Impact on BrixSports:** On iOS < 14.5, the drain side of the offline queue may fail to read from `BrixsportAdminDB`. Given the Background Sync API is unsupported on all iOS anyway, this is moot — the drain path from SW never runs on iOS regardless.

---

### Manifest Scope Error (Active Bug)

**Observed in logs (every page load):**
```
manifest-admin.json: Manifest: property 'scope' ignored.
Start url should be within scope of scope URL.
```

The `start_url` in `manifest-admin.json` is outside the declared `scope`. On iOS this prevents the app from appearing correctly in the "Add to Home Screen" flow — the installed icon may not launch into the correct scope, and PWA mode may not activate.

**Fix:** Ensure `start_url` is a child of `scope`. If `scope` is `/logger`, then `start_url` must be `/logger` or `/logger/...`. Tracked: **BUG-075**.

---

## Android Chrome — Known Issues

### Background Sync Quota

Background Sync on Android has a per-origin quota. If many sync tags are registered without draining (e.g. logger logs many events rapidly offline), older registrations may be silently dropped by the browser.

**Impact on BrixSports:** In a long offline period with many events, not all queued events may drain on the Background Sync trigger. The page-context drain (BACKLOG-107) is the correct mitigation here too.

---

## Summary Table

| Feature | iOS Safari | iOS Home Screen PWA | Android Chrome |
|---------|-----------|--------------------|-|
| Service Worker | ✅ (iOS 11.3+) | ✅ | ✅ |
| Background Sync | ❌ | ❌ | ✅ |
| Push Notifications | ❌ | ✅ (iOS 16.4+) | ✅ |
| `beforeinstallprompt` | ❌ | N/A | ✅ |
| Persistent Storage | ❌ | ❌ | ✅ |
| Cookie isolation | Shared with Safari | Isolated context | N/A |
| SW lifetime | ~30s bg | ~30s bg | Long-lived |
| IndexedDB | ✅ (14.5+) | ✅ (14.5+) | ✅ |

---

## Recommendations for Logger Deployment

1. **Tell iOS loggers to use the Home Screen app, not Safari.** Notifications and better SW lifetime both require it.
2. **Add the BACKLOG-107 drain fallback before the first real match.** Without it, any iPhone logger who loses network briefly loses events silently.
3. **Fix the manifest scope bug (BUG-075)** before coaching loggers to install — the broken scope means the install may not work correctly right now.
4. **Do not rely on Background Sync as the sole drain trigger.** It is Android-only. The `online`/`visibilitychange` page-context drain is the cross-platform solution.
5. **Logger session must survive screen lock.** Test specifically: logger logs an event → locks phone → 2 minutes pass → unlocks → logs another event. Auth cookie and IndexedDB state must still be intact.

---

## Open Backlog Items

| ID | Description | Priority |
|----|-------------|----------|
| BACKLOG-107 | Online/visibilitychange drain fallback (iOS Background Sync alternative) | HIGH — pre-match blocker |
| BUG-075 | `manifest-admin.json` scope mismatch blocks iOS install | MEDIUM |

---

## Architecture Decision — PWA Consolidation (logged 2026-06-29)

**Current state (post session 35):** Three manifests.
- `manifest-user.json` → Viewer PWA (`/`, fans, livescores)
- `manifest-admin.json` → Admin PWA (`/admin`, admins only)
- `manifest-logger.json` → Logger PWA (`/logger`, loggers only) ← created session 35 to fix BUG-075

**Proposed: merge admin + logger into one "Staff PWA"**

Arguments for:
- `sw-admin.js` is already shared between admin and logger — no change to SW
- One install link to send to staff, one icon on home screen, one manifest to maintain
- Role-aware redirect already exists — admin lands `/admin`, logger lands `/logger` after auth
- Simpler to support: one app identity, one set of icons/names to update

Arguments against / caveats:
- On iOS, `start_url` is the cold-launch URL with no JS intercept before render. Setting `start_url: "/login"` (cleanest) means the login screen renders first, then redirect fires after auth. Slight flash but acceptable. Setting `start_url: "/admin"` means loggers see an admin flash before redirect — worse.
- Two manifests created a clean separation of PWA identity for future where admin and logger may diverge further (e.g. different theme colors, different shortcuts)

**Decision: defer the merge.** `manifest-logger.json` was just created to fix a real launch-URL bug. Don't immediately revert. Merge as a deliberate cleanup task in a future PWA pass.

**When merging:** create `manifest-staff.json`, `start_url: "/login"`, `scope: "/"`, `name: "BrixSports Staff"`. Update both `admin/layout.tsx` and `logger/layout.tsx` to reference it. Delete `manifest-admin.json` and `manifest-logger.json`. The auth redirect flow handles role routing from there.
