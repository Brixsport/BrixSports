# Quick Start Guide - New Features

## 🚀 Getting Started with New Features

This guide will help you quickly start using the newly implemented features in Brix V2.

---

## 1. Competition Bulk Operations

### Creating Multiple Competitions at Once

**Step 1:** Prepare your competitions data
```javascript
const competitionsData = [
  {
    name: "Premier League 2024",
    sport: "Football",
    format: "league",
    season: "2024/2025",
    numberOfTeams: 8,
    level: "inter-university",
    scope: "internal"
  },
  {
    name: "Basketball Championship",
    sport: "Basketball",
    format: "knockout",
    season: "2024/2025",
    numberOfTeams: 16,
    level: "college",
    scope: "internal"
  }
];
```

**Step 2:** Send bulk create request
```javascript
const response = await fetch('/api/competitions/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ competitions: competitionsData })
});

const result = await response.json();
console.log(`Created ${result.count} competitions!`);
```

### Bulk Deleting Competitions

```javascript
// Select competitions to delete
const competitionIds = ['comp-1', 'comp-2', 'comp-3'];

// Send delete request
const response = await fetch('/api/competitions/bulk', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: competitionIds })
});

const result = await response.json();
console.log(`Deleted ${result.count} competitions`);
```

---

## 2. Competition Templates

### Viewing Available Templates

```javascript
// Get all templates
const response = await fetch('/api/competitions/templates');
const data = await response.json();
console.log(`Available templates: ${data.total}`);

// Get Football templates only
const footballResponse = await fetch('/api/competitions/templates?sport=Football');
const footballData = await footballResponse.json();
```

### Using a Template

**Step 1:** Choose a template
- `football-league-8` - 8-team football league
- `basketball-knockout-8` - 8-team basketball knockout
- `football-group-knockout-16` - 16-team Champions League style
- And more...

**Step 2:** Apply the template
```javascript
const response = await fetch('/api/competitions/templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: 'football-league-8',
    season: '2024/2025',
    name: 'My Custom League Name',  // Optional
    startDate: '2025-01-15',        // Optional
    endDate: '2025-06-30'           // Optional
  })
});

const result = await response.json();
console.log(`Created: ${result.competition.name}`);
```

### Available Template IDs

**Football:**
- `football-league-8`
- `football-knockout-16`
- `football-group-knockout-16`
- `busa-football-league`
- `college-football-cup`
- `freshers-football-tournament`

**Basketball:**
- `basketball-league-6`
- `basketball-knockout-8`
- `basketball-group-knockout-12`
- `busa-basketball-league`
- `department-basketball-league`

---

## 3. Using the Enhanced Admin UI

### Accessing the Enhanced Admin Page

1. Navigate to `/admin/competitions`
2. You'll see the new features:
   - **Bulk Selection**: Checkboxes next to each competition
   - **Use Template**: Purple button in header
   - **Export**: Download button
   - **Bulk Delete**: Appears when items are selected

### Bulk Operations Workflow

**Step 1:** Select competitions
- Click checkbox next to each competition
- Or click "Select All" to select everything

**Step 2:** Perform action
- Click "Delete (X)" button to bulk delete
- Confirm in the dialog

**Step 3:** Review results
- Toast notification shows success/error
- Selected items are cleared

### Using Templates in Admin UI

**Step 1:** Click "Use Template" button

**Step 2:** Browse template cards
- Each card shows:
  - Template name
  - Description
  - Sport, format, and level
  - Number of teams

**Step 3:** Click a template card
- Competition is created instantly
- Success notification appears
- New competition appears in list

### Exporting Competitions

**Step 1:** Click "Export" button

**Step 2:** File downloads automatically
- Format: JSON
- Filename: `competitions_YYYY-MM-DD.json`
- Contains all competition data

---

## 4. XI (Team Builder) - Already Available

### Creating a Team Lineup

```javascript
const response = await fetch('/api/user/xi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    name: 'My Dream Team',
    formation: '4-3-3',
    players: [
      { playerId: 'player-1', position: 'GK', x: 50, y: 90 },
      { playerId: 'player-2', position: 'LB', x: 20, y: 70 },
      { playerId: 'player-3', position: 'CB', x: 40, y: 70 },
      { playerId: 'player-4', position: 'CB', x: 60, y: 70 },
      { playerId: 'player-5', position: 'RB', x: 80, y: 70 },
      { playerId: 'player-6', position: 'CM', x: 30, y: 50 },
      { playerId: 'player-7', position: 'CM', x: 50, y: 50 },
      { playerId: 'player-8', position: 'CM', x: 70, y: 50 },
      { playerId: 'player-9', position: 'LW', x: 20, y: 20 },
      { playerId: 'player-10', position: 'ST', x: 50, y: 20 },
      { playerId: 'player-11', position: 'RW', x: 80, y: 20 }
    ],
    isPublic: true
  })
});
```

### Viewing Lineups

```javascript
// View your lineups
const myXIs = await fetch('/api/user/xi?userId=user-123');

// View public lineups
const publicXIs = await fetch('/api/user/xi?public=true');
```

### Accessing Lineups Page

Navigate to: `/lineups`

Features:
- Sport selector (Football, Basketball, Track)
- Team selector
- Visual formation display
- Squad statistics
- Bench players
- Recent form

---

## 5. Predictions - Already Available

### Making a Prediction

```javascript
const response = await fetch('/api/predictions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    matchId: 'match-456',
    predictedHomeScore: 2,
    predictedAwayScore: 1,
    predictedWinner: 'home',
    confidence: 75
  })
});
```

### Viewing Leaderboard

```javascript
const response = await fetch('/api/predictions/leaderboard?limit=10');
const data = await response.json();

data.leaderboard.forEach(entry => {
  console.log(`${entry.rank}. ${entry.userName} - ${entry.totalPoints} pts`);
});
```

### Accessing Predictions Page

Navigate to: `/predictions`

Features:
- Make predictions tab
- Leaderboard tab
- User stats display (points, accuracy, streak)
- Score input with confidence slider
- Top 3 podium display

---

## 📊 Common Use Cases

### Use Case 1: Setting Up a New Season

```javascript
// 1. Create multiple competitions using templates
const templates = [
  'football-league-8',
  'basketball-knockout-8',
  'volleyball-league-6'
];

for (const templateId of templates) {
  await fetch('/api/competitions/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId,
      season: '2025/2026'
    })
  });
}
```

### Use Case 2: Cleaning Up Old Competitions

```javascript
// 1. Get all completed competitions
const response = await fetch('/api/competitions');
const data = await response.json();
const completedIds = data.competitions
  .filter(c => c.status === 'completed' && c.season === '2023/2024')
  .map(c => c.id);

// 2. Bulk delete them
await fetch('/api/competitions/bulk', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: completedIds })
});
```

### Use Case 3: Migrating Competitions

```javascript
// 1. Export from old system
const response = await fetch('/api/competitions');
const data = await response.json();
const exportData = JSON.stringify(data.competitions, null, 2);

// 2. Save to file (in browser)
const blob = new Blob([exportData], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'competitions-backup.json';
a.click();

// 3. Import to new system (prepare data)
const importData = JSON.parse(exportData);
const competitions = importData.map(c => ({
  name: c.name,
  sport: c.sport,
  format: c.format,
  season: '2025/2026',  // Update season
  // ... other fields
}));

// 4. Bulk create
await fetch('/api/competitions/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ competitions })
});
```

---

## 🎯 Tips & Best Practices

### Competition Templates

1. **Choose the right template**
   - Use `league` format for round-robin competitions
   - Use `knockout` for elimination tournaments
   - Use `group_knockout` for Champions League style

2. **Customize when needed**
   - Templates provide defaults
   - Override with `customRules` parameter
   - Adjust team numbers, groups, etc.

3. **Season naming**
   - Use format: `YYYY/YYYY` (e.g., `2024/2025`)
   - Consistent naming helps filtering

### Bulk Operations

1. **Batch size**
   - Keep bulk creates under 50 items
   - For larger imports, split into batches

2. **Validation**
   - All items must pass validation
   - One invalid item fails entire batch
   - Validate data before sending

3. **Error handling**
   - Check response status
   - Log errors for debugging
   - Implement retry logic if needed

### XI (Team Builder)

1. **Formation strings**
   - Valid formats: `4-3-3`, `4-4-2`, `3-5-2`, `4-2-3-1`, `3-4-3`, `5-3-2`
   - Must match player count (11 for football)

2. **Player positions**
   - Use standard position codes (GK, LB, CB, RB, CM, LW, ST, RW)
   - Ensure positions match formation

### Predictions

1. **Confidence levels**
   - 0-100 scale
   - Higher confidence = more points if correct
   - Be realistic with confidence

2. **Timing**
   - Submit before match starts
   - Can update until match begins
   - No changes after kickoff

---

## 🔍 Troubleshooting

### Issue: Bulk create fails

**Solution:**
- Check all required fields are present
- Validate data types (numbers, strings)
- Ensure no duplicate IDs
- Check server logs for specific error

### Issue: Template not found

**Solution:**
- Verify template ID is correct
- Use GET endpoint to list available templates
- Check spelling and case sensitivity

### Issue: XI creation fails

**Solution:**
- Verify formation is valid
- Check player count matches formation
- Ensure all players have valid IDs
- Verify user ID exists

### Issue: Prediction not saving

**Solution:**
- Check match ID is valid
- Ensure match hasn't started
- Verify user ID exists
- Check score values are valid numbers

---

## 📞 Need Help?

- Check `FEATURES_IMPLEMENTATION_SUMMARY.md` for detailed API documentation
- Review code comments in API route files
- Check browser console for client-side errors
- Review server logs for backend errors

---

**Happy Building! 🎉**
