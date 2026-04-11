import NextAuth, { NextAuthOptions, User, Account, Profile, Session } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { JWT } from 'next-auth/jwt';
import { normalizeUserRole } from '@/lib/auth';

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }: { user: User; account: Account | null; profile?: Profile }) {
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
        async session({ session, token }: { session: Session; token: JWT }) {
            if (session.user && token.sub) {
                // Get user from database
                const dbUser = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, session.user.email || ''))
                    .limit(1);

                if (dbUser.length > 0) {
                    // @ts-ignore - Adding custom properties to session user
                    session.user.id = dbUser[0].id;
                    // @ts-ignore
                    session.user.role = normalizeUserRole(dbUser[0].role);
                }
            }
            return session;
        },
        async jwt({ token, user }: { token: JWT; user?: User }) {
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
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
