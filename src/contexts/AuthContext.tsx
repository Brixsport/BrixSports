'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getPushService } from '@/lib/notifications/push-service';

// BACKLOG-150 follow-up: the schema already flips an anonymous push subscription's
// userId to a real account for free on a same-browser re-subscribe (endpoint is
// globally unique -- see anonymous-subscriber.ts's own comment), but nothing ever
// triggered that re-subscribe. Best-effort, fire-and-forget: only acts if this
// browser already has an active push subscription (an anonymous viewer who never
// enabled push has nothing to hand off), and never surfaces an error to the login/
// signup flow -- a failed handoff just leaves the subscription anonymous, same as
// today, not a regression.
function reSubscribePushForHandoff(userId: string) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }
    getPushService()
        .isSubscribed()
        .then((subscribed) => {
            if (subscribed) {
                return getPushService().subscribe(userId);
            }
        })
        .catch((error) => {
            console.error('[AuthContext] Push subscription handoff failed:', error);
        });
}

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
        console.log('[AuthContext] checkAuth STARTING...');
        try {
            // Try cookie first
            console.log('[AuthContext] Trying cookie auth...');
            let response = await fetch('/api/auth/me', {
                credentials: 'include',
            });
            console.log('[AuthContext] Cookie auth response status:', response.status);

            // If cookie fails, try localStorage token
            if (!response.ok) {
                console.log('[AuthContext] Cookie auth failed, trying localStorage...');
                const token = localStorage.getItem('authToken');
                console.log('[AuthContext] localStorage token exists:', !!token);
                if (token) {
                    response = await fetch('/api/auth/me', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                        credentials: 'include',
                    });
                    console.log('[AuthContext] localStorage auth response status:', response.status);
                }
            }

            if (response.ok) {
                const data = await response.json();
                console.log('[AuthContext] Auth SUCCESS, user:', data.user?.email);
                setUser(data.user);
            } else if (response.status === 401 || response.status === 403) {
                // BUG-217: the server explicitly rejected the credentials --
                // genuinely unauthenticated, safe to treat as logged out.
                console.log('[AuthContext] Auth explicitly rejected (401/403), setting user to null');
                setUser(null);
                localStorage.removeItem('authToken');
            } else {
                // BUG-217: any other non-2xx (5xx, gateway timeout, etc.) is NOT
                // confirmation the session is invalid -- it just means we couldn't
                // verify it right now. Leave existing auth state untouched so a
                // transient server hiccup doesn't force a real logout; the next
                // periodic check (or an explicit user action) will resolve it.
                console.warn('[AuthContext] Auth check got a non-auth-failure status, leaving auth state unchanged:', response.status);
            }
        } catch (error) {
            // BUG-217: a genuine network/fetch failure (offline, DNS, dropped
            // connection) is not the same as "confirmed logged out" -- don't clear
            // user or the stored token. Leave state as-is; the next check resolves it.
            console.error('[AuthContext] checkAuth network error, leaving auth state unchanged:', error);
        } finally {
            console.log('[AuthContext] checkAuth FINISHED, loading set to false');
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
            } else if (response.status === 401 || response.status === 403) {
                // BUG-217: genuinely expired/invalid session -- safe to log out.
                setUser(null);
                localStorage.removeItem('authToken');
            } else {
                // BUG-217: a non-auth-failure status (5xx, etc.) doesn't mean the
                // session is actually invalid -- leave auth state unchanged.
                console.warn('[AuthContext] refreshSession got a non-auth-failure status, leaving auth state unchanged:', response.status);
            }
        } catch (error) {
            // BUG-217: network failure, not a confirmed logout -- leave state as-is.
            console.error('[AuthContext] refreshSession network error, leaving auth state unchanged:', error);
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
                reSubscribePushForHandoff(data.user.id);

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
                reSubscribePushForHandoff(data.user.id);

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
