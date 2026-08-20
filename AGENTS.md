# BrixSports — Cross-Tool Agent Rules
# Works in: Claude Code, Google Antigravity, Cursor
# For tool-specific rules see: CLAUDE.md (Claude Code) or GEMINI.md (Antigravity)

## Project Tier
MVP → moving toward PRODUCTION

## Stack
Next.js App Router · TailwindCSS · Turso/LibSQL · Drizzle ORM · Custom JWT (jose) · Cloudinary · Sentry · PWA

## Non-Negotiable Rules (all tools)

1. Every /api/admin/* route must verify getAuthUser() AND user.role === 'admin'
2. Every list query must have a .limit() clause
3. No raw SQL — Drizzle query builder only
4. All DB operations in try/catch/finally
5. createdBy/updatedBy must come from verified session — never hardcoded
6. Public API must never expose: assignedLoggers, assignedLoggers.email, approvedBy, approvalStatus, managerNotes, loggerId, profileId, organizationAffiliations, memberships
7. All test/seed artifacts go in /dev/ at project root
8. Never return raw DB errors to the client
9. Never touch 🔴 High Volatility features without an explicit brief

## Three Critical Flows — Never Break
- Flow A: Admin creates match → assigns loggers → appears on public livescore
- Flow B: Logger logs event → saves to DB → public score updates in real time
- Flow C: Viewer opens page → sees live match → updates without refresh

## Active Bug Zones (Do Not Touch Without Brief)
- BUG-002: User management admin panel
- BUG-003: src/app/api/auth/test/route.ts — delete this file
- BUG-004: Transfers page
- BUG-006: News/articles (XSS)
