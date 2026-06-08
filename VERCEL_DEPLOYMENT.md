# 🚀 Vercel Deployment Guide - Brix V2

**Last Updated:** January 3, 2026  
**Estimated Time:** 20-30 minutes

---

## 📋 Overview

This guide will walk you through deploying your Brix V2 application to Vercel, including database setup, environment variables, and cron jobs.

---

## 🎯 Step 1: Prepare Your Project

### 1.1 Verify Build Works Locally
```bash
# Build the project
npm run build

# If successful, you'll see:
# ✓ Compiled successfully
```

**If build fails:**
- Fix any TypeScript errors
- Fix any import errors
- Check all dependencies are installed

### 1.2 Create `.vercelignore` (Optional)
Create `.vercelignore` in your project root:

```
.env.local
.env
local.db
node_modules
.next
```

### 1.3 Update `package.json` Scripts
Make sure you have these scripts:

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "node server.js",
    "lint": "next lint",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## 🎯 Step 2: Set Up Turso Database (Production)

### 2.1 Install Turso CLI
```bash
# Windows (PowerShell as Administrator)
irm https://get.turso.tech/install.ps1 | iex

# Or download from: https://docs.turso.tech/cli/installation
```

### 2.2 Sign Up for Turso
```bash
turso auth signup
```

This will open your browser. Sign up with:
- GitHub account (recommended)
- Or email

### 2.3 Create Production Database
```bash
# Create database
turso db create brix-sport-prod

# Get database URL
turso db show brix-sport-prod

# Create auth token
turso db tokens create brix-sport-prod
```

**Save these values:**
- **Database URL:** `libsql://brix-sport-prod-[your-org].turso.io`
- **Auth Token:** `eyJhbGc...` (long token)

### 2.4 Apply Schema to Production Database
```bash
# Set environment variables temporarily
$env:TURSO_CONNECTION_URL="libsql://brix-sport-prod-[your-org].turso.io"
$env:TURSO_AUTH_TOKEN="your-auth-token-here"

# Push schema
npm run db:push
```

---

## 🎯 Step 3: Prepare Git Repository

### 3.1 Initialize Git (if not already)
```bash
git init
```

### 3.2 Create `.gitignore`
Make sure `.gitignore` includes:

```
# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# next.js
.next/
out/
build
dist

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# database
local.db
local.db-shm
local.db-wal

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

### 3.3 Commit Your Code
```bash
git add .
git commit -m "Initial commit - Ready for Vercel deployment"
```

### 3.4 Push to GitHub
```bash
# Create a new repository on GitHub first
# Then:
git remote add origin https://github.com/Brixsport/BrixSports.git
git branch -M main
git push -u origin main
```

---

## 🎯 Step 4: Deploy to Vercel

### 4.1 Sign Up for Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Sign up with **GitHub** (recommended)

### 4.2 Import Your Project
1. Click **"Add New..."** → **"Project"**
2. Select your GitHub repository: **`brix-v2`**
3. Click **"Import"**

### 4.3 Configure Project Settings

**Framework Preset:**
- Should auto-detect: **Next.js**

**Root Directory:**
- Leave as: **`./`**

**Build Command:**
- Default: `npm run build` ✅

**Output Directory:**
- Default: `.next` ✅

**Install Command:**
- Default: `npm install` ✅

---

## 🎯 Step 5: Configure Environment Variables

### 5.1 Add Environment Variables in Vercel

Click **"Environment Variables"** and add these:

#### **Database**
```
TURSO_CONNECTION_URL = libsql://brix-sport-prod-[your-org].turso.io
TURSO_AUTH_TOKEN = eyJhbGc... (your token)
```

#### **Authentication**
```
JWT_SECRET = (generate new: openssl rand -base64 32)
```

#### **Application URLs**
```
NEXT_PUBLIC_APP_URL = https://your-project.vercel.app
NEXT_PUBLIC_BASE_URL = https://your-project.vercel.app
NEXT_PUBLIC_WS_URL = https://your-project.vercel.app
```

#### **Push Notifications**
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY = BDYyajLbF8Op4vstjSIzBPKRd_qLxvQpYRJBj9VLBoe6TZF-dJVQOWtwxCGvMyas1qp7NImmBUgenK4Eu7krPcA
VAPID_PRIVATE_KEY = tNgRs7W4-tDhaqLot8FTt2GUkV50jSBI0ltcqkEW_Jw
VAPID_SUBJECT = mailto:admin@brixsport.com
```

#### **Cron Job Secret**
```
CRON_SECRET = (generate new: openssl rand -base64 32)
```

#### **Optional (if using)**
```
GOOGLE_CLIENT_ID = your-google-client-id
GOOGLE_CLIENT_SECRET = your-google-client-secret
NEXTAUTH_URL = https://your-project.vercel.app
NEXTAUTH_SECRET = (generate new: openssl rand -base64 32)
EMAIL_SERVICE_API_KEY = (if using email)
EMAIL_FROM = noreply@brixsport.com
```

**For all environments:** Select **Production**, **Preview**, and **Development**

### 5.2 Generate Secrets
```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate CRON_SECRET
openssl rand -base64 32

# Generate NEXTAUTH_SECRET (if using Google OAuth)
openssl rand -base64 32
```

---

## 🎯 Step 6: Configure Vercel Cron Jobs

### 6.1 Create `vercel.json`
Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/reminders/check",
      "schedule": "* * * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

### 6.2 Commit and Push
```bash
git add vercel.json
git commit -m "Add Vercel cron job configuration"
git push
```

---

## 🎯 Step 7: Deploy!

### 7.1 Click Deploy
1. Review your settings
2. Click **"Deploy"**
3. Wait for deployment (2-5 minutes)

### 7.2 Monitor Deployment
Watch the build logs:
- ✅ Installing dependencies
- ✅ Building application
- ✅ Uploading build
- ✅ Deployment ready!

### 7.3 Get Your URL
Once deployed, you'll get:
- **Production URL:** `https://brix-v2-abc123.vercel.app`

---

## 🎯 Step 8: Test Your Deployment

### 8.1 Basic Tests
1. **Visit your site:** `https://your-project.vercel.app`
2. **Check homepage loads** ✅
3. **Check navigation works** ✅
4. **Check API routes work** ✅

### 8.2 Test Database Connection
```bash
# Visit API endpoint
https://your-project.vercel.app/api/teams

# Should return teams data (or empty array)
```

### 8.3 Test Push Notifications
```bash
# Test subscription endpoint
curl https://your-project.vercel.app/api/notifications/subscribe?userId=test-user
```

### 8.4 Test Cron Job
```bash
# Check cron status
curl https://your-project.vercel.app/api/reminders/check

# Should return:
# {"status":"operational","pendingNow":0,"upcomingNext24h":0}
```

### 8.5 Check Vercel Logs
1. Go to Vercel Dashboard
2. Click your project
3. Go to **"Logs"** tab
4. Check for any errors

---

## 🎯 Step 9: Update Google OAuth (if using)

### 9.1 Add Vercel URL to Google Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **Credentials**
4. Edit your OAuth client
5. Add to **Authorized JavaScript origins:**
   ```
   https://your-project.vercel.app
   ```
6. Add to **Authorized redirect URIs:**
   ```
   https://your-project.vercel.app/api/auth/callback/google
   ```
7. Click **"Save"**

### 9.2 Test Google Sign-In
1. Visit: `https://your-project.vercel.app/auth/signin`
2. Click "Continue with Google"
3. Should work! ✅

---

## 🎯 Step 10: Set Up Custom Domain (Later)

### 10.1 Add Domain in Vercel
1. Go to your project in Vercel
2. Click **"Settings"** → **"Domains"**
3. Click **"Add"**
4. Enter your domain: `brixsport.com`
5. Click **"Add"**

### 10.2 Configure DNS
Vercel will show you DNS records to add:

**Option A: Using Nameservers (Recommended)**
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

**Option B: Using A/CNAME Records**
```
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

### 10.3 Wait for DNS Propagation
- Usually takes 5-60 minutes
- Check status in Vercel dashboard

### 10.4 Update Environment Variables
Once domain is active, update:
```
NEXT_PUBLIC_APP_URL = https://brixsport.com
NEXT_PUBLIC_BASE_URL = https://brixsport.com
NEXT_PUBLIC_WS_URL = https://brixsport.com
NEXTAUTH_URL = https://brixsport.com
```

### 10.5 Update Google OAuth
Add your custom domain to Google Console:
```
https://brixsport.com
https://brixsport.com/api/auth/callback/google
```

---

## 🎯 Step 11: Monitor & Optimize

### 11.1 Set Up Monitoring
1. **Vercel Analytics:** Enable in project settings
2. **Error Tracking:** Check logs regularly
3. **Performance:** Monitor Core Web Vitals

### 11.2 Enable Speed Insights
1. Go to project settings
2. Enable **"Speed Insights"**
3. Monitor performance metrics

### 11.3 Set Up Alerts
1. Go to **"Settings"** → **"Notifications"**
2. Enable deployment notifications
3. Enable error alerts

---

## 🐛 Troubleshooting

### Build Fails
**Error:** `Module not found`
**Solution:**
```bash
# Locally
npm install
npm run build

# Fix errors, then push
git add .
git commit -m "Fix build errors"
git push
```

### Database Connection Error
**Error:** `Failed to connect to database`
**Solution:**
1. Check `TURSO_CONNECTION_URL` is correct
2. Check `TURSO_AUTH_TOKEN` is valid
3. Verify database exists: `turso db list`

### Environment Variables Not Working
**Solution:**
1. Check variable names are exact (case-sensitive)
2. Redeploy after adding variables
3. Check they're set for all environments

### Cron Job Not Running
**Solution:**
1. Check `vercel.json` is committed
2. Verify `CRON_SECRET` is set
3. Check logs for cron execution

### 404 on API Routes
**Solution:**
1. Check file structure: `src/app/api/...`
2. Verify routes are exported correctly
3. Check build logs for errors

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Build works locally (`npm run build`)
- [ ] All tests pass
- [ ] Environment variables documented
- [ ] Database schema ready
- [ ] Code committed to GitHub

### Vercel Setup
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Environment variables added
- [ ] `vercel.json` created and committed

### Database
- [ ] Turso database created
- [ ] Schema pushed to production
- [ ] Connection tested

### Post-Deployment
- [ ] Site loads successfully
- [ ] API routes work
- [ ] Database queries work
- [ ] Cron jobs running
- [ ] Logs checked for errors

### Optional
- [ ] Google OAuth configured
- [ ] Custom domain added
- [ ] Analytics enabled
- [ ] Monitoring set up

---

## 📊 Deployment Environments

### Development
- **URL:** `http://localhost:3000`
- **Database:** `local.db`
- **Purpose:** Local development

### Preview (Vercel)
- **URL:** `https://brix-v2-git-branch.vercel.app`
- **Database:** Production (Turso)
- **Purpose:** Test branches before merging

### Production (Vercel)
- **URL:** `https://your-project.vercel.app`
- **Database:** Production (Turso)
- **Purpose:** Live application

### Custom Domain (Later)
- **URL:** `https://brixsport.com`
- **Database:** Production (Turso)
- **Purpose:** Your brand!

---

## 🚀 Quick Deploy Commands

```bash
# 1. Build locally
npm run build

# 2. Commit changes
git add .
git commit -m "Ready for deployment"
git push

# 3. Vercel will auto-deploy!
# Check: https://vercel.com/dashboard
```

---

## 📱 After Deployment

### Share Your App
```
Production URL: https://your-project.vercel.app
Test it out!
```

### Monitor Performance
- Check Vercel Analytics
- Monitor error logs
- Track user engagement

### Iterate
- Push updates to GitHub
- Vercel auto-deploys
- Test on preview URLs first

---

## 🎉 Success!

Your Brix V2 app is now live on Vercel! 🚀

**Next Steps:**
1. ✅ Test thoroughly on Vercel
2. ✅ Add custom domain
3. ✅ Enable monitoring
4. ✅ Share with users!

---

**Deployment Time:** 20-30 minutes  
**Status:** ✅ Production Ready  
**URL:** `https://your-project.vercel.app`
