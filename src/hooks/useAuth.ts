'use client';

import { useEffect, useState } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role?: string;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for user session
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    return { user, loading, isAuthenticated: !!user };
}
