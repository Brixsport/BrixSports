'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, BarChart3, Trash2, Calendar } from 'lucide-react';

interface CreatePollProps {
    matchId: string;
    onPollCreated?: () => void;
}

export default function CreatePoll({ matchId, onPollCreated }: CreatePollProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [pollType, setPollType] = useState<'match_winner' | 'mvp' | 'custom'>('match_winner');
    const [customOptions, setCustomOptions] = useState<string[]>(['', '']);
    const [endsAt, setEndsAt] = useState('');
    const [creating, setCreating] = useState(false);

    const handleAddOption = () => {
        setCustomOptions([...customOptions, '']);
    };

    const handleRemoveOption = (index: number) => {
        if (customOptions.length > 2) {
            setCustomOptions(customOptions.filter((_, i) => i !== index));
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...customOptions];
        newOptions[index] = value;
        setCustomOptions(newOptions);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            let options: any[] = [];

            if (pollType === 'match_winner') {
                // Options will be auto-generated from teams
                options = [];
            } else {
                // Use custom options
                options = customOptions
                    .filter(opt => opt.trim())
                    .map(opt => ({ label: opt.trim() }));
            }

            const response = await fetch('/api/polls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId,
                    question: question || getDefaultQuestion(pollType),
                    pollType,
                    options,
                    endsAt: endsAt || null,
                }),
            });

            if (response.ok) {
                // Reset form
                setQuestion('');
                setPollType('match_winner');
                setCustomOptions(['', '']);
                setEndsAt('');
                setIsOpen(false);

                if (onPollCreated) {
                    onPollCreated();
                }
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to create poll');
            }
        } catch (error) {
            console.error('Error creating poll:', error);
            alert('Failed to create poll');
        } finally {
            setCreating(false);
        }
    };

    const getDefaultQuestion = (type: string) => {
        switch (type) {
            case 'match_winner':
                return 'Who will win this match?';
            case 'mvp':
                return 'Who will be the MVP?';
            default:
                return 'Cast your vote';
        }
    };

    return (
        <>
            {/* Trigger Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg shadow-blue-500/25"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <BarChart3 className="w-5 h-5" />
                Create Poll
            </motion.button>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <BarChart3 className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">Create Poll</h2>
                                        <p className="text-sm text-slate-400">Engage fans with match predictions</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {/* Poll Type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-3">
                                        Poll Type
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['match_winner', 'mvp', 'custom'] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setPollType(type)}
                                                className={`
                                                    p-4 rounded-xl border-2 transition-all duration-200
                                                    ${pollType === type
                                                        ? 'border-blue-500 bg-blue-500/10 text-white'
                                                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                                                    }
                                                `}
                                            >
                                                <div className="text-sm font-medium capitalize">
                                                    {type.replace('_', ' ')}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Question */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Question
                                    </label>
                                    <input
                                        type="text"
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        placeholder={getDefaultQuestion(pollType)}
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                {/* Custom Options */}
                                {pollType === 'custom' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-sm font-medium text-slate-300">
                                                Options
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleAddOption}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Option
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {customOptions.map((option, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={option}
                                                        onChange={(e) => handleOptionChange(index, e.target.value)}
                                                        placeholder={`Option ${index + 1}`}
                                                        className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        required
                                                    />
                                                    {customOptions.length > 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveOption(index)}
                                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* End Time */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        End Time (Optional)
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <input
                                            type="datetime-local"
                                            value={endsAt}
                                            onChange={(e) => setEndsAt(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Leave empty for no expiration
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="flex-1 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creating}
                                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                                    >
                                        {creating ? 'Creating...' : 'Create Poll'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
