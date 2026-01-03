'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    onClose: (id: string) => void;
}

export default function Toast({ id, type, message, duration = 5000, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const config = {
        success: {
            icon: CheckCircle2,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20',
        },
        error: {
            icon: XCircle,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
        },
        warning: {
            icon: AlertCircle,
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/20',
        },
        info: {
            icon: Info,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
        },
    };

    const { icon: Icon, color, bg, border } = config[type];

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`flex items-start gap-3 p-4 ${bg} border ${border} rounded-xl backdrop-blur-xl shadow-lg min-w-[300px] max-w-md`}
        >
            <Icon className={color} size={20} />
            <p className="flex-1 text-sm font-medium">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
            >
                <X size={16} />
            </button>
        </motion.div>
    );
}

interface ToastContainerProps {
    toasts: Array<{ id: string; type: ToastType; message: string }>;
    onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <Toast key={toast.id} {...toast} onClose={onClose} />
                ))}
            </AnimatePresence>
        </div>
    );
}
