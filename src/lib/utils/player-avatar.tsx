'use client';

import { useRef } from 'react';
import { User } from 'lucide-react';
import { isValidLogo } from './team-logo';

const SIZE_PX: Record<string, number> = { sm: 40, md: 56, lg: 80, xl: 128 };

interface PlayerAvatarProps {
    image?: string | null;
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

// Photo when a real one exists, otherwise a generic person icon -- mirrors
// TeamLogo's real-logo-or-fallback pattern (team-logo.tsx) rather than
// falling back to the jersey number, which this component replaces as the
// avatar (jersey number now lives in the Basic Info card instead).
export function PlayerAvatar({ image, name, size = 'md', className = '' }: PlayerAvatarProps) {
    const px = SIZE_PX[size] ?? 56;
    const iconPx = Math.round(px * 0.5);
    const iconRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const iconFallback = (
        <div
            ref={iconRef}
            style={{
                width: px,
                height: px,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: 'rgba(255,255,255,0.08)',
            }}
            className={className}
            aria-label={name}
        >
            <User style={{ width: iconPx, height: iconPx }} className="text-white/40" />
        </div>
    );

    if (!isValidLogo(image)) {
        return iconFallback;
    }

    return (
        <div style={{ position: 'relative', width: px, height: px, flexShrink: 0 }} className={className}>
            <img
                ref={imgRef}
                src={image!}
                alt={name}
                width={px}
                height={px}
                style={{ width: px, height: px, objectFit: 'cover', borderRadius: '50%' }}
                onError={() => {
                    if (imgRef.current) imgRef.current.style.display = 'none';
                    if (iconRef.current) iconRef.current.style.display = 'flex';
                }}
            />
            <div
                ref={iconRef}
                style={{
                    display: 'none',
                    position: 'absolute',
                    inset: 0,
                    width: px,
                    height: px,
                    borderRadius: '50%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                }}
                aria-label={name}
            >
                <User style={{ width: iconPx, height: iconPx }} className="text-white/40" />
            </div>
        </div>
    );
}
