'use client';

import MobileImageUpload from '@/components/ui/mobile-image-upload';

interface ImageUploadProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    aspectRatio?: 'square' | 'video' | 'portrait' | 'free';
    maxSize?: number;
    className?: string;
    folder?: string;
    publicId?: string;
    tags?: string[];
    context?: Record<string, string>;
}

export default function ImageUpload({
    value,
    onChange,
    disabled,
    aspectRatio = 'free',
    maxSize = 5,
    className = '',
    folder,
    publicId,
    tags,
    context,
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
            folder={folder}
            publicId={publicId}
            tags={tags}
            context={context}
        />
    );
}
