'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Heart,
    MessageCircle,
    Share2,
    Bookmark,
    ArrowLeft,
    Eye,
    Calendar,
    User,
    Send,
    Edit2,
    Trash2,
    X,
    Check,
    Facebook,
    Twitter,
    Link as LinkIcon,
    Zap,
    Star,
    Clock,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { getReadingTime } from '@/lib/utils/reading-time';
import { formatNewsContent } from '@/lib/utils/format-content';

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

interface Comment {
    id: string;
    userId: string;
    userName: string;
    content: string;
    likes: number;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
}

export default function NewsDetailPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [relatedArticles, setRelatedArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [commentCount, setCommentCount] = useState(0);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [readingTime, setReadingTime] = useState<string>('');

    // Nested comments state
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});

    // Mock user ID - replace with actual auth
    const userId = 'user-1';
    const userName = 'Guest User';

    useEffect(() => {
        fetchArticle();
        fetchComments();
        fetchLikeStatus();
        fetchBookmarkStatus();
        fetchRelatedArticles();
    }, [slug]);

    useEffect(() => {
        if (article?.content) {
            const { formatted } = getReadingTime(article.content);
            setReadingTime(formatted);
        }
    }, [article]);

    const fetchArticle = async () => {
        try {
            const response = await fetch(`/api/news/${slug}`);
            const data = await response.json();
            setArticle(data);
            setLikeCount(data.likes || 0);
        } catch (error) {
            console.error('Error fetching article:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async () => {
        try {
            const response = await fetch(`/api/news/${slug}/comments`);
            const data = await response.json();
            const fetchedComments = data.comments || [];
            setComments(fetchedComments);
            setCommentCount(data.total || 0);

            // Fetch like status for each comment
            fetchedComments.forEach((comment: Comment) => {
                fetchCommentLikes(comment.id);
            });
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    const fetchCommentLikes = async (commentId: string) => {
        try {
            const response = await fetch(`/api/news/${slug}/comments/${commentId}/like?userId=${userId}`);
            const data = await response.json();
            setCommentLikes(prev => ({
                ...prev,
                [commentId]: {
                    count: data.likes || 0,
                    isLiked: data.isLiked || false,
                },
            }));
        } catch (error) {
            console.error('Error fetching comment likes:', error);
        }
    };

    const fetchRelatedArticles = async () => {
        try {
            const response = await fetch(`/api/news/${slug}/related?limit=3`);
            const data = await response.json();
            setRelatedArticles(data.related || []);
        } catch (error) {
            console.error('Error fetching related articles:', error);
        }
    };

    const fetchLikeStatus = async () => {
        try {
            const response = await fetch(`/api/news/${slug}/like?userId=${userId}`);
            const data = await response.json();
            setIsLiked(data.isLiked);
            setLikeCount(data.count);
        } catch (error) {
            console.error('Error fetching like status:', error);
        }
    };

    const fetchBookmarkStatus = async () => {
        try {
            const response = await fetch(`/api/user/bookmarks/${slug}?userId=${userId}`);
            const data = await response.json();
            setIsBookmarked(data.isBookmarked);
        } catch (error) {
            console.error('Error fetching bookmark status:', error);
        }
    };

    const handleLike = async () => {
        try {
            const response = await fetch(`/api/news/${slug}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await response.json();
            setIsLiked(data.liked);
            setLikeCount((prev) => (data.liked ? prev + 1 : prev - 1));
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleBookmark = async () => {
        try {
            if (isBookmarked) {
                await fetch(`/api/user/bookmarks/${slug}?userId=${userId}`, {
                    method: 'DELETE',
                });
                setIsBookmarked(false);
            } else {
                await fetch('/api/user/bookmarks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, newsId: slug }),
                });
                setIsBookmarked(true);
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    };

    const handleShare = (platform: string) => {
        const url = window.location.href;
        const text = article?.title || '';

        const shareUrls: Record<string, string> = {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
        };

        if (platform === 'copy') {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        } else if (shareUrls[platform]) {
            window.open(shareUrls[platform], '_blank');
        }

        setShowShareMenu(false);
    };

    const handleCommentLike = async (commentId: string) => {
        try {
            const response = await fetch(`/api/news/${slug}/comments/${commentId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await response.json();

            setCommentLikes(prev => ({
                ...prev,
                [commentId]: {
                    count: prev[commentId] ? (data.liked ? prev[commentId].count + 1 : prev[commentId].count - 1) : 0,
                    isLiked: data.liked,
                },
            }));
        } catch (error) {
            console.error('Error toggling comment like:', error);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        try {
            const response = await fetch(`/api/news/${slug}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    userName,
                    content: commentText,
                }),
            });

            if (response.ok) {
                setCommentText('');
                setShowCommentForm(false);
                fetchComments();
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleAddReply = async (parentId: string) => {
        if (!replyText.trim()) return;

        try {
            const response = await fetch(`/api/news/${slug}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    userName,
                    content: replyText,
                    parentId,
                }),
            });

            if (response.ok) {
                setReplyText('');
                setReplyingTo(null);
                fetchComments();
            }
        } catch (error) {
            console.error('Error adding reply:', error);
        }
    };

    const toggleExpandComment = (commentId: string) => {
        setExpandedComments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(commentId)) {
                newSet.delete(commentId);
            } else {
                newSet.add(commentId);
            }
            return newSet;
        });
    };

    const handleEditComment = async (commentId: string) => {
        if (!editText.trim()) return;

        try {
            const response = await fetch(`/api/news/${slug}/comments/${commentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    content: editText,
                }),
            });

            if (response.ok) {
                setEditingComment(null);
                setEditText('');
                fetchComments();
            }
        } catch (error) {
            console.error('Error editing comment:', error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm('Delete this comment?')) return;

        try {
            const response = await fetch(`/api/news/${slug}/comments/${commentId}?userId=${userId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchComments();
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Article not found</h1>
                    <Link href="/news" className="text-cyan-400 hover:text-cyan-300">
                        ← Back to News
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link
                        href="/news"
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to News
                    </Link>
                </div>
            </div>

            {/* Article */}
            <article className="max-w-4xl mx-auto px-6 py-12">
                {/* Title & Meta */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold capitalize border border-cyan-500/20">
                            {article.category}
                        </span>
                        {article.isBreaking && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-bold border border-red-500/20">
                                <Zap className="w-4 h-4" />
                                BREAKING
                            </span>
                        )}
                        {article.isFeatured && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-bold border border-yellow-500/20">
                                <Star className="w-4 h-4" />
                                FEATURED
                            </span>
                        )}
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                        {article.title}
                    </h1>

                    <div className="flex items-center gap-6 text-sm text-slate-400 flex-wrap">
                        <span className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {article.authorName}
                        </span>
                        <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(article.createdAt).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </span>
                        <span className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            {article.views} views
                        </span>
                        {readingTime && (
                            <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {readingTime}
                            </span>
                        )}
                    </div>
                </div>

                {/* Featured Image */}
                {article.imageUrl && (
                    <div className="mb-8 rounded-2xl overflow-hidden">
                        <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="w-full h-auto"
                        />
                    </div>
                )}

                {/* Engagement Bar */}
                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isLiked
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                            <span className="font-semibold">{likeCount}</span>
                        </button>

                        <button
                            onClick={() => setShowCommentForm(!showCommentForm)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                        >
                            <MessageCircle className="w-5 h-5" />
                            <span className="font-semibold">{commentCount}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBookmark}
                            className={`p-2 rounded-lg transition-all ${isBookmarked
                                ? 'bg-yellow-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                        >
                            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setShowShareMenu(!showShareMenu)}
                                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                                title="Share"
                            >
                                <Share2 className="w-5 h-5" />
                            </button>

                            <AnimatePresence>
                                {showShareMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-10"
                                    >
                                        <button
                                            onClick={() => handleShare('facebook')}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
                                        >
                                            <Facebook className="w-5 h-5 text-blue-500" />
                                            <span className="text-white">Facebook</span>
                                        </button>
                                        <button
                                            onClick={() => handleShare('twitter')}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
                                        >
                                            <Twitter className="w-5 h-5 text-sky-500" />
                                            <span className="text-white">Twitter</span>
                                        </button>
                                        <button
                                            onClick={() => handleShare('whatsapp')}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
                                        >
                                            <MessageCircle className="w-5 h-5 text-green-500" />
                                            <span className="text-white">WhatsApp</span>
                                        </button>
                                        <button
                                            onClick={() => handleShare('copy')}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
                                        >
                                            <LinkIcon className="w-5 h-5 text-slate-400" />
                                            <span className="text-white">Copy Link</span>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div
                    className="prose prose-invert prose-lg max-w-none mb-12 
                    prose-headings:text-white prose-headings:font-bold prose-headings:mb-4 prose-headings:mt-8
                    prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl
                    prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-6 prose-p:text-lg
                    prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:text-cyan-300 hover:prose-a:underline
                    prose-strong:text-white prose-strong:font-semibold
                    prose-em:text-slate-200 prose-em:italic
                    prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-6 prose-ul:text-slate-300
                    prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-6 prose-ol:text-slate-300
                    prose-li:mb-2 prose-li:leading-relaxed
                    prose-blockquote:border-l-4 prose-blockquote:border-cyan-500 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-slate-400 prose-blockquote:my-6
                    prose-code:text-cyan-400 prose-code:bg-slate-800 prose-code:px-2 prose-code:py-1 prose-code:rounded
                    prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-xl prose-pre:p-4
                    prose-img:rounded-xl prose-img:my-8 prose-img:shadow-2xl
                    prose-hr:border-slate-700 prose-hr:my-8
                    first-letter:text-5xl first-letter:font-bold first-letter:text-cyan-400 first-letter:mr-1 first-letter:float-left"
                    dangerouslySetInnerHTML={{ __html: formatNewsContent(article.content) }}
                />

                {/* Tags */}
                {article.tags && (
                    <div className="flex items-center gap-2 flex-wrap mb-12">
                        {JSON.parse(article.tags).map((tag: string, index: number) => (
                            <span
                                key={index}
                                className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-sm border border-slate-700"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Comments Section */}
                <div className="border-t border-slate-800 pt-12">
                    <h2 className="text-2xl font-bold text-white mb-6">
                        Comments ({commentCount})
                    </h2>

                    {/* Add Comment Form */}
                    <AnimatePresence>
                        {showCommentForm && (
                            <motion.form
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                onSubmit={handleAddComment}
                                className="mb-8"
                            >
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Write a comment..."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                                    maxLength={1000}
                                />
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-sm text-slate-400">
                                        {commentText.length}/1000
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCommentForm(false);
                                                setCommentText('');
                                            }}
                                            className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!commentText.trim()}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Send className="w-4 h-4" />
                                            Post Comment
                                        </button>
                                    </div>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {/* Comments List */}
                    <div className="space-y-4">
                        {comments.filter(c => !c.parentId).map((comment) => {
                            const replies = comments.filter(c => c.parentId === comment.id);
                            const hasReplies = replies.length > 0;
                            const isExpanded = expandedComments.has(comment.id);
                            const commentLikeData = commentLikes[comment.id] || { count: 0, isLiked: false };

                            return (
                                <motion.div
                                    key={comment.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-slate-800/50 rounded-xl border border-slate-700/50"
                                >
                                    <div className="p-4">
                                        {editingComment === comment.id ? (
                                            <div>
                                                <textarea
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    rows={3}
                                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none mb-3"
                                                    maxLength={1000}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleEditComment(comment.id)}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingComment(null);
                                                            setEditText('');
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <p className="font-semibold text-white">
                                                            {comment.userName}
                                                        </p>
                                                        <p className="text-xs text-slate-400">
                                                            {new Date(comment.createdAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    {comment.userId === userId && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingComment(comment.id);
                                                                    setEditText(comment.content);
                                                                }}
                                                                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4 text-slate-400" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-400" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-slate-300 mb-3">{comment.content}</p>

                                                {/* Comment Actions */}
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => handleCommentLike(comment.id)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${commentLikeData.isLiked
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        <Heart className={`w-4 h-4 ${commentLikeData.isLiked ? 'fill-current' : ''}`} />
                                                        <span>{commentLikeData.count}</span>
                                                    </button>

                                                    <button
                                                        onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors text-sm"
                                                    >
                                                        <MessageCircle className="w-4 h-4" />
                                                        Reply
                                                    </button>

                                                    {hasReplies && (
                                                        <button
                                                            onClick={() => toggleExpandComment(comment.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors text-sm"
                                                        >
                                                            {isExpanded ? (
                                                                <>
                                                                    <ChevronUp className="w-4 h-4" />
                                                                    Hide {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown className="w-4 h-4" />
                                                                    Show {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Reply Form */}
                                                <AnimatePresence>
                                                    {replyingTo === comment.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4"
                                                        >
                                                            <textarea
                                                                value={replyText}
                                                                onChange={(e) => setReplyText(e.target.value)}
                                                                placeholder="Write a reply..."
                                                                rows={3}
                                                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                                                                maxLength={1000}
                                                            />
                                                            <div className="flex items-center justify-between mt-2">
                                                                <span className="text-sm text-slate-400">
                                                                    {replyText.length}/1000
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setReplyingTo(null);
                                                                            setReplyText('');
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAddReply(comment.id)}
                                                                        disabled={!replyText.trim()}
                                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                                    >
                                                                        <Send className="w-4 h-4" />
                                                                        Reply
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </>
                                        )}
                                    </div>

                                    {/* Nested Replies */}
                                    <AnimatePresence>
                                        {isExpanded && hasReplies && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="border-t border-slate-700/50 bg-slate-900/30"
                                            >
                                                {replies.map((reply) => {
                                                    const replyLikeData = commentLikes[reply.id] || { count: 0, isLiked: false };

                                                    return (
                                                        <div key={reply.id} className="p-4 pl-8 border-l-2 border-cyan-500/30">
                                                            {editingComment === reply.id ? (
                                                                <div>
                                                                    <textarea
                                                                        value={editText}
                                                                        onChange={(e) => setEditText(e.target.value)}
                                                                        rows={3}
                                                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none mb-3"
                                                                        maxLength={1000}
                                                                    />
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleEditComment(reply.id)}
                                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm"
                                                                        >
                                                                            <Check className="w-4 h-4" />
                                                                            Save
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingComment(null);
                                                                                setEditText('');
                                                                            }}
                                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div>
                                                                            <p className="font-semibold text-white text-sm">
                                                                                {reply.userName}
                                                                            </p>
                                                                            <p className="text-xs text-slate-400">
                                                                                {new Date(reply.createdAt).toLocaleString()}
                                                                            </p>
                                                                        </div>
                                                                        {reply.userId === userId && (
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingComment(reply.id);
                                                                                        setEditText(reply.content);
                                                                                    }}
                                                                                    className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                                                    title="Edit"
                                                                                >
                                                                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeleteComment(reply.id)}
                                                                                    className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                                                                    title="Delete"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-slate-300 text-sm mb-2">{reply.content}</p>

                                                                    {/* Reply Actions */}
                                                                    <div className="flex items-center gap-3">
                                                                        <button
                                                                            onClick={() => handleCommentLike(reply.id)}
                                                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs ${replyLikeData.isLiked
                                                                                ? 'bg-red-500/20 text-red-400'
                                                                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                                                }`}
                                                                        >
                                                                            <Heart className={`w-3.5 h-3.5 ${replyLikeData.isLiked ? 'fill-current' : ''}`} />
                                                                            <span>{replyLikeData.count}</span>
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}

                        {comments.length === 0 && !showCommentForm && (
                            <div className="text-center py-12">
                                <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400 mb-4">No comments yet</p>
                                <button
                                    onClick={() => setShowCommentForm(true)}
                                    className="px-6 py-3 bg-cyan-500 text-white rounded-xl font-semibold hover:bg-cyan-600 transition-colors"
                                >
                                    Be the first to comment
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Related Articles Section */}
                {relatedArticles.length > 0 && (
                    <div className="border-t border-slate-800 pt-12 mt-12">
                        <h2 className="text-2xl font-bold text-white mb-6">Related Articles</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {relatedArticles.map((related) => (
                                <Link
                                    key={related.id}
                                    href={`/news/${related.slug}`}
                                    className="group"
                                >
                                    <motion.div
                                        whileHover={{ y: -4 }}
                                        className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-cyan-500/50 transition-all"
                                    >
                                        {related.imageUrl && (
                                            <div className="aspect-video overflow-hidden">
                                                <img
                                                    src={related.imageUrl}
                                                    alt={related.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            </div>
                                        )}
                                        <div className="p-4">
                                            <span className="inline-block px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold capitalize border border-cyan-500/20 mb-2">
                                                {related.category}
                                            </span>
                                            <h3 className="text-white font-bold mb-2 line-clamp-2 group-hover:text-cyan-400 transition-colors">
                                                {related.title}
                                            </h3>
                                            <p className="text-slate-400 text-sm line-clamp-2 mb-3">
                                                {related.excerpt}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Eye className="w-3 h-3" />
                                                    {related.views}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Heart className="w-3 h-3" />
                                                    {related.likes}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </article>
        </div>
    );
}
