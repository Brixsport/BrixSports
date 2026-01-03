'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Filter, X, ChevronDown, SlidersHorizontal, ArrowUpDown,
    TrendingUp, TrendingDown, Minus, Check
} from 'lucide-react';

export interface FilterOptions {
    position?: {
        min?: number;
        max?: number;
    };
    points?: {
        min?: number;
        max?: number;
    };
    form?: ('W' | 'D' | 'L')[];
    goalDifference?: {
        min?: number;
        max?: number;
    };
    university?: string[];
}

export interface SortOption {
    field: 'position' | 'points' | 'goalDifference' | 'goalsFor' | 'goalsAgainst' | 'won' | 'form';
    direction: 'asc' | 'desc';
}

export interface ViewOption {
    id: string;
    name: string;
    description: string;
    filters?: FilterOptions;
    sort?: SortOption;
}

interface StandingsFiltersProps {
    onFilterChange: (filters: FilterOptions) => void;
    onSortChange: (sort: SortOption) => void;
    onViewChange?: (view: ViewOption) => void;
    currentFilters: FilterOptions;
    currentSort: SortOption;
    availableUniversities?: string[];
}

const PRESET_VIEWS: ViewOption[] = [
    {
        id: 'all',
        name: 'All Teams',
        description: 'Show all teams in the competition',
    },
    {
        id: 'top-4',
        name: 'Top 4',
        description: 'Teams in qualification positions',
        filters: { position: { min: 1, max: 4 } },
    },
    {
        id: 'relegation',
        name: 'Bottom 3',
        description: 'Teams in relegation zone',
        filters: { position: { min: -3 } }, // Last 3 positions
    },
    {
        id: 'winning-form',
        name: 'Winning Form',
        description: 'Teams with recent wins',
        filters: { form: ['W'] },
    },
    {
        id: 'positive-gd',
        name: 'Positive GD',
        description: 'Teams with positive goal difference',
        filters: { goalDifference: { min: 1 } },
    },
    {
        id: 'high-scorers',
        name: 'High Scorers',
        description: 'Teams with 20+ goals',
        filters: { goalDifference: { min: 0 } },
        sort: { field: 'goalsFor', direction: 'desc' },
    },
];

export function StandingsFilters({
    onFilterChange,
    onSortChange,
    onViewChange,
    currentFilters,
    currentSort,
    availableUniversities = [],
}: StandingsFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'views' | 'filters' | 'sort'>('views');
    const [localFilters, setLocalFilters] = useState<FilterOptions>(currentFilters);

    const applyFilters = () => {
        onFilterChange(localFilters);
        setIsOpen(false);
    };

    const clearFilters = () => {
        const emptyFilters: FilterOptions = {};
        setLocalFilters(emptyFilters);
        onFilterChange(emptyFilters);
    };

    const applyView = (view: ViewOption) => {
        if (view.filters) {
            setLocalFilters(view.filters);
            onFilterChange(view.filters);
        }
        if (view.sort) {
            onSortChange(view.sort);
        }
        if (onViewChange) {
            onViewChange(view);
        }
        setIsOpen(false);
    };

    const hasActiveFilters = Object.keys(currentFilters).length > 0;

    return (
        <div className="relative">
            {/* Filter Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all text-sm font-black uppercase tracking-widest ${hasActiveFilters || isOpen
                        ? 'bg-primary text-black'
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                    }`}
            >
                <Filter size={14} />
                Filters
                {hasActiveFilters && (
                    <span className="w-2 h-2 bg-black rounded-full"></span>
                )}
            </button>

            {/* Filter Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute top-full right-0 mt-2 w-96 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <h3 className="text-sm font-black uppercase tracking-widest">
                                    Filters & Views
                                </h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-white/10">
                                {(['views', 'filters', 'sort'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === tab
                                                ? 'bg-white/10 text-primary border-b-2 border-primary'
                                                : 'text-white/40 hover:text-white/60'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="max-h-96 overflow-y-auto">
                                {activeTab === 'views' && (
                                    <ViewsTab views={PRESET_VIEWS} onSelectView={applyView} />
                                )}
                                {activeTab === 'filters' && (
                                    <FiltersTab
                                        filters={localFilters}
                                        onChange={setLocalFilters}
                                        universities={availableUniversities}
                                    />
                                )}
                                {activeTab === 'sort' && (
                                    <SortTab currentSort={currentSort} onChange={onSortChange} />
                                )}
                            </div>

                            {/* Footer */}
                            {activeTab === 'filters' && (
                                <div className="flex gap-2 p-4 border-t border-white/10">
                                    <button
                                        onClick={clearFilters}
                                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-bold"
                                    >
                                        Clear All
                                    </button>
                                    <button
                                        onClick={applyFilters}
                                        className="flex-1 px-4 py-2 bg-primary text-black rounded-xl hover:scale-105 transition-all text-sm font-black uppercase"
                                    >
                                        Apply
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function ViewsTab({ views, onSelectView }: { views: ViewOption[]; onSelectView: (view: ViewOption) => void }) {
    return (
        <div className="p-4 space-y-2">
            {views.map((view) => (
                <button
                    key={view.id}
                    onClick={() => onSelectView(view)}
                    className="w-full text-left p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-black uppercase tracking-tight mb-1">{view.name}</p>
                            <p className="text-xs text-white/60">{view.description}</p>
                        </div>
                        <ChevronDown size={16} className="text-white/40 group-hover:text-primary transition-colors rotate-[-90deg]" />
                    </div>
                </button>
            ))}
        </div>
    );
}

function FiltersTab({
    filters,
    onChange,
    universities,
}: {
    filters: FilterOptions;
    onChange: (filters: FilterOptions) => void;
    universities: string[];
}) {
    return (
        <div className="p-4 space-y-4">
            {/* Position Range */}
            <div>
                <label className="text-xs font-black uppercase tracking-widest text-white/60 mb-2 block">
                    Position Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="number"
                        placeholder="Min"
                        value={filters.position?.min || ''}
                        onChange={(e) =>
                            onChange({
                                ...filters,
                                position: { ...filters.position, min: parseInt(e.target.value) || undefined },
                            })
                        }
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                    />
                    <input
                        type="number"
                        placeholder="Max"
                        value={filters.position?.max || ''}
                        onChange={(e) =>
                            onChange({
                                ...filters,
                                position: { ...filters.position, max: parseInt(e.target.value) || undefined },
                            })
                        }
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                    />
                </div>
            </div>

            {/* Points Range */}
            <div>
                <label className="text-xs font-black uppercase tracking-widest text-white/60 mb-2 block">
                    Points Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="number"
                        placeholder="Min"
                        value={filters.points?.min || ''}
                        onChange={(e) =>
                            onChange({
                                ...filters,
                                points: { ...filters.points, min: parseInt(e.target.value) || undefined },
                            })
                        }
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                    />
                    <input
                        type="number"
                        placeholder="Max"
                        value={filters.points?.max || ''}
                        onChange={(e) =>
                            onChange({
                                ...filters,
                                points: { ...filters.points, max: parseInt(e.target.value) || undefined },
                            })
                        }
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                    />
                </div>
            </div>

            {/* Form Filter */}
            <div>
                <label className="text-xs font-black uppercase tracking-widest text-white/60 mb-2 block">
                    Recent Form
                </label>
                <div className="flex gap-2">
                    {(['W', 'D', 'L'] as const).map((result) => (
                        <button
                            key={result}
                            onClick={() => {
                                const currentForm = filters.form || [];
                                const newForm = currentForm.includes(result)
                                    ? currentForm.filter((r) => r !== result)
                                    : [...currentForm, result];
                                onChange({ ...filters, form: newForm.length > 0 ? newForm : undefined });
                            }}
                            className={`flex-1 px-3 py-2 rounded-xl text-sm font-black transition-all ${filters.form?.includes(result)
                                    ? result === 'W'
                                        ? 'bg-blue-500 text-white'
                                        : result === 'D'
                                            ? 'bg-yellow-500 text-black'
                                            : 'bg-red-500 text-white'
                                    : 'bg-white/5 border border-white/10 text-white/60'
                                }`}
                        >
                            {result}
                        </button>
                    ))}
                </div>
            </div>

            {/* Goal Difference */}
            <div>
                <label className="text-xs font-black uppercase tracking-widest text-white/60 mb-2 block">
                    Goal Difference
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="number"
                        placeholder="Min"
                        value={filters.goalDifference?.min || ''}
                        onChange={(e) =>
                            onChange({
                                ...filters,
                                goalDifference: { ...filters.goalDifference, min: parseInt(e.target.value) || undefined },
                            })
                        }
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                    />
                    <input
                        type="number"
                        placeholder="Max"
                        value={filters.goalDifference?.max || ''}
                        onChange={(e) =>
                            onChange({
                                ...filters,
                                goalDifference: { ...filters.goalDifference, max: parseInt(e.target.value) || undefined },
                            })
                        }
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all"
                    />
                </div>
            </div>

            {/* University Filter */}
            {universities.length > 0 && (
                <div>
                    <label className="text-xs font-black uppercase tracking-widest text-white/60 mb-2 block">
                        Universities
                    </label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {universities.map((uni) => (
                            <label key={uni} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.university?.includes(uni) || false}
                                    onChange={(e) => {
                                        const currentUnis = filters.university || [];
                                        const newUnis = e.target.checked
                                            ? [...currentUnis, uni]
                                            : currentUnis.filter((u) => u !== uni);
                                        onChange({ ...filters, university: newUnis.length > 0 ? newUnis : undefined });
                                    }}
                                    className="w-4 h-4 accent-primary"
                                />
                                <span className="text-sm text-white/80">{uni}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SortTab({ currentSort, onChange }: { currentSort: SortOption; onChange: (sort: SortOption) => void }) {
    const sortOptions: { field: SortOption['field']; label: string }[] = [
        { field: 'position', label: 'Position' },
        { field: 'points', label: 'Points' },
        { field: 'goalDifference', label: 'Goal Difference' },
        { field: 'goalsFor', label: 'Goals Scored' },
        { field: 'goalsAgainst', label: 'Goals Conceded' },
        { field: 'won', label: 'Wins' },
        { field: 'form', label: 'Form' },
    ];

    return (
        <div className="p-4 space-y-2">
            {sortOptions.map((option) => (
                <div key={option.field} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-sm font-bold">{option.label}</span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => onChange({ field: option.field, direction: 'asc' })}
                            className={`p-2 rounded-lg transition-all ${currentSort.field === option.field && currentSort.direction === 'asc'
                                    ? 'bg-primary text-black'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            <TrendingUp size={14} />
                        </button>
                        <button
                            onClick={() => onChange({ field: option.field, direction: 'desc' })}
                            className={`p-2 rounded-lg transition-all ${currentSort.field === option.field && currentSort.direction === 'desc'
                                    ? 'bg-primary text-black'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            <TrendingDown size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

