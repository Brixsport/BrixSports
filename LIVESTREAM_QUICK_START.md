# 🎥 Livestreaming Feature - Quick Start Guide

## Overview
The Brix V2 livestreaming feature allows you to broadcast matches live to your users with integrated chat, real-time statistics, and multi-platform support.

## For Administrators

### Setting Up a Livestream

1. **Navigate to Livestream Management**
   - Go to `/admin/livestreams`
   - You'll see a list of upcoming and live matches

2. **Configure a Match for Livestreaming**
   - Click the **Edit** button next to the match you want to stream
   - Fill in the following details:
     - **Stream URL**: The URL of your livestream
     - **Stream Type**: Select the platform (YouTube, Twitch, Facebook, HLS, DASH, or Custom)
     - **Enable Livestream**: Toggle to activate the stream
     - **Enable Chat**: Toggle to allow viewers to chat

3. **Save Your Settings**
   - Click **Save Changes**
   - The livestream will now be active and visible to users

### Supported Stream Types

#### YouTube
- **URL Format**: `https://youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`
- **Example**: `https://youtube.com/watch?v=dQw4w9WgXcQ`
- **Best For**: Public streams, easy setup, built-in chat

#### Twitch
- **URL Format**: `https://twitch.tv/CHANNEL_NAME`
- **Example**: `https://twitch.tv/your_channel`
- **Best For**: Gaming content, interactive features

#### Facebook Live
- **URL Format**: Full Facebook video URL
- **Example**: `https://www.facebook.com/username/videos/123456789`
- **Best For**: Social media integration

#### HLS (HTTP Live Streaming)
- **URL Format**: `.m3u8` playlist URL
- **Example**: `https://your-server.com/stream/playlist.m3u8`
- **Best For**: Custom streaming servers, adaptive bitrate

#### DASH (Dynamic Adaptive Streaming)
- **URL Format**: `.mpd` manifest URL
- **Example**: `https://your-server.com/stream/manifest.mpd`
- **Best For**: High-quality adaptive streaming

### Managing Active Streams

- **View Active Streams**: The dashboard shows a count of currently active streams
- **Toggle Stream Status**: Quickly enable/disable streams with the status toggle
- **Monitor Viewers**: See real-time viewer counts (simulated in current version)

## For Users

### Watching a Livestream

1. **Find Live Matches**
   - Check the **"Live Now"** section on the homepage
   - Look for matches with the 🔴 LIVE badge
   - See viewer counts to gauge popularity

2. **Start Watching**
   - Click on any live match card
   - You'll be taken to the livestream page
   - The video will start playing automatically

3. **Interact with the Stream**
   - **Chat**: Join the conversation in the live chat (requires login)
   - **Fullscreen**: Click the fullscreen button for immersive viewing
   - **Share**: Share the stream with friends using the share button
   - **View Stats**: Switch between Stats and Events tabs to see match details

### Chat Features

- **Send Messages**: Type your message and press Enter or click Send
- **Emoji Support**: Click the emoji button to add reactions
- **Auto-scroll**: Chat automatically scrolls to show new messages
- **User Avatars**: See who's chatting with profile pictures

## Technical Setup

### Database Migration

The livestream feature requires new database fields. Run the migration:

```bash
# Generate migration
npx drizzle-kit generate

# Apply migration
npx drizzle-kit push
```

### Environment Variables

No additional environment variables are required for basic functionality.

For production deployments with custom streaming:
```env
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## Testing the Feature

### Test with YouTube

1. Find a public YouTube live stream or video
2. Copy the URL (e.g., `https://youtube.com/watch?v=jfKfPfyJRdk`)
3. In admin panel, paste the URL and select "YouTube" as type
4. Enable the livestream
5. Visit the match page or livestream page to see it in action

### Test with Sample Data

```javascript
// Example livestream configuration
{
  "livestreamUrl": "https://youtube.com/watch?v=jfKfPfyJRdk",
  "livestreamType": "youtube",
  "livestreamEnabled": true,
  "livestreamChatEnabled": true,
  "livestreamViewers": 0
}
```

## Common Issues & Solutions

### Issue: Video Not Loading
- **Solution**: Check that the URL is correct and publicly accessible
- Verify the stream type matches the URL format
- Ensure HTTPS is used for all URLs

### Issue: Chat Not Working
- **Solution**: Verify `livestreamChatEnabled` is set to `true`
- Check that users are logged in (chat requires authentication)

### Issue: Fullscreen Not Working
- **Solution**: Some browsers block fullscreen for iframes
- Try a different browser or enable fullscreen permissions

### Issue: Stream Shows as Inactive
- **Solution**: Check `livestreamEnabled` is `true`
- Verify `livestreamStartTime` and `livestreamEndTime` (if set) are correct
- Ensure match status is LIVE or UPCOMING

## API Endpoints

### Get Livestream Info
```
GET /api/matches/[id]/livestream
```

### Update Livestream Settings (Admin)
```
PATCH /api/matches/[id]/livestream
Body: {
  "livestreamUrl": "string",
  "livestreamType": "youtube" | "twitch" | "facebook" | "hls" | "dash" | "custom",
  "livestreamEnabled": boolean,
  "livestreamChatEnabled": boolean
}
```

### Get All Active Livestreams
```
GET /api/livestreams/active
```

## Best Practices

1. **Test Before Going Live**: Always test your stream URL before the match starts
2. **Enable Chat Moderation**: Monitor chat for inappropriate content
3. **Set Viewer Expectations**: Communicate stream quality and any delays
4. **Have a Backup Plan**: Keep alternative streaming options ready
5. **Monitor Performance**: Watch for buffering or quality issues

## Future Enhancements

- [ ] WebSocket integration for real-time viewer counts
- [ ] Chat moderation tools
- [ ] Stream quality selection
- [ ] DVR/replay functionality
- [ ] Multi-camera angles
- [ ] Live polls and reactions
- [ ] Clip creation and sharing
- [ ] Mobile app support

## Support

For issues or questions:
- Check this guide first
- Review the implementation plan: `LIVESTREAM_IMPLEMENTATION_PLAN.md`
- Check browser console for errors
- Verify database schema is up to date

---

**Last Updated**: December 29, 2025
**Version**: 1.0.0
