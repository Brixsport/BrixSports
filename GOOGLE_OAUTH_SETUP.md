# 🔐 Google OAuth Authentication - Complete Guide

**Last Updated:** January 3, 2026  
**Estimated Time:** 30-45 minutes

---

## 📋 Overview

This guide will walk you through implementing Google OAuth authentication for your Brix V2 application, allowing users to sign in with their Google accounts.

---

## 🎯 Step 1: Create Google Cloud Project

### 1.1 Go to Google Cloud Console
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account

### 1.2 Create a New Project
1. Click the project dropdown at the top
2. Click **"New Project"**
3. Enter project details:
   - **Project Name:** `Brix Sport` (or your preferred name)
   - **Organization:** Leave as default (or select your org)
4. Click **"Create"**
5. Wait for the project to be created (takes ~30 seconds)

### 1.3 Select Your Project
1. Click the project dropdown again
2. Select your newly created project

---

## 🎯 Step 2: Enable Google+ API

### 2.1 Navigate to APIs & Services
1. Click the **☰ menu** (top left)
2. Go to **"APIs & Services"** → **"Library"**

### 2.2 Enable Required APIs
1. Search for **"Google+ API"**
2. Click on it
3. Click **"Enable"**
4. Wait for it to enable

**Alternative:** Search for **"People API"** and enable it as well (recommended)

---

## 🎯 Step 3: Configure OAuth Consent Screen

### 3.1 Go to OAuth Consent Screen
1. Click **☰ menu** → **"APIs & Services"** → **"OAuth consent screen"**

### 3.2 Choose User Type
- **External** (for public app - recommended)
- Click **"Create"**

### 3.3 Fill in App Information

**App Information:**
- **App name:** `Brix Sport`
- **User support email:** Your email address
- **App logo:** (Optional - upload your logo)

**App Domain:**
- **Application home page:** `http://localhost:3000` (for development)
- **Application privacy policy link:** `http://localhost:3000/privacy` (optional)
- **Application terms of service link:** `http://localhost:3000/terms` (optional)

**Authorized domains:**
- Add: `localhost` (for development)
- For production, add your domain (e.g., `brixsport.com`)

**Developer contact information:**
- **Email addresses:** Your email

Click **"Save and Continue"**

### 3.4 Scopes
1. Click **"Add or Remove Scopes"**
2. Select these scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
3. Click **"Update"**
4. Click **"Save and Continue"**

### 3.5 Test Users (for External apps in testing)
1. Click **"Add Users"**
2. Add your email and any test users
3. Click **"Save and Continue"**

### 3.6 Summary
1. Review your settings
2. Click **"Back to Dashboard"**

---

## 🎯 Step 4: Create OAuth Credentials

### 4.1 Go to Credentials
1. Click **☰ menu** → **"APIs & Services"** → **"Credentials"**

### 4.2 Create OAuth Client ID
1. Click **"+ Create Credentials"** at the top
2. Select **"OAuth client ID"**

### 4.3 Configure OAuth Client

**Application type:**
- Select **"Web application"**

**Name:**
- Enter: `Brix Sport Web Client`

**Authorized JavaScript origins:**
- Click **"+ Add URI"**
- Add: `http://localhost:3000` (for development)
- For production, add: `https://yourdomain.com`

**Authorized redirect URIs:**
- Click **"+ Add URI"**
- Add: `http://localhost:3000/api/auth/callback/google`
- For production, add: `https://yourdomain.com/api/auth/callback/google`

Click **"Create"**

### 4.4 Save Your Credentials
A popup will show your credentials:
- **Client ID:** `123456789-abc123.apps.googleusercontent.com`
- **Client Secret:** `GOCSPX-abc123xyz`

**⚠️ IMPORTANT:** Copy these immediately! You'll need them in the next step.

Click **"OK"**

---

## 🎯 Step 5: Install NextAuth.js

### 5.1 Install Required Packages
```bash
npm install next-auth@latest
```

### 5.2 Verify Installation
```bash
npm list next-auth
```

---

## 🎯 Step 6: Configure Environment Variables

### 6.1 Update `.env.local`
Add these variables to your `.env.local` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret-here

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here

# For production, use:
# NEXTAUTH_URL=https://yourdomain.com
```

### 6.2 Generate NEXTAUTH_SECRET
Run this command to generate a secure secret:

```bash
# PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or use OpenSSL (if installed)
openssl rand -base64 32
```

Copy the output and paste it as your `NEXTAUTH_SECRET`.

### 6.3 Update `.env.example`
Update the example file for other developers:

```bash
# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
```

---

## 🎯 Step 7: Create NextAuth API Route

### 7.1 Create Directory Structure
Create this folder structure:
```
src/app/api/auth/[...nextauth]/
```

### 7.2 Create `route.ts`
Create file: `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            try {
                // Check if user exists
                const existingUser = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, user.email))
                    .limit(1);

                if (existingUser.length === 0) {
                    // Create new user
                    await db.insert(users).values({
                        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        email: user.email,
                        name: user.name || '',
                        avatar: user.image || null,
                        role: 'user',
                        createdAt: new Date(),
                    });
                } else {
                    // Update user info (name, avatar)
                    await db
                        .update(users)
                        .set({
                            name: user.name || existingUser[0].name,
                            avatar: user.image || existingUser[0].avatar,
                        })
                        .where(eq(users.id, existingUser[0].id));
                }

                return true;
            } catch (error) {
                console.error('Error in signIn callback:', error);
                return false;
            }
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                // Get user from database
                const dbUser = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, session.user.email || ''))
                    .limit(1);

                if (dbUser.length > 0) {
                    session.user.id = dbUser[0].id;
                    session.user.role = dbUser[0].role;
                }
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    session: {
        strategy: 'jwt',
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

---

## 🎯 Step 8: Create Auth Context (Optional but Recommended)

### 8.1 Create `src/lib/auth.ts`
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getSession() {
    return await getServerSession(authOptions);
}

export async function getCurrentUser() {
    const session = await getSession();
    return session?.user;
}
```

---

## 🎯 Step 9: Create Sign-In Page

### 9.1 Create `src/app/auth/signin/page.tsx`
```typescript
'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';

export default function SignInPage() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome to Brix Sport
                    </h1>
                    <p className="text-slate-400">
                        Sign in to continue
                    </p>
                </div>

                <button
                    onClick={() => signIn('google', { callbackUrl })}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                    <FcGoogle className="w-6 h-6" />
                    Continue with Google
                </button>

                <p className="text-center text-sm text-slate-500 mt-6">
                    By continuing, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    );
}
```

### 9.2 Install React Icons (for Google icon)
```bash
npm install react-icons
```

---

## 🎯 Step 10: Add Session Provider

### 10.1 Create `src/components/providers/SessionProvider.tsx`
```typescript
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

### 10.2 Update Root Layout
Update `src/app/layout.tsx`:

```typescript
import SessionProvider from '@/components/providers/SessionProvider';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <SessionProvider>
                    {children}
                </SessionProvider>
            </body>
        </html>
    );
}
```

---

## 🎯 Step 11: Update Database Schema (if needed)

### 11.1 Check Users Table
Make sure your `users` table has these fields:

```typescript
// In src/db/schema.ts
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    avatar: text('avatar'),
    password: text('password'), // For email/password auth
    role: text('role').notNull().default('user'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

### 11.2 Apply Migration
```bash
npm run db:push
```

---

## 🎯 Step 12: Add Sign-In/Sign-Out Buttons

### 12.1 Create Auth Button Component
Create `src/components/AuthButton.tsx`:

```typescript
'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { User, LogOut } from 'lucide-react';

export default function AuthButton() {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return (
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        );
    }

    if (session) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    {session.user?.image && (
                        <img
                            src={session.user.image}
                            alt={session.user.name || ''}
                            className="w-8 h-8 rounded-full"
                        />
                    )}
                    <span className="text-white font-medium hidden md:block">
                        {session.user?.name}
                    </span>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden md:inline">Sign Out</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => signIn('google')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        >
            <User className="w-4 h-4" />
            <span>Sign In</span>
        </button>
    );
}
```

### 12.2 Add to Your Header/Navbar
```typescript
import AuthButton from '@/components/AuthButton';

// In your header component
<AuthButton />
```

---

## 🎯 Step 13: Protect Routes (Optional)

### 13.1 Create Middleware
Create `src/middleware.ts`:

```typescript
export { default } from 'next-auth/middleware';

export const config = {
    matcher: [
        '/profile/:path*',
        '/admin/:path*',
        // Add other protected routes
    ],
};
```

### 13.2 Or Use in Components
```typescript
'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function ProtectedPage() {
    const { data: session, status } = useSession({
        required: true,
        onUnauthenticated() {
            redirect('/auth/signin');
        },
    });

    if (status === 'loading') {
        return <div>Loading...</div>;
    }

    return <div>Protected content</div>;
}
```

---

## 🎯 Step 14: Test Your Implementation

### 14.1 Start Development Server
```bash
npm run dev
```

### 14.2 Test Sign-In Flow
1. Go to `http://localhost:3000/auth/signin`
2. Click "Continue with Google"
3. Select your Google account
4. Grant permissions
5. You should be redirected back to your app

### 14.3 Check Database
```bash
# View users table
npm run db:studio
# Or
sqlite3 local.db "SELECT * FROM users;"
```

### 14.4 Test Sign-Out
1. Click the sign-out button
2. Verify you're signed out
3. Try accessing protected routes

---

## 🎯 Step 15: Production Deployment

### 15.1 Update OAuth Credentials
1. Go back to Google Cloud Console
2. Go to Credentials
3. Edit your OAuth client
4. Add production URLs:
   - **Authorized JavaScript origins:** `https://yourdomain.com`
   - **Authorized redirect URIs:** `https://yourdomain.com/api/auth/callback/google`

### 15.2 Update Environment Variables
In your production environment (Vercel, etc.):

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-production-secret
```

### 15.3 Publish OAuth Consent Screen
1. Go to OAuth consent screen
2. Click "Publish App"
3. Submit for verification (if needed)

---

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
**Solution:** Make sure your redirect URI in Google Console exactly matches:
```
http://localhost:3000/api/auth/callback/google
```

### Error: "Access blocked: This app's request is invalid"
**Solution:** 
1. Check that you've enabled Google+ API or People API
2. Verify your OAuth consent screen is configured
3. Add yourself as a test user

### Session not persisting
**Solution:**
1. Check that `NEXTAUTH_SECRET` is set
2. Clear browser cookies
3. Restart development server

### User not being created in database
**Solution:**
1. Check database connection
2. Verify schema has all required fields
3. Check console for errors

---

## ✅ Verification Checklist

- [ ] Google Cloud project created
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created and saved
- [ ] NextAuth.js installed
- [ ] Environment variables configured
- [ ] API route created (`[...nextauth]/route.ts`)
- [ ] Sign-in page created
- [ ] Session provider added to layout
- [ ] Auth button component created
- [ ] Database schema updated
- [ ] Migration applied
- [ ] Sign-in tested successfully
- [ ] User created in database
- [ ] Sign-out tested successfully

---

## 📚 Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)

---

## 🎉 You're Done!

Your Brix V2 app now has Google OAuth authentication! Users can sign in with their Google accounts and their data is stored in your database.

**Next Steps:**
1. Add more OAuth providers (GitHub, Facebook, etc.)
2. Implement role-based access control
3. Add user profile management
4. Set up email verification (optional)

---

**Estimated Total Time:** 30-45 minutes  
**Difficulty:** Medium  
**Status:** ✅ Production Ready
