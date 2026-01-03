# PWA Implementation Guide

## Overview

Brixsport now has full Progressive Web App (PWA) support for users, admins, and loggers. This implementation provides:

- **Offline Support**: Access cached content when offline
- **Install Prompts**: Native-like installation on all devices
- **Push Notifications**: Real-time match updates
- **Background Sync**: Automatic data synchronization
- **Fast Performance**: Optimized caching strategies

## Architecture

### Service Workers

We have **two separate service workers** for different user types:

#### 1. User Service Worker (`/sw-user.js`)
- **Scope**: All regular users
- **Manifest**: `/manifest-user.json`
- **Caching Strategy**:
  - **API Requests**: Network-first with cache fallback
  - **Images**: Cache-first with network fallback
  - **Static Assets**: Cache-first
  - **Dynamic Content**: Network-first with cache fallback
- **Features**:
  - Background sync for favorites and profile updates
  - Push notifications for match events
  - Offline page fallback

#### 2. Admin/Logger Service Worker (`/sw-admin.js`)
- **Scope**: Admin and logger users
- **Manifest**: `/manifest-admin.json`
- **Caching Strategy**:
  - **API Requests**: Network-first with short cache
  - **Critical Data**: Always fresh from network
  - **Offline Logging**: IndexedDB storage for match events
- **Features**:
  - Background sync for match events and admin changes
  - Offline match logging capability
  - Real-time sync when connection restored

## Installation Instructions

### Android (Chrome/Edge)

1. Visit the Brixsport website
2. Look for the "Install" prompt at the bottom of the screen
3. Tap "Install App"
4. The app will be added to your home screen

**Alternative Method:**
1. Tap the three-dot menu (⋮) in the browser
2. Select "Add to Home screen" or "Install app"
3. Confirm the installation

### iPhone/iPad (Safari)

1. Open Brixsport in Safari
2. Tap the Share button (□↑) at the bottom of the screen
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. The app icon will appear on your home screen

**Note**: iOS requires Safari for PWA installation. Chrome/Firefox on iOS won't show the install option.

### Desktop (Chrome/Edge/Brave)

1. Visit Brixsport
2. Look for the install icon (⊕) in the address bar
3. Click "Install"
4. The app will open in its own window

**Alternative Method:**
1. Click the three-dot menu
2. Select "Install Brixsport" or "Create shortcut"
3. Check "Open as window"

## Features

### 1. Offline Support

**What Works Offline:**
- Previously viewed matches and scores
- Cached news articles
- Team and player profiles
- Favorite teams/players
- Match logger (for loggers)

**What Requires Connection:**
- Live match updates
- New content
- Push notifications
- Real-time sync

### 2. Background Sync

**For Users:**
- Favorites are queued and synced when online
- Profile updates are saved locally and synced later
- Automatic retry on connection restore

**For Loggers:**
- Match events are stored in IndexedDB when offline
- Automatic sync when connection is restored
- No data loss during temporary disconnections

### 3. Push Notifications

**Setup:**
```typescript
import { subscribeToPushNotifications } from '@/lib/pwa';

// After service worker registration
const subscription = await subscribeToPushNotifications(
  registration,
  VAPID_PUBLIC_KEY
);

// Send subscription to server
await fetch('/api/push/subscribe', {
  method: 'POST',
  body: JSON.stringify(subscription),
});
```

**Notification Types:**
- `GOAL`: Goal scored (high priority, vibration)
- `MATCH_START`: Match starting soon
- `RED_CARD`: Red card shown
- `MATCH_END`: Match finished
- Custom admin notifications

### 4. Install Prompts

**Components Available:**

1. **InstallPrompt** - Android/Desktop install prompt
2. **IOSInstallPrompt** - iOS step-by-step guide
3. **IOSInstallBanner** - Compact iOS banner
4. **UpdatePrompt** - New version notification

**Smart Timing:**
- Shows after 30 seconds of browsing
- Respects user dismissal (7-day cooldown)
- Detects already-installed state
- Platform-specific prompts

### 5. Offline Indicators

**Components:**
- **OfflineIndicator**: Banner notification for connection changes
- **OfflineBadge**: Persistent offline mode badge

**Features:**
- Automatic detection of online/offline state
- Network quality monitoring
- Visual feedback for connection status

## Usage

### Basic Setup (Already Configured)

The PWA is automatically enabled for:
- **Users**: Main app layout
- **Admin**: Admin dashboard
- **Logger**: Logger interface

### Custom PWA Integration

```typescript
import { PWAProvider } from '@/components/pwa/PWAProvider';

function MyApp({ children }) {
  return (
    <PWAProvider 
      swPath="/sw-user.js"
      showInstallPrompt={true}
      showOfflineIndicator={true}
      showUpdatePrompt={true}
    >
      {children}
    </PWAProvider>
  );
}
```

### Using PWA Hooks

```typescript
import { usePWA, useOnlineStatus, useBeforeInstallPrompt } from '@/hooks/usePWA';

function MyComponent() {
  const { registration, isRegistered } = usePWA('/sw-user.js');
  const isOnline = useOnlineStatus();
  const { isInstallable, promptInstall } = useBeforeInstallPrompt();

  const handleInstall = async () => {
    const outcome = await promptInstall();
    console.log('Install outcome:', outcome);
  };

  return (
    <div>
      <p>Online: {isOnline ? 'Yes' : 'No'}</p>
      {isInstallable && (
        <button onClick={handleInstall}>Install App</button>
      )}
    </div>
  );
}
```

### Cache Management

```typescript
import { clearCache, getCacheSize, formatBytes } from '@/lib/pwa';

// Get cache size
const size = await getCacheSize();
console.log('Cache size:', formatBytes(size));

// Clear specific cache
await clearCache('brixsport-user-v1-images');

// Clear all caches
await clearCache();
```

## Logger Offline Functionality

### How It Works

1. **Match Data Caching**: When a logger selects a match, the match data is cached in IndexedDB
2. **Offline Event Logging**: Events are stored locally when offline
3. **Background Sync**: Events are automatically synced when connection is restored
4. **No Data Loss**: All events are preserved even if the app is closed

### Implementation

```typescript
// In logger component
useEffect(() => {
  if (match && registration) {
    // Cache match data for offline use
    registration.active?.postMessage({
      type: 'CACHE_MATCH_DATA',
      match: match,
    });
  }
}, [match, registration]);

// Log event (works offline)
const logEvent = async (event) => {
  try {
    await fetch(`/api/matches/${matchId}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  } catch (error) {
    // Store in IndexedDB for later sync
    await storeOfflineEvent(event);
    
    // Register background sync
    if ('sync' in registration) {
      await registration.sync.register('sync-match-events');
    }
  }
};
```

## Testing

### Test Offline Mode

1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from throttling dropdown
4. Refresh the page
5. Verify offline page appears and cached content works

### Test Service Worker

1. Open DevTools → Application → Service Workers
2. Verify service worker is registered
3. Check "Update on reload" for development
4. Use "Unregister" to test fresh installation

### Test Install Prompt

1. Open in incognito/private mode
2. Visit the site
3. Wait 30 seconds
4. Verify install prompt appears
5. Test installation flow

### Test Background Sync

1. Go offline
2. Perform actions (favorite a team, log match event)
3. Go back online
4. Verify data syncs automatically
5. Check console for sync messages

## Troubleshooting

### Service Worker Not Registering

**Solution:**
- Ensure HTTPS (required for service workers)
- Check browser console for errors
- Verify service worker file is accessible
- Clear browser cache and try again

### Install Prompt Not Showing

**Reasons:**
- App already installed
- User previously dismissed (7-day cooldown)
- Not on HTTPS
- Browser doesn't support PWA

**Solution:**
- Check `localStorage` for `pwa-install-dismissed`
- Clear localStorage and refresh
- Use supported browser (Chrome, Edge, Safari)

### Offline Mode Not Working

**Solution:**
- Verify service worker is active
- Check cache storage in DevTools
- Ensure offline page exists at `/offline`
- Test with DevTools offline mode

### Push Notifications Not Working

**Solution:**
- Request notification permission first
- Verify VAPID keys are configured
- Check subscription is sent to server
- Test with browser notification API

## Best Practices

### 1. Cache Strategy

- **Static Assets**: Cache-first (long-lived)
- **API Data**: Network-first (fresh data)
- **Images**: Cache-first (bandwidth saving)
- **User Content**: Network-first with cache fallback

### 2. Cache Size Management

- Set maximum cache sizes
- Implement LRU (Least Recently Used) eviction
- Clear old caches on service worker update
- Monitor cache size in production

### 3. Update Strategy

- Check for updates hourly
- Prompt user for updates
- Skip waiting only on user action
- Reload page after update

### 4. Offline UX

- Show clear offline indicators
- Explain what works offline
- Queue actions for later sync
- Provide retry mechanisms

## Manifest Configuration

### User Manifest (`manifest-user.json`)

```json
{
  "name": "Brixsport - Live Sports",
  "short_name": "Brixsport",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "theme_color": "#8b5cf6",
  "background_color": "#050505",
  "shortcuts": [
    {
      "name": "Live Matches",
      "url": "/live?source=pwa"
    }
  ]
}
```

### Admin Manifest (`manifest-admin.json`)

```json
{
  "name": "Brixsport Admin & Logger",
  "short_name": "Brix Admin",
  "start_url": "/admin?source=pwa",
  "display": "standalone",
  "theme_color": "#ef4444",
  "shortcuts": [
    {
      "name": "Logger",
      "url": "/logger?source=pwa"
    }
  ]
}
```

## Performance Metrics

### Target Metrics

- **First Load**: < 3s
- **Repeat Load**: < 1s (cached)
- **Offline Load**: < 500ms
- **Cache Hit Rate**: > 80%

### Monitoring

```typescript
// Track cache performance
const trackCachePerformance = async () => {
  const cacheSize = await getCacheSize();
  const cacheNames = await caches.keys();
  
  console.log('Cache Performance:', {
    size: formatBytes(cacheSize),
    caches: cacheNames.length,
  });
};
```

## Security Considerations

1. **HTTPS Required**: PWAs only work on HTTPS
2. **Scope Limitation**: Service workers are scoped to their directory
3. **Content Security**: Validate all cached content
4. **Update Mechanism**: Regular service worker updates
5. **Permission Management**: Request permissions responsibly

## Future Enhancements

- [ ] Periodic background sync for live scores
- [ ] Advanced offline analytics
- [ ] Share target API integration
- [ ] File handling API for media uploads
- [ ] Web Share API for sharing matches
- [ ] Badging API for unread notifications
- [ ] Screen Wake Lock for live matches

## Support

For issues or questions:
- Check browser console for errors
- Review service worker status in DevTools
- Test in incognito mode
- Clear cache and try again
- Contact development team

## Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
