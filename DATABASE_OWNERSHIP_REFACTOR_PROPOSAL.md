# Database Ownership And Identity Refactor Proposal

## Why This Exists

The current database can run matches, teams, players, and competitions, but it does not model ownership and identity correctly for a university sports system.

The core domain problem is:

- one person can belong to multiple teams
- one institution can own multiple teams
- one environment can contain both institutional teams and private clubs
- a university can appear both as an institution and as a representative team

That means the system needs to distinguish:

- `person`
- `organization`
- `team`
- `membership / affiliation`

Right now those concepts are partially mixed together.

## What We Have Today

Observed from the live Turso database and [src/db/schema.ts](/c:/Users/LENOVO/OneDrive/Desktop/brixsports-v2/src/db/schema.ts):

- `teams`: 232 rows
- `players`: 179 rows
- `player_team_affiliations`: 0 rows
- `competitions`: 4 rows
- `competition_team_entries`: 82 rows
- `matches`: 59 rows
- `match_events`: 154 rows

### Current Core Tables

`teams`

- stores `name`, `sport`, `gender`
- stores `university` as plain text
- has no owner foreign key
- mixes true teams with institution-labeled teams

`players`

- stores one main `teamId`
- stores `university`, `college`, and `department` as plain text
- acts as both person identity and team membership

`player_team_affiliations`

- exists in schema
- intended to support many-to-many player/team links
- currently unused in live data

`competitions`

- stores `hostOrganization` as plain text
- has no linked organization table

### What The Current Model Really Means

The live production model is still effectively:

- one player -> one main team
- one team -> one plain-text university label
- one player -> plain-text university / college / department identity

That is why the system struggles with:

- Bells University as institution vs Bells University as team
- College of Computing teams
- private teams like Joga FC
- one person playing in multiple teams at the same time

## Real Examples From Live Data

The live data already shows the conflict:

- `Bells University` exists as a football team
- `Bells University of Technology Football (M)` also exists as a team
- `Kings FC`, `Pirates FC`, `Joga-Bonito`, and `Hammers` all exist as teams with `university = Bells University`
- players on those teams also carry `university`, `college`, and `department` directly on the player row

That means ownership is being implied by text fields instead of modeled explicitly.

## Domain Rules We Actually Need

### Rule 1: A Person Is One Identity

Miriam must exist once in the system.

She can:

- be a student of Bells University
- belong to College of Computing
- play for Bells University Football Team
- play for College of Computing Team
- play for Joga FC

But she must still be one person.

### Rule 2: Organizations Are Not Teams

Examples of organizations:

- Bells University
- College of Computing
- Department of Computer Science
- Joga FC

Examples of teams:

- Bells University Football Team
- College of Computing Football Team
- Joga FC First Team

Organization answers:

- who owns
- who governs
- who contains

Team answers:

- who competes

### Rule 3: Membership Must Be Separate From Identity

The person row should not be the place where team membership lives.

Instead:

- `person` stores identity
- `organization affiliation` stores institutional relationships
- `team membership` stores competitive relationships

## Target Architecture

The system should be organized into four layers.

### 1. Organizations

This is the missing foundation.

Suggested table: `organizations`

Fields:

- `id`
- `name`
- `slug`
- `type`
- `parentOrganizationId`
- `isInternalUnit`
- `status`
- `shortName`
- `displayName`
- `location`
- `metadata`
- `createdAt`
- `updatedAt`

Valid `type` examples:

- `university`
- `college`
- `department`
- `club`
- `academy`
- `association`
- `faculty`

Examples:

- Bells University
- College of Computing
- Department of Computer Science
- Joga FC

### 2. People

This is the single identity layer.

Suggested table: `people`

Fields:

- `id`
- `firstName`
- `lastName`
- `displayName`
- `email`
- `dateOfBirth`
- `gender`
- `photoUrl`
- `bio`
- `profileStatus`
- `createdAt`
- `updatedAt`

This table replaces the conceptual role currently being carried by `players`.

Notes:

- existing `players` can likely be evolved into `people` instead of being discarded
- sports-specific stats should continue to reference the stable person identity

### 3. Teams

Teams become purely competitive entities.

Suggested table: `teams`

Keep:

- `id`
- `name`
- `shortName`
- `logo`
- `sport`
- `gender`
- `color`

Add:

- `ownerOrganizationId`
- `teamType`
- `level`
- `ageGroup`
- `isRepresentative`
- `metadata`

Deprecate:

- `university` as ownership source of truth

`ownerOrganizationId` must point to `organizations.id`.

Examples:

- Bells University Football Team owned by Bells University
- College of Computing Team owned by College of Computing
- Joga FC First Team owned by Joga FC organization

### 4. Affiliations And Memberships

This is where the real flexibility comes from.

#### `person_organization_affiliations`

Stores institutional relationships.

Fields:

- `id`
- `personId`
- `organizationId`
- `affiliationType`
- `role`
- `status`
- `startDate`
- `endDate`
- `isPrimary`
- `metadata`

Examples:

- Miriam -> Bells University -> `student`
- Miriam -> College of Computing -> `student_member`
- Coach A -> Joga FC -> `staff`

#### `person_team_memberships`

Stores actual team participation.

Fields:

- `id`
- `personId`
- `teamId`
- `role`
- `membershipType`
- `status`
- `startDate`
- `endDate`
- `jerseyNumber`
- `position`
- `isPrimary`
- `metadata`

Examples:

- Miriam -> Bells University Football Team -> `player`
- Miriam -> College of Computing Team -> `player`
- Miriam -> Joga FC First Team -> `player`

This table should become the real successor to `player_team_affiliations`.

## How Miriam Should Look

### Person

```text
people
- id: person_miriam_001
- displayName: Miriam Adewale
```

### Organizations

```text
organizations
- org_bells_university
- org_bells_college_computing
- org_joga_fc
```

### Teams

```text
teams
- team_bells_football_m
  ownerOrganizationId = org_bells_university

- team_college_computing_football
  ownerOrganizationId = org_bells_college_computing

- team_joga_fc_first
  ownerOrganizationId = org_joga_fc
```

### Organization Affiliations

```text
person_organization_affiliations
- Miriam -> Bells University -> student
- Miriam -> College of Computing -> student_member
```

### Team Memberships

```text
person_team_memberships
- Miriam -> Bells University Football Team -> player
- Miriam -> College of Computing Team -> player
- Miriam -> Joga FC First Team -> player
```

That is the model the product domain is asking for.

## What Can Be Salvaged

The current schema is not useless. Some parts are solid and can remain largely intact.

Can be preserved with light changes:

- `matches`
- `match_events`
- `standings`
- `competition_team_entries`
- `transfers`
- `news`
- `users`
- sports stats tables

Needs restructuring:

- `teams`
- `players`
- `competitions.hostOrganization`
- all logic that assumes `player.teamId` is singular
- all logic that treats `team.university` as ownership

## Recommended Schema Direction

### New Tables

Introduce:

- `organizations`
- `person_organization_affiliations`
- `person_team_memberships`

Optional but useful:

- `organization_relationships` if parent-child needs more than a simple tree

### Existing Tables To Evolve

`players`

- evolve into `people`
- keep one row per human
- remove team membership as source of truth

`player_team_affiliations`

- rename conceptually to `person_team_memberships`
- start using it for all current and future memberships
- add lifecycle fields like `startDate`, `endDate`, `role`, `status`

`teams`

- add `ownerOrganizationId`
- keep `university` only as temporary display or migration field

`competitions`

- replace `hostOrganization` text with `hostOrganizationId`

## Migration Strategy

This should be phased. Do not do it as a big-bang rewrite.

### Phase 1: Introduce Organizations Without Breaking Existing Code

Add:

- `organizations`
- `teams.ownerOrganizationId`
- `competitions.hostOrganizationId`

Keep existing fields:

- `teams.university`
- `competitions.hostOrganization`

Backfill rules:

- create one organization for every current distinct team university
- create organizations for known internal units
- create organizations for known private clubs
- assign `teams.ownerOrganizationId`

At the end of Phase 1:

- UI still works
- ownership becomes explicit in data

### Phase 2: Separate Identity From Membership

Add or expand:

- `person_team_memberships`
- `person_organization_affiliations`

Backfill:

- for every player with `teamId`, create a membership row
- for every player with `university`, create an organization affiliation
- for every player with `college` and `department`, create organization affiliations where those units exist

At the end of Phase 2:

- every current player has at least one team membership row
- every player has a stable identity plus institutional links

### Phase 3: Dual-Read In Application Code

Update API and UI to prefer:

- memberships for player/team relationships
- organizations for ownership

Keep reading legacy fields as fallback during transition.

Examples:

- player profile pages
- team roster queries
- eligible player queries
- admin player management
- ratings and analytics endpoints
- search

### Phase 4: Make Membership The Source Of Truth

Stop using:

- `players.teamId` as main relationship

Stop using:

- `teams.university` as ownership source of truth

Use:

- `person_team_memberships`
- `person_organization_affiliations`
- `teams.ownerOrganizationId`

### Phase 5: Deprecate Legacy Fields

After all reads and writes are migrated:

- deprecate `players.teamId`
- deprecate `players.university`, `players.college`, and `players.department` as structural fields
- deprecate `teams.university` as structural field
- deprecate `competitions.hostOrganization` text

These fields can remain for export or caching if needed, but not as the canonical model.

## Known Blast Radius In This Codebase

The current app still relies heavily on singular player-team relationships and team university text.

Key dependency areas include:

- admin player pages
- player routes and compare routes
- team profile routes
- eligible-player routes
- football and basketball player APIs
- search and scouting
- competition registration
- standings and profile displays
- seeding scripts

Examples:

- [src/app/admin/players/page.tsx](/c:/Users/LENOVO/OneDrive/Desktop/brixsports-v2/src/app/admin/players/page.tsx)
- [src/app/api/players/route.ts](/c:/Users/LENOVO/OneDrive/Desktop/brixsports-v2/src/app/api/players/route.ts)
- [src/app/api/teams/[id]/route.ts](/c:/Users/LENOVO/OneDrive/Desktop/brixsports-v2/src/app/api/teams/[id]/route.ts)
- [src/app/api/matches/[id]/eligible-players/route.ts](/c:/Users/LENOVO/OneDrive/Desktop/brixsports-v2/src/app/api/matches/[id]/eligible-players/route.ts)
- [src/app/api/competitions/[id]/eligible-players/route.ts](/c:/Users/LENOVO/OneDrive/Desktop/brixsports-v2/src/app/api/competitions/[id]/eligible-players/route.ts)
- [src/lib/competition-player-eligibility.ts](/c:/Users/LENOVO/OneDrive/Desktop/brixsports-v2/src/lib/competition-player-eligibility.ts)

This is manageable, but it confirms that migration should be phased and API-led.

## Final Recommendation

The database should become:

- organization-centric for ownership
- person-centric for identity
- membership-centric for participation

The most important decisions are:

1. Add `organizations`
2. Add `teams.ownerOrganizationId`
3. Stop treating `players.teamId` as the real model
4. Start treating team membership as a separate table
5. Move institutional identity out of raw text fields and into affiliations

## Suggested Immediate Next Step

Implement the refactor in this order:

1. create `organizations`
2. create `person_organization_affiliations`
3. upgrade `player_team_affiliations` into the real membership table
4. add `ownerOrganizationId` to `teams`
5. backfill live data
6. update read paths before removing legacy writes

## Short Version

Current model:

- player row = person + team + institution
- team row = team + implied owner

Target model:

- person row = identity
- organization row = owner / container
- team row = competitive unit
- affiliation row = relationship

That is the model that correctly supports Bells, colleges, departments, and private clubs without duplicating people.
