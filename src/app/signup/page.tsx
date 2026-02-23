"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, Lock, User, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { OnboardingModal } from "@/components/OnboardingModal";

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
        name: z.string().min(2, {
            message: "Name must be at least 2 characters.",
        }),
        email: z.string().email({
            message: "Please enter a valid email address.",
        }),
        password: z.string().min(6, {
            message: "Password must be at least 6 characters.",
        }),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

export default function SignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [success, setSuccess] = useState(false);

    // Onboarding State
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [userId, setUserId] = useState("");
    const [userName, setUserName] = useState("");
    const [userToken, setUserToken] = useState("");

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    async function handleGoogleLogin() {
        // Implement Google Login logic here or redirect
        window.location.href = '/api/auth/google';
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: values.name,
                    email: values.email,
                    password: values.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const error = new Error(data.error || "Something went wrong") as any;
                error.code = data.code;
                throw error;
            }

            // Store token and user data
            localStorage.setItem("authToken", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            setSuccess(true);
            toast.success("Welcome aboard!", {
                description: "Your account has been successfully created.",
            });

            // Set data for Onboarding
            setUserId(data.user.id);
            setUserName(data.user.name);
            setUserToken(data.token);

            // Show onboarding after a short delay
            setTimeout(() => {
                setShowOnboarding(true);
            }, 1000);

        } catch (error) {
            console.error("Signup error:", error);
            toast.error("Registration failed", {
                description: (
                    <div className="flex flex-col gap-1">
                        <p>{error instanceof Error ? error.message : "Please try again later."}</p>
                        {(error as any).code && (
                            <p className="text-[10px] font-mono uppercase opacity-50">Code: {(error as any).code}</p>
                        )}
                    </div>
                ),
            });
        } finally {
            if (!success) setIsLoading(false);
        }
    }

    const handleOnboardingComplete = () => {
        window.location.href = "/";
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">

            <OnboardingModal
                isOpen={showOnboarding}
                userId={userId}
                userName={userName}
                token={userToken}
                onComplete={handleOnboardingComplete}
            />

            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
            >
                {/* Animated Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.1),transparent_50%)]" />
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,rgba(255,215,0,0.05),transparent_50%)]" />
                </div>

                <div className="relative p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center font-display text-3xl -skew-x-12 text-black mx-auto mb-4 shadow-lg shadow-primary/20">
                            B
                        </div>
                        <h2 className="font-display text-3xl tracking-tight italic uppercase mb-2 text-white">
                            Join Brix Sport
                        </h2>
                        <p className="text-sm text-white/40">
                            Create an account to get started
                        </p>
                    </div>

                    {/* Success Message */}
                    <AnimatePresence>
                        {success && !showOnboarding && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-3"
                            >
                                <CheckCircle2 size={20} className="text-primary" />
                                <p className="text-sm text-primary font-medium">
                                    Account created! Setting up...
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                                Full Name
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    {...form.register("name")}
                                    type="text"
                                    placeholder="Enter your name"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-sm"
                                />
                            </div>
                            {form.formState.errors.name && (
                                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    {...form.register("email")}
                                    type="email"
                                    placeholder="Enter your email"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-sm"
                                />
                            </div>
                            {form.formState.errors.email && (
                                <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    {...form.register("password")}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a password"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-sm mb-2"
                                    onChange={(e) => {
                                        form.register("password").onChange(e);
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                                    style={{ marginTop: "-4px" }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Password Strength Meter */}
                            {form.watch("password") && (
                                <div className="space-y-1.5 mb-2">
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
                                                                : "bg-emerald-500"
                                                        : "bg-white/10"
                                                        }`}
                                                />
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-right text-gray-400">
                                        {Object.values(STRENGTH_LABELS)[calculateStrength(form.watch("password"))]}
                                    </p>
                                </div>
                            )}

                            {form.formState.errors.password && (
                                <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    {...form.register("confirmPassword")}
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm your password"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-sm"
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

                        <button
                            type="submit"
                            disabled={isLoading || success}
                            className="w-full bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20 mt-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Creating Account...
                                </>
                            ) : success ? (
                                <>
                                    <CheckCircle2 size={18} />
                                    Success!
                                </>
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#0e0e11] px-4 text-white/40 font-bold tracking-widest">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    {/* Social Logins */}
                    <div className="grid grid-cols-1 gap-3">
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 transition-all text-white"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-wider">Continue with Google</span>
                        </button>
                    </div>

                    {/* Sign In Link */}
                    <div className="mt-8 text-center">
                        <p className="text-sm text-white/40">
                            Already have an account?{" "}
                            <Link
                                href="/login"
                                className="text-primary hover:text-primary/80 font-bold transition-colors"
                            >
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
