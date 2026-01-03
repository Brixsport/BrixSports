# Stats Tab - Hardcoded Data Removal

## Issue
The Stats tab had hardcoded fallback values that would display zeros even when no data was available.

## Changes Made

### Before (Hardcoded)
```typescript
<StatRow label="Possession" values={match.stats.possession} suffix="%" />
<StatRow label="Expected Goals (xG)" values={match.stats.expectedGoals || [0, 0]} suffix="" /> // ❌ Hardcoded [0, 0]
<StatRow label="Total Shots" values={match.stats.shots} />
<StatRow label="Shots on Target" values={match.stats.shotsOnTarget} />
<StatRow label="Corners" values={match.stats.corners} />
<StatRow label="Fouls" values={match.stats.fouls} />
```

**Problems:**
- `expectedGoals || [0, 0]` - Shows [0, 0] even when no data exists
- No conditional rendering - tries to display all stats even if undefined
- Could cause errors if stats are missing

### After (Dynamic)
```typescript
{match.stats.possession && <StatRow label="Possession" values={match.stats.possession} suffix="%" />}
{match.stats.expectedGoals && <StatRow label="Expected Goals (xG)" values={match.stats.expectedGoals} suffix="" />}
{match.stats.shots && <StatRow label="Total Shots" values={match.stats.shots} />}
{match.stats.shotsOnTarget && <StatRow label="Shots on Target" values={match.stats.shotsOnTarget} />}
{match.stats.corners && <StatRow label="Corners" values={match.stats.corners} />}
{match.stats.fouls && <StatRow label="Fouls" values={match.stats.fouls} />}
{match.stats.yellowCards && <StatRow label="Yellow Cards" values={match.stats.yellowCards} />}
{match.stats.redCards && <StatRow label="Red Cards" values={match.stats.redCards} />}

{/* Show message if no stats available */}
{!match.stats.possession && !match.stats.shots && !match.stats.shotsOnTarget && 
 !match.stats.corners && !match.stats.fouls && (
  <div className="py-8 text-center text-white/40">
    No match statistics available yet
  </div>
)}
```

**Improvements:**
- ✅ No hardcoded fallback values
- ✅ Conditional rendering - only shows stats that exist
- ✅ Added Yellow Cards and Red Cards stats
- ✅ Graceful fallback message when no stats available
- ✅ No errors from undefined values

## Benefits

1. **Accurate Data Display**
   - Only shows real data from the database
   - No misleading zeros or empty values

2. **Better UX**
   - Clear message when stats aren't available yet
   - Users know the difference between "0" and "no data"

3. **Flexibility**
   - Can handle matches with partial stats
   - Works for both football and basketball (different stat types)

4. **Error Prevention**
   - No crashes from undefined values
   - Graceful degradation

## Example Scenarios

### Scenario 1: Match with Full Stats
```typescript
match.stats = {
  possession: [55, 45],
  shots: [12, 8],
  shotsOnTarget: [5, 3],
  corners: [6, 4],
  fouls: [10, 12],
  expectedGoals: [1.8, 1.2]
}
```
**Result:** All stats displayed with actual values

### Scenario 2: Match with Partial Stats
```typescript
match.stats = {
  possession: [60, 40],
  shots: [10, 5]
}
```
**Result:** Only Possession and Total Shots displayed, others hidden

### Scenario 3: Match with No Stats (Upcoming)
```typescript
match.stats = {}
```
**Result:** Shows "No match statistics available yet"

## Files Modified
- `src/components/MatchOverlay.tsx` - Stats tab section (lines 373-391)
