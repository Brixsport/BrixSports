'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    ArrowRight,
    Clock,
    DollarSign,
    CheckCircle,
    AlertCircle,
    XCircle,
    Filter,
    Search,
    User,
    Shield,
    Calendar,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Transfer {
    id: string;
    player: {
        id: string;
        name: string;
        image: string | null;
        position: string;
    };
    fromTeam: {
        id: string;
        name: string;
        logo: string;
        color: string;
    } | null;
    toTeam: {
        id: string;
        name: string;
        logo: string;
        color: string;
    } | null;
    transferType: string;
    fee: string | null;
    status: string;
    reliability: number;
    source: string | null;
    description: string | null;
    imageUrl: string | null;
    announcedAt: string | null;
    season: string;
    createdAt: string;
}

const TRANSFER_TYPES = [
    { id: 'all', label: 'All Transfers' },
    { id: 'permanent', label: 'Permanent' },
    { id: 'loan', label: 'Loan' },
    { id: 'free', label: 'Free Transfer' },
    { id: 'draft', label: 'Draft' },
];

const TRANSFER_STATUS = [
    { id: 'all', label: 'All Status' },
    { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-blue-400' },
    { id: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'text-blue-400' },
    { id: 'rumor', label: 'Rumors', icon: AlertCircle, color: 'text-yellow-400' },
    { id: 'failed', label: 'Failed', icon: XCircle, color: 'text-red-400' },
];

export default function TransfersPage() {
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchTransfers();
    }, [selectedType, selectedStatus, searchQuery]);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedType !== 'all') {
                params.append('type', selectedType);
            }
            if (selectedStatus !== 'all') {
                params.append('status', selectedStatus);
            }
            params.append('limit', '20');

            const response = await fetch(`/api/transfers?${params.toString()}`);
            const data = await response.json();

            let transfersData = data.transfers || [];

            // Client-side search filter
            if (searchQuery) {
                transfersData = transfersData.filter((t: Transfer) =>
                    t.player?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.fromTeam?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.toTeam?.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            setTransfers(transfersData);
        } catch (error) {
            console.error('Error fetching transfers:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        const statusConfig = TRANSFER_STATUS.find(s => s.id === status);
        return statusConfig?.icon || AlertCircle;
    };

    const getStatusColor = (status: string) => {
        const statusConfig = TRANSFER_STATUS.find(s => s.id === status);
        return statusConfig?.color || 'text-gray-400';
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 mb-2">
                        Transfer Center
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Track all player movements, transfers, and rumors
                    </p>
                </motion.div>

                {/* Search and Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8 space-y-4"
                >
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search players or teams..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Transfer Type Filter */}
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-slate-400 mb-2">Transfer Type</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {TRANSFER_TYPES.map((type) => (
                                    <motion.button
                                        key={type.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setSelectedType(type.id)}
                                        className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${selectedType === type.id
                                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50'
                                            }`}
                                    >
                                        {type.label}
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-slate-400 mb-2">Status</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {TRANSFER_STATUS.map((status) => {
                                    const Icon = status.icon || Filter;
                                    return (
                                        <motion.button
                                            key={status.id}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setSelectedStatus(status.id)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${selectedStatus === status.id
                                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                                                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50'
                                                }`}
                                        >
                                            {status.icon && <Icon className="w-4 h-4" />}
                                            {status.label}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Transfers List */}
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="bg-slate-800/50 rounded-2xl h-32" />
                            </div>
                        ))}
                    </div>
                ) : transfers.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-slate-400 mb-2">No transfers found</h3>
                        <p className="text-slate-500">Try adjusting your filters or search query</p>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {transfers.map((transfer, index) => (
                                <TransferCard key={transfer.id} transfer={transfer} index={index} getStatusIcon={getStatusIcon} getStatusColor={getStatusColor} formatDate={formatDate} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

function TransferCard({ transfer, index, getStatusIcon, getStatusColor, formatDate }: {
    transfer: Transfer;
    index: number;
    getStatusIcon: (status: string) => any;
    getStatusColor: (status: string) => string;
    formatDate: (date: string | null) => string;
}) {
    const StatusIcon = getStatusIcon(transfer.status);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.05 }}
        >
            <div className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20">
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 ${getStatusColor(transfer.status)}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">{transfer.status}</span>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Player Info */}
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                            {transfer.player?.image ? (
                                <Image
                                    src={transfer.player.image}
                                    alt={transfer.player.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-8 h-8 text-slate-500" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                                {transfer.player?.name || 'Unknown Player'}
                            </h3>
                            <p className="text-slate-400 text-sm">{transfer.player?.position || 'Position TBD'}</p>
                        </div>
                    </div>

                    {/* Transfer Arrow */}
                    <div className="flex items-center gap-4 flex-1">
                        {/* From Team */}
                        {transfer.fromTeam ? (
                            <div className="flex items-center gap-2 flex-1">
                                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                                    <Image
                                        src={transfer.fromTeam.logo}
                                        alt={transfer.fromTeam.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <span className="text-slate-300 font-medium text-sm hidden md:block">{transfer.fromTeam.name}</span>
                            </div>
                        ) : (
                            <div className="flex-1 text-slate-500 text-sm">Free Agent</div>
                        )}

                        {/* Arrow */}
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                                <ArrowRight className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        {/* To Team */}
                        {transfer.toTeam ? (
                            <div className="flex items-center gap-2 flex-1 justify-end">
                                <span className="text-slate-300 font-medium text-sm hidden md:block">{transfer.toTeam.name}</span>
                                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                                    <Image
                                        src={transfer.toTeam.logo}
                                        alt={transfer.toTeam.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 text-slate-500 text-sm text-right">TBD</div>
                        )}
                    </div>

                    {/* Transfer Details */}
                    <div className="flex flex-col gap-2 text-sm">
                        {transfer.fee && (
                            <div className="flex items-center gap-2 text-blue-400">
                                <DollarSign className="w-4 h-4" />
                                <span className="font-semibold">{transfer.fee}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-400">
                            <Shield className="w-4 h-4" />
                            <span className="capitalize">{transfer.transferType}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(transfer.announcedAt)}</span>
                        </div>
                    </div>
                </div>

                {/* Description */}
                {transfer.description && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <p className="text-slate-400 text-sm">{transfer.description}</p>
                    </div>
                )}

                {/* Reliability Indicator (for rumors) */}
                {transfer.status === 'rumor' && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Reliability</span>
                            <div className="flex gap-1">
                                {[...Array(10)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-2 h-2 rounded-full ${i < transfer.reliability ? 'bg-yellow-400' : 'bg-slate-700'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                        {transfer.source && (
                            <p className="text-xs text-slate-500 mt-2">Source: {transfer.source}</p>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

