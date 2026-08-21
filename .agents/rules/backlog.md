---
activation: always_on
---

# BACKLOG.md Maintenance Protocol

> **ENFORCE: Never commit a fix without closing or updating its corresponding backlog entry in the same commit.**

Referenced from `CLAUDE.md` → Definition of Done → Backlog Close.

## Backlog Close — Mandatory Before Moving On

Before committing or starting the next task, update `.agents/dev/BACKLOG.md`:

1. **Bug fixed** → change `**Status:** OPEN` to `**Status:** RESOLVED — YYYY-MM-DD (commit <hash>)` and strike through the heading (`~~BUG-XXX~~`). Move to Bugs (Resolved) section if it is in Bugs (Open).
2. **Feature complete** → change `**Status:** OPEN` to `**Status:** COMPLETE — YYYY-MM-DD`. Strike through the heading if the item is fully done.
3. **Partially resolved** → update the status line with what changed and what remains open. Never leave the status line unchanged after a partial fix.
4. **Stale blocker note** → if the fix removes a dependency that another item listed (e.g. "Blocked by BUG-XXX"), update that item's notes too.
5. **Priority drift** → if resolving this item changes the priority of a related item, update that item's `**Priority:**` line.

## Mandatory Lifecycle States

Every BACKLOG/BUG entry must use one of these states — not freeform text:

| State | Meaning |
|-------|---------|
| `OPEN` | Known, not yet started |
| `IN PROGRESS` | Active this session |
| `SHIPPED` | Code committed. Live test NOT yet run. Do not treat as done. |
| `UNVERIFIED` | Test run attempted but result disputed or incomplete |
| `RESOLVED` | Live-tested, evidence block attached (see below) |
| `WONT FIX` | Consciously deferred — reason documented |

`SHIPPED` is never a final state. It must advance to `RESOLVED` or `UNVERIFIED` after a test run.

## Mandatory Evidence Block for RESOLVED

Every entry moving to `RESOLVED` must include an evidence block:

```
**Evidence:**
- Commit: <hash>
- Verified by: <live test | staging smoke test | DB query | manual check>
- Observed result: <what was seen — not what was expected>
- Pending items: <any remaining actions, or "none">
```

No evidence block = the entry is `SHIPPED`, not `RESOLVED`. This is not optional.

## What Does NOT Count as Evidence

The following are explicitly invalid as evidence for RESOLVED — they demonstrate the fix ran, not that it worked correctly:

- "The UI showed X" — client state is computed locally and may diverge from DB
- "All requests returned 201/200" — a 201 confirms row insertion, not correctness of the data written
- "The logger showed score Y" — logger score is derived from locally dispatched events, not from `matches.homeScore` / `matches.awayScore`
- "No errors in console" — absence of error is not presence of correct state
- "Smoke test passed" — only counts if the smoke test explicitly reads back the DB state and confirms it matches expected values

**For any bug that writes data to the DB**: evidence must include a DB query result showing the actual stored values match expected values. Screenshots and HTTP response codes are supporting context, not proof.
