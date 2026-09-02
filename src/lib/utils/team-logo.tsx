'use client';

import { useRef } from 'react';

export function isValidLogo(logo: string | null | undefined): boolean {
    if (!logo) return false;
    if (logo.trim() === '') return false;
    if (logo.includes('placeholder')) return false;
    return true;
}

const SIZE_PX: Record<string, number> = { sm: 32, md: 40, lg: 48 };

function getInitials(name: string): string {
    // Match alphanumeric words only, so punctuation-heavy names like
    // "BUSALYMPICS (FOOTBALL)" produce "BF", not "B(" from a naive
    // space-split grabbing the paren as a "word".
    const words = name.match(/[A-Za-z0-9]+/g) || [];
    return words
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

interface TeamLogoProps {
    logo?: string | null;
    name: string;
    color?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function TeamLogo({ logo, name, color, size = 'md', className = '' }: TeamLogoProps) {
    const px = SIZE_PX[size] ?? 40;
    const initials = getInitials(name);
    const initialsRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const initialsDiv = (
        <div
            ref={initialsRef}
            style={{
                width: px,
                height: px,
                backgroundColor: color || '#374151',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontWeight: 700,
                fontSize: Math.round(px * 0.35),
                color: '#ffffff',
                userSelect: 'none',
            }}
            className={className}
            aria-label={name}
        >
            {initials}
        </div>
    );

    if (!isValidLogo(logo)) {
        return initialsDiv;
    }

    return (
        <div style={{ position: 'relative', width: px, height: px, flexShrink: 0 }} className={className}>
            <img
                ref={imgRef}
                src={logo!}
                alt={name}
                width={px}
                height={px}
                style={{ width: px, height: px, objectFit: 'contain', borderRadius: '50%' }}
                onError={() => {
                    if (imgRef.current) imgRef.current.style.display = 'none';
                    if (initialsRef.current) initialsRef.current.style.display = 'flex';
                }}
            />
            <div
                ref={initialsRef}
                style={{
                    display: 'none',
                    position: 'absolute',
                    inset: 0,
                    width: px,
                    height: px,
                    backgroundColor: color || '#374151',
                    borderRadius: '50%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: Math.round(px * 0.35),
                    color: '#ffffff',
                    userSelect: 'none',
                }}
                aria-label={name}
            >
                {initials}
            </div>
        </div>
    );
}
