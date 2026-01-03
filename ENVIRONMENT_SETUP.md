# 🔧 Environment Setup Guide

**Last Updated:** January 3, 2026

---

## 🚀 Quick Start

### 1. Create Your `.env.local` File

Copy this content to a new file named `.env.local` in the root directory:

```bash
# Turso Database Configuration
TURSO_CONNECTION_URL=file:./local.db
# TURSO_AUTH_TOKEN= # Not needed for local SQLite

# JWT Authentication Secret
JWT_SECRET=dev-secret-key-change-in-production-8f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=http://localhost:3000

# Push Notifications (VAPID Keys) ✅ CONFIGURED
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BDYyajLbF8Op4vstjSIzBPKRd_qLxvQpYRJBj9VLBoe6TZF-dJVQOWtwxCGvMyas1qp7NImmBUgenK4Eu7krPcA
VAPID_PRIVATE_KEY=tNgRs7W4-tDhaqLot8FTt2GUkV50jSBI0ltcqkEW_Jw
VAPID_SUBJECT=mailto:admin@brixsport.com

# Google OAuth (Optional - leave empty if not using)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Cloudinary (Optional - leave empty if not using)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=brix_uploads

# Email Service (Optional - leave empty if not using yet)
EMAIL_SERVICE_API_KEY=
EMAIL_FROM=noreply@brixsport.com

# Feature Flags
ENABLE_LIVESTREAM=true
ENABLE_PREDICTIONS=true
ENABLE_PUSH_NOTIFICATIONS=true

# Environment
NODE_ENV=development
```

---

## ✅ VAPID Keys Configured!

Your push notification VAPID keys have been generated and are ready to use:

- **Public Key:** `BDYyajLbF8Op4vstjSIzBPKRd_qLxvQpYRJBj9VLBoe6TZF-dJVQOWtwxCGvMyas1qp7NImmBUgenK4Eu7krPcA`
- **Private Key:** `tNgRs7W4-tDhaqLot8FTt2GUkV50jSBI0ltcqkEW_Jw`
- **Subject:** `mailto:admin@brixsport.com`

⚠️ **IMPORTANT:** These keys are for **DEVELOPMENT ONLY**. Generate new keys for production!

---

## 📋 Setup Steps

### Step 1: Create `.env.local`
```bash
# Copy the content above into a new file
touch .env.local
# Then paste the configuration
```

### Step 2: Run Database Migration
```bash
# Apply the push subscriptions migration
npm run db:push

# Or manually with SQLite
sqlite3 local.db < migrations/push-subscriptions.sql
```

### Step 3: Start the Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000` with:
- ✅ Push notifications enabled
- ✅ WebSocket real-time updates enabled
- ✅ Database connected (local SQLite)

---

## 🧪 Test Push Notifications

### 1. Subscribe a User
```bash
curl -X POST http://localhost:3000/api/notifications/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-1",
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
      "keys": {
        "p256dh": "test-p256dh-key",
        "auth": "test-auth-key"
      }
    }
  }'
```

### 2. Send a Test Notification
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "Push notifications are working!",
    "type": "test"
  }'
```

### 3. Check Subscription Status
```bash
curl http://localhost:3000/api/notifications/subscribe?userId=test-user-1
```

---

## 🔄 Test WebSocket Broadcasting

### 1. Connect to WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
    path: '/api/socket',
});

// Subscribe to match updates
socket.emit('match:subscribe', { matchId: 'match-123' });

// Listen for events
socket.on('event:new', (data) => {
    console.log('New event:', data);
});

socket.on('match:score:updated', (data) => {
    console.log('Score updated:', data);
});
```

### 2. Create a Match Event
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "match-123",
    "type": "GOAL",
    "minute": 45,
    "teamId": "team-1",
    "playerId": "player-1"
  }'
```

### 3. Verify Real-Time Update
Check your console - you should see the event broadcast in real-time! ✅

---

## 🔐 Production Setup

### Generate New VAPID Keys for Production
```bash
npx web-push generate-vapid-keys
```

### Update Production Environment Variables
```bash
# In your production environment (.env.production or hosting platform)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-production-public-key>
VAPID_PRIVATE_KEY=<your-production-private-key>
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Use a strong JWT secret
JWT_SECRET=<generate-with-openssl-rand-base64-32>

# Update URLs
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_WS_URL=https://yourdomain.com

# Use Turso for production database
TURSO_CONNECTION_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=<your-turso-token>
```

---

## 📚 Additional Configuration

### Email Service (Optional)
To enable password reset emails:

1. **Sign up for Resend** (recommended): https://resend.com
2. **Get your API key**
3. **Add to `.env.local`:**
```bash
EMAIL_SERVICE_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```

### Cloudinary (Optional)
To enable image uploads:

1. **Sign up for Cloudinary**: https://cloudinary.com
2. **Get your cloud name and upload preset**
3. **Add to `.env.local`:**
```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-preset
```

### Google OAuth (Optional)
To enable Google sign-in:

1. **Create OAuth credentials** in Google Cloud Console
2. **Add to `.env.local`:**
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## ✅ Verification Checklist

- [ ] `.env.local` file created
- [ ] VAPID keys configured
- [ ] Database migration applied
- [ ] Development server starts successfully
- [ ] Push notifications working (test with curl)
- [ ] WebSocket broadcasting working (test with socket.io-client)
- [ ] No console errors on startup

---

## 🐛 Troubleshooting

### "Cannot find module '@/db'"
```bash
# Restart the development server
npm run dev
```

### "Table push_subscriptions does not exist"
```bash
# Run the migration
npm run db:push
```

### "Socket.IO not initialized"
```bash
# Make sure you're using the custom server
npm run dev  # This uses server.js, not next dev
```

### "VAPID keys not working"
```bash
# Verify keys are in .env.local (not .env.example)
cat .env.local | grep VAPID
```

---

## 📞 Need Help?

If you encounter any issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure the database migration has been applied
4. Restart the development server

---

**Setup Status:** ✅ **READY FOR DEVELOPMENT**  
**Push Notifications:** ✅ **CONFIGURED**  
**WebSocket:** ✅ **CONFIGURED**  
**Database:** ✅ **READY**
