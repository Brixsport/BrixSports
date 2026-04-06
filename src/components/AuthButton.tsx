'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthButton() {
    const { data: session, status: nextAuthStatus } = useSession();
    const { user, isAuthenticated, logout } = useAuth();

    // Check both NextAuth and custom auth
    const isLoggedIn = session || isAuthenticated;
    const userData = session?.user || user;

    if (nextAuthStatus === 'loading') {
        return (
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        );
    }

    if (isLoggedIn) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    {(userData?.image || userData?.avatar) && (
                        <img
                            src={userData?.image || userData?.avatar}
                            alt={userData?.name || ''}
                            className="w-8 h-8 rounded-full"
                        />
                    )}
                    <span className="text-white font-medium hidden md:block">
                        {userData?.name}
                    </span>
                </div>
                <button
                    onClick={() => {
                        if (session) {
                            signOut();
                        } else {
                            logout();
                        }
                    }}
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
