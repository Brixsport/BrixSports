import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'How BRIXSPORTS collects, uses, and protects your data.',
};

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <section className="py-16 px-4 md:px-12">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-display italic uppercase tracking-tight mb-4">
                        Privacy Policy
                    </h1>
                    <p className="text-white/40 text-sm mb-12">Last updated: 27 July 2026</p>

                    <div className="prose prose-invert max-w-none space-y-10 text-white/70 leading-relaxed">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-sm not-prose">
                            <strong>Placeholder notice:</strong> this page establishes the required route for NDPA
                            compliance and PWA listing ahead of public launch. It is written to be accurate for
                            BRIXSPORTS&apos; current MVP data practices but has not been reviewed by counsel —
                            replace with reviewed legal copy before onboarding users outside the initial pilot.
                        </div>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">1. Who We Are</h2>
                            <p>
                                BRIXSPORTS (&quot;we&quot;, &quot;us&quot;) operates a live university sports
                                platform covering match scores, player statistics, and related content. This
                                policy explains what data we collect from viewers, loggers, and administrators, and
                                how it is used.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">2. Data We Collect</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Account data:</strong> name, email address, and password (hashed) if you register or log in.</li>
                                <li><strong>Usage data:</strong> favourited teams/players, follows, and notification preferences.</li>
                                <li><strong>Device data:</strong> push notification subscription tokens, if you enable push notifications.</li>
                                <li><strong>Match data you submit:</strong> if you are an assigned logger, the events, scores, and lineups you record during a live match.</li>
                                <li><strong>Uploaded images:</strong> photos submitted through the platform are stored via Cloudinary, a third-party image hosting provider.</li>
                            </ul>
                            <p className="mt-3">
                                Viewers browsing public match pages without an account are not required to
                                register and are not tracked by name.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">3. How We Use Your Data</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>To operate core features: live match logging, live scores, standings, and player profiles.</li>
                                <li>To send push notifications you have explicitly opted into (goals, cards, match start/end for favourited teams).</li>
                                <li>To maintain accurate audit trails for match events (who logged what, and when).</li>
                                <li>To monitor and fix errors, via Sentry (error tracking) — see Section 5.</li>
                            </ul>
                            <p className="mt-3">We do not sell your personal data to third parties.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">4. Public vs. Private Data</h2>
                            <p>
                                Match scores, events, team/player names, and public statistics are shown to all
                                viewers by design — this is the core product. Personal account details (your
                                email address, login credentials, internal role/approval status) are never
                                included in public API responses or pages.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">5. Third-Party Services</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Google (Sign in with Google)</strong> — if you choose to sign up or log in with Google, we receive your name, email address, and profile info from Google to create/authenticate your account.</li>
                                <li><strong>Cloudinary</strong> — hosts and delivers uploaded images.</li>
                                <li><strong>Sentry</strong> — receives error/crash diagnostic data to help us fix bugs; this may include technical details about your device and the page you were using when an error occurred.</li>
                                <li><strong>Push notification infrastructure (VAPID/Web Push)</strong> — used only if you opt in; you can revoke this at any time from your device or browser settings.</li>
                                <li><strong>Turso (database hosting)</strong> — stores all platform data.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">6. Your Rights (NDPR)</h2>
                            <p>
                                Under the Nigeria Data Protection Regulation, you may request access to,
                                correction of, or deletion of your personal data. To make a request, contact us
                                using the details in Section 8.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">7. Data Retention</h2>
                            <p>
                                Account data is retained while your account is active. Match event data (scores,
                                logged events) is retained indefinitely as historical sports records, consistent
                                with how sports statistics are conventionally kept — this data is not personally
                                identifying beyond publicly known player/team names.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">8. Contact</h2>
                            <p>
                                Questions about this policy or your data:{' '}
                                <a href="mailto:support@brixsport.com" className="text-primary hover:underline">
                                    support@brixsport.com
                                </a>
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </div>
    );
}
