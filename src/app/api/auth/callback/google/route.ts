import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generateToken, normalizeUserRole } from '@/lib/auth';
import { env } from '@/lib/env';
import {
    getGoogleRedirectUri,
    oauthStatesMatch,
    shouldDropPasswordOnGoogleMerge,
    OAUTH_STATE_COOKIE,
    OAUTH_HANDOFF_COOKIE,
    OAUTH_HANDOFF_MAX_AGE_SECONDS,
} from '@/lib/google-oauth';
import { serializeCookie, setAuthCookie, isSecureRequest, getCookieDomain } from '@/lib/auth-cookie';

// GET /api/auth/callback/google
//
// Path convention confirmed against the real Google Cloud OAuth client
// (console.cloud.google.com, Brixsport V2 project) -- its 4 registered
// Authorised redirect URIs (localhost, brixsports.com, brixs2.vercel.app,
// brixsports-staging.vercel.app) all use /api/auth/callback/google, not
// /api/auth/google/callback. Google enforces an exact match on redirect_uri,
// so the route has to live at the path already registered there, not the
// other way around. This route did not exist at all until this fix. "Continue
// with Google" was a real, reachable button (login and signup screens both)
// that sent a fan through the actual Google consent screen and then 404'd
// on the way back, instead of just being a dead no-op button.
export async function GET(request: NextRequest) {
    const loginUrl = new URL('/login', env.appUrl || request.nextUrl.origin);

    // The state cookie is single use: every exit from this handler expires it.
    const done = (response: NextResponse): NextResponse => {
        response.headers.append(
            'Set-Cookie',
            serializeCookie(OAUTH_STATE_COOKIE, '', {
                maxAge: 0,
                secure: isSecureRequest(request),
                domain: getCookieDomain(),
            })
        );
        return response;
    };

    try {
        const code = request.nextUrl.searchParams.get('code');
        const oauthError = request.nextUrl.searchParams.get('error');

        if (oauthError) {
            // User declined consent, or Google itself returned an error --
            // not a bug, a normal outcome, no need to log it as one.
            loginUrl.searchParams.set('error', 'google_auth_denied');
            return done(NextResponse.redirect(loginUrl));
        }

        if (!code) {
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return done(NextResponse.redirect(loginUrl));
        }

        // The state Google echoes back must equal the one this browser was given
        // when the flow started; otherwise this callback was not started here.
        const stateFromQuery = request.nextUrl.searchParams.get('state');
        const stateFromCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
        if (!oauthStatesMatch(stateFromQuery, stateFromCookie)) {
            console.error('[Google OAuth Callback] OAuth state missing or mismatched; refusing sign-in');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return done(NextResponse.redirect(loginUrl));
        }

        if (!env.googleClientId || !env.googleClientSecret) {
            console.error('[Google OAuth Callback] Missing Google OAuth credentials');
            loginUrl.searchParams.set('error', 'google_config_missing');
            return done(NextResponse.redirect(loginUrl));
        }

        // Must exactly match the redirect_uri sent in the initiate step and
        // registered in Google Cloud Console -- Google rejects the token
        // exchange otherwise. Shared builder, not a second inline copy.
        const redirectUri = getGoogleRedirectUri(request.nextUrl.origin);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: env.googleClientId,
                client_secret: env.googleClientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            console.error('[Google OAuth Callback] Token exchange failed:', await tokenResponse.text());
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return done(NextResponse.redirect(loginUrl));
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token as string | undefined;

        if (!accessToken) {
            console.error('[Google OAuth Callback] No access_token in Google response');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return done(NextResponse.redirect(loginUrl));
        }

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!profileResponse.ok) {
            console.error('[Google OAuth Callback] Failed to fetch Google profile');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return done(NextResponse.redirect(loginUrl));
        }

        const profile = await profileResponse.json();
        const email: string | undefined = profile.email;
        const name: string | undefined = profile.name;

        if (!email) {
            console.error('[Google OAuth Callback] Google profile had no email');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return done(NextResponse.redirect(loginUrl));
        }

        // BACKLOG-464 item 7: /oauth2/v2/userinfo reports `verified_email`. Reject only
        // when Google EXPLICITLY says the address is unverified -- an unverified address
        // must not be matched onto an existing account (account takeover). A missing
        // field still passes, so this can't lock out sign-in if the field is absent.
        if (profile.verified_email === false) {
            console.error('[Google OAuth Callback] Google email is not verified; refusing sign-in');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return done(NextResponse.redirect(loginUrl));
        }

        // Find-or-create by email -- same account-matching rule the rest of
        // auth already uses (register/route.ts's own existing-user check),
        // no separate googleId column needed for this. An existing
        // password-based account with the same email simply gains a Google
        // sign-in path; a first-time Google fan gets a real row with no
        // password (users.password is already nullable in schema.ts).
        const existing = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
            .all();

        let userId: string;
        let role: string;
        let tokenVersion = 0;

        if (existing[0]) {
            userId = existing[0].id;
            role = normalizeUserRole(existing[0].role);
            tokenVersion = existing[0].tokenVersion;
            // Registration does not verify email ownership, but this Google sign-in
            // does. Cut off any password set on the account before merging onto it,
            // so whoever pre-registered this address can no longer sign in with it.
            // The real owner uses Google, or resets the password by email.
            if (shouldDropPasswordOnGoogleMerge(existing[0])) {
                await db
                    .update(users)
                    .set({ password: null, updatedAt: new Date() })
                    .where(eq(users.id, userId));
                console.warn(`[Google OAuth Callback] Password removed from existing account ${userId} on Google merge`);
            }
        } else {
            userId = nanoid();
            role = normalizeUserRole('user');
            await db.insert(users).values({
                id: userId,
                email: email.toLowerCase(),
                password: null,
                name: name || email.split('@')[0],
                avatar: profile.picture || null,
                role,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        const token = generateToken(userId, email.toLowerCase(), role, tokenVersion);

        // A server-side redirect can set the httpOnly session cookie but cannot write
        // localStorage, and several client paths read localStorage.getItem('authToken')
        // directly and treat its absence as logged out. So the token is also handed
        // over in a 60 second cookie that AuthContext reads once and deletes. It is
        // never put in the URL, and AuthContext accepts it from nowhere else.
        const destination = new URL('/', env.appUrl || request.nextUrl.origin);
        const response = NextResponse.redirect(destination);
        response.headers.set('Cache-Control', 'no-store');

        setAuthCookie(response, request, token);
        response.headers.append(
            'Set-Cookie',
            serializeCookie(OAUTH_HANDOFF_COOKIE, token, {
                maxAge: OAUTH_HANDOFF_MAX_AGE_SECONDS,
                secure: isSecureRequest(request),
                httpOnly: false,
                domain: getCookieDomain(),
            })
        );

        return done(response);
    } catch (error) {
        console.error('[Google OAuth Callback] Unexpected error:', error);
        loginUrl.searchParams.set('error', 'google_auth_failed');
        return done(NextResponse.redirect(loginUrl));
    }
}
