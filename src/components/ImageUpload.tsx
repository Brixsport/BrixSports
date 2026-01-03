'use client';

import { CldUploadWidget } from 'next-cloudinary';
import { ImagePlus, X } from 'lucide-react';

interface ImageUploadProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export default function ImageUpload({
    value,
    onChange,
    disabled
}: ImageUploadProps) {
    const onUpload = (result: any) => {
        onChange(result.info.secure_url);
    };

    if (value) {
        return (
            <div className="relative w-full h-48 rounded-md overflow-hidden bg-slate-800">
                <div className="absolute top-2 right-2 z-10">
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <img
                    src={value}
                    alt="Upload"
                    className="object-cover w-full h-full"
                />
            </div>
        );
    }

    return (
        <CldUploadWidget
            onSuccess={onUpload}
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
            options={{
                maxFiles: 1
            }}
        >
            {({ open }) => {
                const onClick = () => {
                    open();
                };

                return (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={onClick}
                        className="w-full h-48 rounded-md border-2 border-dashed border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition flex flex-col items-center justify-center gap-4 text-slate-400 hover:text-white"
                    >
                        <ImagePlus className="w-10 h-10" />
                        <span className="font-semibold">Upload an Image</span>
                    </button>
                );
            }}
        </CldUploadWidget>
    );
}
