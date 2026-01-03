"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
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

const formSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
});

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
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
            console.error("Forgot password error:", error);
            toast.error("Request failed", {
                description: error instanceof Error ? error.message : "Please try again later.",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
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
                            Forgot Password
                        </CardTitle>
                        <CardDescription>
                            Enter your email to receive a password reset link
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isSubmitted ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center text-center space-y-4 py-6"
                            >
                                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Mail className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">Check your inbox</h3>
                                    <p className="text-muted-foreground text-sm">
                                        We've sent a password reset link to <span className="font-medium text-foreground">{form.getValues().email}</span>
                                    </p>
                                </div>
                                <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                                    Try another email
                                </Button>
                            </motion.div>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="name@example.com"
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
                                                Sending link...
                                            </>
                                        ) : (
                                            "Send Reset Link"
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        )}
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
