'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Loader2 } from 'lucide-react';

// BACKLOG-359: the modal re-interrupted on nearly every navigation because
// its "Later" snooze only ever lived in this component's own React state
// (and an in-memory setTimeout) -- both reset the instant this component
// remounts, which App Router does for any hard navigation / route-segment
// boundary crossing, not just a full page reload. A waiting service worker
// stays waiting across all of that (it's real browser state, not app
// state), so every remount re-derived showPrompt=true from scratch,
// regardless of whether the user had already dismissed it seconds earlier.
// Fix: back the snooze with localStorage so a dismissal survives a remount,
// not just a re-render of the same mounted instance.
const SNOOZE_STORAGE_KEY = 'brixsport-update-prompt-snoozed-until';

function readSnoozedUntil(): number {
    try {
        const raw = window.localStorage.getItem(SNOOZE_STORAGE_KEY);
        return raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
        return 0;
    }
}

function writeSnoozedUntil(untilMs: number) {
    try {
        window.localStorage.setItem(SNOOZE_STORAGE_KEY, String(untilMs));
    } catch {
        // localStorage unavailable (private mode, quota, etc.) -- the prompt
        // just won't survive a remount this time, same as before this fix.
    }
}

export function UpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    const checkRegistration = useCallback((reg: ServiceWorkerRegistration) => {
        setRegistration(reg);
        const stillSnoozed = Date.now() < readSnoozedUntil();

        // 1. Check if there's already a waiting worker
        if (reg.waiting) {
            if (stillSnoozed) {
                console.log('[UpdatePrompt] Waiting worker found on mount, but still within snooze window -- not showing');
                return;
            }
            console.log('[UpdatePrompt] Waiting worker found on mount');
            setShowPrompt(true);
            return;
        }

        // 2. Listen for a new worker being installed
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            console.log('[UpdatePrompt] New worker installing');
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    if (Date.now() < readSnoozedUntil()) {
                        console.log('[UpdatePrompt] New worker installed, but still within snooze window -- not showing');
                        return;
                    }
                    console.log('[UpdatePrompt] New worker installed and waiting');
                    setShowPrompt(true);
                }
            });
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        // Get current registration
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
                checkRegistration(reg);
            }
        });

        // BUG-041 root cause: sw-user.js calls self.clients.claim() in its
        // `activate` handler (public/sw-user.js line 61), which claims THIS
        // page the moment the service worker first activates -- including on
        // a brand new visit where no worker controlled the page yet, and
        // including while this very page is still hydrating. That claim
        // fires `controllerchange` unconditionally, and this handler used to
        // call window.location.reload() for ANY controllerchange, with no
        // check for whether the page was already controlled.
        //
        // Net effect in production: every fresh visit (new tab, cleared
        // cache, or a page open when a deploy activates a new worker) forced
        // a full hard reload while React was mid-hydration -- interrupting
        // hydration is exactly what produces React error #418, and the
        // reload re-parses/re-executes the entire bundle (including the
        // ~420KB shared framework chunk, "168" in the original filing),
        // which is the long-task/TBT spike, recurring on every such claim,
        // not just the first page load.
        //
        // Fix: only reload on a genuine controller SWAP (this page was
        // already controlled by an older worker, and a newer one just took
        // over) -- never on the first-ever claim of a previously-uncontrolled
        // page. Captured before the listener is attached so it reflects the
        // state at mount, not after any claim has already happened.
        const hadControllerAlready = !!navigator.serviceWorker.controller;

        const handleControllerChange = () => {
            if (!hadControllerAlready) {
                console.log('[UpdatePrompt] Controller changed (first claim on an uncontrolled page, no reload needed)');
                return;
            }
            console.log('[UpdatePrompt] Controller changed, reloading...');
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, [checkRegistration]);

    const handleUpdate = async () => {
        if (!registration) {
            console.error('[UpdatePrompt] No registration found');
            // Try to get it again as a fallback
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg?.waiting) {
                setIsUpdating(true);
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
                // If all else fails, just reload
                window.location.reload();
            }
            return;
        }

        if (registration.waiting) {
            console.log('[UpdatePrompt] Sending SKIP_WAITING message');
            setIsUpdating(true);
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            console.warn('[UpdatePrompt] No waiting worker found during update click');
            // If it disappeared but we think there's an update, maybe it already activated?
            // Or maybe it's still installing? Let's check reg.installing
            if (registration.installing) {
                setIsUpdating(true);
                // Wait for it to install
                registration.installing.addEventListener('statechange', (e: any) => {
                    if (e.target.state === 'installed') {
                        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            } else {
                // Last ditch effort
                window.location.reload();
            }
        }
    };

    // BUG-244 follow-up: dismissing used to hide this permanently for the rest
    // of the tab's life, leaving a waiting worker (and its stale build) in
    // place with zero further nudge -- a logger who dismisses once could run
    // a fully stale build through an entire live match with no other prompt.
    // A literal forced reload on dismiss was considered and rejected: forcing
    // a reload out from under an active logger mid-match risks interrupting
    // in-flight event logging (CLAUDE.md: "No page refresh required to
    // continue logging mid-match"). Snoozing and re-surfacing instead keeps
    // the nudge alive without ever reloading anything the user didn't ask for.
    //
    // BACKLOG-359: the in-memory setTimeout below still re-surfaces the
    // prompt after 15min *for this mounted instance* -- kept as-is since a
    // long-lived tab that never navigates should still get re-nudged. The
    // localStorage write is the actual fix: it's what a FUTURE remount
    // (a different navigation) checks via readSnoozedUntil() in
    // checkRegistration, so "Later" now means "not for 15 minutes," not
    // "not until this exact component instance happens to still be alive."
    const UPDATE_SNOOZE_MS = 15 * 60 * 1000;
    const handleDismiss = () => {
        setShowPrompt(false);
        writeSnoozedUntil(Date.now() + UPDATE_SNOOZE_MS);
        window.setTimeout(() => {
            if (registration?.waiting) setShowPrompt(true);
        }, UPDATE_SNOOZE_MS);
    };

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] pointer-events-auto"
                >
                    <div className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border border-blue-500/30 rounded-3xl p-6 backdrop-blur-xl shadow-2xl shadow-blue-500/20 pointer-events-auto relative overflow-hidden">
                        {isUpdating && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20 flex items-center justify-center">
                                <Loader2 className="text-white animate-spin" size={32} />
                            </div>
                        )}

                        <button
                            onClick={handleDismiss}
                            disabled={isUpdating}
                            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer z-10 disabled:opacity-0"
                            type="button"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <RefreshCw className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="font-display text-xl italic uppercase tracking-tight text-white mb-1">
                                    Update Available
                                </h3>
                                <p className="text-sm text-white/60">
                                    A new version of Brixsport is ready. Update now for the latest features and improvements.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleUpdate}
                                disabled={isUpdating}
                                type="button"
                                className="flex-1 bg-blue-500 text-white font-black uppercase tracking-widest text-xs py-3 px-4 rounded-xl hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
                            >
                                {isUpdating ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        Update Now
                                    </>
                                )}
                            </button>
                            {!isUpdating && (
                                <button
                                    onClick={handleDismiss}
                                    type="button"
                                    className="px-4 py-3 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                                >
                                    Later
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

