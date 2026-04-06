'use client';

import MobileImageUpload from '@/components/ui/mobile-image-upload';

interface ImageUploadProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    aspectRatio?: 'square' | 'video' | 'portrait' | 'free';
    maxSize?: number;
    className?: string;
}

export default function ImageUpload({
    value,
    onChange,
    disabled,
    aspectRatio = 'free',
    maxSize = 5,
    className = '',
}: ImageUploadProps) {
    return (
        <MobileImageUpload
            value={value}
            onChange={onChange}
            disabled={disabled}
            aspectRatio={aspectRatio}
            maxSize={maxSize}
            className={className}
            showPreview={true}
        />
    );
}
