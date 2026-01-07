'use client';

import { motion } from 'framer-motion';

interface MatchStatusBadgeProps {
    status: string;
    className?: string;
    matchTime?: {
        minute: number;
        extraTime: number;
        half: number;
    };
}

export default function MatchStatusBadge({ status, className = '', matchTime }: MatchStatusBadgeProps) {
    const getStatusConfig = () => {
        switch (status) {
            case 'LIVE':
                return {
                    label: matchTime ? `${matchTime.minute}'${matchTime.extraTime > 0 ? `+${matchTime.extraTime}` : ''}` : 'LIVE',
                    icon: '🔴',
                    bgColor: 'bg-red-500/20',
                    textColor: 'text-red-500',
                    borderColor: 'border-red-500/50',
                    animate: true,
                };
            case 'HALF_TIME':
                return {
                    label: 'HT',
                    icon: '⏸️',
                    bgColor: 'bg-orange-500/20',
                    textColor: 'text-orange-500',
                    borderColor: 'border-orange-500/50',
                    animate: false,
                };
            case 'FINISHED':
                return {
                    label: 'FT',
                    icon: '✅',
                    bgColor: 'bg-blue-500/20',
                    textColor: 'text-blue-500',
                    borderColor: 'border-blue-500/50',
                    animate: false,
                };
            case 'UPCOMING':
                return {
                    label: 'UPCOMING',
                    icon: '⏰',
                    bgColor: 'bg-blue-500/20',
                    textColor: 'text-blue-500',
                    borderColor: 'border-blue-500/50',
                    animate: false,
                };
            case 'POSTPONED':
                return {
                    label: 'POSTPONED',
                    icon: '⏸️',
                    bgColor: 'bg-gray-500/20',
                    textColor: 'text-gray-500',
                    borderColor: 'border-gray-500/50',
                    animate: false,
                };
            case 'CANCELLED':
                return {
                    label: 'CANCELLED',
                    icon: '❌',
                    bgColor: 'bg-red-500/20',
                    textColor: 'text-red-500',
                    borderColor: 'border-red-500/50',
                    animate: false,
                };
            default:
                return {
                    label: status,
                    icon: '⚪',
                    bgColor: 'bg-white/10',
                    textColor: 'text-white/60',
                    borderColor: 'border-white/20',
                    animate: false,
                };
        }
    };

    const config = getStatusConfig();

    return (
        <motion.div
            animate={config.animate ? { opacity: [1, 0.5, 1] } : {}}
            transition={config.animate ? { duration: 2, repeat: Infinity } : {}}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} font-semibold text-sm ${className}`}
        >
            <span className={config.animate ? 'animate-pulse' : ''}>{config.icon}</span>
            <span>{config.label}</span>
        </motion.div>
    );
}
