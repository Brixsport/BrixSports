# 🎥 Livestreaming Implementation Plan

## Overview
This document outlines the implementation of a comprehensive livestreaming feature for Brix V2, allowing users to watch live matches directly on the platform.

## Architecture

### Technology Stack
- **Video Streaming**: Support for multiple streaming platforms (YouTube, Twitch, custom HLS/DASH streams)
- **Player**: Custom video player with controls, quality selection, and fullscreen
- **Live Chat**: Real-time chat integration for viewer engagement
- **Admin Controls**: Easy management of stream URLs and settings

### Streaming Options
1. **Embedded Streams** (Phase 1 - Easiest)
   - YouTube Live embeds
   - Twitch embeds
   - Facebook Live embeds
   
2. **Custom Streams** (Phase 2 - Advanced)
   - HLS (HTTP Live Streaming)
   - DASH (Dynamic Adaptive Streaming)
   - WebRTC for ultra-low latency

### Highlights Workflow (Smart Replays)
Instead of manually editing and uploading video clips, the system creates highlights automatically:
1.  **Live Logging**: As the logger records events (Goals, Cards, etc.) using the Logger Tool, the system saves the exact timestamp.
2.  **Synchronization**: These timestamps are synchronized with the `livestreamStartTime`.
3.  **Playback**: When users watch the Full Match Replay, these events appear as markers on the timeline. Clicking a "Goal" event seeks the video player directly to that moment.

## Implementation Steps

### 1. Database Schema Updates

Add livestream fields to the `matches` table:
```typescript
// New fields for matches table
livestreamUrl: text('livestream_url'),           // URL to stream (YouTube, Twitch, or HLS/DASH)
livestreamType: text('livestream_type'),         // 'youtube' | 'twitch' | 'facebook' | 'hls' | 'dash' | 'custom'
livestreamEnabled: integer('livestream_enabled', { mode: 'boolean' }).default(false),
livestreamStartTime: integer('livestream_start_time', { mode: 'timestamp' }),
livestreamEndTime: integer('livestream_end_time', { mode: 'timestamp' }),
livestreamViewers: integer('livestream_viewers').default(0),
livestreamChatEnabled: integer('livestream_chat_enabled', { mode: 'boolean' }).default(true),
livestreamChatUrl: text('livestream_chat_url'),  // Optional separate chat URL
```

### 2. API Endpoints

#### GET `/api/matches/[id]/livestream`
- Returns livestream information for a match
- Response includes: URL, type, status, viewer count

#### PATCH `/api/matches/[id]/livestream` (Admin only)
- Update livestream settings for a match
- Body: `{ livestreamUrl, livestreamType, livestreamEnabled, livestreamChatEnabled }`

#### GET `/api/livestreams/active`
- Returns all currently active livestreams
- Useful for "Live Now" section on homepage

### 3. Frontend Components

#### `LivestreamPlayer` Component
- **Location**: `src/components/livestream/LivestreamPlayer.tsx`
- **Features**:
  - Adaptive player based on stream type
  - Quality selection
  - Fullscreen support
  - Volume controls
  - Live indicator with viewer count
  - Theater mode
  - Picture-in-picture support

#### `LivestreamChat` Component
- **Location**: `src/components/livestream/LivestreamChat.tsx`
- **Features**:
  - Real-time chat messages
  - User authentication integration
  - Emoji support
  - Moderation controls
  - Chat toggle

#### `LivestreamEmbed` Component
- **Location**: `src/components/livestream/LivestreamEmbed.tsx`
- **Features**:
  - Handles different embed types (YouTube, Twitch, etc.)
  - Responsive iframe wrapper
  - Loading states
  - Error handling

### 4. Match Page Integration

Update `src/app/matches/[id]/page.tsx`:
- Add livestream section at the top when available
- Show "Live Now" badge
- Display viewer count
- Integrate chat sidebar
- Fallback to match details when stream is offline

### 5. Homepage Integration

Update `src/app/page.tsx`:
- Add "Live Now" section showing active streams
- Featured livestream carousel
- Quick access to live matches

### 6. Admin Dashboard

Create `src/app/admin/livestreams/page.tsx`:
- Manage livestream URLs for matches
- Enable/disable streams
- Monitor viewer counts
- Test stream URLs
- Schedule streams

## UI/UX Design

### Livestream Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│  🔴 LIVE • 1,234 viewers                    [Theater] [⛶]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                                                               │
│                   VIDEO PLAYER                                │
│                                                               │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  [▶] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ LIVE  [🔊] [⚙] [⛶] │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────┐
│  Match Details           │  💬 Live Chat                    │
│                          │  ┌────────────────────────────┐  │
│  Team A vs Team B        │  │ User1: Great play! 🔥      │  │
│  Score: 2-1              │  │ User2: Let's go Team A!    │  │
│  Time: 45'               │  │ User3: Amazing goal ⚽     │  │
│                          │  └────────────────────────────┘  │
│  [Stats] [Events]        │  [Type a message...]  [Send]     │
└──────────────────────────┴──────────────────────────────────┘
```

### Design Principles
1. **Immersive Experience**: Full-width player with minimal distractions
2. **Responsive**: Works on mobile, tablet, and desktop
3. **Accessible**: Keyboard controls, screen reader support
4. **Performance**: Lazy loading, optimized embeds
5. **Engagement**: Integrated chat, reactions, polls

## Security Considerations

1. **URL Validation**: Validate stream URLs before saving
2. **Admin Only**: Only admins can manage livestream settings
3. **Rate Limiting**: Prevent abuse of viewer count updates
4. **Content Security**: CSP headers for iframe embeds
5. **HTTPS Only**: Ensure all streams use secure protocols

## Performance Optimization

1. **Lazy Loading**: Load player only when needed
2. **CDN**: Use CDN for static assets
3. **Adaptive Bitrate**: Support multiple quality levels
4. **Caching**: Cache stream metadata
5. **Progressive Enhancement**: Basic functionality without JavaScript

## Analytics & Monitoring

Track the following metrics:
- Total viewers per stream
- Peak concurrent viewers
- Average watch time
- Chat engagement rate
- Stream uptime/reliability
- Buffering events

## Future Enhancements

### Phase 2
- [ ] Multi-camera angles
- [ ] DVR/replay functionality
- [ ] Clip creation and sharing
- [ ] Live polls during matches
- [ ] Real-time statistics overlay
- [ ] Commentator audio tracks

### Phase 3
- [ ] Self-hosted streaming infrastructure
- [ ] Mobile app streaming
- [ ] 4K/HDR support
- [ ] Virtual reality viewing
- [ ] AI-powered highlights

## Testing Checklist

- [ ] YouTube embed works correctly
- [ ] Twitch embed works correctly
- [ ] HLS streams play smoothly
- [ ] Chat messages send/receive
- [ ] Fullscreen mode works
- [ ] Mobile responsive
- [ ] Viewer count updates
- [ ] Admin controls functional
- [ ] Error states handled
- [ ] Loading states smooth

## Deployment Steps

1. Run database migration to add new fields
2. Deploy API endpoints
3. Deploy frontend components
4. Update admin dashboard
5. Test with sample streams
6. Monitor performance
7. Gather user feedback

## Support & Documentation

- Create user guide for watching streams
- Create admin guide for managing streams
- Document supported stream formats
- Provide troubleshooting guide
- Set up monitoring alerts

---

**Status**: Ready for Implementation
**Priority**: High
**Estimated Time**: 2-3 days
**Dependencies**: None
