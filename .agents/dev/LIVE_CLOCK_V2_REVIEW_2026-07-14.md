# Live Clock v2 — Review Note (Session 43)
**Status:** NOTE — does not modify `LIVE_CLOCK_V2_ARCHITECTURE.md`, read alongside it
**Trigger:** session 42's live match test (logger on mobile, viewer watched independently, real Railway restart) produced BUG-108/109/111/112/113/114 — the first real-world data this design has been checked against since it was drafted 2026-06-30/07-01 from code-reading and Directive 6's trace alone.

---

## Verdict

The design in `LIVE_CLOCK_V2_ARCHITECTURE.md` is not wrong and does not need to be re-derived. Its five named structural risks (§1) and the algorithms fixing them (§4.1-4.5 — carry-forward delta cap, timestamp projection, catch-up multiplier, backwards-jump guard, degraded-duration check) all remain valid, still worth building, still backed by the research in §7. Nothing found in the live test contradicts any of that work.

## The blind spot the live test found

Every mechanism in the doc lives only in memory — the logger's tab state, the viewer's `useMatchTimer` hook (§3). Nothing in the design writes a clock value anywhere durable. The design handles the clock being *bumpy* (backgrounded phone, brief drop, delayed correction) — it does not handle the clock having **nothing to converge from or fall back to**, because:

- No first payload has ever arrived yet (cold page load), or
- No payload will ever arrive again for that session (a dead socket that never recovers)

`matches` has no `minute` column at all (confirmed by reading `src/db/schema.ts:302-343` directly, not inferred from the bug filing). §6 "Known Limitations" lists three deliberately-accepted gaps (clock sync precision, 5s cadence vs. event channel, iOS EU PWA) — total absence of a durable fallback isn't one of them. It wasn't scoped out on purpose; it was never examined, because this doc was drafted from code-reading, before a real live match with a real server restart existed to test it against.

**BUG-109** (matches table has zero persisted clock state) is the direct, confirmed instance of this gap. **BUG-114** (a tab stuck past max reconnection attempts, real root cause unconfirmed due to a logging bug in `useWebSocket.tsx`) is a second instance of the same underlying assumption failing — the doc's §4.2/§8-item-6 reconnection work targets resilience, not this failure mode, and doesn't know the specific logging bug exists.

## Scope this doc explicitly disclaims — still open regardless

§6 states directly: "the clock and the event feed are independent data streams; this design only touches the former." So **BUG-108** (DB write and live broadcast for a match *event* are fully uncoordinated) was never this doc's problem and isn't fixed by shipping it as-is. No design currently owns that gap.

## Sequencing conclusion

The durable checkpoint that BUG-109 introduces is a prerequisite layer underneath this design, not a competing direction — it doesn't conflict with §2's "logger remains sole time authority" principle, since the logger would still be the one writing the checkpoint, just to a durable store in addition to the ephemeral WS channel. It belongs as a "Phase 0," before `LIVE_CLOCK_V2_ARCHITECTURE.md §8`'s own build sequence, not a rewrite of it.

This gives concrete, code-level backing to the call already made at the end of session 42 (`BUILD_JOURNAL.md`): the full v2 smoothing model was deferred as likely oversized even before the live test, and BUG-109 was named as upstream of everything that model assumes. That read holds up.

**Practical implication:** BUG-109 must be resolved before any v2 build directive is issued — not as a priority preference, but because v2's algorithms have nothing to seed from or fall back to without it.
