'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Home, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
// BACKSCOPED: 2026-06-11 — Three.js removed. Reinstate when: lightweight replacement built (see BACKLOG-031)
// import dynamic from 'next/dynamic';

// BACKSCOPED: 2026-06-11 — Three.js removed for perf/deprecation.
// Reinstate when: lightweight replacement built (see BACKLOG-031)
// const BasketballRimScene = dynamic(
//   () => import('@/components/error/BasketballRimScene'),
//   {
//     ssr: false,
//     loading: () => <div className="w-full h-[400px] bg-gradient-to-b from-orange-900 to-red-900 animate-pulse rounded-2xl" />
//   }
// );

export default function NotFoundPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Court lines effect */}
        <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.5" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="20" fill="none" stroke="white" strokeWidth="0.5" />
        </svg>
        
        {/* Floating basketballs -- purely decorative, infinite-loop motion. Skipped
            entirely when the user prefers reduced motion (no static replacement
            needed since these add nothing but movement). */}
        {!prefersReducedMotion && [...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-orange-600 to-orange-800"
            style={{
              left: `${10 + i * 20}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 360],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          >
            {/* Basketball lines */}
            <div className="absolute inset-0 rounded-full border-2 border-orange-400/30" />
            <div className="absolute inset-0 rounded-full border border-orange-400/20 rotate-45" />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 max-w-4xl w-full text-center">
        {/* BACKSCOPED: 2026-06-11 — Three.js scene container removed. Reinstate
            when: lightweight replacement built (see BACKLOG-031). The empty
            container + its dark overlay gradient (a leftover meant to sit under
            the now-gone 3D scene) were removed entirely, not just commented --
            with no scene inside it, the overlay rendered as a bare hardcoded-dark
            gradient smear on the page, breaking visibly in light mode. */}

        {/* 404 Code */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.3,
            type: "spring",
            stiffness: 200 
          }}
        >
          <h1 className="text-[100px] md:text-[150px] font-black leading-none tracking-tighter bg-gradient-to-b from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent font-display italic">
            404
          </h1>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-3xl md:text-4xl font-bold text-foreground mt-4 mb-4"
        >
          OUT OF BOUNDS!
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-muted-foreground text-lg mb-2 max-w-lg mx-auto"
        >
          This page went out of bounds. It's nowhere on the pitch, the court, or anywhere else.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-muted-foreground/70 text-base mb-8 max-w-md mx-auto"
        >
          The page you're looking for missed the target completely - it's just not there.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            onClick={() => window.history.back()}
            className="group flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold rounded-xl transition-all border border-border"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Go Back
          </button>

          <Link
            href="/"
            className="group flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-orange-600/25"
          >
            <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Back Home
          </Link>

          <Link
            href="/search"
            className="group flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold rounded-xl transition-all border border-border"
          >
            <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Search
          </Link>
        </motion.div>

        {/* Basketball Quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-muted-foreground/70 text-sm italic"
        >
          "You miss 100% of the pages you don't look for." - ancient sporting wisdom, probably
        </motion.p>
      </div>
    </div>
  );
}
