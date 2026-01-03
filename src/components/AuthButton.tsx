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
