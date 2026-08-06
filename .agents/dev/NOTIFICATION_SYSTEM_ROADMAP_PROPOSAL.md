# Notification System — Roadmap Proposal (for review)

**Written:** session 49, 2026-08-06. **Method:** read-only trace of the live codebase on
`feature/notification-system` @ `aa3e8f0`, triggered by Richard's brain-dump after Phase 1
(server-side football triggers, `ce46f6c`).

**Nothing in this document is filed or built.** No `BACKLOG.md` entry was created or edited.
No code was written. This is a triage pass for Richard to review, edit, and approve before
anything becomes a real backlog item.

**Phase 2 (basketball wiring) is explicitly out of scope for this document** — it is already
being implemented in parallel. Where a finding is relevant to Phase 2, it is called out as an
input to that work, not a proposal to start it.

**Stale-doc warning:** `.agents/dev/NOTIFICATION_SYSTEM_FLOW.md` was written before `ce46f6c`.
Its §1/§3/§8 claims about client-side triggers and "basketball produces no notifications at
all" are no longer accurate. See threads 3 and 7 below.

---

## 1. Does a broader in-app notification / campaign system already exist?

### What's actually there

**Yes — considerably more than the per-match push pipeline, in three separate systems that
don't know about each other.**

**(a) A complete admin push-campaign composer.** Fully built, reachable, admin-gated:

- `src/app/admin/notifications/composer/page.tsx` — a 738-line UI with six message templates
  (`match_start`, `goal`, `red_card`, `match_end`, `breaking_news`, `custom`), `{homeTeam}` /
  `{playerName}` variable substitution, icon/image/action-URL fields, `requireInteraction`
  toggle, and mobile + desktop live previews.
- `src/app/admin/notifications/page.tsx:23-35` — the index card linking to it, plus a mounted
  `PushNotificationDebugger`.
- `POST /api/notifications/send` — correctly admin-gated (`send/route.ts:125-131`), fresh
  per-request VAPID config with real key-format validation (`send/route.ts:9-61`).
- Three targeting modes (`send/route.ts:64-120`): `all`, `team_followers` (multi-select),
  `match_specific`.

**(b) An in-app WebSocket toast layer, entirely separate from push.**
`src/components/GlobalNotificationListener.tsx`, mounted globally at `src/app/layout.tsx:228`.
It listens for `notification:global`, which is emitted from `ws-server/index.js:313`. It is
already favorite-**player**-aware (`GlobalNotificationListener.tsx:22-23`) and applies its own
display rules: always show goals, show cards/period-changes only for a followed team or player
(lines 32-33).

**(c) An in-app notification *feed*.** `GET /api/notifications` (`notifications/route.ts`) —
this synthesizes a list on the fly from recent matches/events/news; it is not a stored
notification table. Consistent with `BUG-088`.

**Ads: no notification coupling exists.** Grep of `src/app/api/admin/ads/**` for
`notif|push` returns zero matches. `advertisements` (`schema.ts:856`), `AdBanner.tsx`, and
`/admin/advertisements` are wholly independent of notifications. There is no ads-notification
code, dead or alive.

### Critical assessment

The composer is real and works, but it has four problems Richard should know about before
building anything on top of it:

**1. "Match Viewers" targeting silently sends to *everyone*.** `getTargetUserIds()` returns
`[]` for `match_specific` — the code says so outright (`send/route.ts:110-114`:
`// For now, return all users (fallback)`). An empty array is then interpreted at
`send/route.ts:211-216` as *no filter*, so the query falls through to every subscription in
the table. The same trap fires for `team_followers` with nothing checked. An admin selecting
"Match Viewers" for one match blasts the entire subscriber base with no warning. **Not filed
as a bug anywhere.**

**2. Unbounded query.** `db.select().from(pushSubscriptions)` at `send/route.ts:215` has no
`.limit()` — a direct CLAUDE.md architecture-rule violation ("Every list endpoint MUST have a
`.limit()` clause"). Same pattern in `sendMatchReminderNotification()`
(`match-notification-service.ts:353-355`).

**3. It ignores user preferences entirely.** `sendMatchEventNotification()` correctly filters
out users with `userPreferences.matchAlerts = false` (`match-notification-service.ts:112-123`).
The campaign path does not. A user who explicitly turned off alerts still receives campaigns.

**4. It will hit anonymous per-match subscribers.** `BACKLOG-150` devices consented to *one
match*. They live in `pushSubscriptions` under the sentinel user, so a `targetAudience: 'all'`
campaign reaches them. That's a consent problem, not just a UX one.

**Bonus finding — send history has never worked.** `/api/notifications/history` stores rows in
a module-level in-memory array (`history/route.ts:6`), which evaporates per serverless
invocation. Worse: `send/route.ts:276` writes to it via a **server-side self-`fetch()` that
forwards no auth headers**, while the POST handler requires admin (`history/route.ts:39-45`).
It 401s every time and is swallowed by the surrounding try/catch. This is exactly the
`BACKLOG-124` class of bug (the ratings self-fetch). The composer's "Recent History" panel has
therefore always been empty.

**Scope conflict to resolve.** `CLAUDE.md` → Explicit Out of Scope lists **"Push notification
campaigns."** A fully-built campaign composer contradicts the project's own charter. This
needs an explicit decision from Richard: either bring it in scope and fix it, or hide it (it
would also then belong on the Live Event Readiness Checklist's "🔴 features hidden" line).

### Recommendation

**Near-term / do next:**
- **Decide the scope question first** — in-scope-and-fix, or hide behind the same gate as the
  other pre-match-day hidden features. Everything else here depends on that answer.
- If kept: fix the `match_specific` → send-to-everyone fallback. This is the highest-severity
  item in this entire document (an admin can accidentally page every subscriber).

**Backlog for later:**
- Add `.limit()` + `userPreferences` filtering to the campaign send path.
- Exclude anonymous per-match subscriptions from `targetAudience: 'all'`.
- Replace in-memory history with a real table, and replace the self-`fetch()` with a direct
  function call (same fix shape as `BACKLOG-124`).

---

## 2. Admin / logger operational reminders

### What's actually there

**No operational reminder exists — but two competing, both-dead fan-facing reminder systems do.**

| System | Trigger source | Audience | Status |
|---|---|---|---|
| `POST /api/notifications/match-reminders` | scans `matches` for T-30 / T-15 windows | **all** subscriptions, unfiltered | never invoked |
| `POST /api/reminders/check` | reads the `matchReminders` table (`schema.ts:835`) | that reminder's own `userId` | never invoked |

Both require `Bearer ${CRON_SECRET}`. **`vercel.json` has no `crons` block** (confirmed — the
file contains only `headers` and `rewrites`). Neither route has ever run in production. This
matches the session-48 audit finding and is still true.

Also: `/api/reminders/check`'s payload interpolates raw foreign keys, not names —
`reminders/check/route.ts:85` produces `"busa-kings vs busa-cruise starts in 30 minutes"`.

Building blocks that already exist for operational reminders:
- `matchLoggerAssignments` with an `active` status filter — the exact query already exists at
  `api/internal/logger-assignment-check/route.ts:33-43`.
- `matches.startTime` / `.status` / `.currentPeriod` (`schema.ts:308-346`).
- Lineup publish already fires a notification server-side
  (`matches/[id]/lineup/publish/route.ts`), so "lineup published" state is observable.
- `jwtSecondsRemaining(token)` already exists and is used for queue decisions
  (`BasketballLogger.tsx:729`).

### Critical assessment

Richard's two examples are both sound, but they are a different *class* of notification from
everything built so far. All existing targeting is **fan-oriented** — audience is derived from
team follows or per-match opt-in. Operational reminders are **role/assignment-oriented**:
audience is "the logger assigned to match X", "admins of competition Y". That requires a
second targeting path in the service layer, not a new event type on the existing one.

More importantly: **every reminder idea here is blocked on the same missing piece — a
scheduler.** There is no point designing reminder types while nothing can invoke them.

Brainstormed set, grounded in CLAUDE.md's Live Event Readiness Checklist and the actual match
lifecycle (not generic ideas):

| Reminder | Grounded in | Audience | Value |
|---|---|---|---|
| Match reaching `startTime` with **zero active logger assignments** | Flow A; checklist line 1 | Admin | Highest — this is a silent total failure of Flow B/C |
| Assigned-logger reminder at T-60 / T-15 | Richard's example | Logger | High |
| Logger JWT approaching expiry mid-match | checklist "120+ minutes" (still UNVERIFIED) | Logger | High — a re-login mid-match loses the tab |
| Lineup not published N min before kickoff | Richard's example | Admin / Team Manager | Medium |
| Match still `LIVE` well past expected duration | `BUG-076`/`BUG-078` class; checklist "cleanly closed" | Admin | Medium |
| **Two** loggers active on the same match at once | checklist "two simultaneous loggers" — still OPEN, never tested | Admin | Medium — currently no detection at all |
| Match past `startTime` but still `UPCOMING` | lifecycle drift | Admin | Low-medium |
| `LIVE` match with subscribers but no event logged in N minutes | Flow B stall detection | Admin | Low — noisy for low-event sports |

### Recommendation

**Near-term / do next:**
- **Unblock the scheduler.** Add a `crons` block to `vercel.json` and pick *one* of the two
  reminder routes to keep (`/api/reminders/check` is the better base — it's per-user and has
  a `notificationSent` idempotency flag; the other blasts everyone). Delete or gate the other.
  Nothing in this thread can ship before this.
- Fix `reminders/check/route.ts:85` to resolve team names.

**Backlog for later (in priority order once the scheduler exists):**
1. "Match going LIVE with no assigned logger" — admin alert.
2. Assigned-logger T-60/T-15 reminder.
3. Logger session-expiry warning.
4. Lineup-not-published reminder.
5. The rest of the table above.

**Design note for whoever builds these:** add a role/assignment targeting function alongside
the existing team-follow one rather than overloading `sendMatchEventNotification()` — the
audience derivation is genuinely different and mixing them will make both harder to reason
about.

---

## 3. Basketball notification volume — UX strategy

### What's actually there

`BasketballLogger.tsx:23` defines twelve event types:

```
'Field Goal' | 'Three Pointer' | 'Free Throw' | 'Rebound' | 'Assist' | 'Steal' |
'Block' | 'Turnover' | 'Foul' | 'Technical Foul' | 'Substitution' | 'Timeout'
```

Period model: `Q1`–`Q4` (configurable count via `periodCount`, `BasketballLogger.tsx:97`) plus
`OT1`/`OT2`/… (`getCurrentPeriod()`, line 702), persisted to `matches.currentPeriod`.

### Critical assessment — one finding that changes the premise

**Basketball is already sending push notifications in production, right now, unintentionally.**

The Phase 1 period hook (`matches/[id]/route.ts:661-666`) matches on `body.currentPeriod` with
**no sport check**:

```ts
body.currentPeriod === 'FIRST_HALF' ? 'MATCH_START' :
body.currentPeriod === 'HALF_TIME'  ? 'HALF_TIME'   :
body.currentPeriod === 'FINISHED'   ? 'MATCH_END'   : null
```

And `BasketballLogger.finalizeMatch()` (`BasketballLogger.tsx:1069-1084`) PATCHes exactly
`{ status: 'FINISHED', currentPeriod: 'FINISHED', homeScore, awayScore }`.

So since `ce46f6c`, ending a basketball match sends a real
`"⏹️ Full Time! Match finished: X-Y"` push to every follower of either basketball team and
every anonymous per-match subscriber. Basketball gets **no** `MATCH_START` (it writes `'Q1'`,
which matches nothing) and no event notifications (none of the twelve types appear in
`NOTIFIABLE_EVENT_TYPES`, `events/route.ts:19-26`).

This means: (a) `NOTIFICATION_SYSTEM_FLOW.md` §1's "Basketball produces no notifications at
all, for any event type" is now **stale**; (b) basketball's current behaviour is asymmetric and
accidental — full-time with no kickoff; (c) **Phase 2 must decide deliberately whether to keep
it or gate it**, because it is live either way. This is the single most important input from
this document into the in-flight Phase 2 work.

On the spam question itself, Richard's framing is correct and the numbers back it. A basketball
game produces 100+ scoring-adjacent events; football's entire Phase 1 notifiable set fires
maybe 3-8 times a match. Wiring basketball "like football" is not a like-for-like port —
football's event set is *inherently* sparse, and that sparseness is doing the volume-control
work implicitly. Basketball has no such natural filter, so the filter has to be explicit.

### Recommendation

**Near-term / do next (input to Phase 2, not a directive):**

Minimal v1 set — mechanism first, minimal events, exactly how football's Phase 1 was scoped:

| Fire | Rationale |
|---|---|
| `MATCH_START` (on `Q1`) | Parity with football; ~1 per match |
| Halftime (on `Q3` start — the football `HALF_TIME` analogue) | Natural break; ~1 per match |
| `MATCH_END` (on `FINISHED`) | **Already firing today** — formalise it |
| `Technical Foul` | Genuinely newsworthy, genuinely rare |
| Overtime start (on `OT1`/`OT2`) | Rare, high-signal |

Ceiling: ~5 pushes per basketball match, comparable to football.

**Never fire:** `Field Goal`, `Three Pointer`, `Free Throw`, `Rebound`, `Assist`, `Steal`,
`Block`, `Turnover`, `Foul`, `Substitution`, `Timeout`.

**Deliberately excluded from v1:** per-quarter transitions for Q2 and Q4-start. Four quarter
notifications per game is already at the annoyance ceiling, and "end of Q1" carries almost no
information. Halftime + start + end is the right v1.

**Backlog for later — clearly labelled future, per Richard's "let's not overengineer" call:**

> **Close-game / buzzer-beater alerts (FUTURE — do not build with Phase 2).**
> Fire a push only when a made shot occurs under specific tight-game conditions: e.g. final
> N seconds of Q4/OT **and** margin ≤ 3 points, or any lead change in the final 2 minutes.
> This is the one genuinely compelling case for notifying on an individual made basket.
> It needs, and does not currently have: reliable per-event game-clock remaining (basketball
> currently derives elapsed time from `quarterStartedAt`, `BasketballLogger.tsx:760` — a
> wall-clock approximation, not a real game clock), plus a lead-change/margin evaluator.
> Also a natural home for a **per-match notification budget** (hard cap of N pushes per match
> across all types) — worth designing once, applying to all sports, not basketball-only.

---

## 4. Followed-player notifications — architect now, build later

### What's actually there

**The follow/preference layer for players already exists and is live.** Richard's memory of
"legacy code for user preferences" is correct, and it's further along than he may realise:

- `userFollows.followType` is plain `text` (`schema.ts:493`), **not** an enum — `'player'`
  costs zero migration. Same for `userFavorites.favoriteType` (`schema.ts:484`).
- `useFavorites.ts:99-134` — `togglePlayer()` **already** POSTs
  `{ favoriteType: 'player', favoriteId }` to `/api/users/favorites`, with localStorage
  fallback for logged-out users. This is live, working code.
- `/api/users/follows/route.ts:25` documents `'team' | 'player' | 'competition'` and already
  resolves player follows (line 75). `/api/users/favorites/route.ts:71` likewise.
- `GlobalNotificationListener.tsx:22-23` already reads `isFavoritePlayer` and tags in-app
  toasts as `type: 'player'` (line 38).
- `userPreferences` already has the relevant opt-out toggles: `playerRatings`, `milestones`,
  `scoutUpdates` (`schema.ts:462-464`).

### Critical assessment

**Good news:** no rearchitecture is needed. `sendMatchEventNotification()`'s audience-building
(lines 54-147) is a *merge of independent subscriber queries* deduplicated into one set. Adding
player-follow targeting is structurally a fourth query merged into the same set — additive, not
a redesign. The delivery, dedup, and cleanup layers are all identity-agnostic.

**The one real rework risk, and it's cheap to eliminate now:** the notification interface does
not carry player identity. `MatchEventNotification` (`match-notification-service.ts:29-39`)
takes `playerName?: string` — a display string — but **no `playerId`**. A player-follow query
needs the ID. Both IDs are already in scope at the call site (`events/route.ts:362-370` has
`playerId`, `relatedPlayerId`, and `notifyPlayerId`); they're just resolved to a name and
discarded.

Second, smaller design question to settle now rather than later: with team-follow, "either team
in the match has a follower" makes the whole match notification-active. With player-follow, the
natural rule is narrower — notify only on *that player's own* events, not every event in the
match. Those two rules coexist fine in a merged-set model, but only if the payload knows which
rule matched (otherwise a player-follower gets a generic team-flavoured payload).

### Recommendation

**Near-term / do next — a ~4-line change worth making during Phase 2 to avoid rework:**
- Add `playerId?: string` and `relatedPlayerId?: string` to `MatchEventNotification`
  (`match-notification-service.ts:29-39`) and pass them through from `events/route.ts`. No
  schema change, no behaviour change, no new query. This is the entire "architect now" ask.

**Backlog for later:**
- The player-follow audience query itself (a fourth `userFollows`/`userFavorites` query keyed
  on `followType: 'player'` + the event's player IDs), merged into the existing dedup set.
- Player-specific payload templates (so a player-follower's notification reads
  "Your player scored", not the generic team copy).
- Rating-change / milestone triggers — these fire from `calculateAndSaveRatings()`
  (`events/route.ts:415-421`), a different trigger point entirely, and gate on the already-
  existing `userPreferences.playerRatings` / `.milestones` flags.
- A UI surface for following a player (the *hook* exists; no page appears to call
  `togglePlayer()` — worth confirming before building the notification side).

---

## 5. Heart button → two per-team follow stars

### What's actually there

The Heart button is exactly as documented in `BUG-152` — `matches/[id]/page.tsx:543-549`:

```tsx
<button onClick={() => setIsFavorited(!isFavorited)} ...>
```

Pure local `useState` (declared line 60). No API call, no localStorage, no `useFavorites`
import. Resets on reload.

The targeting rule Richard describes **already matches the shipped code exactly**.
`sendMatchEventNotification()` queries all three team-follow sources with an
`or(homeTeamId, awayTeamId)`:

- `userFollows` — `match-notification-service.ts:60-69`
- `userFavorites` — lines 78-86
- `users.favoriteTeamId` — lines 94-99

So "if either team has at least one follower, the match is notification-active" is not a new
rule to implement — it is the current behaviour. **No gap here.**

### Critical assessment — two gaps between his description and the code

**1. The Bell is not gated on team-follow, and shouldn't become so.** Richard's framing implies
team-follow status determines whether "the match's Bell/notification targeting is active." It
doesn't: the Bell is a *separate* anonymous, device-scoped, per-match path via
`pushSubscriptionMatches` (`match-notification-service.ts:138-147`), which works with zero team
follows and zero account. The two audiences are merged (lines 144-147) but independently
derived. Worth stating explicitly so the star redesign doesn't accidentally couple them — the
Bell must keep working for a viewer who follows nothing, per the actor model ("Viewers NEVER
have a session").

**2. "Favorite" silently means "notify me."** `useFavorites.toggleTeam()` writes to
`userFavorites`, and the service queries `userFavorites` **unconditionally** (lines 78-86) —
unlike `userFollows`, which at least respects a per-row `notificationsEnabled` flag (line 67).
So tapping a star to bookmark a team enrolls you in push for every match it plays, with no
separate consent step. That's a real product decision to make before shipping a prominent
two-star UI, not an implementation detail.

### Recommendation

**Near-term / do next — good small win, closes a filed bug:**
- Replace the single Heart with two per-team stars beside each team badge, wired to
  `useFavorites.toggleTeam(teamId)` (already working, already the exact thing the service
  targets). This closes `BUG-152` and makes existing targeting reachable from the match page
  for the first time.
- Make the star's tooltip/label state the consequence honestly ("Follow — get alerts for this
  team's matches"), given gap 2 above.
- Keep the Bell visually and functionally distinct from the stars — different mechanism,
  different audience.

**Backlog for later:**
- Decide whether "favorite" and "notify" should split into two states (matching
  `userFollows.notificationsEnabled`), or stay fused. If they split, `userFavorites` needs a
  `notificationsEnabled` column and the service query at lines 78-86 needs the filter.
- The `BUG-150` follow-up: anonymous → authenticated subscription handoff. Becomes more
  visible once stars and Bell sit side by side.

---

## 6. Competition-level following

### What's actually there

**Partially built already — Richard may not know this.** Following a competition is a live,
working capability today:

- `POST /api/users/follows` accepts `followType: 'competition'` and increments
  `competitions.followersCount` (`follows/route.ts:159-164`); `DELETE` decrements it
  (line 219+).
- `competitions.followersCount` exists in schema (`schema.ts:242`).
- `GET /api/users/follows?type=competition` resolves them (`follows/route.ts:25, 62`).

What does **not** exist: anything that consumes a competition follow for notification
targeting. `sendMatchEventNotification()` never queries `followType: 'competition'` and never
looks at `matches.competitionId` at all.

### Critical assessment

Richard is right that this needs thread 3's thinking first, and the volume math makes it stark.
A team-follow yields notifications for ~1 match at a time. A competition-follow yields
notifications for **every concurrent match in that competition**. On a busy fixture day, a
single follow could produce 5-10× the volume of a team follow — and it inherits basketball's
spam problem wholesale, since a competition can be multi-sport (`competitions.isMultiSport`,
`schema.ts:221`).

His proposed event set (started, finished, HT/FT with scoreline, goals) is reasonable per-match
but is exactly the set that doesn't survive multiplication. Goals-for-every-match-in-a-league
is the single highest-volume thing anyone could subscribe to in this system.

### Recommendation

**Backlog for later — do not build now.** Correctly scoped by Richard. Capture as:

> **Competition following with match alerts (FUTURE).**
> Blocked on: thread 3's per-sport event-set policy being settled, *and* a per-user volume cap
> existing. Requires: a `followType: 'competition'` audience query in
> `sendMatchEventNotification()` joined via `matches.competitionId`; a dedicated
> `userPreferences` opt-out; a reduced event set relative to team-follow (recommend: start /
> HT / FT only for v1 — **not** goals, which is where the volume actually lives); and a
> per-user daily notification cap. Note the follow *plumbing* already exists
> (`/api/users/follows`, `competitions.followersCount`) — only the targeting side is missing.

**One near-term note:** since users can already follow competitions today with no effect, it's
worth confirming whether any UI exposes that, so expectations aren't already being set.

---

## 7. Making the architecture sport-agnostic

### What's actually there — where football coupling really lives

Five places, all in the *vocabulary* layer:

1. `MatchEventNotification.eventType` — a closed union of nine football strings
   (`match-notification-service.ts:33`).
2. `NOTIFIABLE_EVENT_TYPES` — a football-only DB-type → notification-type map
   (`events/route.ts:19-26`).
3. `createNotificationPayload()` — a switch with football-specific copy and emoji:
   `'⚽ GOAL!'`, `'🟥 Red Card!'`, `'🧤 Penalty Saved!'`
   (`match-notification-service.ts:230-334`), including a football-flavoured `default` case
   (line 327: `'⚽ Match Update'`).
4. Period mapping hardcoded to `FIRST_HALF` / `HALF_TIME` / `FINISHED`
   (`matches/[id]/route.ts:662-666`).
5. The same nine-string allowlist re-validated at `notifications/match-event/route.ts:33-43`.

### Critical assessment

**The good news is bigger than the bad news.** Everything *below* the vocabulary layer is
already sport-neutral and needs no change whatsoever:

- Audience derivation (`match-notification-service.ts:54-147`) — pure team/subscription
  identity, never inspects sport.
- Delivery loop, 410/404 stale-subscription cleanup (lines 162-193).
- The `after()` scheduling pattern at both call sites.
- `pushSubscriptionMatches` anonymous targeting.
- The service worker's push/notificationclick handlers.

So the honest answer to Richard's question is: **the architecture is football-coupled, but only
in two data literals, one type union, and one payload switch.** It is not structurally
football-shaped. The rework risk if this is left alone is real but bounded — and it is at its
cheapest to fix *right now*, before a second sport's worth of literals exists.

**The concrete argument for doing it during Phase 2 rather than after:** the alternative shape
Phase 2 would naturally reach for is a second parallel structure —
`BASKETBALL_NOTIFIABLE_EVENT_TYPES`, a second `if` block for `Q1`/`Q3`/`FINISHED`, and the
union widened with basketball strings. That (a) leaves the accidental basketball `MATCH_END`
from thread 3 in place as an untracked special case, (b) doubles the surface area again when
Track (`TrackLogger.tsx` exists today, with `'Race Start'`, `'Finish'`, `'Disqualification'`
events at lines 229-279) eventually needs notifications, and (c) means the period mapping has
two places to get out of sync with the loggers that write those strings.

`matches.sport` is already loaded and in scope at both call sites (used at
`events/route.ts:390`), so a sport-keyed lookup costs no extra query.

**Proposed shape (design only, no code):**

```
NOTIFICATION_RULES: Record<Sport, {
  events:  Record<DbEventType, NotificationKey>   // 'Goal' -> 'GOAL', 'Technical Foul' -> ...
  periods: Record<PeriodLabel, NotificationKey>   // 'FIRST_HALF' -> 'MATCH_START', 'Q1' -> ...
}>

NOTIFICATION_TEMPLATES: Record<NotificationKey, (ctx) => NotificationPayload>
```

Two data tables plus one shared engine. Football's existing entries move across unchanged (a
mechanical refactor, not a rewrite). Basketball adds a sibling entry. Track gets one later for
free. `eventType` becomes an open `NotificationKey` union rather than a closed football list,
and the period `if`-chain in `matches/[id]/route.ts` becomes a lookup keyed on
`(match.sport, body.currentPeriod)` — which incidentally makes the thread-3 basketball
`MATCH_END` an explicit, visible table entry instead of an accident.

This also aligns with the separate future plan to unify `FootballLogger.tsx` /
`BasketballLogger.tsx` — a sport-keyed rules table is the same shape that work will need.

### Recommendation

**Near-term / do next — for Richard's decision, not a directive to the in-flight Phase 2 work:**
- Adopt the sport-keyed rules-table shape *in* Phase 2 rather than adding a second
  football-shaped structure. Frame it as what it is: moving two existing literals into a
  sport-keyed object, plus generalising one switch. Low cost, done once.
- **Regardless of shape chosen, Phase 2 must consciously handle the already-live basketball
  `MATCH_END`** (thread 3). It is firing in production today and needs to be either formalised
  or gated — not left implicit.
- Combine with thread 4's `playerId` interface addition — same file, same edit window.

**Backlog for later:**
- Move `notifications/match-event/route.ts`'s duplicate validation list to read from the shared
  rules table rather than maintaining its own copy (`match-event/route.ts:33-43`).
- Sport-neutral default payload (currently `'⚽ Match Update'` for any unmatched type).

---

## Also worth flagging (notification-system, not on Richard's list)

Two findings surfaced during this trace that belong in the roadmap conversation:

**A. The in-app toast layer still has the exact single-tab dependency `BUG-200` just fixed for
push.** `notification:global` is emitted from `ws-server/index.js:313` only in response to a
`socket.on('event:log')` — which is emitted from the logger's own browser tab
(`FootballLogger.tsx:734`). If the logger's tab closes, in-app toasts stop, exactly as push did
before `ce46f6c`. Additionally, `BasketballLogger.tsx` never emits `event:log` at all, so
basketball produces no in-app toasts under any circumstances. **Phase 1 fixed push and left its
in-app sibling on the old architecture.** The server-side fix would be a natural extension of
the same `after()` hook in `events/route.ts` that now calls `sendMatchEventNotification()`.

**B. `BUG-200`'s own evidence block flags an unbuilt follow-up that is still open:** there is no
persistent server-side log of notification send attempts / successes / failures —
`sendMatchEventNotification()` only `console.log`s (lines 51, 150, 195). This slowed down
Phase 1's own verification and will slow down Phase 2's. Worth filing before basketball
testing starts, not after.

---
---

# Unrelated, Captured for Later

Richard explicitly flagged the following two items as **not part of the notification system**.
They are recorded here so nothing is lost, and deliberately separated so they don't get pulled
into notification planning.

---

## 8. Match livestream embed

### What's actually there

**This is almost entirely already built — substantially more than "a reference to
`livestream/route.ts`."** Full inventory:

**Schema** — `matches` already carries eight livestream columns: `livestreamUrl`,
`livestreamType`, `livestreamEnabled`, `livestreamStartTime`, `livestreamEndTime`,
`livestreamViewers`, `livestreamChatEnabled`, `livestreamChatUrl`
(enumerated at `api/matches/[id]/livestream/route.ts:17-27`).

**API** — `src/app/api/matches/[id]/livestream/route.ts`:
- `GET` (public) returns the fields plus a computed `isActive` (enabled ∧ URL ∧ inside the
  start/end window, lines 40-43).
- `PATCH` (admin) — correctly gated via `getAuthUser()` + `role !== 'admin'` (lines 71-83);
  the comment at lines 66-70 notes `BACKLOG-168` already hardened this from a hand-rolled
  `jwt.verify()`. Validates `livestreamType` against
  `['youtube','twitch','facebook','hls','dash','custom']` (line 99) and the URL as http/https
  (lines 161-167).
- `GET /api/livestreams/active` also exists.

**Admin publish UI** — `src/app/admin/livestreams/page.tsx`. A real form that loads matches
(line 54) and PATCHes `/api/matches/{id}/livestream` (lines 109-110, 151-152), including a
per-match URL display (line 367).

**Player components** — `src/components/livestream/`: `LivestreamView.tsx`,
`LivestreamPlayer.tsx`, `LivestreamChat.tsx`, `LiveNowSection.tsx`, plus a standalone
`/livestream/[id]` page.

**And the embed Richard is asking for already exists, in the exact place he wants it** —
`matches/[id]/page.tsx:792-806`, inside the Overview tab, gated on
`match.livestreamEnabled && match.livestreamUrl`.

### Critical assessment

Richard's request is essentially already implemented. The reason it looks absent is the `else`
branch at `matches/[id]/page.tsx:807-829`: when no livestream is configured — which is every
match, since no admin has populated the fields — the Overview tab renders a placeholder
(an `Eye` icon, an "Match Overview" heading, and three small Venue/Competition/Status cards).
**That placeholder is the "lots of unused white/black space" he's describing.**

So there are two genuinely separate pieces of work hiding behind one request:
1. **Livestream: a data/discoverability task, not a build task.** Verify `/admin/livestreams`
   is reachable from `AdminSidebar.tsx`, set a URL on one match, confirm the embed renders.
2. **The Overview-tab empty state: a real UI design task.** What should the Overview tab show
   for the ~100% of matches with no stream? That's the actual "Tier 1 redesign" item, and it
   is independent of livestream entirely.

**Security caveat, not audited here:** `LivestreamPlayer` renders third-party embeds from an
admin-supplied URL, validated only as http/https. Before any public match day, that deserves a
source allowlist check (it sits adjacent to the `BUG-006` XSS class of concern).

### Recommendation

**Near-term:** treat as verification, not construction. One admin walkthrough:
`/admin/livestreams` → set a YouTube URL + `livestreamEnabled` on a test match → open the match
detail Overview tab → confirm the embed renders. If it does, thread 8's "build" is done.

**Backlog for later:** (a) redesign the Overview-tab empty state — this is the real Tier 1 item
and should be scoped alongside the Lineups tab UI as Richard grouped it; (b) livestream embed
source allowlist before public use.

---

## 9. Competition logos + Cloudinary migration

### What's actually there

**Competition logos: the UI is ready, the schema is not.**

- `competitions` (`schema.ts:217-261`) has **no `logo` column at all**. The only `logo` columns
  in the entire schema are `teams.logo` (line 34, `notNull`) and one other at line 567.
- Yet the UI already tries to render one: `LiveMatchCard.tsx:70-72` and `FixtureCard.tsx:137-139`
  both conditionally render `match.competition.logo`. It is always undefined, so the branch
  never fires. `src/app/page.tsx:590-591` even carries a literal TODO about it
  (`{/* Ideally we'd have a map or lookup for competition logos... */}`).

**The fallback pattern to reuse already exists and is good.** `src/lib/utils/team-logo.tsx`:
- `isValidLogo()` (lines 5-10) — rejects null/empty/`'placeholder'` strings.
- `TeamLogo` renders an initials circle with the team colour when there's no valid logo
  (lines 62-64), and swaps to it via `onError` if the image 404s (lines 75-78).
- It takes a plain `logo?: string` prop — it is already entity-agnostic in everything but its
  name. Generalising to an `EntityLogo` for competitions is near-free.

**Cloudinary: two separate realities.**

*Working* — `POST /api/cloudinary/sign` (`api/cloudinary/sign/route.ts`) does real signed
uploads via `cloudinary.utils.api_sign_request` (line 43), auth-gated (line 18), with a
`GET` config-status probe. Consumed by `components/ui/mobile-image-upload.tsx`. This is the
path a logo migration should use.

*Broken and effectively dead* — `src/lib/cloudinary.ts`. `buildCloudinaryUrl()` (lines 108-128)
builds transformations as a **query string** and **never appends `publicId` to the URL at all**:

```ts
const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
```

Cloudinary requires transformations as **path segments** followed by the public ID
(`/image/upload/c_fill,w_40/<publicId>`). Every exported function in this file
(`getResponsiveImageUrls`, `generateSrcSet`, `generatePlaceholderUrl`,
`getProgressiveImageUrls`) inherits the defect. Its **only** importer is
`components/ui/optimized-image.tsx`, which nothing else in `src/` imports — so this is dead
code rather than a live production bug, but it must not be used as the basis for the migration.

**Current team logo data is local repo paths.** `src/db/seed-busa-football.ts:24-157` writes
values like `'/assests/Logos/football/kings-fc.jpg'` directly into `teams.logo`. Those are the
rows a Cloudinary migration would have to rewrite.

**Incidental bug found while checking this.** Only `public/assests/Logos/` exists (the typo
spelling). But three files reference the correctly-spelled `/assets/` path:
- `src/lib/utils/aeo.ts:589` — `${baseUrl}/assets/Logos/BRIX-SPORT-LOGO.png`
- `src/components/seo/PageSEO.tsx:41` — default `ogImage`
- `src/app/page.tsx:356` — homepage `ogImage`

Meanwhile `src/lib/email.ts:217,297` and `src/app/reset-password/page.tsx:301` use the working
`/assests/` spelling. **The site's OG/social-share image and AEO structured-data logo are
currently 404s.** Small, separate, worth its own fix.

### Critical assessment

Richard's instinct is right on both counts, and the work is smaller than it sounds because
`TeamLogo` already solves the hard part (graceful fallback). The genuine prerequisites he may
not have accounted for: (1) competitions need a schema migration — there is no column to
populate; (2) the Cloudinary helper library he'd naturally reach for is broken and should be
deleted rather than fixed, with the signed-upload route used instead; (3) migrating team logos
means rewriting existing DB rows, which per project convention is a `dev/*.mjs` script with a
`RUNLOG.md` entry, staging-first.

### Recommendation

**Near-term:**
- Fix the `/assets/` vs `/assests/` split (3 files) — cheapest real bug in this document, and
  it's currently breaking every social share preview.

**Backlog for later, in dependency order:**
1. Add `competitions.logo` (`text`, nullable) — staging first, log in `RUNLOG.md`.
2. Generalise `TeamLogo` → a shared `EntityLogo` (or just reuse it as-is; it already accepts a
   bare `logo` string). Wire into `LiveMatchCard.tsx:70` / `FixtureCard.tsx:137`, replacing the
   `&&` guard with the built-in fallback, and resolve `page.tsx:590`'s TODO.
3. Cloudinary migration: upload existing `public/assests/Logos/**` via the **working**
   `/api/cloudinary/sign` path; rewrite `teams.logo` rows and `seed-busa-football.ts` literals
   to Cloudinary URLs; populate `competitions.logo`.
4. Delete `src/lib/cloudinary.ts` and its sole consumer `components/ui/optimized-image.tsx`
   (both dead), or fix `buildCloudinaryUrl()` to use path-segment transformations — but do not
   build on it in its current state.

---

## Summary — what actually wants doing next (proposal, for Richard's edit)

| # | Item | Class | Note |
|---|---|---|---|
| 1 | Campaign composer: `match_specific` silently sends to **all** subscribers | **Bug, high** | Unfiled. Admin can page everyone by accident |
| 2 | Basketball `MATCH_END` is already firing, unintentionally | **Decision, urgent** | Live now. Input to in-flight Phase 2 |
| 3 | Scope decision on the campaign composer vs. CLAUDE.md "Out of Scope" | **Decision** | Blocks all thread-1 work |
| 4 | Add `playerId` to `MatchEventNotification` | **Cheap, now** | ~4 lines; prevents thread-4 rework |
| 5 | Sport-keyed rules table instead of a 2nd football-shaped structure | **Design, now** | Cheapest during Phase 2 |
| 6 | Two team stars replacing the dead Heart (`BUG-152`) | **Small feature** | Targeting already supports it |
| 7 | `vercel.json` crons + consolidate the two dead reminder routes | **Unblocker** | All of thread 2 is blocked on this |
| 8 | `/assets/` vs `/assests/` — broken OG image | **Bug, small** | 3 files |
| 9 | In-app WS toasts still single-tab-dependent | **Bug, medium** | The gap `BUG-200` fixed only for push |
| 10 | No persistent notification send log | **Tooling** | Flagged in `BUG-200`'s own evidence block |

Everything else in this document is explicitly **backlog for later**: close-game alerts (3),
player-follow send path (4), competition following (6), livestream empty-state redesign (8),
competition logos + Cloudinary migration (9).
