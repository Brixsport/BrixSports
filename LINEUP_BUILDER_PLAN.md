# Lineup Builder - Implementation Plan

## Overview
Transform the current lineup viewer into a full-featured lineup management system for creating, editing, and publishing match lineups.

## Core Features

### 1. Match Selection
- **Select a specific match** to create lineup for
- Filter matches by:
  - Status (UPCOMING only - can't edit lineups for LIVE/FINISHED matches)
  - Sport
  - Competition
  - Date range
- Display match details: Teams, Date, Venue, Competition

### 2. Team Roster Management
- **Load team roster** based on selected match
- Display all available players from both teams
- Show player details:
  - Name, Number, Position
  - Rating, Eye Points
  - Current status (available/injured/suspended)

### 3. Lineup Creation
- **Drag-and-drop interface** for positioning players
- **Formation selector** (4-3-3, 4-4-2, 3-5-2, etc.)
- **Position assignment**:
  - Visual pitch representation
  - Click to assign player to position
  - Validate position compatibility
- **Captain/Vice-captain selection**
- **Starting XI** (11 players for football, 5 for basketball)
- **Substitutes bench** (up to 7 subs for football, 7 for basketball)

### 4. Lineup States
- **Draft** - Work in progress, not visible to public
- **Published** - Locked and visible to everyone
- **Editable** - Can edit before match starts
- **Locked** - Cannot edit after match starts

### 5. Validation
- Ensure correct number of players (11 starters + subs)
- Validate formation (correct positions filled)
- Check for duplicates
- Ensure all players are from the correct team

### 6. Save & Publish
- **Save as draft** - Store in database, not published
- **Publish lineup** - Make visible to public, lock editing
- **Auto-save** - Periodic saves while editing
- **Edit published** - Allow edits before match starts

### 7. Public View
- Display published lineups on match pages
- Show formation visually
- Highlight captain/vice-captain
- Show bench players

## Database Schema

### Lineup JSON Structure (stored in matches.lineups)
```json
{
  "home": {
    "formation": "4-3-3",
    "starters": [
      {
        "playerId": "player-id",
        "position": "GK",
        "jerseyNumber": 1,
        "isCaptain": false,
        "isViceCaptain": false
      }
      // ... 10 more
    ],
    "substitutes": [
      {
        "playerId": "player-id",
        "position": "FW",
        "jerseyNumber": 12
      }
      // ... up to 6 more
    ],
    "status": "published", // draft | published
    "publishedAt": "2024-12-31T10:00:00Z",
    "publishedBy": "admin-id"
  },
  "away": {
    // same structure
  }
}
```

## UI Components

### 1. Match Selector Component
- Dropdown/List of upcoming matches
- Search and filter functionality
- Display match cards with key info

### 2. Formation Selector Component
- Visual formation picker
- Common formations for each sport
- Custom formation option

### 3. Pitch Visualizer Component
- Interactive football/basketball court
- Drag-and-drop player positioning
- Position labels and zones
- Responsive design

### 4. Player Pool Component
- Searchable list of available players
- Filter by position
- Drag source for lineup builder
- Show player stats

### 5. Lineup Summary Component
- List view of selected players
- Captain/Vice-captain badges
- Quick remove/swap actions
- Validation status

### 6. Action Bar Component
- Save Draft button
- Publish button
- Reset button
- Status indicator

## API Endpoints

### GET /api/matches?status=UPCOMING
- Fetch upcoming matches for lineup creation

### GET /api/matches/[id]/lineup
- Get current lineup for a match (draft or published)

### POST /api/matches/[id]/lineup
- Create/update lineup (draft)
- Body: { team: 'home'|'away', lineup: {...} }

### POST /api/matches/[id]/lineup/publish
- Publish lineup (lock it)
- Body: { team: 'home'|'away' }

### DELETE /api/matches/[id]/lineup
- Delete draft lineup

## User Flow

1. **Select Match** → Choose from upcoming matches
2. **Select Team** → Home or Away
3. **Choose Formation** → Pick formation template
4. **Build Lineup** → Drag players to positions
5. **Assign Roles** → Set captain/vice-captain
6. **Add Substitutes** → Select bench players
7. **Validate** → Check all requirements met
8. **Save/Publish** → Save draft or publish

## Access Control

- **Admin only** - Can create/edit/publish lineups
- **Public** - Can view published lineups
- **Loggers** - Can view published lineups (no edit)

## Next Steps

1. Create API endpoints for lineup management
2. Build Match Selector component
3. Build Formation Selector component
4. Build Interactive Pitch component with drag-and-drop
5. Build Player Pool component
6. Integrate components into Lineup Builder page
7. Add validation logic
8. Test with real data
9. Deploy and document

## Estimated Timeline

- API Endpoints: 2-3 hours
- UI Components: 4-6 hours
- Integration & Testing: 2-3 hours
- **Total: 8-12 hours**

---

**Note**: This is a significant feature. Should we proceed with full implementation, or would you like to prioritize specific parts first?
