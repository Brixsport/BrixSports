# 🚀 Quick Start Guide - Competition Management

## Immediate Next Steps

### 1. Install Required Package
```bash
npm install date-fns
```

### 2. Apply Database Schema Changes
```bash
# Push schema changes to database
npm run db:push
# OR
npx drizzle-kit push:sqlite
```

### 3. Complete BUSA League (Kings FC Winners)
```bash
tsx src/db/complete-busa-league.ts
```

### 4. Add New 5-Aside Competitions
```bash
tsx src/db/add-5aside-competitions.ts
```

---

## Using the New Features

### Display Competitions on Homepage
```tsx
// In your homepage component
import CompetitionsShowcase from '@/components/CompetitionsShowcase';

export default function HomePage() {
  return (
    <main>
      <CompetitionsShowcase />
    </main>
  );
}
```

### Use Match Cards
```tsx
import MatchCard from '@/components/ui/MatchCard';

// Compact version (for lists)
<MatchCard match={matchData} variant="compact" />

// Live version (for featured matches)
<MatchCard match={matchData} variant="live" />

// Detailed version (for match pages)
<MatchCard match={matchData} variant="detailed" />
```

### Access Registration
Teams can register at:
```
http://localhost:3000/competitions/{competitionId}/register
```

---

## File Structure

```
src/
├── components/
│   ├── CompetitionRegistration.tsx    # Multi-step registration
│   ├── CompetitionsShowcase.tsx       # Homepage display
│   └── ui/
│       └── MatchCard.tsx               # SofaScore-style card
├── app/
│   ├── competitions/
│   │   └── [id]/
│   │       ├── register/
│   │       │   └── page.tsx            # Registration page
│   │       └── registration-success/
│   │           └── page.tsx            # Success page
│   └── api/
│       └── competitions/
│           ├── register/
│           │   └── route.ts            # Registration API
│           └── organized/
│               └── route.ts            # Organized competitions API
├── db/
│   ├── schema.ts                       # Updated schema
│   ├── complete-busa-league.ts         # Complete BUSA script
│   └── add-5aside-competitions.ts      # Add competitions script
└── lib/
    └── competition-templates.ts        # Updated templates
```

---

## Key Features

### ✅ 5-Aside Support
- Configurable players per side (5, 7, 11, etc.)
- Adjusted match durations
- Position templates for different formats

### ✅ Gender-Specific Competitions
- Male, Female, or Mixed
- Filtering and categorization
- Dedicated templates

### ✅ Team Registration
- Step 1: Team info (name, school, contact)
- Step 2: Players (unlimited with details)
- Step 3: Review & submit
- Admin approval workflow

### ✅ Competition Lifecycle
- **Upcoming** → Open for registration
- **Ongoing** → Live matches
- **Completed** → Winners recorded
- **Archived** → Hidden from main views

### ✅ Homepage Organization
- Featured competitions
- Open for registration
- Live matches
- Recent champions

---

## Competition Status Management

### Mark Competition as Completed
```typescript
// Update competition status
await db.update(competitions)
  .set({
    status: 'completed',
    winnerId: teamId,
    completedAt: new Date(),
    isFeatured: false,
    displayOrder: 999,
  })
  .where(eq(competitions.id, competitionId));
```

### Feature a Competition
```typescript
await db.update(competitions)
  .set({
    isFeatured: true,
    displayOrder: 1, // Lower = higher priority
  })
  .where(eq(competitions.id, competitionId));
```

### Open Registration
```typescript
await db.update(competitions)
  .set({
    registrationOpen: true,
    registrationDeadline: new Date('2026-03-01'),
    maxTeams: 12,
  })
  .where(eq(competitions.id, competitionId));
```

---

## API Usage

### Get Organized Competitions
```typescript
const response = await fetch('/api/competitions/organized');
const { competitions, stats } = await response.json();

// competitions.featured - Featured competitions
// competitions.upcoming - Open for registration
// competitions.ongoing - Currently active
// competitions.completed - Finished with winners
```

### Submit Team Registration
```typescript
const response = await fetch('/api/competitions/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    competitionId,
    teamInfo: {
      teamName: 'University of Lagos FC',
      schoolName: 'University of Lagos',
      shortName: 'UNILAG',
      contactName: 'John Doe',
      contactEmail: 'john@example.com',
      contactPhone: '+234 XXX XXX XXXX',
      // ... other fields
    },
    players: [
      {
        name: 'Player Name',
        number: 10,
        position: 'Midfielder',
        // ... other fields
      },
      // ... more players
    ],
  }),
});
```

---

## Database Schema Quick Reference

### Competitions Table
```typescript
{
  // Basic info
  name, sport, format, season, startDate, endDate,
  
  // Format details
  playersPerSide: 5 | 7 | 11,
  gender: 'male' | 'female' | 'mixed',
  
  // Registration
  registrationOpen: boolean,
  registrationDeadline: Date,
  maxTeams: number,
  
  // Status
  status: 'upcoming' | 'ongoing' | 'completed' | 'archived',
  
  // Winners
  winnerId, runnerUpId, thirdPlaceId,
  completedAt, finalStandings, highlights,
  
  // Display
  isFeatured, isArchived, displayOrder
}
```

### Team Registrations Table
```typescript
{
  competitionId, teamName, schoolName, shortName,
  logo, color, contactName, contactEmail, contactPhone,
  status: 'pending' | 'approved' | 'rejected',
  playersSubmitted, numberOfPlayers,
  approvedBy, approvedAt, createdTeamId
}
```

---

## Common Tasks

### Create a New Competition
```typescript
await db.insert(competitions).values({
  id: nanoid(),
  name: 'NPUGA 5-Aside Championship',
  sport: 'Football',
  format: 'knockout',
  playersPerSide: 5,
  gender: 'mixed',
  registrationOpen: true,
  registrationDeadline: new Date('2026-03-01'),
  maxTeams: 12,
  status: 'upcoming',
  isFeatured: true,
  displayOrder: 1,
});
```

### Approve Team Registration
```typescript
// 1. Get registration
const registration = await db.query.teamRegistrations.findFirst({
  where: eq(teamRegistrations.id, registrationId),
});

// 2. Create team
const teamId = nanoid();
await db.insert(teams).values({
  id: teamId,
  name: registration.teamName,
  shortName: registration.shortName,
  // ... other fields
});

// 3. Create players
const players = await db.query.registeredPlayers.findMany({
  where: eq(registeredPlayers.registrationId, registrationId),
});

for (const player of players) {
  await db.insert(players).values({
    id: nanoid(),
    teamId,
    name: player.name,
    number: player.number,
    // ... other fields
  });
}

// 4. Update registration
await db.update(teamRegistrations)
  .set({
    status: 'approved',
    approvedBy: adminId,
    approvedAt: new Date(),
    createdTeamId: teamId,
  })
  .where(eq(teamRegistrations.id, registrationId));
```

---

## Troubleshooting

### Issue: Competitions not showing
**Solution:** Check the status and archived flags
```typescript
// Make sure competition is not archived
isArchived: false

// Set appropriate status
status: 'upcoming' | 'ongoing'

// Feature it if needed
isFeatured: true
```

### Issue: Registration page not accessible
**Solution:** Ensure registration is open
```typescript
registrationOpen: true
registrationDeadline: future date
status: 'upcoming'
```

### Issue: Match card not rendering
**Solution:** Install date-fns
```bash
npm install date-fns
```

---

## What's Next?

1. **Apply database changes** - `npm run db:push`
2. **Complete BUSA League** - Mark Kings FC as winners
3. **Add NPUGA competition** - 5-aside, open for registration
4. **Update homepage** - Use CompetitionsShowcase component
5. **Test registration flow** - Register a test team
6. **Implement live updates** - Follow SOFASCORE-IMPLEMENTATION-PLAN.md

---

## Documentation Files

- `IMPLEMENTATION-SUMMARY.md` - Complete feature overview
- `5-ASIDE-REGISTRATION-GUIDE.md` - Registration system guide
- `SOFASCORE-IMPLEMENTATION-PLAN.md` - Future roadmap
- `QUICK-START.md` - This file

---

**You're all set! 🚀 Start with the database migration and then add your competitions.**
