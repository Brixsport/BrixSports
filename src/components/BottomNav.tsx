'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Trophy, Eye, User } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    path: string;
    badge?: number;
}

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, []);

    const navItems: NavItem[] = [
        {
            id: 'fixtures',
            label: 'Fixtures',
            icon: Calendar,
            path: '/',
        },
        {
            id: 'competitions',
            label: 'Competitions',
            icon: Trophy,
            path: '/competitions',
        },
        {
            id: 'scouts',
            label: 'Scouts',
            icon: Eye,
            path: '/scouts',
            badge: -1, // Special indicator for NEW
        },
        {
            id: 'profile',
            label: 'Profile',
            icon: User,
            path: user ? '/profile' : '/login',
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
    const hiddenRoutes = ['/login', '/signup', '/admin', '/reset-password', '/forgot-password', '/lineups', '/logger'];
    if (hiddenRoutes.some(route => pathname.startsWith(route))) {
        return null;
    }

    return (
        <>
            {/* Spacer to prevent content from being hidden behind fixed nav */}
            <div className="h-20 md:hidden" />

            {/* Bottom Navigation - Mobile Only */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0a0a] border-t border-white/10 backdrop-blur-xl">
                <div className="max-w-lg mx-auto px-2 py-2">
                    <div className="flex items-center justify-around">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item)}
                                    className="relative flex flex-col items-center justify-center gap-1 px-4 py-2 min-w-[70px] transition-all"
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
                                                    : 'text-white/40'
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
                                                className="absolute -top-2 -right-2 bg-primary text-black text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                            >
                                                NEW
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Label */}
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${active
                                            ? 'text-primary'
                                            : 'text-white/40'
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
                <div className="h-[env(safe-area-inset-bottom)] bg-[#0a0a0a]" />
            </nav>
        </>
    );
}
