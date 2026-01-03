'use client';

import { motion } from 'framer-motion';
import { getFormationsBySport, Formation } from '@/lib/formations';
import { Check } from 'lucide-react';

interface FormationSelectorProps {
    sport: 'Football' | 'Basketball';
    selectedFormation: string;
    onSelectFormation: (formationId: string) => void;
}

export function FormationSelector({ sport, selectedFormation, onSelectFormation }: FormationSelectorProps) {
    const formations = getFormationsBySport(sport);

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
                Select Formation
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {formations.map((formation) => (
                    <FormationCard
                        key={formation.id}
                        formation={formation}
                        isSelected={formation.id === selectedFormation}
                        onClick={() => onSelectFormation(formation.id)}
                    />
                ))}
            </div>
        </div>
    );
}

function FormationCard({ formation, isSelected, onClick }: {
    formation: Formation;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={`relative p-4 rounded-2xl border transition-all ${isSelected
                    ? 'bg-primary/10 border-primary'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
        >
            {/* Selection Indicator */}
            {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check size={12} className="text-black" />
                </div>
            )}

            {/* Formation Visual Preview */}
            <div className="mb-3 h-24 relative bg-black/20 rounded-xl overflow-hidden">
                <FormationPreview formation={formation} />
            </div>

            {/* Formation Name */}
            <div className="text-center">
                <p className="text-lg font-display italic text-white mb-1">
                    {formation.name}
                </p>
                <p className="text-[10px] text-white/60 font-medium">
                    {formation.description}
                </p>
            </div>
        </motion.button>
    );
}

function FormationPreview({ formation }: { formation: Formation }) {
    return (
        <div className="relative w-full h-full">
            {/* Pitch background */}
            <div className="absolute inset-0 bg-gradient-to-b from-green-900/20 to-green-800/20" />

            {/* Position dots */}
            {formation.positions.map((pos, idx) => (
                <div
                    key={pos.id}
                    className="absolute w-2 h-2 bg-primary rounded-full transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                    }}
                />
            ))}
        </div>
    );
}
