"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

const formSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
});

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        setServerError(null);
        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(values),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong");
            }

            setIsSubmitted(true);
            toast.success("Reset link sent!", {
                description: "Check your email for a link to reset your password.",
            });

            // In development, you might see the reset link in the server console
            if (data.resetLink) {
                console.log("Reset Link:", data.resetLink);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Please try again later";
            setServerError(errorMessage);
            console.error("Forgot password error:", error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#050505]">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#3b82f6]/10 blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#8b5cf6]/10 blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] rounded-full bg-[#3b82f6]/5 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="z-10 w-full max-w-md"
            >
                {/* Main Card */}
                <div className="relative bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl shadow-[#3b82f6]/5">
                    {/* Top Gradient Line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#3b82f6] rounded-t-3xl" />

                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <Link href="/">
                            <Image
                                src="/assests/Logos/BRIX-SPORT-LOGO.png"
                                alt="Brixsports"
                                width={120}
                                height={60}
                                className="h-16 w-auto object-contain"
                                priority
                            />
                        </Link>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <h2 className="font-display text-3xl tracking-tight italic uppercase mb-2 text-white">
                            Reset Password
                        </h2>
                        <p className="text-sm text-white/40">
                            Enter your email and we&apos;ll send you a reset link
                        </p>
                    </div>

                    {/* Server Error Display */}
                    <AnimatePresence>
                        {serverError && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                            >
                                <p className="text-sm text-red-400 text-center font-medium">
                                    {serverError}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isSubmitted ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center text-center space-y-6 py-8"
                        >
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 flex items-center justify-center border border-[#3b82f6]/30">
                                <CheckCircle2 className="w-10 h-10 text-[#3b82f6]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2 text-white">Check your inbox</h3>
                                <p className="text-white/50 text-sm">
                                    We&apos;ve sent a password reset link to <span className="font-medium text-[#3b82f6]">{form.getValues().email}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setIsSubmitted(false)}
                                className="text-sm text-white/50 hover:text-[#3b82f6] transition-colors"
                            >
                                Try another email
                            </button>
                        </motion.div>
                    ) : (
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Email Field */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                    <input
                                        {...form.register("email")}
                                        type="email"
                                        placeholder="Enter your email"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/10 transition-all text-sm"
                                    />
                                </div>
                                {form.formState.errors.email && (
                                    <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group overflow-hidden bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#3b82f6] text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#3b82f6]/25"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Sending link...
                                        </>
                                    ) : (
                                        "Send Reset Link"
                                    )}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            </button>
                        </form>
                    )}

                    {/* Back to Login */}
                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[#3b82f6] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Sign In
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-white/30 mt-6">
                    Need help? Contact us at support@brixsports.com
                </p>
            </motion.div>
        </div>
    );
}
