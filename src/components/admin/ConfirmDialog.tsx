'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
}: ConfirmDialogProps) {
    const variantStyles = {
        danger: {
            icon: 'text-red-500',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            button: 'bg-red-500 hover:bg-red-600 text-white',
        },
        warning: {
            icon: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/20',
            button: 'bg-yellow-500 hover:bg-yellow-600 text-black',
        },
        info: {
            icon: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            button: 'bg-blue-500 hover:bg-blue-600 text-white',
        },
    };

    const styles = variantStyles[variant];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative bg-[#0a0a0a] rounded-2xl border border-white/10 max-w-md w-full overflow-hidden"
                    >
                        {/* Header */}
                        <div className={`p-6 ${styles.bg} border-b ${styles.border}`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${styles.bg} border ${styles.border}`}>
                                    <AlertTriangle className={styles.icon} size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold mb-1">{title}</h3>
                                    <p className="text-sm text-white/60">{message}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    disabled={isLoading}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isLoading}
                                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles.button}`}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </span>
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
