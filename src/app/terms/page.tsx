import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Terms of Service',
    description: 'The terms governing use of BRIXSPORTS.',
};

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <section className="py-16 px-4 md:px-12">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-display italic uppercase tracking-tight mb-4">
                        Terms of Service
                    </h1>
                    <p className="text-white/40 text-sm mb-12">Last updated: 27 July 2026</p>

                    <div className="prose prose-invert max-w-none space-y-10 text-white/70 leading-relaxed">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-sm not-prose">
                            <strong>Placeholder notice:</strong> this page establishes the required route for PWA
                            listing ahead of public launch and reflects BRIXSPORTS&apos; current MVP scope. It has
                            not been reviewed by counsel — replace with reviewed legal copy before onboarding
                            users outside the initial pilot.
                        </div>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">1. Acceptance</h2>
                            <p>
                                By creating an account or using BRIXSPORTS, you agree to these terms. If you do
                                not agree, do not use the platform.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">2. The Service</h2>
                            <p>
                                BRIXSPORTS provides live scores, event logging, statistics, and related coverage
                                for Nigerian university sports competitions. Live match data is entered by
                                assigned loggers in real time; while we take reasonable care, we do not guarantee
                                the data is free of human entry error.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">3. Accounts and Roles</h2>
                            <p>
                                The platform has distinct account roles (Super Admin, Competition Admin, Team
                                Manager, Logger, Viewer). You are responsible for keeping your login credentials
                                confidential and for all activity under your account. Logger accounts are assigned
                                by an administrator and are expected to be used only for the matches assigned to
                                that logger.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">4. Acceptable Use</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Do not submit false, defamatory, or intentionally inaccurate match data.</li>
                                <li>Do not attempt to access accounts, matches, or admin functionality you are not authorized for.</li>
                                <li>Do not use automated tools to scrape or overload the platform.</li>
                                <li>Do not upload content you do not have the right to share.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">5. Content Ownership</h2>
                            <p>
                                Match data, statistics, and media you submit as part of an official logging or
                                admin role become part of the platform&apos;s public sports record. You retain
                                ownership of original content you upload but grant BRIXSPORTS a licence to display
                                it as part of the service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">6. Availability</h2>
                            <p>
                                BRIXSPORTS is provided on an &quot;as is&quot; basis during its MVP phase. Live
                                features (real-time scores, notifications) depend on network connectivity and
                                third-party infrastructure and may occasionally be delayed or interrupted.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">7. Termination</h2>
                            <p>
                                We may suspend or terminate accounts that violate these terms, including logger
                                or admin accounts found to have entered deliberately false match data.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">8. Changes</h2>
                            <p>
                                We may update these terms as the platform evolves. Material changes will be
                                reflected by updating the &quot;Last updated&quot; date above.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-white mb-3">9. Contact</h2>
                            <p>
                                Questions about these terms:{' '}
                                <a href="mailto:support@brixsport.com" className="text-primary hover:underline">
                                    support@brixsport.com
                                </a>
                            </p>
                        </section>

                        <p className="text-white/40 text-sm">
                            See also our{' '}
                            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
