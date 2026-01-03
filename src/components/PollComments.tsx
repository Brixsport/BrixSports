'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Heart, Reply, Trash2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
    id: string;
    pollId: string;
    userId: string;
    content: string;
    parentId: string | null;
    likes: number;
    createdAt: Date;
    user: {
        id: string;
        name: string;
        avatar: string | null;
    };
    replies?: Comment[];
}

interface PollCommentsProps {
    pollId: string;
    userId?: string;
}

export default function PollComments({ pollId, userId }: PollCommentsProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchComments();
    }, [pollId]);

    const fetchComments = async () => {
        try {
            const response = await fetch(`/api/polls/comments?pollId=${pollId}`);
            if (response.ok) {
                const data = await response.json();
                setComments(data);
            }
        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !newComment.trim()) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/polls/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pollId,
                    userId,
                    content: newComment.trim(),
                }),
            });

            if (response.ok) {
                setNewComment('');
                fetchComments();
            }
        } catch (error) {
            console.error('Error posting comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitReply = async (parentId: string) => {
        if (!userId || !replyContent.trim()) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/polls/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pollId,
                    userId,
                    content: replyContent.trim(),
                    parentId,
                }),
            });

            if (response.ok) {
                setReplyContent('');
                setReplyTo(null);
                fetchComments();
            }
        } catch (error) {
            console.error('Error posting reply:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleLike = async (commentId: string) => {
        if (!userId) return;

        try {
            const response = await fetch('/api/polls/comments/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId, userId }),
            });

            if (response.ok) {
                const { liked } = await response.json();
                setLikedComments(prev => {
                    const newSet = new Set(prev);
                    if (liked) {
                        newSet.add(commentId);
                    } else {
                        newSet.delete(commentId);
                    }
                    return newSet;
                });
                fetchComments();
            }
        } catch (error) {
            console.error('Error liking comment:', error);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!userId) return;

        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            const response = await fetch(
                `/api/polls/comments?commentId=${commentId}&userId=${userId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                fetchComments();
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
        const isLiked = likedComments.has(comment.id);
        const canDelete = userId === comment.userId;

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${isReply ? 'ml-12' : ''}`}
            >
                <div className="flex gap-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        {comment.user?.avatar ? (
                            <img
                                src={comment.user.avatar}
                                alt={comment.user.name}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">
                                {comment.user?.name || 'Anonymous'}
                            </span>
                            <span className="text-xs text-slate-500">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                        </div>
                        <p className="text-slate-300 text-sm mb-3 break-words">
                            {comment.content}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => handleLike(comment.id)}
                                disabled={!userId}
                                className={`flex items-center gap-1 text-sm transition-colors ${isLiked
                                        ? 'text-red-400'
                                        : 'text-slate-500 hover:text-red-400'
                                    }`}
                            >
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                <span>{comment.likes || 0}</span>
                            </button>

                            {!isReply && userId && (
                                <button
                                    onClick={() => setReplyTo(comment.id)}
                                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-400 transition-colors"
                                >
                                    <Reply className="w-4 h-4" />
                                    Reply
                                </button>
                            )}

                            {canDelete && (
                                <button
                                    onClick={() => handleDelete(comment.id)}
                                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-400 transition-colors ml-auto"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Reply Form */}
                        {replyTo === comment.id && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3"
                            >
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Write a reply..."
                                        className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSubmitReply(comment.id);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => handleSubmitReply(comment.id)}
                                        disabled={submitting || !replyContent.trim()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setReplyTo(null);
                                            setReplyContent('');
                                        }}
                                        className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-2 space-y-2">
                        {comment.replies.map((reply) => (
                            <CommentItem key={reply.id} comment={reply} isReply />
                        ))}
                    </div>
                )}
            </motion.div>
        );
    };

    if (!userId) {
        return (
            <div className="text-center py-8 text-slate-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Sign in to join the discussion</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 text-slate-300">
                <MessageCircle className="w-5 h-5" />
                <h3 className="font-semibold">
                    Discussion ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
                </h3>
            </div>

            {/* New Comment Form */}
            <form onSubmit={handleSubmitComment} className="flex gap-2">
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts..."
                    className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Send className="w-4 h-4" />
                    Post
                </button>
            </form>

            {/* Comments List */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No comments yet. Be the first to share your thoughts!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence>
                        {comments.map((comment) => (
                            <CommentItem key={comment.id} comment={comment} />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
