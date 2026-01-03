# 🚀 Google OAuth Quick Start

**Time:** 30-45 minutes | **Difficulty:** Medium

---

## 📋 Quick Overview

```
Google Cloud Console → Create Project → Enable APIs → 
Configure OAuth → Get Credentials → Install NextAuth → 
Configure App → Test → Deploy
```

---

## ⚡ Super Quick Steps

### 1️⃣ Google Cloud (15 min)
1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create new project: "Brix Sport"
3. Enable "Google+ API"
4. Configure OAuth consent screen
5. Create OAuth credentials
6. **Save:** Client ID & Client Secret

### 2️⃣ Install Package (1 min)
```bash
npm install next-auth@latest react-icons
```

### 3️⃣ Environment Variables (2 min)
Add to `.env.local`:
```bash
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4️⃣ Create API Route (5 min)
Create: `src/app/api/auth/[...nextauth]/route.ts`
(See full code in `GOOGLE_OAUTH_SETUP.md`)

### 5️⃣ Add Session Provider (3 min)
Update `src/app/layout.tsx` with SessionProvider
(See full code in guide)

### 6️⃣ Create Sign-In Page (5 min)
Create: `src/app/auth/signin/page.tsx`
(See full code in guide)

### 7️⃣ Add Auth Button (5 min)
Create: `src/components/AuthButton.tsx`
Add to your header/navbar

### 8️⃣ Test (5 min)
```bash
npm run dev
# Visit http://localhost:3000/auth/signin
# Click "Continue with Google"
# ✅ Done!
```

---

## 🎯 Key Files to Create

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts          ← NextAuth config
│   ├── auth/
│   │   └── signin/
│   │       └── page.tsx              ← Sign-in page
│   └── layout.tsx                    ← Add SessionProvider
├── components/
│   ├── AuthButton.tsx                ← Sign in/out button
│   └── providers/
│       └── SessionProvider.tsx       ← Session wrapper
└── lib/
    └── auth.ts                       ← Helper functions (optional)
```

---

## 🔑 Important URLs

### Google Cloud Console
- **Console:** https://console.cloud.google.com/
- **APIs Library:** APIs & Services → Library
- **Credentials:** APIs & Services → Credentials
- **OAuth Consent:** APIs & Services → OAuth consent screen

### Your App URLs (Development)
- **Sign In:** http://localhost:3000/auth/signin
- **Callback:** http://localhost:3000/api/auth/callback/google
- **Sign Out:** Call `signOut()` from next-auth/react

### Your App URLs (Production)
- **Sign In:** https://yourdomain.com/auth/signin
- **Callback:** https://yourdomain.com/api/auth/callback/google

---

## ⚠️ Common Errors & Fixes

| Error | Solution |
|-------|----------|
| `redirect_uri_mismatch` | Check redirect URI matches exactly in Google Console |
| `Access blocked` | Add yourself as test user in OAuth consent screen |
| `Session not persisting` | Set `NEXTAUTH_SECRET` and restart server |
| `User not created` | Check database schema and connection |

---

## ✅ Checklist

**Google Cloud:**
- [ ] Project created
- [ ] Google+ API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created
- [ ] Client ID & Secret saved

**Code:**
- [ ] NextAuth installed
- [ ] Environment variables set
- [ ] API route created
- [ ] Session provider added
- [ ] Sign-in page created
- [ ] Auth button added

**Testing:**
- [ ] Sign-in works
- [ ] User created in database
- [ ] Sign-out works
- [ ] Session persists

---

## 🎨 UI Preview

### Sign-In Button (Before)
```
┌─────────────────┐
│  👤 Sign In     │
└─────────────────┘
```

### User Menu (After)
```
┌──────────────────────────┐
│ 👤 John Doe  🚪 Sign Out │
└──────────────────────────┘
```

---

## 📱 User Flow

```
1. User clicks "Sign In"
   ↓
2. Redirected to Google
   ↓
3. User selects Google account
   ↓
4. User grants permissions
   ↓
5. Redirected back to app
   ↓
6. User created/updated in database
   ↓
7. Session created
   ↓
8. User is signed in! ✅
```

---

## 🚀 Production Deployment

### Before Deploying:
1. ✅ Add production URLs to Google Console
2. ✅ Set production environment variables
3. ✅ Publish OAuth consent screen (if needed)
4. ✅ Test with production URL

### Environment Variables (Production):
```bash
GOOGLE_CLIENT_ID=same-as-development
GOOGLE_CLIENT_SECRET=same-as-development
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=new-secure-secret-for-production
```

---

## 💡 Pro Tips

1. **Use the same Client ID/Secret** for dev and production
2. **Add multiple redirect URIs** in Google Console (dev + prod)
3. **Generate strong NEXTAUTH_SECRET** for production
4. **Add test users** during development
5. **Enable People API** for better profile data

---

## 🎯 Next Steps After Setup

1. **Add more providers:** GitHub, Facebook, Twitter
2. **Implement roles:** Admin, User, Logger
3. **Add profile page:** Let users edit their info
4. **Protect routes:** Use middleware or session checks
5. **Add user preferences:** Store user settings

---

## 📚 Full Guide

For detailed explanations and code, see:
**`GOOGLE_OAUTH_SETUP.md`** ← Complete step-by-step guide

---

## 🆘 Need Help?

1. Check `GOOGLE_OAUTH_SETUP.md` for detailed steps
2. Review NextAuth.js docs: https://next-auth.js.org/
3. Check Google OAuth docs: https://developers.google.com/identity

---

**Ready to start?** Open `GOOGLE_OAUTH_SETUP.md` and follow Step 1! 🚀
