# BrixSports — Platform Model
> Documented: 2026-06-11

## The Model: Google Drive, Not Shopify

BrixSports is a **shared platform** where all universities coexist,
not a multi-tenant system where each university gets an isolated instance.

The mental model is Google Drive:
- One platform, one database, all universities on it
- Users from Bells see Bells competitions surfaced first by default
- But they can discover Covenant, follow cross-university players,
  watch NUGA nationals — discoverability across universities is a
  feature, not a security concern
- Cross-university competitions (NUGA, NPUGA) are platform-level,
  visible to everyone
- Admin operations are scoped to their university — a Bells admin
  cannot manage Covenant data

## What This Is NOT

- NOT Shopify-style multi-tenancy (separate DB per university)
- NOT subdomain routing for tenant resolution (bells.brixsports.com)
- NOT hard data walls between universities
- NOT separate deployments per university

Separate databases would make cross-university competitions and
player discovery impossible. That discoverability is core to the vision.

## Current Schema Fit

The existing schema is ~80% correct for this model already:
- Self-referential org hierarchy (university → college → department) ✓
- Affiliation tables (players ↔ teams ✔ teams ↔ competitions) ✓
- platform-level competition support (hostOrganizationId nullable) ✓
- No hard tenant boundaries in queries ✓

## The Missing 20% (Build Before University 2 Onboards)

These gaps do not affect the Bells pilot. Build them before a second
university is onboarded — not before.

### 1. users.universityId FK
- Nothing in the schema links a user account to their university
- Required for: personalised feed ordering, admin scoping, 
  "your university" default filter
- Implementation: add universityId FK on users table pointing to 
  organizations (type='university'). Set during onboarding 
  ("which university are you from?")

### 2. Admin Permission Scoping
- role === 'admin' currently means global platform access
- Required for: Bells admin cannot see/edit Covenant data
- Options:
  A. Add scopeOrganizationId field on users table 
     (simple, single-org admins only)
  B. Separate admin_permissions table with 
     (userId, organizationId, permissionLevel) rows
     (flexible, supports multi-org admins like NUGA officials)
- Decision: make at implementation time. Option B is correct 
  long-term but Option A is sufficient for University 2 onboarding.

### 3. Affiliation-Aware Query Ordering
- GET /api/matches, GET /api/competitions etc. return everything 
  with no university-first ordering
- Required for: users see their university's content first, 
  not a random global feed
- Implementation: when authUser.universityId is set, ORDER BY 
  (competitionId IN university's competitions) DESC as a soft 
  preference signal — not a hard filter

## Cross-University Competitions

Two valid modelling approaches — convention not yet established:

Option A: hostOrganizationId = null (platform-level)
  - Competition belongs to no university
  - Visible to everyone by default
  - Simple — works today with existing schema

Option B: governing body as org (NUGA as its own organization)
  - Create NUGA as an organization in the hierarchy
  - governingOrganizationId = NUGA.id on the competition
  - More accurate — reflects real-world governing structure
  - Enables NUGA officials to have scoped admin access

Recommendation: use Option A for now (null host = platform-level).
Switch to Option B when NUGA admin access is needed.

## Implementation Order

1. Bells pilot — no multi-university features needed ← YOU ARE HERE
2. Before University 2 onboards:
   - Add users.universityId (schema migration + onboarding UI)
   - Add admin scoping (Option A first, Option B when needed)
3. After 2+ universities active:
   - Affiliation-aware feed ordering
   - Cross-university competition discovery UI
   - NUGA/governing body org model (Option B) if needed

## Backlog Reference

BACKLOG-014 — Platform multi-university model implementation
Filed: 2026-06-08
Status: OPEN — do not build until University 2 onboarding begins
