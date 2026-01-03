# 🚀 Quick Integration Guide

## Integrating Livestreaming & Predictions into Your App

This guide shows you how to quickly integrate the new features into your existing Brix V2 pages.

---

## 1. Add "Live Now" Section to Homepage

**File**: `src/app/page.tsx`

```typescript
import { LiveNowSection } from '@/components/livestream';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Your existing hero section */}
      
      {/* Add Live Now Section */}
      <section className="py-12 px-4">
        <LiveNowSection />
      </section>
      
      {/* Your existing content */}
    </div>
  );
}
```

---

## 2. Update Match Detail Page

**File**: `src/app/matches/[id]/page.tsx`

```typescript
import { UpcomingMatchView } from '@/components/matches/UpcomingMatchView';
import { LivestreamView } from '@/components/livestream';

export default async function MatchPage({ params }: { params: { id: string } }) {
  // Fetch match data
  const match = await fetchMatch(params.id);
  
  // Check if match has active livestream
  const livestreamResponse = await fetch(`/api/matches/${params.id}/livestream`);
  const livestream = livestreamResponse.ok ? await livestreamResponse.json() : null;
  
  // Render based on match status
  if (match.status === 'LIVE' && livestream?.isActive) {
    return <LivestreamView match={match} livestream={livestream} />;
  }
  
  if (match.status === 'UPCOMING') {
    return <UpcomingMatchView match={match} />;
  }
  
  // Your existing finished match view
  return <FinishedMatchView match={match} />;
}
```

---

## 3. Add Prediction Card to Match Cards

**File**: `src/components/matches/MatchCard.tsx`

```typescript
import { MatchVotePoll } from '@/components/predictions';

export function MatchCard({ match }: { match: Match }) {
  return (
    <div className="match-card">
      {/* Your existing match card content */}
      
      {/* Add quick poll for upcoming matches */}
      {match.status === 'UPCOMING' && (
        <div className="mt-4">
          <MatchVotePoll match={match} compact />
        </div>
      )}
    </div>
  );
}
```

---

## 4. Add Livestream Button to Match Cards

**File**: `src/components/matches/MatchCard.tsx`

```typescript
import { Radio, Play } from 'lucide-react';
import Link from 'next/link';

export function MatchCard({ match }: { match: Match }) {
  const hasLivestream = match.livestreamEnabled && match.livestreamUrl;
  
  return (
    <div className="match-card">
      {/* Your existing content */}
      
      {/* Add livestream button for live matches */}
      {match.status === 'LIVE' && hasLivestream && (
        <Link
          href={`/livestream/${match.id}`}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          <span>Watch Live</span>
        </Link>
      )}
      
      {/* Add prediction button for upcoming matches */}
      {match.status === 'UPCOMING' && (
        <Link
          href={`/matches/${match.id}`}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Play className="w-4 h-4" />
          <span>Make Prediction</span>
        </Link>
      )}
    </div>
  );
}
```

---

## 5. Add Admin Link to Navigation

**File**: `src/components/layout/AdminNav.tsx` or similar

```typescript
import { Video } from 'lucide-react';
import Link from 'next/link';

export function AdminNav() {
  return (
    <nav>
      {/* Your existing admin links */}
      
      <Link
        href="/admin/livestreams"
        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-lg"
      >
        <Video className="w-5 h-5" />
        <span>Livestreams</span>
      </Link>
    </nav>
  );
}
```

---

## 6. Test the Features

### Test Livestreaming

1. **Create a test match** (if you don't have one):
   ```sql
   INSERT INTO matches (id, sport, homeTeamId, awayTeamId, status, startTime, venue, competition)
   VALUES ('test-match-1', 'Football', 'team-1', 'team-2', 'LIVE', '2025-12-29T15:00:00Z', 'Test Stadium', 'Test League');
   ```

2. **Go to admin panel**: `/admin/livestreams`

3. **Add a livestream URL**:
   - Use a public YouTube live stream or video
   - Example: `https://youtube.com/watch?v=jfKfPfyJRdk`
   - Select "YouTube" as type
   - Enable livestream

4. **View the livestream**: `/livestream/test-match-1`

### Test Predictions

1. **Create an upcoming match**:
   ```sql
   INSERT INTO matches (id, sport, homeTeamId, awayTeamId, status, startTime, venue, competition)
   VALUES ('test-match-2', 'Football', 'team-1', 'team-2', 'UPCOMING', '2025-12-30T15:00:00Z', 'Test Stadium', 'Test League');
   ```

2. **Visit match page**: `/matches/test-match-2`

3. **Make a prediction**:
   - Enter scores
   - Set confidence level
   - Submit prediction

4. **Vote in poll**:
   - Click "Vote Winner" tab
   - Select your choice
   - See results

---

## 7. Environment Variables (Optional)

Add to `.env.local` if needed:

```env
# Base URL for server-side fetching
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# For production
# NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

---

## 8. Styling Customization

All components use Tailwind CSS and can be customized:

```typescript
// Example: Change livestream player colors
<LivestreamPlayer
  streamUrl={url}
  streamType="youtube"
  matchTitle="Match Title"
  className="custom-player-class" // Add custom class
/>
```

---

## 9. API Integration Examples

### Fetch Active Livestreams

```typescript
const response = await fetch('/api/livestreams/active');
const { streams, count, liveCount } = await response.json();

console.log(`${liveCount} live streams out of ${count} total`);
```

### Update Livestream Settings

```typescript
const response = await fetch(`/api/matches/${matchId}/livestream`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    livestreamUrl: 'https://youtube.com/watch?v=...',
    livestreamType: 'youtube',
    livestreamEnabled: true,
    livestreamChatEnabled: true,
  }),
});
```

### Submit Prediction

```typescript
const response = await fetch('/api/predictions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    matchId: 'match-123',
    userId: user.id,
    predictedHomeScore: 2,
    predictedAwayScore: 1,
    predictedWinner: 'home',
    confidence: 75,
  }),
});
```

---

## 10. Mobile Responsiveness

All components are mobile-responsive by default:

- **Livestream**: Chat toggles on mobile, full layout on desktop
- **Predictions**: Stacks vertically on mobile, grid on desktop
- **Match View**: Responsive grid system

---

## 11. Performance Tips

1. **Lazy Load Components**:
   ```typescript
   import dynamic from 'next/dynamic';
   
   const LivestreamPlayer = dynamic(
     () => import('@/components/livestream').then(mod => mod.LivestreamPlayer),
     { ssr: false }
   );
   ```

2. **Cache API Responses**:
   ```typescript
   const response = await fetch('/api/livestreams/active', {
     next: { revalidate: 30 } // Revalidate every 30 seconds
   });
   ```

3. **Optimize Images**:
   ```typescript
   import Image from 'next/image';
   
   <Image
     src={team.logo}
     alt={team.name}
     width={64}
     height={64}
     className="object-contain"
   />
   ```

---

## 12. Common Issues & Solutions

### Issue: Livestream not loading
**Solution**: Check browser console for CORS errors. Ensure the stream URL is publicly accessible.

### Issue: Chat not showing messages
**Solution**: This is expected - WebSocket integration is pending. Messages are currently simulated.

### Issue: Predictions not saving
**Solution**: Ensure user is authenticated. Check `/api/predictions` endpoint is working.

### Issue: TypeScript errors
**Solution**: Run `npm run build` to check for type errors. Most should be resolved.

---

## 13. Next Steps

1. ✅ Database migration applied
2. ⏳ Integrate components into existing pages
3. ⏳ Test with real data
4. ⏳ Add WebSocket for real-time features
5. ⏳ Deploy to production

---

## 14. Support

For questions or issues:
1. Check `LIVESTREAM_QUICK_START.md`
2. Check `LIVESTREAM_PREDICTIONS_SUMMARY.md`
3. Review component code and comments
4. Check browser console for errors

---

**Happy Coding! 🚀**

Last Updated: December 29, 2025
