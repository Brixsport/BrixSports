# BUSA League Football - Database Seeding Guide

## Overview
This guide explains how to seed the BUSA League Football competition data into your database.

## What Gets Seeded

### 1. Teams (16 total)
- **Group A**: Joga-Bonito, Wolves FC, Westbridge, Prime FC
- **Group B**: Kings FC, Hammers, Cruise FC, Santos
- **Group C**: Legacy FC, Agenda FC, Allianz FC, La Fabrica
- **Group D**: Underrated FC, Quantum FC, Pirates FC, Deadline FC

### 2. Matches (27 total)
- Group Stage: 23 matches (all FINISHED)
- Quarter Finals: 4 matches (all FINISHED)
- Semi-Finalists: Joga-Bonito, Kings FC, Hammers, Pirates FC

### 3. Player Rosters (67 players for semi-finalists)
- **Kings FC**: 13 players
- **Joga-Bonito**: 22 players
- **Pirates FC**: 18 players
- **Hammers**: 14 players

### 4. Standings
- Group standings calculated from match results
- 16 standings entries (one per team per group)

## Prerequisites

### Environment Variables
Make sure your `.env` file has the following variables set:
```env
TURSO_CONNECTION_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
```

## Seeding Steps

### Step 1: Seed Teams and Matches
Run the main seeding script to insert all teams, matches, and standings:

```bash
npx tsx src/db/seed-busa-football.ts
```

**What this does:**
- Creates 16 teams with actual logos from `/assests/Logos/football/`
- Inserts 27 matches with real scores and dates
- Calculates and inserts group standings
- **Does NOT insert any player data** (to avoid mock data)

### Step 2: Import Player Rosters
After teams are seeded, import the actual player rosters:

```bash
npx tsx src/db/import-player-rosters.ts
```

**What this does:**
- Inserts 67 real players for the 4 semi-finalist teams
- Maps position codes (DM, AM, CF, etc.) to standard positions
- Sets default ratings (7.0) that can be updated later
- Sets eyePoints to 0 (will be calculated from match events)

## Data Structure

### Team Logos
All team logos are stored in: `/public/assests/Logos/football/`
- Format: `.jpg` or `.png`
- Referenced in database as: `/assests/Logos/football/team-name.jpg`

### Player Positions
Position mapping:
- `GK` → Goalkeeper
- `CB` → Center Back
- `LB` → Left Back
- `RB` → Right Back
- `DM` → Defensive Midfielder (CDM)
- `CM` → Central Midfielder
- `AM` → Attacking Midfielder (CAM)
- `LW` → Left Winger
- `RW` → Right Winger
- `CF` → Center Forward (ST)

### Match Data
- **Group Stage**: Matches organized by groups (A, B, C, D)
- **Quarter Finals**: Top 2 from each group advanced
- **Competition Name**: 
  - Group matches: `BUSA League Football - Group X`
  - Knockout: `BUSA League Football - Quarter Finals`
- **Venue**: All matches at `BELLS UNIVERSITY FOOTBALL PITCH`

## Verification

After seeding, verify the data:

1. **Check Teams**:
   ```sql
   SELECT COUNT(*) FROM teams WHERE sport = 'Football';
   -- Should return: 16
   ```

2. **Check Matches**:
   ```sql
   SELECT COUNT(*) FROM matches WHERE competition LIKE 'BUSA League Football%';
   -- Should return: 27
   ```

3. **Check Players**:
   ```sql
   SELECT teamId, COUNT(*) as player_count 
   FROM players 
   WHERE teamId IN ('busa-joga', 'busa-kings', 'busa-hammers', 'busa-pirates')
   GROUP BY teamId;
   -- Should return:
   -- busa-joga: 22
   -- busa-kings: 13
   -- busa-hammers: 14
   -- busa-pirates: 18
   ```

4. **Check Standings**:
   ```sql
   SELECT COUNT(*) FROM standings WHERE competition LIKE 'BUSA League Football%';
   -- Should return: 16 (one per team)
   ```

## Next Steps

After seeding:
1. **Add Semi-Final Matches**: Create matches for the semi-finals
2. **Add Final Match**: Create the championship match
3. **Update Player Stats**: Import detailed player statistics if available
4. **Add Match Events**: Import detailed match events for completed games

## Troubleshooting

### Database Connection Error
```
LibsqlError: URL_INVALID: The URL 'undefined' is not in a valid format
```
**Solution**: Check that `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` are set in your `.env` file

### Duplicate Key Error
```
UNIQUE constraint failed: teams.id
```
**Solution**: The data has already been seeded. Clear the tables first or use a different database.

### Position Mapping Issues
If a position code is not recognized, it defaults to `CM` (Central Midfielder). Check the `mapPosition` function in `import-player-rosters.ts` to add new position mappings.

## Files Reference

- **Main Seed Script**: `src/db/seed-busa-football.ts`
- **Player Import Script**: `src/db/import-player-rosters.ts`
- **Database Schema**: `src/db/schema.ts`
- **Team Logos**: `public/assests/Logos/football/`

---

**Competition**: BUSA League Football  
**Season**: 2024/2025  
**Format**: Group Stage (4 groups of 4) → Quarter Finals → Semi Finals → Final  
**Total Teams**: 16  
**Semi-Finalists**: Joga-Bonito, Kings FC, Hammers, Pirates FC
