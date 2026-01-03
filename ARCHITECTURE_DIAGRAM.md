# 🎯 Brix V2 - Livestreaming & Predictions Feature Map

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BRIX V2 PLATFORM                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            USER INTERFACE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Homepage   │  │ Match Detail │  │  Livestream  │                  │
│  │              │  │     Page     │  │     Page     │                  │
│  │ ┌──────────┐ │  │              │  │              │                  │
│  │ │Live Now  │ │  │ ┌──────────┐ │  │ ┌──────────┐ │                  │
│  │ │Section   │ │  │ │Prediction│ │  │ │  Player  │ │                  │
│  │ └──────────┘ │  │ │   Card   │ │  │ └──────────┘ │                  │
│  │              │  │ └──────────┘ │  │ ┌──────────┐ │                  │
│  └──────────────┘  │ ┌──────────┐ │  │ │   Chat   │ │                  │
│                    │ │Vote Poll │ │  │ └──────────┘ │                  │
│                    │ └──────────┘ │  │              │                  │
│                    └──────────────┘  └──────────────┘                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │              Admin Dashboard                             │            │
│  │  ┌──────────────────────────────────────────────────┐   │            │
│  │  │  Livestream Management                           │   │            │
│  │  │  - Configure stream URLs                         │   │            │
│  │  │  - Enable/Disable streams                        │   │            │
│  │  │  - Monitor viewer counts                         │   │            │
│  │  └──────────────────────────────────────────────────┘   │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Next.js)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  GET  /api/livestreams/active                                            │
│       └─> Returns all active livestreams with team details               │
│                                                                           │
│  GET  /api/matches/[id]/livestream                                       │
│       └─> Returns livestream info for specific match                     │
│                                                                           │
│  PATCH /api/matches/[id]/livestream (Admin)                              │
│       └─> Updates livestream settings                                    │
│                                                                           │
│  GET  /api/predictions?matchId=...&userId=...                            │
│       └─> Returns user's prediction for a match                          │
│                                                                           │
│  POST /api/predictions                                                   │
│       └─> Submits new prediction                                         │
│                                                                           │
│  GET  /api/predictions/stats?matchId=...                                 │
│       └─> Returns prediction statistics                                  │
│                                                                           │
│  GET  /api/polls?matchId=...&type=match_winner                           │
│       └─> Returns poll data                                              │
│                                                                           │
│  POST /api/polls/vote                                                    │
│       └─> Submits vote                                                   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE (SQLite + Drizzle)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  matches                                                  │           │
│  │  ├─ id                                                    │           │
│  │  ├─ homeTeamId, awayTeamId                               │           │
│  │  ├─ status (UPCOMING, LIVE, FINISHED)                    │           │
│  │  ├─ livestreamUrl                    ◄─── NEW            │           │
│  │  ├─ livestreamType                   ◄─── NEW            │           │
│  │  ├─ livestreamEnabled                ◄─── NEW            │           │
│  │  ├─ livestreamStartTime              ◄─── NEW            │           │
│  │  ├─ livestreamEndTime                ◄─── NEW            │           │
│  │  ├─ livestreamViewers                ◄─── NEW            │           │
│  │  ├─ livestreamChatEnabled            ◄─── NEW            │           │
│  │  └─ livestreamChatUrl                ◄─── NEW            │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  matchPredictions                                         │           │
│  │  ├─ id                                                    │           │
│  │  ├─ userId                                                │           │
│  │  ├─ matchId                                               │           │
│  │  ├─ predictedHomeScore                                   │           │
│  │  ├─ predictedAwayScore                                   │           │
│  │  ├─ predictedWinner                                       │           │
│  │  ├─ confidence                                            │           │
│  │  ├─ points                                                │           │
│  │  └─ isCorrect                                             │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  polls                                                    │           │
│  │  ├─ id                                                    │           │
│  │  ├─ matchId                                               │           │
│  │  ├─ question                                              │           │
│  │  ├─ pollType (match_winner)                              │           │
│  │  ├─ options (JSON)                                        │           │
│  │  ├─ totalVotes                                            │           │
│  │  └─ status                                                │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  pollVotes                                                │           │
│  │  ├─ id                                                    │           │
│  │  ├─ pollId                                                │           │
│  │  ├─ userId                                                │           │
│  │  └─ optionId                                              │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ YouTube  │  │  Twitch  │  │ Facebook │  │   HLS    │               │
│  │  Embed   │  │  Player  │  │   Live   │  │  Server  │               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│                                                                           │
│  Future: WebSocket Server for Real-time Chat & Viewer Counts            │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
App
├── Homepage
│   └── LiveNowSection
│       └── LiveStreamCard (multiple)
│           ├── Team Logos
│           ├── Score Display
│           ├── Viewer Count
│           └── Live Badge
│
├── Match Detail Page (Upcoming)
│   └── UpcomingMatchView
│       ├── Match Header
│       │   ├── Team Displays
│       │   ├── Match Info
│       │   └── Countdown Timer
│       ├── Tabs
│       │   ├── Prediction Tab
│       │   │   └── MatchPredictionCard
│       │   │       ├── Score Selectors
│       │   │       ├── Confidence Slider
│       │   │       ├── Stats Display
│       │   │       └── Submit Button
│       │   └── Poll Tab
│       │       └── MatchVotePoll
│       │           ├── Vote Buttons
│       │           ├── Results Display
│       │           └── Percentage Bars
│       └── Sidebar
│           ├── Quick Poll (compact)
│           ├── Countdown
│           └── Discussion Link
│
├── Livestream Page (Live)
│   └── LivestreamView
│       ├── Header (Back, Share)
│       ├── Main Content
│       │   ├── LivestreamPlayer
│       │   │   ├── Video Embed
│       │   │   ├── Live Indicator
│       │   │   ├── Viewer Count
│       │   │   └── Controls
│       │   ├── Score Card
│       │   └── Stats/Events Tabs
│       └── Sidebar
│           └── LivestreamChat
│               ├── Message List
│               ├── User Avatars
│               └── Input Field
│
└── Admin Dashboard
    └── Livestreams Page
        ├── Header (Stats)
        ├── Match List Table
        │   ├── Match Info
        │   ├── Stream Settings
        │   └── Actions
        └── Inline Editor
            ├── URL Input
            ├── Type Selector
            ├── Toggles
            └── Save/Cancel
```

---

## Data Flow Diagrams

### Livestream Flow

```
User clicks "Watch Live"
         │
         ▼
Navigate to /livestream/[id]
         │
         ▼
Server fetches match data
         │
         ▼
Server fetches livestream info
         │
         ▼
Check if stream is active
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    ▼         ▼
 Render    Redirect
 Player    to Match
    │
    ▼
Load video embed (YouTube/Twitch/etc)
    │
    ▼
Initialize chat
    │
    ▼
Display viewer count
    │
    ▼
User watches & chats
```

### Prediction Flow

```
User visits upcoming match
         │
         ▼
Load MatchPredictionCard
         │
         ▼
Fetch existing prediction (if any)
         │
    ┌────┴────┐
    │         │
  Found    Not Found
    │         │
    ▼         ▼
Pre-fill   Show empty
 form       form
    │         │
    └────┬────┘
         │
         ▼
User adjusts scores
         │
         ▼
User sets confidence
         │
         ▼
Calculate potential points
         │
         ▼
User clicks submit
         │
         ▼
POST /api/predictions
         │
         ▼
Save to database
         │
         ▼
Update leaderboard
         │
         ▼
Show success message
         │
         ▼
Fetch updated stats
         │
         ▼
Display community predictions
```

### Admin Livestream Setup Flow

```
Admin navigates to /admin/livestreams
         │
         ▼
Fetch upcoming & live matches
         │
         ▼
Display matches table
         │
         ▼
Admin clicks "Edit" on a match
         │
         ▼
Show inline editor
         │
         ▼
Admin enters stream URL
         │
         ▼
Admin selects stream type
         │
         ▼
Admin enables livestream
         │
         ▼
Admin clicks "Save"
         │
         ▼
Validate URL format
         │
    ┌────┴────┐
    │         │
  Valid   Invalid
    │         │
    ▼         ▼
 PATCH    Show error
  API
    │
    ▼
Update database
    │
    ▼
Refresh table
    │
    ▼
Stream is now live!
```

---

## Feature Interaction Map

```
┌─────────────────────────────────────────────────────────────┐
│                    MATCH LIFECYCLE                           │
└─────────────────────────────────────────────────────────────┘

UPCOMING Match
    │
    ├─> Users can PREDICT scores
    │   └─> Earn points based on accuracy
    │
    ├─> Users can VOTE for winner
    │   └─> See community sentiment
    │
    └─> Admin can CONFIGURE livestream
        └─> Set URL, type, enable/disable
            │
            ▼
LIVE Match
    │
    ├─> Users can WATCH livestream
    │   ├─> Video player
    │   ├─> Live chat
    │   └─> Real-time stats
    │
    ├─> Predictions are LOCKED
    │   └─> No more changes allowed
    │
    └─> Viewer count UPDATES
        └─> Real-time (future WebSocket)
            │
            ▼
FINISHED Match
    │
    ├─> Predictions are SCORED
    │   └─> Points awarded
    │       └─> Leaderboard updated
    │
    ├─> Poll results are FINAL
    │   └─> Show accuracy vs actual
    │
    └─> Livestream is ARCHIVED
        └─> Optional replay available
```

---

## Technology Stack Map

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
├─────────────────────────────────────────────────────────────┤
│  React 18                                                    │
│  └─> Component-based UI                                     │
│                                                              │
│  Next.js 14                                                  │
│  ├─> App Router                                             │
│  ├─> Server Components                                      │
│  ├─> Client Components                                      │
│  └─> API Routes                                             │
│                                                              │
│  Tailwind CSS                                                │
│  └─> Utility-first styling                                  │
│                                                              │
│  Lucide React                                                │
│  └─> Icon library                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      BACKEND                                 │
├─────────────────────────────────────────────────────────────┤
│  Next.js API Routes                                          │
│  └─> RESTful endpoints                                       │
│                                                              │
│  Drizzle ORM                                                 │
│  ├─> Type-safe queries                                      │
│  ├─> Schema management                                      │
│  └─> Migrations                                             │
│                                                              │
│  SQLite                                                      │
│  └─> Lightweight database                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
├─────────────────────────────────────────────────────────────┤
│  YouTube Player API                                          │
│  Twitch Embed                                                │
│  Facebook Video Plugin                                       │
│  HLS.js (future)                                             │
│  Dash.js (future)                                            │
│  WebSocket Server (future)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Organization

```
src/
├── components/
│   ├── livestream/
│   │   ├── LivestreamPlayer.tsx      ─┐
│   │   ├── LivestreamChat.tsx         ├─ Core Components
│   │   ├── LivestreamView.tsx         │
│   │   ├── LiveNowSection.tsx        ─┘
│   │   └── index.ts                   ─── Exports
│   │
│   ├── predictions/
│   │   ├── MatchPredictionCard.tsx   ─┐
│   │   ├── MatchVotePoll.tsx          ├─ Prediction Components
│   │   └── index.ts                  ─┘
│   │
│   └── matches/
│       └── UpcomingMatchView.tsx     ─── Match View
│
├── app/
│   ├── livestream/[id]/
│   │   └── page.tsx                  ─── Livestream Page
│   │
│   ├── matches/[id]/
│   │   └── page.tsx                  ─── Match Detail Page
│   │
│   ├── admin/livestreams/
│   │   └── page.tsx                  ─── Admin Dashboard
│   │
│   └── api/
│       ├── livestreams/active/
│       │   └── route.ts              ─── Active Streams API
│       │
│       ├── matches/[id]/livestream/
│       │   └── route.ts              ─── Livestream API
│       │
│       ├── predictions/
│       │   ├── route.ts              ─┐
│       │   ├── stats/route.ts         ├─ Prediction APIs
│       │   └── leaderboard/route.ts  ─┘
│       │
│       └── polls/
│           ├── route.ts              ─┐
│           └── vote/route.ts         ─┘─ Poll APIs
│
├── hooks/
│   └── useAuth.ts                    ─── Auth Hook
│
└── db/
    ├── schema.ts                     ─── Main Schema
    └── schema-predictions.ts         ─── Prediction Schema
```

---

**Last Updated**: December 29, 2025
**Version**: 1.0.0
