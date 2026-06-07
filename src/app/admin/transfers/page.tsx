'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    Plus,
    Edit,
    Trash2,
    ArrowRight,
    Save,
    X,
    Search,
    User,
    Shield,
    DollarSign,
    Calendar,
    CheckCircle,
    AlertCircle,
    XCircle,
    Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

interface Transfer {
    id: string;
    player: {
        id: string;
        name: string;
        image: string | null;
        position: string;
    } | null;
    fromTeam: {
        id: string;
        name: string;
        logo: string;
    } | null;
    toTeam: {
        id: string;
        name: string;
        logo: string;
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

const TRANSFER_TYPES = ['permanent', 'loan', 'free', 'draft'];
const TRANSFER_STATUS = ['rumor', 'confirmed', 'completed', 'failed'];

function AdminTransfersPageContent() {
    const { user } = useAuth();
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const { toasts, removeToast, success, error } = useToast();

    const [deleteDialog, setDeleteDialog] = useState({
        isOpen: false,
        itemId: null as string | null,
        itemName: '',
        isDeleting: false,
    });

    // Form state
    const [formData, setFormData] = useState({
        playerId: '',
        fromTeamId: '',
        toTeamId: '',
        transferType: 'permanent',
        fee: '',
        status: 'rumor',
        reliability: 5,
        source: '',
        description: '',
        imageUrl: '',
        sendPushNotification: false,
        season: new Date().getFullYear().toString(),
    });

    useEffect(() => {
        fetchTransfers();
        fetchPlayers();
        fetchTeams();
    }, [filterStatus]);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'all') {
                params.append('status', filterStatus);
            }
            params.append('limit', '50');

            const response = await fetch(`/api/transfers?${params.toString()}`);
            const data = await response.json();
            setTransfers(data.transfers || []);
        } catch (err) {
            error('Failed to load transfers. Please try again.');
            console.error('Error fetching transfers:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayers = async () => {
        try {
            const response = await fetch('/api/players?limit=100');
            const data = await response.json();
            setPlayers(data.players || []);
        } catch (err) {
            error('Failed to load players.');
            console.error('Error fetching players:', err);
        }
    };

    const fetchTeams = async () => {
        try {
            const response = await fetch('/api/teams?limit=50');
            const data = await response.json();
            setTeams(data.teams || []);
        } catch (err) {
            error('Failed to load teams.');
            console.error('Error fetching teams:', err);
        }
    };

    const handleCreate = () => {
        setEditingTransfer(null);
        setFormData({
            playerId: '',
            fromTeamId: '',
            toTeamId: '',
            transferType: 'permanent',
            fee: '',
            status: 'rumor',
            reliability: 5,
            source: '',
            description: '',
            imageUrl: '',
            sendPushNotification: false,
            season: new Date().getFullYear().toString(),
        });
        setShowEditor(true);
    };

    const handleEdit = (transfer: Transfer) => {
        setEditingTransfer(transfer);
        setFormData({
            playerId: transfer.player?.id || '',
            fromTeamId: transfer.fromTeam?.id || '',
            toTeamId: transfer.toTeam?.id || '',
            transferType: transfer.transferType,
            fee: transfer.fee || '',
            status: transfer.status,
            reliability: transfer.reliability,
            source: transfer.source || '',
            description: transfer.description || '',
            imageUrl: transfer.imageUrl || '',
            sendPushNotification: false,
            season: transfer.season,
        });
        setShowEditor(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = {
                ...formData,
                createdBy: user?.id ?? null,
            };

            const url = editingTransfer ? `/api/transfers/${editingTransfer.id}` : '/api/transfers';
            const method = editingTransfer ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setShowEditor(false);
                fetchTransfers();
                success(editingTransfer ? 'Transfer updated successfully!' : 'Transfer created successfully!');
            } else {
                const data = await response.json();
                error(data.error || 'Failed to save transfer');
            }
        } catch (err) {
            error('Network error. Please check your connection.');
            console.error('Error saving transfer:', err);
        }
    };

    const confirmDelete = (id: string, name: string) => {
        setDeleteDialog({
            isOpen: true,
            itemId: id,
            itemName: name,
            isDeleting: false,
        });
    };

    const handleDelete = async () => {
        if (!deleteDialog.itemId) return;

        setDeleteDialog(prev => ({ ...prev, isDeleting: true }));

        try {
            const response = await fetch(`/api/transfers/${deleteDialog.itemId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchTransfers();
                success('Transfer deleted successfully!');
                setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false });
            } else {
                const data = await response.json();
                error(data.error || 'Failed to delete transfer');
                setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
            }
        } catch (err) {
            error('Network error. Please try again.');
            console.error('Error deleting transfer:', err);
            setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
        }
    };

    const filteredTransfers = transfers.filter(transfer =>
        transfer.player?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transfer.fromTeam?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transfer.toTeam?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} onClose={removeToast} />
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin" className="text-slate-400 hover:text-white transition-colors">
                                ← Back to Admin
                            </Link>
                            <div className="h-6 w-px bg-slate-700" />
                            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                Transfers Management
                            </h1>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            Add Transfer
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Filters */}
                <div className="mb-8 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search transfers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex gap-2">
                            {['all', ...TRANSFER_STATUS].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-3 rounded-xl font-semibold capitalize transition-all ${filterStatus === status
                                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Transfers List */}
                {loading ? (
                    <SkeletonLoader type="card" count={5} />
                ) : filteredTransfers.length === 0 ? (
                    <div className="text-center py-20">
                        <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-slate-400 mb-2">No transfers found</h3>
                        <p className="text-slate-500">Create your first transfer to get started</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredTransfers.map((transfer) => (
                            <TransferCard
                                key={transfer.id}
                                transfer={transfer}
                                onEdit={() => handleEdit(transfer)}
                                onDelete={() => confirmDelete(transfer.id, transfer.player?.name || 'Unknown Player')}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Editor Modal */}
            <AnimatePresence>
                {showEditor && (
                    <TransferEditor
                        formData={formData}
                        setFormData={setFormData}
                        onSubmit={handleSubmit}
                        onClose={() => setShowEditor(false)}
                        isEditing={!!editingTransfer}
                        players={players}
                        teams={teams}
                    />
                )}
            </AnimatePresence>

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={() => setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false })}
                onConfirm={handleDelete}
                title="Delete Transfer?"
                message={`Are you sure you want to delete the transfer for "${deleteDialog.itemName}"? This action cannot be undone.`}
                confirmText="Delete Transfer"
                variant="danger"
                isLoading={deleteDialog.isDeleting}
            />
        </div>
    );
}

export default function AdminTransfersPage() {
    return (
        <ErrorBoundary>
            <AdminTransfersPageContent />
        </ErrorBoundary>
    );
}

function TransferCard({ transfer, onEdit, onDelete }: {
    transfer: Transfer;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            rumor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
            confirmed: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
            completed: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
            failed: 'text-red-400 bg-red-400/10 border-red-400/20',
        };
        return colors[status] || colors.rumor;
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 transition-all"
        >
            <div className="flex items-center gap-6">
                {/* Player */}
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-700">
                        {transfer.player?.image ? (
                            <img src={transfer.player.image} alt={transfer.player.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <User className="w-6 h-6 text-slate-500" />
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">{transfer.player?.name || 'Unknown Player'}</h3>
                        <p className="text-sm text-slate-400">{transfer.player?.position || 'Position TBD'}</p>
                    </div>
                </div>

                {/* Transfer Arrow */}
                <div className="flex items-center gap-4">
                    {transfer.fromTeam && (
                        <div className="flex items-center gap-2">
                            <img src={transfer.fromTeam.logo} alt={transfer.fromTeam.name} className="w-8 h-8" />
                            <span className="text-sm text-slate-300 hidden md:block">{transfer.fromTeam.name}</span>
                        </div>
                    )}
                    <ArrowRight className="w-6 h-6 text-blue-400" />
                    {transfer.toTeam && (
                        <div className="flex items-center gap-2">
                            <img src={transfer.toTeam.logo} alt={transfer.toTeam.name} className="w-8 h-8" />
                            <span className="text-sm text-slate-300 hidden md:block">{transfer.toTeam.name}</span>
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="flex items-center gap-6 text-sm text-slate-400">
                    <span className={`px-3 py-1 rounded-full border font-semibold capitalize ${getStatusColor(transfer.status)}`}>
                        {transfer.status}
                    </span>
                    <span className="capitalize">{transfer.transferType}</span>
                    {transfer.fee && (
                        <span className="flex items-center gap-1 text-blue-400">
                            <DollarSign className="w-4 h-4" />
                            {transfer.fee}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onEdit}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <Edit className="w-5 h-5 text-blue-400" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function TransferEditor({ formData, setFormData, onSubmit, onClose, isEditing, players, teams }: {
    formData: any;
    setFormData: (data: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
    isEditing: boolean;
    players: any[];
    teams: any[];
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
                <form onSubmit={onSubmit}>
                    {/* Header */}
                    <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between z-10">
                        <h2 className="text-2xl font-bold text-white">
                            {isEditing ? 'Edit Transfer' : 'Add New Transfer'}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="p-6 space-y-6">
                        {/* Player Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                                Player *
                            </label>
                            <select
                                required
                                value={formData.playerId}
                                onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a player...</option>
                                {players.map((player) => (
                                    <option key={player.id} value={player.id}>
                                        {player.name} - {player.position}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Teams */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    From Team
                                </label>
                                <select
                                    value={formData.fromTeamId}
                                    onChange={(e) => setFormData({ ...formData, fromTeamId: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Free Agent</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    To Team
                                </label>
                                <select
                                    value={formData.toTeamId}
                                    onChange={(e) => setFormData({ ...formData, toTeamId: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">TBD</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Transfer Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Transfer Type *
                                </label>
                                <select
                                    required
                                    value={formData.transferType}
                                    onChange={(e) => setFormData({ ...formData, transferType: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {TRANSFER_TYPES.map((type) => (
                                        <option key={type} value={type} className="capitalize">
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Status *
                                </label>
                                <select
                                    required
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {TRANSFER_STATUS.map((status) => (
                                        <option key={status} value={status} className="capitalize">
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Fee and Season */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Transfer Fee
                                </label>
                                <input
                                    type="text"
                                    value={formData.fee}
                                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Undisclosed, $1M"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Season
                                </label>
                                <input
                                    type="text"
                                    value={formData.season}
                                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="2024/2025"
                                />
                            </div>
                        </div>

                        {/* Reliability (for rumors) */}
                        {formData.status === 'rumor' && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Reliability (1-10): {formData.reliability}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={formData.reliability}
                                    onChange={(e) => setFormData({ ...formData, reliability: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        )}

                        {/* Source */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                                Source
                            </label>
                            <input
                                type="text"
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Sky Sports, ESPN"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Additional details..."
                            />
                        </div>

                        {/* Image URL */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                                Image URL
                            </label>
                            <input
                                type="url"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://example.com/image.jpg"
                            />
                        </div>

                        {/* Push Notification */}
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.sendPushNotification}
                                onChange={(e) => setFormData({ ...formData, sendPushNotification: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-slate-300 font-semibold">Send Push Notification</span>
                        </label>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-6 flex items-center justify-end gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all"
                        >
                            <Save className="w-5 h-5" />
                            {isEditing ? 'Update Transfer' : 'Add Transfer'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

