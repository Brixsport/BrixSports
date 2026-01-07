'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AuthModal() {
    const {
        isAuthModalOpen,
        closeAuthModal,
        authModalMode,
        setAuthModalMode,
        login,
        register
    } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Password strength indicator
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

    // Reset form when modal opens/closes or mode changes
    useEffect(() => {
        if (isAuthModalOpen) {
            setName('');
            setEmail('');
            setPassword('');
            setError('');
            setSuccess('');
            setShowPassword(false);
        }
    }, [isAuthModalOpen, authModalMode]);

    // Calculate password strength
    useEffect(() => {
        if (password.length === 0) {
            setPasswordStrength('weak');
            return;
        }

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        if (strength <= 1) setPasswordStrength('weak');
        else if (strength <= 2) setPasswordStrength('medium');
        else setPasswordStrength('strong');
    }, [password]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (authModalMode === 'login') {
                const result = await login(email, password);
                if (result.success) {
                    setSuccess('Login successful!');
                } else {
                    setError(result.error || 'Login failed');
                }
            } else {
                // Validate password strength for registration
                if (passwordStrength === 'weak') {
                    setError('Please use a stronger password');
                    setLoading(false);
                    return;
                }

                const result = await register(name, email, password);
                if (result.success) {
                    setSuccess('Registration successful!');
                } else {
                    setError(result.error || 'Registration failed');
                }
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const getPasswordStrengthColor = () => {
        switch (passwordStrength) {
            case 'weak': return 'bg-red-500';
            case 'medium': return 'bg-yellow-500';
            case 'strong': return 'bg-green-500';
        }
    };

    const getPasswordStrengthWidth = () => {
        switch (passwordStrength) {
            case 'weak': return '33%';
            case 'medium': return '66%';
            case 'strong': return '100%';
        }
    };

    return (
        <AnimatePresence>
            {isAuthModalOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={closeAuthModal}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative p-6 border-b border-white/10">
                            <button
                                onClick={closeAuthModal}
                                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-white/60" />
                            </button>
                            <h2 className="text-2xl font-bold text-white">
                                {authModalMode === 'login' ? 'Welcome Back' : 'Create Account'}
                            </h2>
                            <p className="text-white/60 text-sm mt-1">
                                {authModalMode === 'login'
                                    ? 'Sign in to continue'
                                    : 'Join the community today'}
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Error/Success Messages */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                    <p className="text-sm text-red-200">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <p className="text-sm text-green-200">{success}</p>
                                </div>
                            )}

                            {/* Name Field (Register only) */}
                            {authModalMode === 'register' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/80">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="John Doe"
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Email Field */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={authModalMode === 'register' ? 8 : undefined}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-12 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-5 h-5 text-white/40" />
                                        ) : (
                                            <Eye className="w-5 h-5 text-white/40" />
                                        )}
                                    </button>
                                </div>

                                {/* Password Strength Indicator (Register only) */}
                                {authModalMode === 'register' && password.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                                                style={{ width: getPasswordStrengthWidth() }}
                                            />
                                        </div>
                                        <p className="text-xs text-white/60">
                                            Password strength: <span className="capitalize">{passwordStrength}</span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/40 font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        <span>{authModalMode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                                    </div>
                                ) : (
                                    authModalMode === 'login' ? 'Sign In' : 'Create Account'
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="p-6 pt-0 text-center">
                            <p className="text-sm text-white/60">
                                {authModalMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    onClick={() => setAuthModalMode(authModalMode === 'login' ? 'register' : 'login')}
                                    className="text-primary hover:text-primary/80 font-semibold transition-colors"
                                >
                                    {authModalMode === 'login' ? 'Sign up' : 'Sign in'}
                                </button>
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
