'use client';

import { motion } from 'framer-motion';
import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    isSameMonth,
    isSameDay,
    isToday,
    addMonths,
    subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface MatchCalendarProps {
    fixtures: any[];
    onDateSelect: (date: Date) => void;
    selectedDate: Date;
}

export default function MatchCalendar({ fixtures, onDateSelect, selectedDate }: MatchCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get fixtures count per day
    const fixturesByDay = fixtures.reduce((acc, fixture) => {
        const dateKey = format(new Date(fixture.startTime), 'yyyy-MM-dd');
        acc[dateKey] = (acc[dateKey] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const handlePreviousMonth = () => {
        setCurrentMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const handleDateClick = (date: Date) => {
        onDateSelect(date);
    };

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={handlePreviousMonth}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold">
                    {format(currentMonth, 'MMMM yyyy')}
                </h3>

                <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-white/60 py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
                {/* Empty cells for days before month starts */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {/* Days of the month */}
                {daysInMonth.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const fixtureCount = fixturesByDay[dateKey] || 0;
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentDay = isToday(day);

                    return (
                        <motion.button
                            key={dateKey}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDateClick(day)}
                            className={`aspect-square rounded-lg p-2 transition-all relative ${isSelected
                                    ? 'bg-primary text-white'
                                    : isCurrentDay
                                        ? 'bg-white/10 text-white border-2 border-primary'
                                        : fixtureCount > 0
                                            ? 'bg-white/5 text-white hover:bg-white/10'
                                            : 'text-white/40 hover:bg-white/5'
                                }`}
                        >
                            <div className="text-sm font-medium">
                                {format(day, 'd')}
                            </div>

                            {/* Fixture Count Indicator */}
                            {fixtureCount > 0 && (
                                <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 ${isSelected ? 'opacity-100' : 'opacity-60'
                                    }`}>
                                    {Array.from({ length: Math.min(fixtureCount, 3) }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'
                                                }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-white/60">Has Matches</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-primary" />
                    <span className="text-white/60">Today</span>
                </div>
            </div>
        </div>
    );
}
