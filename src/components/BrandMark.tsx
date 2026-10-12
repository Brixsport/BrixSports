import Image from 'next/image';

export type BrandMarkVariant = 'viewer' | 'logger' | 'admin';

interface BrandMarkProps {
    variant?: BrandMarkVariant;
    /** Rendered width and height in px. */
    size: number;
    className?: string;
    priority?: boolean;
}

// The role colourway PNGs already include the rounded-square tile, so the
// wrapper must not add its own background or skew.
const SRC_BY_SIZE = (variant: BrandMarkVariant, size: number) =>
    `/icons/role-colorways/${variant}-${size > 96 ? 512 : 192}.png`;

export function BrandMark({ variant = 'viewer', size, className, priority = false }: BrandMarkProps) {
    return (
        <Image
            src={SRC_BY_SIZE(variant, size)}
            alt="BrixSports"
            width={size}
            height={size}
            priority={priority}
            className={`shrink-0 ${className ?? ''}`.trim()}
        />
    );
}

export default BrandMark;
