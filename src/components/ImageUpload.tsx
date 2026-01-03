'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { CldUploadWidget } from 'next-cloudinary';

interface ImageUploadProps {
    value: string;
    onChange: (url: string) => void;
    onRemove?: () => void;
}

export default function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);

    const handleUpload = useCallback((result: any) => {
        if (result.event === 'success') {
            onChange(result.info.secure_url);
            setUploading(false);
        }
    }, [onChange]);

    return (
        <div className="space-y-4">
            {value ? (
                <div className="relative group">
                    <img
                        src={value}
                        alt="Upload preview"
                        className="w-full h-48 object-cover rounded-xl border border-slate-700"
                    />
                    <button
                        type="button"
                        onClick={onRemove}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <CldUploadWidget
                    uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'brix_uploads'}
                    onUpload={handleUpload}
                >
                    {({ open }) => (
                        <button
                            type="button"
                            onClick={() => {
                                setUploading(true);
                                open();
                            }}
                            disabled={uploading}
                            className="w-full h-48 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-cyan-500 hover:bg-slate-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                                    <span className="text-sm text-slate-400">Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 text-slate-400" />
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-slate-300">
                                            Click to upload image
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            PNG, JPG, GIF up to 10MB
                                        </p>
                                    </div>
                                </>
                            )}
                        </button>
                    )}
                </CldUploadWidget>
            )}

            {/* Alternative: URL Input */}
            <div className="relative">
                <input
                    type="url"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Or paste image URL..."
                    className="w-full px-4 py-3 pl-10 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            </div>
        </div>
    );
}
