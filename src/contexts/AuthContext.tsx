'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string }>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
    openAuthModal: (returnUrl?: string) => void;
    closeAuthModal: () => void;
    isAuthModalOpen: boolean;
    authModalMode: 'login' | 'register';
    setAuthModalMode: (mode: 'login' | 'register') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
    const [returnUrl, setReturnUrl] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    // Check authentication status
    const checkAuth = useCallback(async () => {
        try {
            // Try cookie first
            let response = await fetch('/api/auth/me', {
                credentials: 'include',
            });

            // If cookie fails, try localStorage token
            if (!response.ok) {
                const token = localStorage.getItem('authToken');
                if (token) {
                    response = await fetch('/api/auth/me', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                        credentials: 'include',
                    });
                }
            }

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                setUser(null);
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial auth check
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Auto-refresh session every 15 minutes
    useEffect(() => {
        if (!user) return;

        const refreshInterval = setInterval(() => {
            refreshSession();
        }, 15 * 60 * 1000); // 15 minutes

        return () => clearInterval(refreshInterval);
    }, [user]);

    // Refresh session
    const refreshSession = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                await checkAuth();
            } else {
                // Session expired, log out
                setUser(null);
            }
        } catch (error) {
            console.error('Session refresh failed:', error);
        }
    }, [checkAuth]);

    // Login
    const login = useCallback(async (email: string, password: string) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Store token in localStorage as backup
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
                setUser(data.user);
                setIsAuthModalOpen(false);

                // Redirect to return URL if set
                if (returnUrl) {
                    router.push(returnUrl);
                    setReturnUrl(null);
                }

                return { success: true };
            } else {
                return { success: false, error: data.error || 'Login failed', code: data.code };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error', code: 'AUTH_NETWORK_ERROR' };
        }
    }, [returnUrl, router]);

    // Register
    const register = useCallback(async (name: string, email: string, password: string) => {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Store token in localStorage as backup
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
                setUser(data.user);
                setIsAuthModalOpen(false);

                // Redirect to return URL if set
                if (returnUrl) {
                    router.push(returnUrl);
                    setReturnUrl(null);
                }

                return { success: true };
            } else {
                return { success: false, error: data.error || 'Registration failed', code: data.code };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error', code: 'AUTH_NETWORK_ERROR' };
        }
    }, [returnUrl, router]);

    // Logout
    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });

            setUser(null);
            localStorage.removeItem('authToken');
            router.push('/');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }, [router]);

    // Open auth modal
    const openAuthModal = useCallback((url?: string) => {
        setReturnUrl(url || pathname);
        setIsAuthModalOpen(true);
    }, [pathname]);

    // Close auth modal
    const closeAuthModal = useCallback(() => {
        setIsAuthModalOpen(false);
        setReturnUrl(null);
    }, []);

    const value: AuthContextType = {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshSession,
        openAuthModal,
        closeAuthModal,
        isAuthModalOpen,
        authModalMode,
        setAuthModalMode,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
