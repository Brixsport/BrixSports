# 📡 Brix V2 - Complete API Reference

This document provides comprehensive documentation for all API endpoints in Brix V2.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Matches](#matches)
3. [Teams](#teams)
4. [Players](#players)
5. [Competitions](#competitions)
6. [Predictions](#predictions)
7. [Livestreams](#livestreams)
8. [Lineups (XI)](#lineups-xi)
9. [Polls](#polls)
10. [Users](#users)
11. [Admin](#admin)
12. [Error Handling](#error-handling)

---

## Authentication

All authenticated endpoints require a valid session cookie. Authentication is handled via NextAuth.js.

### POST /api/auth/signin
Sign in with credentials or OAuth provider.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "expires": "2026-02-04T11:51:35.000Z"
  }
}
```

---

## Matches

### GET /api/matches
Fetch all matches with optional filters.

**Query Parameters:**
- `sport` (optional): Filter by sport (`Football`, `Basketball`, etc.)
- `status` (optional): Filter by status (`UPCOMING`, `LIVE`, `FINISHED`)
- `competitionId` (optional): Filter by competition ID
- `date` (optional): Filter by date (YYYY-MM-DD)
- `teamId` (optional): Filter by team ID
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
GET /api/matches?sport=Football&status=LIVE
```

**Response:**
```json
{
  "matches": [
    {
      "id": "match-123",
      "homeTeamId": "team-1",
      "awayTeamId": "team-2",
      "competitionId": "comp-1",
      "sport": "Football",
      "status": "LIVE",
      "homeScore": 2,
      "awayScore": 1,
      "scheduledTime": "2026-01-04T15:00:00.000Z",
      "venue": "Main Stadium",
      "livestreamEnabled": true,
      "livestreamUrl": "https://youtube.com/watch?v=..."
    }
  ],
  "total": 1
}
```

### GET /api/matches/[id]
Fetch a specific match by ID with related data.

**Response:**
```json
{
  "match": {
    "id": "match-123",
    "homeTeamId": "team-1",
    "awayTeamId": "team-2",
    "homeScore": 2,
    "awayScore": 1,
    "status": "LIVE"
  },
  "homeTeam": {
    "id": "team-1",
    "name": "Kings FC",
    "logo": "https://...",
    "sport": "Football"
  },
  "awayTeam": {
    "id": "team-2",
    "name": "Pirates FC",
    "logo": "https://...",
    "sport": "Football"
  },
  "competition": {
    "id": "comp-1",
    "name": "BUSA League Football",
    "season": "2024/2025"
  }
}
```

### POST /api/matches
Create a new match (Admin only).

**Request Body:**
```json
{
  "homeTeamId": "team-1",
  "awayTeamId": "team-2",
  "competitionId": "comp-1",
  "sport": "Football",
  "scheduledTime": "2026-01-10T15:00:00.000Z",
  "venue": "Main Stadium"
}
```

**Response:**
```json
{
  "match": {
    "id": "match-456",
    "homeTeamId": "team-1",
    "awayTeamId": "team-2",
    "status": "UPCOMING",
    "homeScore": 0,
    "awayScore": 0
  },
  "message": "Match created successfully"
}
```

### PATCH /api/matches/[id]
Update match details (Admin only).

**Request Body:**
```json
{
  "homeScore": 3,
  "awayScore": 2,
  "status": "FINISHED"
}
```

**Response:**
```json
{
  "match": {
    "id": "match-123",
    "homeScore": 3,
    "awayScore": 2,
    "status": "FINISHED"
  },
  "message": "Match updated successfully"
}
```

### DELETE /api/matches/[id]
Delete a match (Admin only).

**Response:**
```json
{
  "message": "Match deleted successfully"
}
```

---

## Teams

### GET /api/teams
Fetch all teams with optional filters.

**Query Parameters:**
- `sport` (optional): Filter by sport
- `college` (optional): Filter by college
- `search` (optional): Search by name

**Response:**
```json
{
  "teams": [
    {
      "id": "team-1",
      "name": "Kings FC",
      "sport": "Football",
      "logo": "https://...",
      "college": "Kings College",
      "wins": 5,
      "losses": 2,
      "draws": 1
    }
  ],
  "total": 1
}
```

### GET /api/teams/[id]
Fetch team details with statistics.

**Response:**
```json
{
  "team": {
    "id": "team-1",
    "name": "Kings FC",
    "sport": "Football",
    "logo": "https://...",
    "wins": 5,
    "losses": 2,
    "draws": 1,
    "goalsFor": 15,
    "goalsAgainst": 8
  },
  "players": [
    {
      "id": "player-1",
      "name": "John Doe",
      "position": "Forward",
      "jerseyNumber": 10,
      "goals": 5,
      "assists": 3
    }
  ],
  "recentMatches": [
    {
      "id": "match-123",
      "opponent": "Pirates FC",
      "result": "W",
      "score": "2-1"
    }
  ]
}
```

---

## Players

### GET /api/players
Fetch all players with optional filters.

**Query Parameters:**
- `teamId` (optional): Filter by team
- `position` (optional): Filter by position
- `search` (optional): Search by name

**Response:**
```json
{
  "players": [
    {
      "id": "player-1",
      "name": "John Doe",
      "teamId": "team-1",
      "position": "Forward",
      "jerseyNumber": 10,
      "rating": 85,
      "goals": 5,
      "assists": 3,
      "appearances": 8
    }
  ],
  "total": 1
}
```

### GET /api/players/[id]
Fetch player details with statistics.

**Response:**
```json
{
  "player": {
    "id": "player-1",
    "name": "John Doe",
    "teamId": "team-1",
    "position": "Forward",
    "jerseyNumber": 10,
    "rating": 85
  },
  "team": {
    "id": "team-1",
    "name": "Kings FC",
    "logo": "https://..."
  },
  "stats": {
    "goals": 5,
    "assists": 3,
    "appearances": 8,
    "minutesPlayed": 720
  }
}
```

---

## Competitions

### GET /api/competitions
Fetch all competitions.

**Query Parameters:**
- `sport` (optional): Filter by sport
- `season` (optional): Filter by season
- `status` (optional): Filter by status

**Response:**
```json
{
  "competitions": [
    {
      "id": "comp-1",
      "name": "BUSA League Football",
      "sport": "Football",
      "format": "league",
      "season": "2024/2025",
      "status": "active",
      "numberOfTeams": 8
    }
  ],
  "total": 1
}
```

### GET /api/competitions/[id]/standings
Fetch competition standings.

**Response:**
```json
{
  "standings": [
    {
      "position": 1,
      "teamId": "team-1",
      "teamName": "Kings FC",
      "played": 8,
      "won": 5,
      "drawn": 1,
      "lost": 2,
      "goalsFor": 15,
      "goalsAgainst": 8,
      "goalDifference": 7,
      "points": 16
    }
  ]
}
```

---

## Predictions

### POST /api/predictions
Submit a match prediction.

**Request Body:**
```json
{
  "matchId": "match-123",
  "predictedHomeScore": 2,
  "predictedAwayScore": 1,
  "predictedWinner": "home",
  "confidence": 75
}
```

**Response:**
```json
{
  "prediction": {
    "id": "pred-123",
    "userId": "user-123",
    "matchId": "match-123",
    "predictedHomeScore": 2,
    "predictedAwayScore": 1,
    "confidence": 75,
    "potentialPoints": 15
  },
  "message": "Prediction submitted successfully"
}
```

### GET /api/predictions
Fetch user predictions.

**Query Parameters:**
- `userId` (optional): Filter by user
- `matchId` (optional): Filter by match

**Response:**
```json
{
  "predictions": [
    {
      "id": "pred-123",
      "matchId": "match-123",
      "predictedHomeScore": 2,
      "predictedAwayScore": 1,
      "confidence": 75,
      "points": 15,
      "isCorrect": true
    }
  ]
}
```

### GET /api/predictions/leaderboard
Fetch prediction leaderboard.

**Query Parameters:**
- `limit` (optional): Number of results (default: 10)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "userId": "user-123",
      "userName": "John Doe",
      "totalPoints": 150,
      "correctPredictions": 10,
      "totalPredictions": 15,
      "accuracy": 66.67,
      "currentStreak": 3
    }
  ]
}
```

### GET /api/predictions/stats
Fetch prediction statistics for a match.

**Query Parameters:**
- `matchId` (required): Match ID

**Response:**
```json
{
  "stats": {
    "totalPredictions": 50,
    "homeWinPercentage": 60,
    "awayWinPercentage": 25,
    "drawPercentage": 15,
    "averageHomeScore": 2.1,
    "averageAwayScore": 1.3,
    "averageConfidence": 68
  }
}
```

---

## Livestreams

### GET /api/livestreams/active
Fetch all active livestreams.

**Response:**
```json
{
  "streams": [
    {
      "match": {
        "id": "match-123",
        "homeScore": 2,
        "awayScore": 1,
        "status": "LIVE",
        "livestreamUrl": "https://youtube.com/watch?v=...",
        "livestreamType": "youtube"
      },
      "homeTeam": {
        "id": "team-1",
        "name": "Kings FC",
        "logo": "https://..."
      },
      "awayTeam": {
        "id": "team-2",
        "name": "Pirates FC",
        "logo": "https://..."
      },
      "viewers": 150
    }
  ]
}
```

### PATCH /api/matches/[id]/livestream
Update livestream settings (Admin only).

**Request Body:**
```json
{
  "livestreamUrl": "https://youtube.com/watch?v=...",
  "livestreamType": "youtube",
  "livestreamEnabled": true,
  "livestreamChatEnabled": true
}
```

**Response:**
```json
{
  "match": {
    "id": "match-123",
    "livestreamUrl": "https://youtube.com/watch?v=...",
    "livestreamEnabled": true
  },
  "message": "Livestream settings updated"
}
```

---

## Lineups (XI)

### POST /api/user/xi
Create a user lineup.

**Request Body:**
```json
{
  "name": "My Dream Team",
  "sport": "Football",
  "formation": "4-3-3",
  "players": [
    {
      "playerId": "player-1",
      "position": "GK",
      "x": 50,
      "y": 90
    },
    {
      "playerId": "player-2",
      "position": "LB",
      "x": 20,
      "y": 70
    }
  ],
  "isPublic": true
}
```

**Response:**
```json
{
  "lineup": {
    "id": "xi-123",
    "userId": "user-123",
    "name": "My Dream Team",
    "formation": "4-3-3",
    "players": [...],
    "isPublic": true
  },
  "message": "Lineup created successfully"
}
```

### GET /api/user/xi
Fetch user lineups.

**Query Parameters:**
- `userId` (optional): Filter by user
- `public` (optional): Show only public lineups

**Response:**
```json
{
  "lineups": [
    {
      "id": "xi-123",
      "name": "My Dream Team",
      "formation": "4-3-3",
      "players": [...],
      "createdAt": "2026-01-04T11:51:35.000Z"
    }
  ]
}
```

---

## Polls

### GET /api/polls
Fetch polls for a match.

**Query Parameters:**
- `matchId` (required): Match ID
- `type` (optional): Poll type (`match_winner`, `mvp`, etc.)

**Response:**
```json
{
  "polls": [
    {
      "id": "poll-123",
      "matchId": "match-123",
      "question": "Who will win?",
      "pollType": "match_winner",
      "options": [
        {
          "id": "opt-1",
          "label": "Kings FC",
          "votes": 30
        },
        {
          "id": "opt-2",
          "label": "Pirates FC",
          "votes": 20
        }
      ],
      "totalVotes": 50
    }
  ]
}
```

### POST /api/polls/vote
Submit a vote.

**Request Body:**
```json
{
  "pollId": "poll-123",
  "optionId": "opt-1"
}
```

**Response:**
```json
{
  "vote": {
    "id": "vote-123",
    "pollId": "poll-123",
    "optionId": "opt-1",
    "userId": "user-123"
  },
  "message": "Vote submitted successfully"
}
```

---

## Users

### GET /api/users/[id]
Fetch user profile.

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": "https://...",
    "role": "user"
  },
  "stats": {
    "totalPredictions": 15,
    "correctPredictions": 10,
    "totalPoints": 150,
    "rank": 5
  }
}
```

### PATCH /api/users/[id]
Update user profile.

**Request Body:**
```json
{
  "name": "John Smith",
  "avatar": "https://..."
}
```

---

## Admin

### GET /api/admin/stats
Fetch admin dashboard statistics (Admin only).

**Response:**
```json
{
  "stats": {
    "totalUsers": 500,
    "totalMatches": 100,
    "liveMatches": 3,
    "totalPredictions": 1500,
    "activeStreams": 2
  }
}
```

### POST /api/admin/loggers
Register a new logger (Admin only).

**Request Body:**
```json
{
  "name": "Logger Name",
  "email": "logger@example.com",
  "password": "password123"
}
```

---

## Error Handling

All endpoints follow a consistent error response format:

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Common Error Codes

- `VALIDATION_ERROR`: Invalid input data
- `UNAUTHORIZED`: Not authenticated
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `DUPLICATE_ENTRY`: Resource already exists
- `DATABASE_ERROR`: Database operation failed

### Example Error Response

```json
{
  "error": "Match not found",
  "code": "NOT_FOUND",
  "statusCode": 404
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authenticated users**: 100 requests per minute
- **Unauthenticated users**: 20 requests per minute
- **Admin endpoints**: 200 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704369095
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit`: Number of results per page (default: 50, max: 100)
- `offset`: Number of results to skip (default: 0)

**Response includes pagination metadata:**

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Webhooks

Brix V2 supports webhooks for real-time event notifications (Admin only).

### Available Events

- `match.started`: Match status changed to LIVE
- `match.finished`: Match status changed to FINISHED
- `match.score_updated`: Match score updated
- `prediction.submitted`: New prediction submitted
- `livestream.started`: Livestream started
- `livestream.ended`: Livestream ended

### Webhook Payload Format

```json
{
  "event": "match.started",
  "timestamp": "2026-01-04T11:51:35.000Z",
  "data": {
    "matchId": "match-123",
    "homeTeam": "Kings FC",
    "awayTeam": "Pirates FC"
  }
}
```

---

**Last Updated**: January 4, 2026
