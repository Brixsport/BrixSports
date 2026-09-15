'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Trophy, User, Users, Newspaper, ListChecks, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NewFeatureBadge } from '@/components/ui/NewFeatureBadge';

interface NavItem {
    id: string;
    label: string;
    icon: LucideIcon;
    path: string;
    badge?: number;
}

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();

    // BACKLOG-388: BottomNav is the app's only truly global nav -- the
    // homepage's own mobile overlay (page.tsx's isMenuOpen state) reaches
    // Teams/Lineup Builder/News too, but only from the homepage itself.
    // Extended here (Richard's call: extend BottomNav, not a separate
    // hamburger component) rather than duplicating that overlay elsewhere.
    const navItems: NavItem[] = [
        {
            id: 'fixtures',
            label: 'Fixtures',
            icon: Calendar,
            path: '/',
        },
        {
            id: 'competitions',
            // Shortened for the 6-column mobile nav specifically -- "Competitions"
            // at 10px in a ~60px column wraps/overflows; not used anywhere else.
            label: 'Comps',
            icon: Trophy,
            path: '/competitions',
        },
        {
            id: 'teams',
            label: 'Teams',
            icon: Users,
            path: '/teams',
        },
        {
            id: 'lineup-builder',
            label: 'Lineups',
            icon: ListChecks,
            path: '/lineup-builder',
        },
        {
            id: 'news',
            label: 'News',
            icon: Newspaper,
            path: '/news',
        },
        {
            id: 'profile',
            label: isAuthenticated && user ? 'Profile' : 'Sign In',
            icon: User,
            path: isAuthenticated && user ? '/profile' : '/login',
        },
    ];

    const handleNavClick = (item: NavItem) => {
        router.push(item.path);
    };

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    };

    // Hide bottom nav on specific routes
    const hiddenRoutes = ['/login', '/signup', '/admin', '/reset-password', '/forgot-password', '/lineup-builder', '/logger'];
    if (hiddenRoutes.some(route => pathname.startsWith(route))) {
        return null;
    }

    return (
        <>
            {/* Spacer to prevent content from being hidden behind fixed nav */}
            <div className="h-20 md:hidden" />

            {/* Bottom Navigation - Mobile Only */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border backdrop-blur-xl">
                <div className="max-w-lg mx-auto px-1 py-2">
                    {/* BACKLOG-388: grid, not justify-around + fixed min-w -- 6
                        items at a fixed 70px min-width overflow a 375px
                        viewport (420px needed). Equal-width columns instead. */}
                    <div className="grid grid-cols-6">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item)}
                                    className="relative flex flex-col items-center justify-center gap-1 px-0.5 py-2 min-w-0 transition-all"
                                >
                                    {/* Active Indicator */}
                                    {active && (
                                        <motion.div
                                            layoutId="bottomNavIndicator"
                                            className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full"
                                            transition={{
                                                type: 'spring',
                                                stiffness: 500,
                                                damping: 30,
                                            }}
                                        />
                                    )}

                                    {/* Icon Container */}
                                    <div className="relative">
                                        <motion.div
                                            animate={{
                                                scale: active ? 1.1 : 1,
                                                y: active ? -2 : 0,
                                            }}
                                            transition={{
                                                type: 'spring',
                                                stiffness: 400,
                                                damping: 17,
                                            }}
                                        >
                                            <Icon
                                                size={24}
                                                className={`transition-colors ${active
                                                    ? 'text-primary'
                                                    : 'text-foreground/40'
                                                    }`}
                                                strokeWidth={active ? 2.5 : 2}
                                            />
                                        </motion.div>

                                        {/* Badge */}
                                        {item.badge && item.badge > 0 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                                            >
                                                <span className="text-[10px] font-bold text-white">
                                                    {item.badge > 9 ? '9+' : item.badge}
                                                </span>
                                            </motion.div>
                                        )}
                                        {/* NEW Badge */}
                                        {item.badge === -1 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-2 -right-2"
                                            >
                                                <NewFeatureBadge />
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Label */}
                                    <span
                                        className={`text-[9px] font-bold uppercase tracking-tight truncate max-w-full transition-colors ${active
                                            ? 'text-primary'
                                            : 'text-foreground/40'
                                            }`}
                                    >
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Safe Area for iOS devices */}
                <div className="h-[env(safe-area-inset-bottom)] bg-background" />
            </nav>
        </>
    );
}
