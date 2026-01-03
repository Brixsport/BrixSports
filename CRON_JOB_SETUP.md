# 🔔 Cron Job Setup Guide for Match Reminders

**Last Updated:** January 3, 2026

---

## 📋 Overview

The match reminder system requires a cron job to periodically check for pending reminders and send notifications. This guide covers multiple setup options.

---

## 🎯 Quick Setup (Recommended Options)

### **Option 1: Vercel Cron (Easiest for Vercel Deployments)** ⭐

If you're deploying to Vercel, this is the simplest option.

#### Step 1: Create `vercel.json`

Create a file named `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/reminders/check",
      "schedule": "* * * * *"
    }
  ]
}
```

This will run the reminder checker **every minute**.

#### Step 2: Add Authorization Header

Update `vercel.json` to include the authorization header:

```json
{
  "crons": [
    {
      "path": "/api/reminders/check",
      "schedule": "* * * * *",
      "headers": {
        "Authorization": "Bearer your-production-cron-secret"
      }
    }
  ]
}
```

#### Step 3: Deploy

```bash
vercel deploy
```

That's it! Vercel will automatically run your cron job every minute.

---

### **Option 2: GitHub Actions (Free & Reliable)** ⭐

Perfect for any deployment platform.

#### Step 1: Create Workflow File

Create `.github/workflows/reminder-checker.yml`:

```yaml
name: Check Match Reminders

on:
  schedule:
    # Runs every minute
    - cron: '* * * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  check-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Call Reminder Checker API
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/reminders/check \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

#### Step 2: Add Secrets to GitHub

1. Go to your repository on GitHub
2. Settings → Secrets and variables → Actions
3. Add these secrets:
   - `APP_URL`: Your app URL (e.g., `https://yourdomain.com`)
   - `CRON_SECRET`: Your cron secret from `.env`

#### Step 3: Enable Workflow

The workflow will run automatically every minute once pushed to GitHub.

---

### **Option 3: EasyCron (External Service)**

Free tier available, works with any hosting.

#### Step 1: Sign Up

1. Go to [EasyCron.com](https://www.easycron.com)
2. Create a free account

#### Step 2: Create Cron Job

1. Click "Create Cron Job"
2. **URL:** `https://yourdomain.com/api/reminders/check`
3. **Cron Expression:** `* * * * *` (every minute)
4. **HTTP Method:** POST
5. **HTTP Headers:**
   ```
   Authorization: Bearer your-cron-secret
   Content-Type: application/json
   ```

#### Step 3: Save and Enable

The service will now call your API every minute.

---

### **Option 4: Node-Cron (Built-in, Development Only)**

For local development and testing.

#### Step 1: Install Package

```bash
npm install node-cron
```

#### Step 2: Create Cron Service

Create `src/lib/cron.ts`:

```typescript
import cron from 'node-cron';

export function startReminderChecker() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            console.log('[Cron] Checking reminders...');
            
            const response = await fetch('http://localhost:3000/api/reminders/check', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();
            console.log('[Cron] Result:', result);
        } catch (error) {
            console.error('[Cron] Error:', error);
        }
    });

    console.log('[Cron] Reminder checker started');
}
```

#### Step 3: Start in Server

Update `server.js`:

```javascript
const { startReminderChecker } = require('./src/lib/cron');

// After server starts
httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    
    // Start cron job
    if (process.env.NODE_ENV !== 'production') {
        startReminderChecker();
    }
});
```

---

## 🔧 Configuration

### Environment Variables

Make sure these are set in your environment:

```bash
# In .env.local (development)
CRON_SECRET=dev-cron-secret-change-in-production

# In production environment
CRON_SECRET=your-secure-random-string-here
```

### Generate Secure Cron Secret

For production:

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Online
# Visit: https://www.random.org/strings/
```

---

## 🧪 Testing Your Cron Job

### Manual Test

Test the endpoint manually:

```bash
# PowerShell
$headers = @{
    "Authorization" = "Bearer dev-cron-secret-change-in-production"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/reminders/check" -Method POST -Headers $headers

# Or using curl (if installed)
curl -X POST http://localhost:3000/api/reminders/check \
  -H "Authorization: Bearer dev-cron-secret-change-in-production" \
  -H "Content-Type: application/json"
```

### Check Status

```bash
# Get reminder checker status
Invoke-RestMethod -Uri "http://localhost:3000/api/reminders/check" -Method GET
```

### Create Test Reminder

```bash
# Create a reminder for testing
$body = @{
    userId = "test-user"
    matchId = "test-match"
    minutesBefore = 1
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/reminders" -Method POST -Body $body -ContentType "application/json"
```

---

## 📊 Monitoring

### Check Logs

Your cron job will log to the console:

```
[Reminder Checker] Processing 3 pending reminders
[Reminder Checker] Sent notification to user-123
[Reminder Checker] Sent notification to user-456
[Reminder Checker] Success: 3 sent, 0 failed
```

### Monitor Endpoint

Call the status endpoint:

```bash
GET /api/reminders/check
```

Response:
```json
{
  "status": "operational",
  "pendingNow": 2,
  "upcomingNext24h": 15,
  "timestamp": "2026-01-03T20:30:00.000Z"
}
```

---

## 🔒 Security Best Practices

### 1. Use Strong Secrets

```bash
# Generate a strong secret
openssl rand -base64 32
```

### 2. Restrict Access

The endpoint checks for the `Authorization` header:

```typescript
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;

if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 3. Rate Limiting

Consider adding rate limiting to prevent abuse:

```typescript
// In your cron endpoint
const rateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 2, // Max 2 requests per minute
});
```

---

## ⚙️ Cron Schedule Examples

```bash
# Every minute
* * * * *

# Every 5 minutes
*/5 * * * *

# Every 15 minutes
*/15 * * * *

# Every hour
0 * * * *

# Every day at midnight
0 0 * * *
```

**Recommended:** `* * * * *` (every minute) for timely reminders

---

## 🐛 Troubleshooting

### Issue: Cron job not running

**Check:**
1. Is the cron service running?
2. Is the URL correct?
3. Is the authorization header correct?
4. Check logs for errors

### Issue: Unauthorized error

**Solution:**
```bash
# Verify your CRON_SECRET matches
echo $CRON_SECRET  # Linux/Mac
$env:CRON_SECRET   # PowerShell
```

### Issue: Reminders not sending

**Check:**
1. Are there pending reminders in the database?
2. Are push subscriptions configured?
3. Are VAPID keys set correctly?
4. Check the `/api/reminders/check` status endpoint

### Issue: Too many notifications

**Solution:**
- Adjust cron schedule to run less frequently
- Add rate limiting
- Check for duplicate reminders in database

---

## 📱 Alternative: Manual Trigger

For development, you can manually trigger the checker:

### Create a Button in Admin Panel

```tsx
// In your admin dashboard
const triggerReminderCheck = async () => {
    const response = await fetch('/api/reminders/check', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
    });
    
    const result = await response.json();
    console.log('Reminder check result:', result);
};

<button onClick={triggerReminderCheck}>
    Check Reminders Now
</button>
```

---

## 🎯 Recommended Setup by Environment

### Development
- **Option 4:** Node-Cron (built-in)
- Easy to test and debug
- No external dependencies

### Staging
- **Option 2:** GitHub Actions
- Free and reliable
- Easy to monitor

### Production
- **Option 1:** Vercel Cron (if using Vercel)
- **Option 2:** GitHub Actions (any platform)
- **Option 3:** EasyCron (any platform)

---

## ✅ Setup Checklist

- [ ] Choose cron option (Vercel/GitHub/EasyCron/Node-Cron)
- [ ] Configure cron job with correct URL
- [ ] Set Authorization header with CRON_SECRET
- [ ] Set schedule to `* * * * *` (every minute)
- [ ] Test manually with curl/Postman
- [ ] Create test reminder
- [ ] Wait 1 minute and verify notification sent
- [ ] Monitor logs for errors
- [ ] Set up alerts for failures (optional)

---

## 🚀 Quick Start Commands

### For Vercel
```bash
# 1. Create vercel.json (see Option 1 above)
# 2. Deploy
vercel deploy
```

### For GitHub Actions
```bash
# 1. Create .github/workflows/reminder-checker.yml
# 2. Add secrets to GitHub
# 3. Push to repository
git add .github/workflows/reminder-checker.yml
git commit -m "Add reminder checker cron job"
git push
```

### For Local Development
```bash
# 1. Install node-cron
npm install node-cron

# 2. Update server.js (see Option 4 above)
# 3. Start server
npm run dev
```

---

**Recommended for You:** Start with **GitHub Actions** (Option 2) - it's free, reliable, and works with any hosting platform! 🎯

---

**Need Help?** Check the logs at `/api/reminders/check` or manually trigger the endpoint to test! 🔍
