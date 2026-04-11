'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Newspaper,
    Plus,
    Edit,
    Trash2,
    Eye,
    Heart,
    Save,
    X,
    Search,
    CheckSquare,
    Square,
    Trash,
    Send,
    Archive,
    Zap,
    Star,
    Calendar,
    User,
    Clock,
    CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

// Dynamic imports to avoid SSR issues
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });
const ImageUpload = dynamic(() => import('@/components/ImageUpload'), { ssr: false });

interface NewsArticle {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    imageUrl: string | null;
    category: string;
    tags: string | null;
    isBreaking: boolean;
    isFeatured: boolean;
    authorName: string;
    views: number;
    likes: number;
    status: string;
    publishedAt: string | null;
    createdAt: string;
}

const CATEGORIES = ['match', 'transfer', 'injury', 'general', 'breaking'];

interface FormData {
    title: string;
    content: string;
    excerpt: string;
    imageUrl: string;
    category: string;
    tags: string;
    isBreaking: boolean;
    isFeatured: boolean;
    sendPushNotification: boolean;
    status: string;
}

function AdminNewsPageContent() {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingNews, setEditingNews] = useState<NewsArticle | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const { toasts, removeToast, success, error } = useToast();

    const [deleteDialog, setDeleteDialog] = useState({
        isOpen: false,
        itemId: null as string | null,
        itemName: '',
        isDeleting: false,
    });

    // Bulk selection
    const {
        selectedIds,
        selectedCount,
        toggleSelection,
        toggleAll,
        clearSelection,
        isSelected,
        isAllSelected,
        isSomeSelected,
    } = useBulkSelection(news);

    // Form state
    const [formData, setFormData] = useState<FormData>({
        title: '',
        content: '',
        excerpt: '',
        imageUrl: '',
        category: 'general',
        tags: '',
        isBreaking: false,
        isFeatured: false,
        sendPushNotification: false,
        status: 'draft',
    });

    // Auto-save for drafts
    const { isSaving } = useAutoSave({
        data: formData,
        onSave: async (data) => {
            if (editingNews && formData.status === 'draft') {
                await fetch(`/api/news/${editingNews.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...data,
                        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
                    }),
                });
                setLastSaved(new Date());
            }
        },
        delay: 3000,
        enabled: autoSaveEnabled && editingNews !== null && formData.status === 'draft',
    });

    useEffect(() => {
        fetchNews();
    }, [filterStatus]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus !== 'all') {
                params.append('status', filterStatus);
            }
            params.append('limit', '50');

            const response = await fetch(`/api/news?${params.toString()}`);
            const data = await response.json();
            setNews(data.news || []);
        } catch (err) {
            error('Failed to load news articles. Please try again.');
            console.error('Error fetching news:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingNews(null);
        setFormData({
            title: '',
            content: '',
            excerpt: '',
            imageUrl: '',
            category: 'general',
            tags: '',
            isBreaking: false,
            isFeatured: false,
            sendPushNotification: false,
            status: 'draft',
        });
        setAutoSaveEnabled(false);
        setShowEditor(true);
    };

    const handleEdit = (article: NewsArticle) => {
        setEditingNews(article);
        setFormData({
            title: article.title,
            content: article.content,
            excerpt: article.excerpt || '',
            imageUrl: article.imageUrl || '',
            category: article.category,
            tags: article.tags || '',
            isBreaking: article.isBreaking,
            isFeatured: article.isFeatured,
            sendPushNotification: false,
            status: article.status,
        });
        setAutoSaveEnabled(article.status === 'draft');
        setShowEditor(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!formData.title.trim()) {
            error('Title is required');
            return;
        }
        if (!formData.content.trim() || formData.content === '<p></p>') {
            error('Content is required. Please add content to the article.');
            return;
        }
        if (!formData.category) {
            error('Category is required');
            return;
        }

        try {
            const payload = {
                ...formData,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
                authorId: 'admin-1',
                authorName: 'Admin',
            };

            const url = editingNews ? `/api/news/${editingNews.id}` : '/api/news';
            const method = editingNews ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setShowEditor(false);
                setAutoSaveEnabled(false);
                fetchNews();
                success(editingNews ? 'Article updated successfully!' : 'Article created successfully!');
            } else {
                const data = await response.json();
                error(data.error || 'Failed to save article');
            }
        } catch (err) {
            error('Network error. Please check your connection.');
            console.error('Error saving news:', err);
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
            const response = await fetch(`/api/news/${deleteDialog.itemId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchNews();
                success('Article deleted successfully!');
                setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false });
            } else {
                const data = await response.json();
                error(data.error || 'Failed to delete article');
                setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
            }
        } catch (err) {
            error('Network error. Please try again.');
            console.error('Error deleting news:', err);
            setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
        }
    };

    // Bulk operations
    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedCount} selected articles?`)) return;

        try {
            await Promise.all(
                selectedIds.map((id) =>
                    fetch(`/api/news/${id}`, { method: 'DELETE' })
                )
            );
            clearSelection();
            fetchNews();
        } catch (error) {
            console.error('Error bulk deleting:', error);
        }
    };

    const handleBulkPublish = async () => {
        try {
            await Promise.all(
                selectedIds.map((id) =>
                    fetch(`/api/news/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'published' }),
                    })
                )
            );
            clearSelection();
            fetchNews();
        } catch (error) {
            console.error('Error bulk publishing:', error);
        }
    };

    const handleBulkArchive = async () => {
        try {
            await Promise.all(
                selectedIds.map((id) =>
                    fetch(`/api/news/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'archived' }),
                    })
                )
            );
            clearSelection();
            fetchNews();
        } catch (error) {
            console.error('Error bulk archiving:', error);
        }
    };

    const filteredNews = useMemo(() => {
        return news.filter(article =>
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [news, searchQuery]);

    return (
        <div className="min-h-screen bg-[#050505]">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} onClose={removeToast} />
            {/* Header */}
            <div className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 md:gap-4">
                            <Link href="/admin" className="text-white/40 hover:text-white transition-colors text-sm md:text-base">
                                ← Back
                            </Link>
                            <div className="h-6 w-px bg-white/10 hidden sm:block" />
                            <h1 className="text-xl md:text-2xl font-black text-white">
                                News
                            </h1>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary text-black rounded-xl font-semibold hover:bg-primary/80 transition-all text-sm md:text-base"
                        >
                            <Plus className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden sm:inline">Create Article</span>
                            <span className="sm:hidden">Create</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
                {/* Filters and Bulk Actions */}
                <div className="mb-8 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex flex-wrap gap-2">
                            {['all', 'draft', 'published', 'archived'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 md:px-4 py-2 md:py-3 rounded-xl font-semibold capitalize transition-all text-sm md:text-base ${filterStatus === status
                                        ? 'bg-primary text-black'
                                        : 'bg-[#0a0a0a] text-white/60 hover:bg-white/10 border border-white/10'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bulk Actions Bar */}
                    <AnimatePresence>
                        {selectedCount > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 bg-primary/10 border border-primary/20 rounded-xl"
                            >
                                <div className="flex items-center gap-3 md:gap-4">
                                    <span className="text-primary font-semibold text-sm md:text-base">
                                        {selectedCount} selected
                                    </span>
                                    <button
                                        onClick={clearSelection}
                                        className="text-sm text-white/40 hover:text-white transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={handleBulkPublish}
                                        className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-primary text-black rounded-lg font-semibold hover:bg-primary/80 transition-colors text-sm"
                                    >
                                        <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        <span className="hidden sm:inline">Publish</span>
                                    </button>
                                    <button
                                        onClick={handleBulkArchive}
                                        className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors text-sm"
                                    >
                                        <Archive className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        <span className="hidden sm:inline">Archive</span>
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm"
                                    >
                                        <Trash className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        <span className="hidden sm:inline">Delete</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Select All */}
                    {filteredNews.length > 0 && (
                        <button
                            onClick={toggleAll}
                            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
                        >
                            {isAllSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                            ) : isSomeSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary/50" />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                            Select All
                        </button>
                    )}
                </div>

                {/* News List */}
                {loading ? (
                    <SkeletonLoader type="card" count={5} />
                ) : filteredNews.length === 0 ? (
                    <div className="text-center py-20">
                        <Newspaper className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-white/60 mb-2">No articles found</h3>
                        <p className="text-white/40">Create your first article to get started</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredNews.map((article) => (
                            <NewsCard
                                key={article.id}
                                article={article}
                                isSelected={isSelected(article.id)}
                                onToggleSelect={() => toggleSelection(article.id)}
                                onEdit={() => handleEdit(article)}
                                onDelete={() => confirmDelete(article.id, article.title)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Enhanced Editor Modal */}
            <AnimatePresence>
                {showEditor && (
                    <EnhancedNewsEditor
                        formData={formData}
                        setFormData={setFormData}
                        onSubmit={handleSubmit}
                        onClose={() => {
                            setShowEditor(false);
                            setAutoSaveEnabled(false);
                        }}
                        isEditing={!!editingNews}
                        isSaving={isSaving}
                        lastSaved={lastSaved}
                        autoSaveEnabled={autoSaveEnabled}
                        onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled)}
                    />
                )}
            </AnimatePresence>

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={() => setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false })}
                onConfirm={handleDelete}
                title="Delete Article?"
                message={`Are you sure you want to delete "${deleteDialog.itemName}"? This action cannot be undone and will permanently remove the article.`}
                confirmText="Delete Article"
                variant="danger"
                isLoading={deleteDialog.isDeleting}
            />
        </div>
    );
}

export default function AdminNewsPageEnhanced() {
    return (
        <ErrorBoundary>
            <AdminNewsPageContent />
        </ErrorBoundary>
    );
}

function NewsCard({ article, isSelected, onToggleSelect, onEdit, onDelete }: {
    article: NewsArticle;
    isSelected: boolean;
    onToggleSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
            published: 'text-primary bg-primary/10 border-primary/20',
            archived: 'text-white/40 bg-white/10 border-white/10',
        };
        return colors[status] || colors.draft;
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`bg-[#0a0a0a] backdrop-blur-sm border rounded-2xl p-4 md:p-6 hover:border-primary/50 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-white/10'
                }`}
        >
            <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                {/* Checkbox */}
                <button
                    onClick={onToggleSelect}
                    className="mt-1 md:mt-2 flex-shrink-0"
                >
                    {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                        <Square className="w-5 h-5 text-white/30 hover:text-white/60" />
                    )}
                </button>

                {/* Image */}
                {article.imageUrl ? (
                    <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full md:w-32 h-48 md:h-32 rounded-xl object-cover flex-shrink-0"
                    />
                ) : (
                    <div className="w-full md:w-32 h-32 rounded-xl bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                        <Newspaper className="w-12 h-12 text-white/20" />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-col md:flex-row md:items-start justify-between mb-3 gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                                <h3 className="text-lg md:text-xl font-bold text-white line-clamp-2 md:truncate">{article.title}</h3>
                                {article.isBreaking && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex-shrink-0">
                                        <Zap className="w-3 h-3" />
                                        BREAKING
                                    </span>
                                )}
                                {article.isFeatured && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold flex-shrink-0">
                                        <Star className="w-3 h-3" />
                                        FEATURED
                                    </span>
                                )}
                            </div>
                            <p className="text-white/40 text-sm line-clamp-2">{article.excerpt}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={onEdit}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Edit className="w-5 h-5 text-primary" />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs md:text-sm text-white/40">
                        <span className={`px-2 md:px-3 py-1 rounded-full border font-semibold capitalize ${getStatusColor(article.status)}`}>
                            {article.status}
                        </span>
                        <span className="capitalize">{article.category}</span>
                        <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {article.views}
                        </span>
                        <span className="flex items-center gap-1">
                            <Heart className="w-4 h-4" />
                            {article.likes}
                        </span>
                        <span className="flex items-center gap-1 hidden sm:flex">
                            <User className="w-4 h-4" />
                            {article.authorName}
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(article.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function EnhancedNewsEditor({ formData, setFormData, onSubmit, onClose, isEditing, isSaving, lastSaved, autoSaveEnabled, onToggleAutoSave }: {
    formData: any;
    setFormData: (data: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
    isEditing: boolean;
    isSaving: boolean;
    lastSaved: Date | null;
    autoSaveEnabled: boolean;
    onToggleAutoSave: () => void;
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
                className="bg-[#0a0a0a] rounded-2xl border border-white/10 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            >
                <form onSubmit={onSubmit}>
                    {/* Header */}
                    <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/10 p-4 md:p-6 flex items-center justify-between z-10 gap-4">
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-2xl font-bold text-white truncate">
                                {isEditing ? 'Edit Article' : 'New Article'}
                            </h2>
                            {isEditing && formData.status === 'draft' && (
                                <div className="flex items-center gap-3 md:gap-4 mt-2 flex-wrap">
                                    <label className="flex items-center gap-2 text-xs md:text-sm text-white/40 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoSaveEnabled}
                                            onChange={onToggleAutoSave}
                                            className="w-4 h-4 rounded border-white/10 bg-[#0a0a0a] text-primary"
                                        />
                                        Auto-save
                                    </label>
                                    {isSaving && (
                                        <span className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-primary">
                                            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                                            Saving...
                                        </span>
                                    )}
                                    {lastSaved && !isSaving && (
                                        <span className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-primary">
                                            <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                            Saved {lastSaved.toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                        >
                            <X className="w-5 h-5 md:w-6 md:h-6 text-white/40" />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-semibold text-white/80 mb-2">
                                Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                                placeholder="Enter article title..."
                            />
                        </div>

                        {/* Excerpt */}
                        <div>
                            <label className="block text-sm font-semibold text-white/80 mb-2">
                                Excerpt
                            </label>
                            <textarea
                                value={formData.excerpt}
                                onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                                rows={2}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                                placeholder="Brief summary..."
                            />
                        </div>

                        {/* Rich Text Content */}
                        <div>
                            <label className="block text-sm font-semibold text-white/80 mb-2">
                                Content *
                            </label>
                            <RichTextEditor
                                content={formData.content}
                                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                                placeholder="Write your article content here..."
                            />
                        </div>

                        {/* Image Upload */}
                        <div>
                            <label className="block text-sm font-semibold text-white/80 mb-2">
                                Featured Image
                            </label>
                            <ImageUpload
                                value={formData.imageUrl}
                                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                                onRemove={() => setFormData({ ...formData, imageUrl: '' })}
                            />
                        </div>

                        {/* Category and Tags */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-white/80 mb-2">
                                    Category *
                                </label>
                                <select
                                    required
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat} className="capitalize">
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-white/80 mb-2">
                                    Tags (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={formData.tags}
                                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                                    placeholder="NUGA, Football, Championship"
                                />
                            </div>
                        </div>

                        {/* Checkboxes */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isBreaking}
                                    onChange={(e) => setFormData({ ...formData, isBreaking: e.target.checked })}
                                    className="w-5 h-5 rounded border-white/10 bg-[#0a0a0a] text-primary focus:ring-1 focus:ring-primary/50"
                                />
                                <span className="text-white/80 font-semibold">Breaking News</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isFeatured}
                                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                    className="w-5 h-5 rounded border-white/10 bg-[#0a0a0a] text-primary focus:ring-1 focus:ring-primary/50"
                                />
                                <span className="text-white/80 font-semibold">Featured Article</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.sendPushNotification}
                                    onChange={(e) => setFormData({ ...formData, sendPushNotification: e.target.checked })}
                                    className="w-5 h-5 rounded border-white/10 bg-[#0a0a0a] text-primary focus:ring-1 focus:ring-primary/50"
                                />
                                <span className="text-white/80 font-semibold">Send Push Notification</span>
                            </label>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-semibold text-white/80 mb-2">
                                Status *
                            </label>
                            <select
                                required
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-white/10 p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-end gap-3 md:gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 md:px-6 py-2.5 md:py-3 bg-[#0a0a0a] text-white rounded-xl font-semibold hover:bg-white/10 transition-colors border border-white/10 text-sm md:text-base"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary text-black rounded-xl font-semibold hover:bg-primary/80 transition-all text-sm md:text-base"
                        >
                            <Save className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden sm:inline">{isEditing ? 'Update Article' : 'Create Article'}</span>
                            <span className="sm:hidden">{isEditing ? 'Update' : 'Create'}</span>
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

