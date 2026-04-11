'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Heart,
    MessageCircle,
    Share2,
    Bookmark,
    ArrowLeft,
    User,
    Send,
    Trash2,
    Facebook,
    Twitter,
    Zap,
    Copy
} from 'lucide-react';
import Link from 'next/link';
import { getReadingTime } from '@/lib/utils/reading-time';
import { formatNewsContent } from '@/lib/utils/format-content';
import { toast } from 'sonner';

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
    const slug = params.slug as string;

    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [commentCount, setCommentCount] = useState(0);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [readingTime, setReadingTime] = useState<string>('');

    // Nested comments state
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});

    // Mock user ID - replace with actual auth
    const userId = 'user-1';
    const userName = 'Guest User';

    useEffect(() => {
        fetchArticle();
        fetchComments();
        fetchLikeStatus();
        fetchBookmarkStatus();
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
                fetchComments();
                toast.success('Comment posted successfully');
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to post comment');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            toast.error('Network error. Please try again.');
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
                toast.success('Reply posted successfully');
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to post reply');
            }
        } catch (error) {
            console.error('Error adding reply:', error);
            toast.error('Network error. Please try again.');
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
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Article not found</h1>
                    <Link href="/news" className="text-primary hover:text-white transition-colors">
                        ← Back to News
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-[#e0e0e0]">
            {/* Minimalist Header */}
            <div className="border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link
                        href="/news"
                        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to News
                    </Link>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBookmark}
                            className={`p-2 rounded-full transition-all ${isBookmarked
                                ? 'text-yellow-500'
                                : 'text-white/40 hover:bg-white/5 hover:text-white'
                                }`}
                            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                        >
                            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>
                        <button
                            onClick={() => setShowShareMenu(!showShareMenu)}
                            className="p-2 rounded-full text-white/40 hover:bg-white/5 hover:text-white transition-colors relative"
                            title="Share"
                        >
                            <Share2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Share Dropdown */}
                <AnimatePresence>
                    {showShareMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute right-4 md:right-[calc(50%-24rem)] top-14 w-56 bg-[#111] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                            >
                                <div className="p-1">
                                    <button onClick={() => handleShare('facebook')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left text-sm text-white/80">
                                        <Facebook className="w-4 h-4 text-[#1877f2]" /> Facebook
                                    </button>
                                    <button onClick={() => handleShare('twitter')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left text-sm text-white/80">
                                        <Twitter className="w-4 h-4 text-[#1da1f2]" /> Twitter
                                    </button>
                                    <button onClick={() => handleShare('whatsapp')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left text-sm text-white/80">
                                        <MessageCircle className="w-4 h-4 text-[#25d366]" /> WhatsApp
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button onClick={() => handleShare('copy')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left text-sm text-white/80">
                                        <Copy className="w-4 h-4 text-white/40" /> Copy Link
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            <article className="max-w-3xl mx-auto px-6 py-12">
                {/* Article Header */}
                <header className="mb-12 text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <span className="text-primary font-bold tracking-wider text-xs uppercase bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                            {article.category}
                        </span>
                        {article.isBreaking && (
                            <span className="flex items-center gap-1 text-red-500 font-bold tracking-wider text-xs uppercase bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 animate-pulse">
                                <Zap className="w-3 h-3" /> Breaking
                            </span>
                        )}
                    </div>

                    <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 leading-[1.15]">
                        {article.title}
                    </h1>

                    <p className="text-xl text-white/60 leading-relaxed mb-8 max-w-2xl mx-auto">
                        {article.excerpt}
                    </p>

                    <div className="flex items-center justify-center gap-4 border-t border-b border-white/5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-white/60" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white">{article.authorName}</div>
                                <div className="flex items-center gap-2 text-xs text-white/40">
                                    <span>{new Date(article.publishedAt || article.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    <span>•</span>
                                    <span>{readingTime || '5 min read'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Featured Image */}
                {article.imageUrl && (
                    <figure className="mb-12">
                        <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                            <img
                                src={article.imageUrl}
                                alt={article.title}
                                className="w-full h-auto"
                            />
                        </div>
                    </figure>
                )}

                {/* Main Content */}
                <div
                    className="prose prose-invert prose-lg max-w-none mb-16
                    prose-headings:font-display prose-headings:font-bold prose-headings:text-white
                    prose-p:text-[#d4d4d4] prose-p:font-sans prose-p:text-[18px] prose-p:leading-[1.8] prose-p:tracking-normal
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-white prose-strong:font-bold
                    prose-blockquote:border-l-primary prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:rounded-r-lg
                    prose-img:rounded-xl prose-img:shadow-xl
                    prose-code:text-primary prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                    prose-li:text-[#d4d4d4]"
                    dangerouslySetInnerHTML={{ __html: formatNewsContent(article.content) }}
                />

                {/* Tags */}
                {article.tags && (
                    <div className="flex items-center gap-2 flex-wrap mb-12 pb-12 border-b border-white/5">
                        {JSON.parse(article.tags).map((tag: string, index: number) => (
                            <Link
                                key={index}
                                href={`/news?search=${tag}`}
                                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                            >
                                #{tag}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Engagement / Comments */}
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleLike}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${isLiked
                                    ? 'bg-red-500/10 border-red-500/50 text-red-500'
                                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                <span className="font-bold text-sm">{likeCount}</span>
                            </button>
                            <h3 className="text-lg font-bold text-white/80">
                                {commentCount} comments
                            </h3>
                        </div>
                    </div>

                    {/* Comment Input */}
                    <form onSubmit={handleAddComment} className="mb-10">
                        <div className="relative">
                            <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="What are your thoughts?"
                                rows={3}
                                className="w-full pl-4 pr-12 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 resize-none transition-all"
                                maxLength={1000}
                            />
                            <button
                                type="submit"
                                disabled={!commentText.trim()}
                                className="absolute right-3 bottom-3 p-2 rounded-lg bg-primary text-black hover:bg-primary/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-6">
                        {comments.filter(c => !c.parentId).map((comment) => {
                            const replies = comments.filter(c => c.parentId === comment.id);
                            const hasReplies = replies.length > 0;
                            const commentLikeData = commentLikes[comment.id] || { count: 0, isLiked: false };

                            return (
                                <motion.div
                                    key={comment.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="group"
                                >
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center">
                                            <span className="text-xs font-bold text-white/60">
                                                {comment.userName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 mb-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-sm text-white">{comment.userName}</span>
                                                    <span className="text-xs text-white/20">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-white/80 text-sm leading-relaxed">{comment.content}</p>
                                            </div>

                                            {/* Comment Actions */}
                                            <div className="flex items-center gap-4 px-2">
                                                <button
                                                    onClick={() => handleCommentLike(comment.id)}
                                                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${commentLikeData.isLiked ? 'text-red-500' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    <Heart className={`w-3.5 h-3.5 ${commentLikeData.isLiked ? 'fill-current' : ''}`} />
                                                    {commentLikeData.count > 0 && <span>{commentLikeData.count}</span>}
                                                </button>
                                                <button
                                                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                                    className="text-xs font-medium text-white/40 hover:text-white transition-colors"
                                                >
                                                    Reply
                                                </button>
                                                {comment.userId === userId && (
                                                    <button
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                        className="text-xs font-medium text-white/40 hover:text-red-500 transition-colors ml-auto"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>

                                            {/* Reply Input */}
                                            <AnimatePresence>
                                                {replyingTo === comment.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mt-3 ml-2"
                                                    >
                                                        <div className="relative">
                                                            <textarea
                                                                value={replyText}
                                                                onChange={(e) => setReplyText(e.target.value)}
                                                                placeholder="Write a reply..."
                                                                rows={2}
                                                                className="w-full pl-4 pr-12 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary/50 text-sm resize-none"
                                                                maxLength={1000}
                                                            />
                                                            <button
                                                                onClick={() => handleAddReply(comment.id)}
                                                                disabled={!replyText.trim()}
                                                                className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-primary hover:text-black transition-colors disabled:opacity-0"
                                                            >
                                                                <Send className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Replies */}
                                            {hasReplies && (
                                                <div className="mt-3 pl-4 border-l-2 border-white/5 space-y-4">
                                                    {replies.map(reply => (
                                                        <div key={reply.id} className="flex gap-3">
                                                            <div className="w-6 h-6 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center">
                                                                <span className="text-[10px] font-bold text-white/60">
                                                                    {reply.userName.charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="font-bold text-xs text-white">{reply.userName}</span>
                                                                        <span className="text-[10px] text-white/20">{new Date(reply.createdAt).toLocaleDateString()}</span>
                                                                    </div>
                                                                    <p className="text-white/80 text-sm leading-relaxed">{reply.content}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </article>
        </div>
    );
}
