---
trigger: always_on
---

> **ENFORCE: All rules in this file are blocking. Violations must be surfaced and resolved before any implementation proceeds.**

# BrixSports — Workspace Rules (Antigravity / Gemini)

This file exists for tool compatibility with Google Antigravity. The canonical, actively-maintained ruleset is `CLAUDE.md` at the project root — see it for: Project Tier, Stack, Scope Boundaries, Explicit Out of Scope, Actor Model, Three Critical Flows, Architecture Rules, Public API banned fields, Feature Volatility, Anti-Patterns, Error Handling Rules, PWA/Mobile Rules, Structured Output template, Context Log template, Definition of Done, and the Live Event Readiness Checklist.

**Where anything in this file appears to conflict with `CLAUDE.md`, `CLAUDE.md` wins.** (Past drift example, now resolved: this file previously still listed push notification campaigns as out-of-scope after `CLAUDE.md` brought push notifications into scope — session 50 decision, see `BACKLOG.md` `BUG-204`/`BACKLOG-211`/`BACKLOG-212`.)

---

## Final Directive

Build Brixsports as:

- **reliable during live events** — a match running cleanly beats ten unshipped features
- **honest about errors** — never hide failures from operators or loggers
- **simple for non-technical users** — loggers are not developers
- **defensible at the API layer** — public endpoints expose only what viewers need

Not:

- over-engineered
- feature-complete before stable
- dependent on a single point of failure

---

## Cross-Project Knowledge

Read at session start: `C:\Users\Wise\.gemini\antigravity\knowledge\global-patterns\artifacts\patterns.md`
Apply all anti-patterns, settled decisions, and stack gotchas recorded there.

Note: `CLAUDE.md` (Claude Code) points to a different patterns file at `~/.claude/knowledge/global-patterns/patterns.md` — intentional, a separate tool ecosystem's knowledge store, not drift.
