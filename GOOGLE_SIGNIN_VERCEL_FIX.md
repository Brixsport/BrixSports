# 🔧 Google Sign-In Not Working on Vercel - Troubleshooting Guide

## Issue
Google Sign-In is not working on production deployment: `https://brixs2.vercel.app/`

---

## ✅ Checklist - Follow These Steps

### Step 1: Update Google Cloud Console

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Select your project** (Brix Sport)
3. **Go to APIs & Services → Credentials**
4. **Click on your OAuth 2.0 Client ID**

5. **Add Production URLs to Authorized JavaScript origins:**
   ```
   https://brixs2.vercel.app
   ```

6. **Add Production URLs to Authorized redirect URIs:**
   ```
   https://brixs2.vercel.app/api/auth/callback/google
   ```

7. **Click SAVE**

### Step 2: Update Vercel Environment Variables

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Select your project** (brixs2)
3. **Go to Settings → Environment Variables**

4. **Add/Update these variables:**

   ```bash
   # Google OAuth
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
   
   # NextAuth Configuration
   NEXTAUTH_URL=https://brixs2.vercel.app
   NEXTAUTH_SECRET=your-production-secret-here
   ```

5. **Make sure to set them for:**
   - ✅ Production
   - ✅ Preview (optional)
   - ✅ Development (optional)

### Step 3: Generate New NEXTAUTH_SECRET (if needed)

Run this command locally to generate a secure secret:

```bash
# PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or use OpenSSL
openssl rand -base64 32
```

Copy the output and use it as your `NEXTAUTH_SECRET` in Vercel.

### Step 4: Redeploy Your Application

After updating environment variables:

1. **Go to Deployments tab in Vercel**
2. **Click on the latest deployment**
3. **Click the three dots (•••)**
4. **Select "Redeploy"**
5. **Wait for deployment to complete**

---

## 🔍 Common Issues & Solutions

### Issue 1: "redirect_uri_mismatch" Error

**Cause:** The redirect URI in Google Console doesn't match your production URL.

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Add EXACTLY this redirect URI:
   ```
   https://brixs2.vercel.app/api/auth/callback/google
   ```
4. Make sure there are NO trailing slashes
5. Save and wait 5 minutes for changes to propagate

### Issue 2: "Access blocked: This app's request is invalid"

**Cause:** OAuth consent screen not properly configured or app not published.

**Solution:**
1. Go to Google Cloud Console → OAuth consent screen
2. Make sure all required fields are filled:
   - App name
   - User support email
   - Developer contact information
3. Add your production domain to **Authorized domains**:
   ```
   vercel.app
   ```
4. If app is in "Testing" mode, add yourself as a test user
5. Or publish the app (click "Publish App")

### Issue 3: Environment Variables Not Loading

**Cause:** Environment variables not set correctly in Vercel.

**Solution:**
1. Check that ALL required variables are set:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
2. Make sure there are no extra spaces or quotes
3. Redeploy after adding variables

### Issue 4: "Configuration error" or "There is a problem with the server configuration"

**Cause:** Missing or incorrect `NEXTAUTH_SECRET`.

**Solution:**
1. Generate a new secret:
   ```bash
   openssl rand -base64 32
   ```
2. Add it to Vercel environment variables
3. Redeploy

### Issue 5: Sign-in button does nothing

**Cause:** Client-side code not properly configured.

**Solution:**
Check your sign-in button code:
```typescript
// Make sure you're using the correct provider name
onClick={() => signIn('google', { callbackUrl: '/' })}
```

---

## 🧪 Testing Steps

### Test 1: Check Environment Variables

1. Add a temporary API route to check env vars:

```typescript
// src/app/api/test-env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL, // Safe to expose
    });
}
```

2. Visit: `https://brixs2.vercel.app/api/test-env`
3. All values should be `true`
4. `nextAuthUrl` should be `https://brixs2.vercel.app`

### Test 2: Check OAuth Callback

1. Try signing in
2. If you get redirected to Google, that's good!
3. Check the URL Google redirects you back to
4. It should be: `https://brixs2.vercel.app/api/auth/callback/google?code=...`

### Test 3: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try signing in
4. Look for any error messages

---

## 📝 Quick Fix Script

Run this locally to verify your setup:

```bash
# Check if environment variables are set
echo "Checking environment variables..."

# Check Google OAuth
if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "❌ GOOGLE_CLIENT_ID is not set"
else
    echo "✅ GOOGLE_CLIENT_ID is set"
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "❌ GOOGLE_CLIENT_SECRET is not set"
else
    echo "✅ GOOGLE_CLIENT_SECRET is set"
fi

# Check NextAuth
if [ -z "$NEXTAUTH_URL" ]; then
    echo "❌ NEXTAUTH_URL is not set"
else
    echo "✅ NEXTAUTH_URL is set: $NEXTAUTH_URL"
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "❌ NEXTAUTH_SECRET is not set"
else
    echo "✅ NEXTAUTH_SECRET is set"
fi
```

---

## 🎯 Step-by-Step Fix (Most Common Solution)

### 1. Update Google Console (5 minutes)

```
1. Go to: https://console.cloud.google.com/
2. Select your project
3. Go to: APIs & Services → Credentials
4. Click your OAuth 2.0 Client ID
5. Under "Authorized redirect URIs", add:
   https://brixs2.vercel.app/api/auth/callback/google
6. Click SAVE
```

### 2. Update Vercel Variables (3 minutes)

```
1. Go to: https://vercel.com/dashboard
2. Select: brixs2 project
3. Go to: Settings → Environment Variables
4. Add/Update:
   - NEXTAUTH_URL = https://brixs2.vercel.app
   - NEXTAUTH_SECRET = (generate new with: openssl rand -base64 32)
   - GOOGLE_CLIENT_ID = (from Google Console)
   - GOOGLE_CLIENT_SECRET = (from Google Console)
5. Select "Production" environment
6. Click SAVE
```

### 3. Redeploy (2 minutes)

```
1. Go to: Deployments tab
2. Click latest deployment
3. Click ••• → Redeploy
4. Wait for completion
```

### 4. Test (1 minute)

```
1. Go to: https://brixs2.vercel.app
2. Click "Sign In with Google"
3. Should work! ✅
```

---

## 📞 Still Not Working?

### Check Vercel Logs

1. Go to Vercel Dashboard → Your Project
2. Click on the latest deployment
3. Go to "Functions" tab
4. Look for errors in the logs

### Check Google Cloud Logs

1. Go to Google Cloud Console
2. Go to "Logging" → "Logs Explorer"
3. Look for OAuth-related errors

### Common Error Messages

**"redirect_uri_mismatch"**
- Fix: Add correct redirect URI to Google Console

**"invalid_client"**
- Fix: Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

**"Configuration error"**
- Fix: Check NEXTAUTH_SECRET is set

**"There is a problem with the server configuration"**
- Fix: Check all environment variables are set correctly

---

## ✅ Final Checklist

Before asking for help, make sure:

- [ ] Google Console has production URL in redirect URIs
- [ ] Vercel has all 4 environment variables set
- [ ] Environment variables have no extra spaces/quotes
- [ ] You've redeployed after adding variables
- [ ] You've waited 5 minutes after Google Console changes
- [ ] Browser cache is cleared
- [ ] You're using the correct Google account (if in testing mode)

---

## 🆘 Need More Help?

If you've tried everything above and it's still not working:

1. **Check the exact error message** in browser console
2. **Check Vercel function logs** for server-side errors
3. **Verify your OAuth client type** is "Web application"
4. **Try creating a new OAuth client** in Google Console
5. **Contact me** with:
   - Exact error message
   - Screenshot of Google Console redirect URIs
   - Screenshot of Vercel environment variables (hide secrets!)
   - Browser console logs

---

**Last Updated:** January 4, 2026  
**Status:** Production Troubleshooting Guide
