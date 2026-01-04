# 🔐 Brix V2 - Data Persistence & User Sessions Guide

## Overview

This document explains how user data is persisted in Brix V2 and what happens when users clear their cache or session.

---

## 📊 Data Persistence Architecture

### What is Stored in the Database (PERSISTS)

All user data is stored in the database and **persists even after clearing cache/session**:

#### 1. **User Profile** (`users` table)
```typescript
{
  id: string
  email: string
  name: string
  avatar: string
  coverImage: string
  bio: string
  favoriteTeamId: string
  role: 'user' | 'admin' | 'logger'
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 2. **User Preferences** (`userPreferences` table)
```typescript
{
  id: string
  userId: string
  theme: 'dark' | 'light'
  language: string
  notifications: boolean
  emailNotifications: boolean
  favoriteSports: string[] (JSON)
  defaultView: 'standings' | 'brackets' | 'matches' | 'lineups'
  timezone: string
  updatedAt: timestamp
}
```

#### 3. **User Favorites** (`userFavorites` table)
```typescript
{
  id: string
  userId: string
  favoriteType: 'team' | 'player' | 'match' | 'competition'
  favoriteId: string
  createdAt: timestamp
}
```

#### 4. **Prediction History** (`matchPredictions` table)
```typescript
{
  id: string
  userId: string
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
  predictedWinner: 'home' | 'away' | 'draw'
  confidence: number (0-100)
  points: number
  isCorrect: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 5. **Prediction Leaderboard** (`predictionLeaderboard` table)
```typescript
{
  id: string
  userId: string
  totalPredictions: number
  correctPredictions: number
  totalPoints: number
  accuracy: number
  rank: number
  streak: number
  longestStreak: number
  updatedAt: timestamp
}
```

#### 6. **User Lineups (XI)** (`userXI` table)
```typescript
{
  id: string
  userId: string
  name: string
  sport: 'Football' | 'Basketball'
  formation: string
  players: JSON
  isPublic: boolean
  likes: number
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 7. **User Follows** (`userFollows` table)
```typescript
{
  id: string
  userId: string
  followType: 'team' | 'player' | 'competition'
  followId: string
  notificationsEnabled: boolean
  createdAt: timestamp
}
```

#### 8. **User Activity** (`userActivity` table)
```typescript
{
  id: string
  userId: string
  activityType: string
  entityType: string
  entityId: string
  metadata: JSON
  createdAt: timestamp
}
```

#### 9. **Push Subscriptions** (`pushSubscriptions` table)
```typescript
{
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
  createdAt: timestamp
}
```

#### 10. **Match Reminders** (`matchReminders` table)
```typescript
{
  id: string
  userId: string
  matchId: string
  reminderTime: timestamp
  minutesBefore: number
  notificationSent: boolean
  createdAt: timestamp
}
```

---

## 🔄 What Happens When Users Clear Cache/Session?

### ❌ What is LOST (Session-Based)

1. **Authentication Session**
   - User is logged out
   - Session cookie is deleted
   - Must sign in again

2. **Temporary UI State**
   - Current page/tab
   - Filter selections
   - Sort preferences
   - Scroll position
   - Expanded/collapsed sections

3. **Browser Cache**
   - Cached images
   - Cached API responses
   - Service worker cache (if PWA)

### ✅ What is RETAINED (Database)

1. **User Profile**
   - Name, email, avatar
   - Bio and cover image
   - Favorite team
   - Account settings

2. **All Favorites**
   - Favorite teams
   - Favorite players
   - Favorite matches
   - Favorite competitions

3. **Complete Prediction History**
   - All past predictions
   - Prediction results
   - Points earned
   - Leaderboard position
   - Current streak
   - Longest streak

4. **User Preferences**
   - Theme (dark/light)
   - Language
   - Timezone
   - Default view
   - Notification settings

5. **User Lineups (XI)**
   - All created lineups
   - Formation choices
   - Player selections

6. **Social Data**
   - Followed teams/players
   - Activity history
   - Comments and likes

---

## 🔐 Session Management

### How Authentication Works

1. **Sign In**
   ```
   User enters credentials
   → Server validates
   → Creates session
   → Sets session cookie (httpOnly, secure)
   → User is authenticated
   ```

2. **Session Cookie**
   - **Type**: HTTP-only, Secure
   - **Duration**: Configurable (default: 30 days)
   - **Storage**: Browser cookies
   - **Security**: Cannot be accessed by JavaScript

3. **Sign Out**
   ```
   User clicks sign out
   → Session cookie is deleted
   → User is logged out
   → Redirected to login page
   ```

### After Clearing Cache/Session

```
User clears browser data
→ Session cookie is deleted
→ User is logged out
→ User signs in again
→ Session is restored
→ ALL data is loaded from database:
   ✓ Profile
   ✓ Favorites
   ✓ Predictions
   ✓ Preferences
   ✓ Lineups
   ✓ Everything!
```

---

## 🛠️ Settings Page Implementation

### Before (Hardcoded)

```typescript
// ❌ OLD - Data was lost on page refresh
const [settings, setSettings] = useState({
  name: 'Alex Johnson',  // Hardcoded
  email: 'alex@example.com',  // Hardcoded
  theme: 'dark',  // Not saved
  // ...
});
```

### After (Database-Backed)

```typescript
// ✅ NEW - Data persists in database
useEffect(() => {
  // Load from database
  const loadSettings = async () => {
    const userData = await fetch(`/api/users/${userId}`);
    const prefsData = await fetch(`/api/users/${userId}/preferences`);
    
    setSettings({
      name: userData.name,  // From database
      email: userData.email,  // From database
      theme: prefsData.theme,  // From database
      // ...
    });
  };
  
  loadSettings();
}, [userId]);

// Save to database
const handleSave = async () => {
  await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: settings.name }),
  });
  
  await fetch(`/api/users/${userId}/preferences`, {
    method: 'PATCH',
    body: JSON.stringify({
      theme: settings.theme,
      language: settings.language,
      // ...
    }),
  });
};
```

---

## 📋 API Endpoints for User Data

### User Profile

```bash
# Get user profile
GET /api/users/[id]

# Update user profile
PATCH /api/users/[id]
Body: { name, avatar, bio, favoriteTeamId }
```

### User Preferences

```bash
# Get preferences
GET /api/users/[id]/preferences

# Update preferences
PATCH /api/users/[id]/preferences
Body: { theme, language, timezone, notifications, ... }

# Reset to defaults
DELETE /api/users/[id]/preferences
```

### User Favorites

```bash
# Get all favorites
GET /api/users/[id]/favorites

# Add favorite
POST /api/users/[id]/favorites
Body: { favoriteType, favoriteId }

# Remove favorite
DELETE /api/users/[id]/favorites/[favoriteId]
```

### Predictions

```bash
# Get user predictions
GET /api/predictions?userId=[id]

# Get leaderboard stats
GET /api/predictions/leaderboard?userId=[id]
```

---

## 🔍 Testing Data Persistence

### Test Scenario 1: Clear Cache

1. Sign in to the app
2. Add some favorites
3. Make some predictions
4. Update settings
5. **Clear browser cache** (Ctrl+Shift+Delete)
6. Refresh the page
7. **Result**: You're still logged in, all data is intact

### Test Scenario 2: Clear Cookies (Session)

1. Sign in to the app
2. Add some favorites
3. Make some predictions
4. Update settings
5. **Clear cookies** (including session cookie)
6. Refresh the page
7. **Result**: You're logged out
8. Sign in again
9. **Result**: All your data is back! ✅
   - Favorites are there
   - Predictions are there
   - Settings are restored
   - Everything persists!

### Test Scenario 3: Different Browser

1. Sign in on Chrome
2. Add favorites and make predictions
3. Sign out
4. Open Firefox
5. Sign in with same account
6. **Result**: All your data is there! ✅

---

## 💡 Best Practices

### For Users

1. **Don't worry about losing data**
   - Your data is safe in the database
   - Clearing cache won't delete your favorites or predictions
   - Just sign in again to restore everything

2. **Sign out properly**
   - Use the sign-out button
   - Don't just close the browser
   - This ensures clean session termination

3. **Keep your account secure**
   - Use a strong password
   - Don't share your credentials
   - Sign out on shared devices

### For Developers

1. **Always use database for persistent data**
   - Never rely on localStorage for critical data
   - Use session storage only for temporary UI state
   - Save user preferences to database

2. **Handle session expiration gracefully**
   - Check authentication status
   - Redirect to login if session expired
   - Show clear error messages

3. **Implement proper loading states**
   - Show loading indicators while fetching data
   - Handle errors gracefully
   - Provide fallback values

---

## 🎯 Summary

### Quick Answer

**Q: When a user clears cache or session, do they lose their data?**

**A: NO!** Here's what happens:

| Data Type | Persists? | Reason |
|-----------|-----------|--------|
| Profile | ✅ Yes | Stored in database |
| Favorites | ✅ Yes | Stored in database |
| Predictions | ✅ Yes | Stored in database |
| Settings | ✅ Yes | Stored in database |
| Lineups (XI) | ✅ Yes | Stored in database |
| Login Session | ❌ No | Cookie-based |
| UI State | ❌ No | Temporary |

**Bottom Line**: Users only need to **sign in again**. All their data will be **automatically restored** from the database!

---

## 🔧 Recent Fixes

### Settings Page

**Before**: Hardcoded values, changes not saved
```typescript
// ❌ Lost on refresh
const [settings, setSettings] = useState({
  name: 'Alex Johnson',  // Hardcoded
});
```

**After**: Database-backed, fully persistent
```typescript
// ✅ Persists across sessions
useEffect(() => {
  loadFromDatabase();
}, []);

const handleSave = async () => {
  await saveToDatabase();
};
```

**Changes Made**:
1. ✅ Load user data from database on mount
2. ✅ Load preferences from database
3. ✅ Save changes to database on "Save"
4. ✅ Show loading states
5. ✅ Handle errors gracefully
6. ✅ Disable email editing (security)

---

**Last Updated**: January 4, 2026
**Version**: 2.0.0
