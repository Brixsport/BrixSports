"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

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
            console.error("Reset password error:", error);
            toast.error("Reset failed", {
                description: error instanceof Error ? error.message : "Please try again later.",
            });
        } finally {
            setIsLoading(false);
        }
    }

    if (!token) {
        return (
            <div className="text-center space-y-4">
                <h3 className="text-xl font-bold text-destructive">Invalid Link</h3>
                <p className="text-muted-foreground">The password reset link is invalid or missing.</p>
                <Button asChild>
                    <Link href="/forgot-password">Request new link</Link>
                </Button>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center space-y-4 py-6"
            >
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h3 className="text-xl font-bold mb-2">Password Reset Successful</h3>
                    <p className="text-muted-foreground text-sm">
                        You can now log in with your new password.
                    </p>
                </div>
                <Button asChild className="mt-4">
                    <Link href="/login">Go to Login</Link>
                </Button>
            </motion.div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="bg-background/50"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="bg-background/50"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="w-full text-base font-medium transition-all hover:scale-[1.02]"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting password...
                        </>
                    ) : (
                        "Reset Password"
                    )}
                </Button>
            </form>
        </Form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="z-10 w-full max-w-md"
            >
                <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="space-y-1 text-center">
                        <CardTitle className="text-3xl font-display tracking-wide">
                            Reset Password
                        </CardTitle>
                        <CardDescription>
                            Create a new password for your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>}>
                            <ResetPasswordForm />
                        </Suspense>
                    </CardContent>
                    <CardFooter className="flex justify-center text-sm text-muted-foreground">
                        <Link
                            href="/login"
                            className="flex items-center gap-2 font-medium hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Sign In
                        </Link>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
}
