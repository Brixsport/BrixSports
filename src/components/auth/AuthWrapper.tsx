'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { ReactNode } from 'react';

export function AuthWrapper({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            {children}
            <AuthModal />
        </AuthProvider>
    );
}
