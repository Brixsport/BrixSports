# 🔍 User-Side Updates Debugging Checklist

## Expected Updates

### 1. Homepage Date Filter (`http://localhost:3000`)

**What Should Happen:**
- Date filter has dark background (`#0a0a0a`)
- When you click "Today", "Tomorrow", or "Next Week":
  - Left/Right arrow buttons should appear
  - Current date shown between arrows (e.g., "Dec 29")
  - Click left arrow to go to previous day
  - Click right arrow to go to next day

**How to Test:**
1. Go to homepage
2. Click "Today" button
3. Look for `< Dec 29 >` arrows

**If Not Working:**
- Check browser console (F12) for errors
- Try hard refresh: `Ctrl + Shift + R`
- Check if changes are in file: `src/app/page.tsx` lines 357-437

---

### 2. Live Now Section (`http://localhost:3000`)

**What Should Happen:**
- Section appears below date filter
- Shows active livestreams (if any exist in database)
- Auto-refreshes every 30 seconds

**How to Test:**
1. Go to homepage
2. Look for "Live Now" heading
3. Should appear even if empty

**If Not Working:**
- Component might not be rendering
- Check browser console for errors
- Check if import exists: `src/app/page.tsx` line 19
- Check if component is used: `src/app/page.tsx` lines 439-442

---

### 3. Match Detail Predictions Tab

**What Should Happen:**
- For UPCOMING matches only:
  - "Predictions" tab appears FIRST
  - Auto-selected when page loads
  - Shows prediction card + voting poll
  - Stats and Timeline tabs are HIDDEN

**How to Test:**
1. Find an UPCOMING match on homepage
2. Click to open match details
3. Look for "Predictions" tab (should be first)
4. Should see score prediction and winner vote

**If Not Working:**
- Match might not be UPCOMING status
- Check browser console for errors
- Check if imports exist: `src/app/matches/[id]/page.tsx` line 17
- Check if tab is rendered: `src/app/matches/[id]/page.tsx` lines 290-307

---

## Quick Verification Commands

### Check if files have changes:
```bash
# Check homepage
Get-Content "src/app/page.tsx" | Select-String "LiveNowSection"
Get-Content "src/app/page.tsx" | Select-String "ChevronLeft"

# Check match page
Get-Content "src/app/matches/[id]/page.tsx" | Select-String "MatchPredictionCard"
Get-Content "src/app/matches/[id]/page.tsx" | Select-String "isUpcoming"
```

### Check server status:
```bash
# See if server is running
Get-Process -Name node -ErrorAction SilentlyContinue

# Check what's on port 3000
netstat -ano | findstr :3000
```

---

## Common Issues & Solutions

### Issue 1: Changes Not Visible After Refresh

**Possible Causes:**
- Browser cache
- Service worker cache
- Next.js build cache

**Solutions:**
1. Hard refresh: `Ctrl + Shift + R`
2. Clear browser cache: F12 → Application → Clear storage
3. Open in incognito/private window
4. Clear Next.js cache: Delete `.next` folder

### Issue 2: Components Not Rendering

**Possible Causes:**
- Import errors
- TypeScript errors
- React rendering errors

**Solutions:**
1. Check browser console (F12)
2. Check terminal for compilation errors
3. Look for red underlines in VS Code
4. Check Network tab for failed requests

### Issue 3: Server Not Compiling

**Possible Causes:**
- Syntax errors
- Missing dependencies
- Port already in use

**Solutions:**
1. Check terminal output
2. Look for error messages
3. Kill all node processes: `Stop-Process -Name node -Force`
4. Restart server: `npm run dev`

---

## Manual Verification Steps

### Step 1: Check File Contents
Open these files and verify changes exist:

**src/app/page.tsx:**
- Line 8: Should import `ChevronLeft, ChevronRight`
- Line 19: Should import `LiveNowSection`
- Lines 357-437: Date filter with arrows
- Lines 439-442: LiveNowSection component

**src/app/matches/[id]/page.tsx:**
- Line 17: Should import `MatchPredictionCard, MatchVotePoll`
- Line 143: Should have `isUpcoming` variable
- Lines 290-307: Predictions tab (first position)
- Lines 309-351: Timeline and Stats tabs hidden for upcoming

### Step 2: Check Browser
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors (red text)
4. Go to Network tab
5. Refresh page
6. Look for failed requests (red)

### Step 3: Check Database
Make sure you have:
- At least one UPCOMING match in database
- Match status is exactly "UPCOMING" (case-sensitive)
- Teams exist for the match

---

## What to Report

If still not working, please provide:

1. **Browser Console Errors**:
   - Screenshot or copy/paste errors from F12 console

2. **Network Errors**:
   - Any failed API requests in Network tab

3. **Specific Issue**:
   - Which update isn't working? (Date filter, Live Now, or Predictions)
   - What do you see instead?
   - Any error messages?

4. **Match Status**:
   - Are you testing with an UPCOMING match?
   - What's the match ID you're testing with?

---

## Emergency Reset

If nothing works:

```bash
# 1. Stop all node processes
Stop-Process -Name node -Force

# 2. Clear Next.js cache
Remove-Item -Recurse -Force .next

# 3. Clear node modules cache
npm cache clean --force

# 4. Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install

# 5. Restart server
npm run dev
```

---

**Last Updated**: December 29, 2025
