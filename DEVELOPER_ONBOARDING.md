# 🚀 Brix V2 - Developer Onboarding Guide

Welcome to Brix V2! This comprehensive guide will help you get started with development, understand the architecture, and contribute effectively to the project.

---

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Project Structure](#project-structure)
5. [Architecture Overview](#architecture-overview)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Component Library](#component-library)
9. [Development Workflow](#development-workflow)
10. [Testing](#testing)
11. [Deployment](#deployment)
12. [Contributing](#contributing)
13. [Troubleshooting](#troubleshooting)
14. [Resources](#resources)

---

## 🎯 Introduction

Brix V2 is a comprehensive sports management platform designed for university sports competitions. It features:

- **Live Streaming**: Real-time match streaming with integrated chat
- **Match Predictions**: User predictions with leaderboards and points system
- **Lineup Builder**: Interactive team formation editor
- **Admin Dashboard**: Comprehensive management tools
- **Multi-Sport Support**: Football, Basketball, and more
- **Real-time Updates**: Live scores and statistics
- **Social Features**: Comments, polls, and fan engagement

### Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Next.js API Routes, Drizzle ORM
- **Database**: SQLite (local) / Turso (production)
- **Authentication**: NextAuth.js with Google OAuth
- **Real-time**: Socket.io
- **UI Components**: Radix UI, Framer Motion
- **Notifications**: Web Push API

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.x or higher
- **npm** or **yarn**: Package manager
- **Git**: Version control
- **Code Editor**: VS Code recommended with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features

### Recommended Knowledge

- React and Next.js fundamentals
- TypeScript basics
- Tailwind CSS
- SQL and database concepts
- RESTful API design

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd -BrixsV2
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and configure the following:

```env
# Database (Local Development)
DATABASE_URL=file:./local.db

# For Production (Turso)
# TURSO_DATABASE_URL=libsql://your-database.turso.io
# TURSO_AUTH_TOKEN=your-auth-token

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth (Optional for local dev)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudinary (for image uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Web Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

### 4. Initialize the Database

```bash
# Push schema to database
npm run db:push

# Open Drizzle Studio to view database
npm run db:studio
```

### 5. Seed the Database (Optional)

```bash
# Seed BUSA Football competition
npx tsx src/db/seed-busa-football.ts

# Seed BUSA Basketball competition
npx tsx src/db/seed-busa-basketball.ts

# Import player rosters
npx tsx src/db/import-player-rosters.ts

# Seed test accounts
npm run seed:accounts
```

### 6. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your application!

---

## 📁 Project Structure

```
-BrixsV2/
├── public/                      # Static assets
│   ├── icons/                  # App icons
│   ├── images/                 # Images
│   └── manifest.json           # PWA manifest
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── matches/       # Match endpoints
│   │   │   ├── predictions/   # Prediction endpoints
│   │   │   ├── livestreams/   # Livestream endpoints
│   │   │   └── ...
│   │   ├── admin/             # Admin dashboard
│   │   ├── football/          # Football pages
│   │   ├── basketball/        # Basketball pages
│   │   ├── lineups/           # Lineup builder
│   │   ├── predictions/       # Predictions page
│   │   ├── docs/              # Documentation page
│   │   └── page.tsx           # Homepage
│   │
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components (Radix)
│   │   ├── lineup/           # Lineup builder components
│   │   ├── predictions/      # Prediction components
│   │   ├── livestream/       # Livestream components
│   │   ├── MatchOverlay.tsx  # Match detail modal
│   │   └── ...
│   │
│   ├── db/                    # Database
│   │   ├── schema.ts         # Main database schema
│   │   ├── schema-predictions.ts
│   │   ├── schema-xi.ts
│   │   ├── seed.ts           # Seed scripts
│   │   └── ...
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useMatches.ts
│   │   └── ...
│   │
│   ├── lib/                   # Utility functions
│   │   ├── utils.ts
│   │   ├── auth.ts
│   │   └── ...
│   │
│   └── types/                 # TypeScript types
│       └── index.ts
│
├── .env.example               # Environment variables template
├── .env.local                 # Local environment variables (gitignored)
├── drizzle.config.ts          # Drizzle ORM configuration
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

---

## 🏗️ Architecture Overview

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Pages     │  │ Components  │  │    Hooks    │     │
│  │             │  │             │  │             │     │
│  │ • Homepage  │  │ • UI        │  │ • useAuth   │     │
│  │ • Football  │  │ • Lineup    │  │ • useMatch  │     │
│  │ • Basketball│  │ • Predict   │  │ • useSocket │     │
│  │ • Admin     │  │ • Stream    │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer (REST)                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  GET    /api/matches                                     │
│  POST   /api/predictions                                 │
│  PATCH  /api/matches/[id]/livestream                     │
│  GET    /api/livestreams/active                          │
│  ...                                                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Database (SQLite/Turso + Drizzle)          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  • matches          • predictions                        │
│  • teams            • polls                              │
│  • players          • users                              │
│  • competitions     • lineups                            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Key Design Patterns

1. **Server Components**: Used for data fetching and static content
2. **Client Components**: Used for interactive UI elements
3. **API Routes**: RESTful endpoints for data operations
4. **Custom Hooks**: Reusable logic for common operations
5. **Component Composition**: Small, focused components

---

## 🗄️ Database Schema

### Core Tables

#### matches
Stores all match information including scores, status, and livestream data.

```typescript
{
  id: string (primary key)
  homeTeamId: string (foreign key -> teams)
  awayTeamId: string (foreign key -> teams)
  competitionId: string (foreign key -> competitions)
  sport: 'Football' | 'Basketball' | ...
  status: 'UPCOMING' | 'LIVE' | 'FINISHED'
  homeScore: number
  awayScore: number
  scheduledTime: timestamp
  venue: string
  
  // Livestream fields
  livestreamUrl: string
  livestreamType: 'youtube' | 'twitch' | 'custom'
  livestreamEnabled: boolean
  livestreamStartTime: timestamp
  livestreamEndTime: timestamp
  livestreamViewers: number
  livestreamChatEnabled: boolean
  livestreamChatUrl: string
}
```

#### teams
Team information and statistics.

```typescript
{
  id: string (primary key)
  name: string
  sport: 'Football' | 'Basketball' | ...
  logo: string
  college: string
  wins: number
  losses: number
  draws: number
  goalsFor: number
  goalsAgainst: number
}
```

#### players
Player profiles and statistics.

```typescript
{
  id: string (primary key)
  name: string
  teamId: string (foreign key -> teams)
  position: string
  jerseyNumber: number
  jerseyName: string
  college: string
  department: string
  rating: number
  goals: number
  assists: number
  appearances: number
}
```

#### matchPredictions
User predictions for matches.

```typescript
{
  id: string (primary key)
  userId: string (foreign key -> users)
  matchId: string (foreign key -> matches)
  predictedHomeScore: number
  predictedAwayScore: number
  predictedWinner: 'home' | 'away' | 'draw'
  confidence: number (0-100)
  points: number
  isCorrect: boolean
  createdAt: timestamp
}
```

#### userLineups (XI)
User-created team lineups.

```typescript
{
  id: string (primary key)
  userId: string (foreign key -> users)
  name: string
  sport: 'Football' | 'Basketball'
  formation: string (e.g., '4-3-3')
  players: json (array of player positions)
  isPublic: boolean
  createdAt: timestamp
}
```

### Database Commands

```bash
# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push

# Open Drizzle Studio (GUI)
npm run db:studio

# Run migrations
npm run db:migrate
```

---

## 🔌 API Reference

### Matches

#### GET /api/matches
Fetch all matches with optional filters.

**Query Parameters:**
```typescript
{
  sport?: 'Football' | 'Basketball'
  status?: 'UPCOMING' | 'LIVE' | 'FINISHED'
  competitionId?: string
  date?: string (YYYY-MM-DD)
  teamId?: string
}
```

**Response:**
```typescript
{
  matches: Match[]
  total: number
}
```

#### GET /api/matches/[id]
Fetch a specific match by ID.

**Response:**
```typescript
{
  match: Match
  homeTeam: Team
  awayTeam: Team
  competition: Competition
}
```

#### PATCH /api/matches/[id]
Update match details (Admin only).

**Request Body:**
```typescript
{
  homeScore?: number
  awayScore?: number
  status?: 'UPCOMING' | 'LIVE' | 'FINISHED'
  // ... other fields
}
```

### Predictions

#### POST /api/predictions
Submit a match prediction.

**Request Body:**
```typescript
{
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
  predictedWinner: 'home' | 'away' | 'draw'
  confidence: number // 0-100
}
```

**Response:**
```typescript
{
  prediction: Prediction
  potentialPoints: number
}
```

#### GET /api/predictions
Fetch user predictions.

**Query Parameters:**
```typescript
{
  userId?: string
  matchId?: string
}
```

#### GET /api/predictions/leaderboard
Fetch prediction leaderboard.

**Query Parameters:**
```typescript
{
  limit?: number
  offset?: number
}
```

**Response:**
```typescript
{
  leaderboard: Array<{
    rank: number
    userId: string
    userName: string
    totalPoints: number
    correctPredictions: number
    totalPredictions: number
    accuracy: number
  }>
}
```

### Livestreams

#### GET /api/livestreams/active
Fetch all active livestreams.

**Response:**
```typescript
{
  streams: Array<{
    match: Match
    homeTeam: Team
    awayTeam: Team
    viewers: number
  }>
}
```

#### PATCH /api/matches/[id]/livestream
Update livestream settings (Admin only).

**Request Body:**
```typescript
{
  livestreamUrl?: string
  livestreamType?: 'youtube' | 'twitch' | 'custom'
  livestreamEnabled?: boolean
  livestreamChatEnabled?: boolean
}
```

### Authentication

Most endpoints require authentication. The session is managed via cookies using NextAuth.js.

```typescript
// Example authenticated request
const response = await fetch('/api/predictions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
  credentials: 'include' // Important for session cookies
});
```

---

## 🧩 Component Library

### Core Components

#### MatchOverlay
Comprehensive match detail modal with tabs for stats, lineups, and predictions.

```tsx
import { MatchOverlay } from '@/components';

<MatchOverlay
  match={match}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

**Features:**
- Match header with team logos and scores
- Tabs: Stats, Lineups, Standings, Predict, Fan Poll
- Responsive design
- Smooth animations

#### InteractivePitch
Drag-and-drop lineup builder with formation support.

```tsx
import { InteractivePitch } from '@/components/lineup';

<InteractivePitch
  formation="4-3-3"
  players={players}
  onUpdate={handleUpdate}
  sport="Football"
/>
```

**Features:**
- Visual formation display
- Drag-and-drop player positioning
- Formation presets
- Player statistics

#### MatchPredictionCard
Interactive prediction interface with confidence slider.

```tsx
import { MatchPredictionCard } from '@/components';

<MatchPredictionCard
  match={match}
  userId={userId}
  onSubmit={handleSubmit}
/>
```

**Features:**
- Score prediction inputs
- Confidence slider
- Potential points calculation
- Community prediction stats

#### LivestreamPlayer
Embedded video player with support for multiple platforms.

```tsx
import { LivestreamPlayer } from '@/components/livestream';

<LivestreamPlayer
  url={streamUrl}
  type="youtube"
  autoplay={true}
/>
```

**Supported Platforms:**
- YouTube
- Twitch
- Custom HLS/DASH streams

### UI Components

Built on Radix UI primitives with custom Tailwind styling:

- **Button**: Various variants and sizes
- **Dialog**: Modal dialogs
- **Dropdown**: Dropdown menus
- **Tabs**: Tab navigation
- **Select**: Custom select inputs
- **Slider**: Range sliders
- **Switch**: Toggle switches
- **Toast**: Notification toasts

Example usage:

```tsx
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

<Button variant="primary" size="lg">
  Click Me
</Button>

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>Title</DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

## 💻 Development Workflow

### Running the Development Server

```bash
# Standard development server
npm run dev

# With Turbopack (faster)
npm run dev:turbo
```

### Building for Production

```bash
# Create production build
npm run build

# Start production server
npm run start
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Auto-fix linting issues
npm run lint -- --fix
```

### Database Management

```bash
# Generate migrations
npm run db:generate

# Push schema changes
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

### Git Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Follow TypeScript best practices
   - Use Tailwind CSS for styling

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **Push to remote**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Provide a clear description
   - Reference any related issues
   - Request reviews from team members

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```bash
git commit -m "feat: add livestream chat feature"
git commit -m "fix: resolve prediction points calculation"
git commit -m "docs: update API reference"
```

---

## 🧪 Testing

### Manual Testing Checklist

Before submitting a PR, ensure:

- [ ] Application builds without errors
- [ ] All pages load correctly
- [ ] Forms submit successfully
- [ ] API endpoints return expected data
- [ ] Responsive design works on mobile
- [ ] No console errors or warnings
- [ ] Database operations work correctly

### Testing API Endpoints

Use tools like:
- **Postman**: API testing
- **Thunder Client**: VS Code extension
- **curl**: Command-line testing

Example:
```bash
# Test match endpoint
curl http://localhost:3000/api/matches

# Test prediction submission
curl -X POST http://localhost:3000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{"matchId":"123","predictedHomeScore":2,"predictedAwayScore":1}'
```

---

## 🚀 Deployment

### Vercel Deployment

1. **Connect Repository**
   - Go to [Vercel](https://vercel.com)
   - Import your GitHub repository

2. **Configure Environment Variables**
   - Add all variables from `.env.example`
   - Use Turso for production database

3. **Deploy**
   - Vercel will automatically build and deploy
   - Monitor build logs for errors

### Turso Database Setup

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Create database
turso db create brix-v2

# Get connection URL
turso db show brix-v2 --url

# Create auth token
turso db tokens create brix-v2

# Add to Vercel environment variables
TURSO_DATABASE_URL=<url-from-above>
TURSO_AUTH_TOKEN=<token-from-above>
```

### Environment Variables for Production

```env
# Database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-production-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

1. **Report Bugs**: Open an issue with detailed reproduction steps
2. **Suggest Features**: Share your ideas for improvements
3. **Submit PRs**: Fix bugs or implement new features
4. **Improve Docs**: Help make documentation better
5. **Review Code**: Provide feedback on pull requests

### Code Style Guidelines

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Tailwind CSS for styling
- Write meaningful variable and function names
- Add comments for complex logic
- Keep components small and focused
- Use custom hooks for reusable logic

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Commit with conventional commits
6. Push to your fork
7. Create a pull request
8. Address review feedback

---

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Error

**Problem**: Cannot connect to database

**Solution**:
```bash
# Ensure database file exists
npm run db:push

# Check DATABASE_URL in .env.local
# For local dev, should be: file:./local.db
```

#### Build Errors

**Problem**: `npm run build` fails

**Solution**:
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Try building again
npm run build
```

#### TypeScript Errors

**Problem**: Type errors in IDE

**Solution**:
```bash
# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"

# Or rebuild TypeScript
npx tsc --noEmit
```

#### Environment Variables Not Loading

**Problem**: Environment variables are undefined

**Solution**:
- Ensure `.env.local` exists
- Restart development server after changes
- Check variable names start with `NEXT_PUBLIC_` for client-side access

---

## 📚 Resources

### Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs)
- [Radix UI](https://www.radix-ui.com/docs/primitives)

### Project Documentation

- [Quick Start Guide](./QUICK_START_GUIDE.md)
- [Architecture Diagram](./ARCHITECTURE_DIAGRAM.md)
- [API Reference](./docs/api-reference.md)
- [Deployment Guide](./VERCEL_DEPLOYMENT.md)

### Interactive Documentation

Visit `/docs` in your local development server for interactive documentation with code examples and search functionality.

---

## 📞 Support

Need help? Here are your options:

1. **Check Documentation**: Review this guide and other docs
2. **Search Issues**: Look for similar problems in GitHub issues
3. **Ask the Team**: Reach out to team members
4. **Create an Issue**: Open a detailed issue on GitHub

---

**Happy Coding! 🎉**

Last Updated: January 4, 2026
