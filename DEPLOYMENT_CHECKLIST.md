# 🚀 Vercel Deployment - Quick Checklist

**Ready to deploy?** Follow this checklist!

---

## ✅ Pre-Deployment Checklist

### 1. Code Ready
- [ ] `npm run build` works locally
- [ ] No TypeScript errors
- [ ] All dependencies installed
- [ ] Code committed to Git

### 2. Database Ready
- [ ] Turso CLI installed
- [ ] Production database created
- [ ] Schema pushed to production
- [ ] Connection tested

### 3. Environment Variables Ready
Copy these for Vercel:

```bash
# Database
TURSO_CONNECTION_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Auth
JWT_SECRET=(generate new)

# URLs (update after deployment)
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app
NEXT_PUBLIC_WS_URL=https://your-project.vercel.app

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BDYyajLbF8Op4vstjSIzBPKRd_qLxvQpYRJBj9VLBoe6TZF-dJVQOWtwxCGvMyas1qp7NImmBUgenK4Eu7krPcA
VAPID_PRIVATE_KEY=tNgRs7W4-tDhaqLot8FTt2GUkV50jSBI0ltcqkEW_Jw
VAPID_SUBJECT=mailto:admin@brixsport.com

# Cron
CRON_SECRET=(generate new)
```

### 4. Files Created
- [ ] `vercel.json` exists
- [ ] `.gitignore` configured
- [ ] `.vercelignore` created (optional)

---

## 🎯 Deployment Steps

### Step 1: Build Test (5 min)
```bash
npm run build
```
✅ Should complete without errors

### Step 2: Turso Setup (10 min)
```bash
# Install Turso
irm https://get.turso.tech/install.ps1 | iex

# Sign up
turso auth signup

# Create database
turso db create brix-sport-prod

# Get credentials
turso db show brix-sport-prod
turso db tokens create brix-sport-prod
```

### Step 3: Push to GitHub (5 min)
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### Step 4: Deploy to Vercel (10 min)
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import `brix-v2` repository
4. Add environment variables
5. Click **Deploy**

### Step 5: Test (5 min)
1. Visit your Vercel URL
2. Test homepage
3. Test API routes
4. Check logs

---

## 🔧 Quick Commands

### Generate Secrets
```bash
# JWT Secret
openssl rand -base64 32

# Cron Secret
openssl rand -base64 32

# NextAuth Secret (if using Google OAuth)
openssl rand -base64 32
```

### Test Build
```bash
npm run build
```

### Push to Git
```bash
git add .
git commit -m "Deploy to Vercel"
git push
```

---

## 📋 Environment Variables Template

Copy this and fill in your values:

```env
# === DATABASE ===
TURSO_CONNECTION_URL=
TURSO_AUTH_TOKEN=

# === AUTHENTICATION ===
JWT_SECRET=

# === APPLICATION URLS ===
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_BASE_URL=
NEXT_PUBLIC_WS_URL=

# === PUSH NOTIFICATIONS ===
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BDYyajLbF8Op4vstjSIzBPKRd_qLxvQpYRJBj9VLBoe6TZF-dJVQOWtwxCGvMyas1qp7NImmBUgenK4Eu7krPcA
VAPID_PRIVATE_KEY=tNgRs7W4-tDhaqLot8FTt2GUkV50jSBI0ltcqkEW_Jw
VAPID_SUBJECT=mailto:admin@brixsport.com

# === CRON JOB ===
CRON_SECRET=

# === OPTIONAL: GOOGLE OAUTH ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# === OPTIONAL: EMAIL ===
EMAIL_SERVICE_API_KEY=
EMAIL_FROM=noreply@brixsport.com
```

---

## 🎯 After Deployment

### Test These URLs:
```
Homepage: https://your-project.vercel.app
API Test: https://your-project.vercel.app/api/teams
Cron Status: https://your-project.vercel.app/api/reminders/check
```

### Update These:
1. **Environment Variables** - Add your actual Vercel URL
2. **Google OAuth** - Add Vercel URL to authorized origins
3. **Custom Domain** - Configure later

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Build fails | Run `npm run build` locally and fix errors |
| Database error | Check Turso credentials |
| 404 on routes | Check file structure in `src/app/api/` |
| Env vars not working | Redeploy after adding variables |

---

## ✅ Success Criteria

- [ ] Site loads at Vercel URL
- [ ] Homepage displays correctly
- [ ] API routes return data
- [ ] Database queries work
- [ ] No errors in Vercel logs
- [ ] Cron job status returns OK

---

## 🎉 You're Ready!

**Estimated Time:** 30 minutes  
**Difficulty:** Easy  
**Result:** Live app on Vercel! 🚀

**Full Guide:** See `VERCEL_DEPLOYMENT.md`

---

**Let's deploy!** 🎯
