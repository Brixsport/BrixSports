# Football Overlay - Scout Report to Standings

## Change Summary
Replaced the "Scout Report" tab with a "Standings" tab in the football match overlay to show league table standings instead of player ratings.

## Why This Change?

### Before: Scout Report
- Showed player ratings from both teams
- Duplicated the Lineups tab functionality
- Less relevant for football context

### After: Standings
- Shows full league table for the competition
- Highlights the two teams playing in the match
- More contextual and useful for understanding match importance
- Matches basketball overlay structure

## Implementation Details

### 1. Tab Configuration
```typescript
// Before
{ id: 'scout', label: 'Scout Report', icon: Star }

// After
{ id: 'standings', label: 'Standings', icon: Table }
```

### 2. State Management
Added new state for standings data:
```typescript
const [standings, setStandings] = useState<any[]>([]);
const [loadingStandings, setLoadingStandings] = useState(false);
```

### 3. Data Fetching
Fetches standings when tab is opened:
```typescript
useEffect(() => {
  if (activeTab !== 'standings' || loadingStandings || standings.length > 0) return;

  const fetchStandings = async () => {
    setLoadingStandings(true);
    try {
      const response = await fetch(`/api/standings?competition=${encodeURIComponent(match.competition)}`);
      const data = await response.json();
      if (data.success && data.standings) {
        setStandings(data.standings);
      }
    } catch (error) {
      console.error('Error fetching standings:', error);
    } finally {
      setLoadingStandings(false);
    }
  };

  fetchStandings();
}, [activeTab, match.competition, standings, loadingStandings]);
```

### 4. Standings Table

**Columns:**
- **Pos** - Position in table
- **Team** - Team name with logo
- **P** - Played
- **W** - Won (green)
- **D** - Drawn (yellow)
- **L** - Lost (red)
- **GF** - Goals For
- **GA** - Goals Against
- **GD** - Goal Difference (colored based on +/-)
- **Pts** - Points (highlighted)

**Features:**
- Team logos displayed using Next.js Image component
- Teams in current match are highlighted with primary color background
- First place team has primary colored position number
- Goal difference shows + for positive values
- Responsive table with horizontal scroll on mobile
- Loading state with spinner
- Empty state when no standings available

### 5. Team Highlighting
```typescript
const isHomeTeam = standing.team?.id === match.homeTeamId;
const isAwayTeam = standing.team?.id === match.awayTeamId;
const isHighlighted = isHomeTeam || isAwayTeam;
```

Highlighted teams get:
- `bg-primary/10` background
- `border-primary/20` border
- Makes it easy to see where the competing teams stand

## Benefits

1. **More Contextual Information**
   - Shows league position of both teams
   - Helps understand match importance
   - Shows form and performance context

2. **Better UX**
   - Eliminates duplicate functionality (Scout Report was similar to Lineups)
   - Provides unique value in each tab
   - Matches basketball overlay structure

3. **Visual Clarity**
   - Color-coded stats (W/D/L)
   - Highlighted teams in the match
   - Clear table structure

4. **Performance**
   - Lazy loading - only fetches when tab is opened
   - Caches data after first fetch
   - Loading states for better UX

## Tab Structure Now

1. **Overview** - Match summary and info
2. **Lineups** - Team squads with player details
3. **Stats** - Match statistics
4. **Timeline** - Match events chronologically
5. **Standings** - League table (NEW!)
6. **Predict** - Score prediction (upcoming matches)
7. **Poll** - Fan voting (upcoming matches)
8. **Chat** - Live chat (live matches)

## API Endpoint Used
```
GET /api/standings?competition={competitionName}
```

Returns:
```json
{
  "success": true,
  "standings": [
    {
      "id": "...",
      "team": { "id": "...", "name": "...", "logo": "..." },
      "played": 10,
      "won": 7,
      "drawn": 2,
      "lost": 1,
      "goalsFor": 20,
      "goalsAgainst": 8,
      "goalDifference": 12,
      "points": 23
    }
  ]
}
```

## Files Modified
- `src/components/MatchOverlay.tsx`
  - Updated tab configuration
  - Added standings state
  - Added standings fetching logic
  - Replaced Scout Report tab with Standings tab

## Consistency with Basketball
Both football and basketball overlays now have:
- Overview
- Lineups
- Stats
- Timeline/Events
- **Standings** ✅
- Conditional tabs (Predict, Poll, Chat)

This creates a consistent experience across sports while respecting sport-specific differences.
