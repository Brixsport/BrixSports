import React from 'react';

export function PitchMarkings({ className }: { className?: string }) {
    const strokeColor = "rgba(255,255,255,0.15)";

    return (
        <svg
            className={className}
            viewBox="0 0 68 105"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%' }}
        >
            {/* Border */}
            <rect x="0" y="0" width="68" height="105" fill="none" stroke={strokeColor} strokeWidth="0.5" />

            {/* Center Line */}
            <line x1="0" y1="52.5" x2="68" y2="52.5" stroke={strokeColor} strokeWidth="0.5" />

            {/* Center Circle */}
            <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={strokeColor} strokeWidth="0.5" />
            <circle cx="34" cy="52.5" r="0.4" fill={strokeColor} />

            {/* --- TOP (AWAY / ATTACKING END for Home) --- */}

            {/* Goal Area (width 18.32, depth 5.5) */}
            <rect x="24.84" y="0" width="18.32" height="5.5" fill="none" stroke={strokeColor} strokeWidth="0.5" />

            {/* Penalty Area (width 40.32, depth 16.5) */}
            <rect x="13.84" y="0" width="40.32" height="16.5" fill="none" stroke={strokeColor} strokeWidth="0.5" />

            {/* Penalty Spot (11m) */}
            <circle cx="34" cy="11" r="0.4" fill={strokeColor} />

            {/* Penalty Arc */}
            <path d="M 26.69 16.5 A 9.15 9.15 0 0 0 41.31 16.5" fill="none" stroke={strokeColor} strokeWidth="0.5" />

            {/* --- BOTTOM (HOME / DEFENDING END) --- */}

            {/* Goal Area */}
            <rect x="24.84" y="99.5" width="18.32" height="5.5" fill="none" stroke={strokeColor} strokeWidth="0.5" />

            {/* Penalty Area */}
            <rect x="13.84" y="88.5" width="40.32" height="16.5" fill="none" stroke={strokeColor} strokeWidth="0.5" />

            {/* Penalty Spot (105 - 11 = 94) */}
            <circle cx="34" cy="94" r="0.4" fill={strokeColor} />

            {/* Penalty Arc */}
            <path d="M 26.69 88.5 A 9.15 9.15 0 0 1 41.31 88.5" fill="none" stroke={strokeColor} strokeWidth="0.5" />

            {/* --- CORNERS --- */}
            <path d="M 1 0 A 1 1 0 0 0 0 1" fill="none" stroke={strokeColor} strokeWidth="0.5" />
            <path d="M 68 1 A 1 1 0 0 0 67 0" fill="none" stroke={strokeColor} strokeWidth="0.5" />
            <path d="M 0 104 A 1 1 0 0 0 1 105" fill="none" stroke={strokeColor} strokeWidth="0.5" />
            <path d="M 67 105 A 1 1 0 0 0 68 104" fill="none" stroke={strokeColor} strokeWidth="0.5" />
        </svg>
    );
}
