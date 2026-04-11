'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Home, RefreshCcw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import the 3D scene to avoid SSR issues
const SoccerGoalScene = dynamic(
  () => import('@/components/error/SoccerGoalScene'),
  { 
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-gradient-to-b from-sky-900 to-green-900 animate-pulse rounded-2xl" />
  }
);

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [isClient, setIsClient] = useState(false);
  const [errorCode] = useState(() => 
    Math.random() > 0.5 ? '500' : '404'
  );

  useEffect(() => {
    setIsClient(true);
    // Log error to console for debugging
    console.error('Application error:', error);
  }, [error]);

  const getErrorMessage = () => {
    if (errorCode === '404') {
      return "Oops! Looks like this page took a wrong turn at the penalty box.";
    }
    return "Houston, we have a problem! The server fumbled the ball.";
  };

  const getSubMessage = () => {
    if (errorCode === '404') {
      return "The goal you're looking for doesn't exist. Maybe it was offside?";
    }
    return "Our servers are having a tough game. Let's take a water break and try again.";
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-4 py-8 overflow-hidden">
      {/* Background Stadium Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Stadium lights */}
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/10 rounded-full blur-3xl" />
        
        {/* Crowd noise effect - animated dots */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-20">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                bottom: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0.2, 0.8, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-4xl w-full text-center">
        {/* 3D Scene Container */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative w-full h-[250px] sm:h-[300px] md:h-[400px] mb-6 md:mb-8 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl"
        >
          <SoccerGoalScene errorCode={errorCode} />
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
        </motion.div>

        {/* Error Code */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.3,
            type: "spring",
            stiffness: 200 
          }}
          className="relative"
        >
          <h1 className="text-[120px] md:text-[180px] font-black leading-none tracking-tighter bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent font-display italic">
            {errorCode}
          </h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="h-1 bg-gradient-to-r from-transparent via-primary to-transparent max-w-xs mx-auto -mt-4"
          />
        </motion.div>

        {/* Error Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-2xl md:text-3xl font-bold text-white mt-6 mb-2"
        >
          {getErrorMessage()}
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-white/60 text-lg mb-8 max-w-lg mx-auto"
        >
          {getSubMessage()}
        </motion.p>

        {/* Error Details (if available) */}
        {error?.message && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl max-w-lg mx-auto"
          >
            <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-semibold">Error Details</span>
            </div>
            <p className="text-red-300/80 text-sm font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-red-300/60 text-xs mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            onClick={reset}
            className="group flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/25"
          >
            <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            Try Again
          </button>

          <Link
            href="/"
            className="group flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/10 hover:border-white/20"
          >
            <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Back to Home
          </Link>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-white/30 text-sm"
        >
          Even Messi misses sometimes. Don't worry, we've got this!
        </motion.p>
      </div>
    </div>
  );
}
