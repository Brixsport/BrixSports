"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, CheckCircle, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { getClientErrorMessage } from "@/lib/client-error";

const STRENGTH_LABELS = {
    0: "Enter Password",
    1: "Weak",
    2: "Fair",
    3: "Good",
    4: "Strong",
};

const calculateStrength = (password: string) => {
    let score = 0;
    if (!password) return 0;
    if (password.length > 5) score += 1;
    if (password.length > 7) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    return score;
};

const formSchema = z
    .object({
        password: z.string().min(6, {
            message: "Password must be at least 6 characters.",
        }),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!token) {
            toast.error("Invalid Request", {
                description: "Missing reset token. Please request a new link.",
            });
            return;
        }

        setIsLoading(true);
        setServerError(null);
        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    newPassword: values.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong");
            }

            setIsSuccess(true);
            toast.success("Password Reset!", {
                description: "Your password has been successfully updated.",
            });

            // Redirect after a delay
            setTimeout(() => {
                router.push("/login");
            }, 3000);

        } catch (error) {
            setServerError(getClientErrorMessage(error, "Please try again later"));
            console.error("Reset password error:", error);
        } finally {
            setIsLoading(false);
        }
    }

    if (!token) {
        return (
            <div className="text-center space-y-6 py-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center border border-red-500/30 mx-auto">
                    <Lock className="w-10 h-10 text-red-500" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-2">Invalid Link</h3>
                    <p className="text-white/50 text-sm">The password reset link is invalid or has expired.</p>
                </div>
                <Link
                    href="/forgot-password"
                    className="inline-block w-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#3b82f6] text-white font-bold py-3.5 px-6 rounded-xl transition-all"
                >
                    Request new link
                </Link>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center space-y-6 py-8"
            >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 flex items-center justify-center border border-[#3b82f6]/30">
                    <CheckCircle className="w-10 h-10 text-[#3b82f6]" />
                </div>
                <div>
                    <h3 className="text-xl font-bold mb-2 text-white">Password Reset Successful!</h3>
                    <p className="text-white/50 text-sm">
                        You can now log in with your new password. Redirecting...
                    </p>
                </div>
                <Link
                    href="/login"
                    className="inline-block w-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#3b82f6] text-white font-bold py-3.5 px-6 rounded-xl transition-all"
                >
                    Go to Login
                </Link>
            </motion.div>
        );
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

            {/* Password Field */}
            <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                    New Password
                </label>
                <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                        {...form.register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/10 transition-all text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                {/* Password Strength Meter */}
                {form.watch("password") && (
                    <div className="space-y-2 mt-3">
                        <div className="flex gap-1 h-1.5 w-full">
                            {[1, 2, 3, 4].map((level) => {
                                const strength = calculateStrength(form.watch("password"));
                                return (
                                    <div
                                        key={level}
                                        className={`h-full flex-1 rounded-full transition-colors duration-300 ${strength >= level
                                                ? strength <= 2
                                                    ? "bg-red-500"
                                                    : strength === 3
                                                        ? "bg-yellow-500"
                                                        : "bg-[#3b82f6]"
                                                : "bg-white/10"
                                            }`}
                                    />
                                );
                            })}
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-right text-white/40">
                            {Object.values(STRENGTH_LABELS)[calculateStrength(form.watch("password"))]}
                        </p>
                    </div>
                )}

                {form.formState.errors.password && (
                    <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
                )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                    Confirm Password
                </label>
                <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                        {...form.register("confirmPassword")}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/10 transition-all text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                    >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                {form.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-500">{form.formState.errors.confirmPassword.message}</p>
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
                            Resetting password...
                        </>
                    ) : (
                        "Reset Password"
                    )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#050505]">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#3b82f6]/10 blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#8b5cf6]/10 blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-[40%] right-[30%] w-[30%] h-[30%] rounded-full bg-[#3b82f6]/5 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
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
                            Create New Password
                        </h2>
                        <p className="text-sm text-white/40">
                            Enter a strong password for your account
                        </p>
                    </div>

                    {/* Form Content */}
                    <Suspense fallback={
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
                        </div>
                    }>
                        <ResetPasswordForm />
                    </Suspense>

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
