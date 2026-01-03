# Removing Hardcoded Data from Match Overlay

## Overview
Eliminated all hardcoded data from the `MatchOverlay` component by implementing dynamic data fetching from the API.

## Changes Made

### 1. **Match Overlay Component** (`src/components/MatchOverlay.tsx`)

#### Added State Management
```typescript
const [players, setPlayers] = useState<Record<string, Player>>({});
const [loadingPlayers, setLoadingPlayers] = useState(false);
```

#### Added Player Data Fetching
- Implemented `useEffect` hook to fetch player data when lineups or scout tabs are opened
- Only fetches missing players to avoid redundant API calls
- Caches fetched players in state for performance

```typescript
useEffect(() => {
  const needsPlayers = (activeTab === 'lineups' || activeTab === 'scout') && match.lineups;
  if (!needsPlayers || loadingPlayers) return;

  const playerIds = [
    ...(match.lineups?.home.map(e => e.playerId) || []),
    ...(match.lineups?.away.map(e => e.playerId) || [])
  ];

  const missingPlayers = playerIds.filter(id => !players[id]);
  if (missingPlayers.length === 0) return;

  // Fetch players from API
  fetchPlayers();
}, [activeTab, match.lineups, players, loadingPlayers]);
```

#### Removed Hardcoded Player Data
**Before:**
```typescript
const player: Player = {
  id: entry.playerId,
  name: 'Player ' + entry.playerId.slice(-4), // ❌ Hardcoded
  number: 0, // ❌ Hardcoded
  position: entry.position || 'Unknown', // ❌ Hardcoded fallback
  teamId: match.homeTeamId
};
```

**After:**
```typescript
const player = players[entry.playerId]; // ✅ From API
if (!player) return null; // ✅ Graceful handling
```

#### Removed Hardcoded Team Data
**Before:**
```typescript
homeTeam: match.homeTeam || { 
  id: '', 
  name: 'Home', // ❌ Hardcoded
  shortName: 'HOM', // ❌ Hardcoded
  logo: '', 
  color: '#000' // ❌ Hardcoded
}
```

**After:**
```typescript
{match.homeTeam && match.awayTeam ? (
  <MatchPredictionCard
    match={{
      id: match.id,
      homeTeam: match.homeTeam, // ✅ From match data
      awayTeam: match.awayTeam, // ✅ From match data
      startTime: match.startTime,
      competition: match.competition,
    }}
  />
) : (
  <div>Team data not available</div> // ✅ Graceful fallback
)}
```

#### Added Loading States
- Shows "Loading players..." while fetching player data
- Shows "Team data not available" when team data is missing
- Prevents rendering incomplete data

### 2. **Players API Endpoint** (`src/app/api/players/route.ts`)

#### Added Support for Multiple Query Parameters

**Fetch by IDs:**
```typescript
GET /api/players?ids=player1,player2,player3
```

**Fetch by Team:**
```typescript
GET /api/players?teamId=team123
```

**Search by Name:**
```typescript
GET /api/players?search=John
```

**Fetch All:**
```typescript
GET /api/players
```

#### Updated Response Format
All responses now include a consistent format:
```typescript
{
  success: true,
  players: [...] // Array of player objects
}
```

#### Added Drizzle ORM Operators
```typescript
import { eq, inArray, or, like } from 'drizzle-orm';
```

- `inArray`: For fetching multiple players by IDs
- `like`: For search functionality
- `or`: For searching across multiple fields (name, jerseyName)

## Benefits

### 1. **No More Hardcoded Data**
- All player names, numbers, and positions come from the database
- All team data comes from match object
- No fallback hardcoded values

### 2. **Better Performance**
- Players are cached after first fetch
- Only missing players are fetched
- Lazy loading - data fetched only when needed

### 3. **Better UX**
- Loading states inform users when data is being fetched
- Graceful error handling when data is unavailable
- No confusing placeholder data

### 4. **Maintainability**
- Single source of truth (database)
- Easy to update player data
- No need to update component when data changes

### 5. **Scalability**
- API supports batch fetching
- Efficient queries with Drizzle ORM
- Can handle large numbers of players

## API Usage Examples

### Fetch Players for Match Lineups
```typescript
const playerIds = match.lineups.home.map(e => e.playerId);
const response = await fetch(`/api/players?ids=${playerIds.join(',')}`);
const { success, players } = await response.json();
```

### Search for Player
```typescript
const response = await fetch(`/api/players?search=John Doe`);
const { success, players } = await response.json();
```

### Get Team Players
```typescript
const response = await fetch(`/api/players?teamId=team123`);
const { success, players } = await response.json();
```

## Files Modified

1. `src/components/MatchOverlay.tsx`
   - Added player state and fetching logic
   - Removed all hardcoded player data
   - Removed hardcoded team fallbacks
   - Added loading states

2. `src/app/api/players/route.ts`
   - Added support for `ids` query parameter
   - Added support for `search` query parameter
   - Updated response format to include `success` flag
   - Added proper error handling

## Testing Checklist

- [ ] Lineups tab loads player data correctly
- [ ] Scout report tab loads player data correctly
- [ ] Loading states display while fetching
- [ ] Graceful fallback when data unavailable
- [ ] Predict tab works without hardcoded team data
- [ ] Poll tab works without hardcoded team data
- [ ] API returns correct players by IDs
- [ ] API search functionality works
- [ ] No console errors or warnings
