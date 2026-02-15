'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Home, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function RegistrationSuccessPage() {
    const params = useParams();
    const competitionId = params.id as string;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 md:p-12 shadow-2xl text-center"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="inline-flex items-center justify-center w-24 h-24 bg-green-500/20 rounded-full mb-6"
                >
                    <CheckCircle className="w-16 h-16 text-green-400" />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-4xl md:text-5xl font-bold text-white mb-4"
                >
                    Registration Successful!
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-gray-300 text-lg mb-8"
                >
                    Your team registration has been submitted successfully. You will receive a confirmation email shortly.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/5 border border-gray-700 rounded-xl p-6 mb-8"
                >
                    <h2 className="text-xl font-semibold text-white mb-3">What's Next?</h2>
                    <ul className="text-left text-gray-300 space-y-2">
                        <li className="flex items-start gap-2">
                            <span className="text-purple-400 mt-1">•</span>
                            <span>Our team will review your registration within 24-48 hours</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-purple-400 mt-1">•</span>
                            <span>You'll receive an email notification once your registration is approved</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-purple-400 mt-1">•</span>
                            <span>Check your email for further instructions and competition details</span>
                        </li>
                    </ul>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                    <Link
                        href={`/competitions/${competitionId}`}
                        className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
                    >
                        <FileText className="w-5 h-5" />
                        View Competition
                    </Link>
                    <Link
                        href="/"
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        <Home className="w-5 h-5" />
                        Back to Home
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    );
}
