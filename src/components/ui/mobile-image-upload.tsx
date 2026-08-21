'use client';

import React, { useState, useCallback } from 'react';
import { CldUploadWidget } from 'next-cloudinary';
import { Camera, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MobileImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'free';
  maxSize?: number; // in MB
  allowedFormats?: string[];
  className?: string;
  showPreview?: boolean;
  folder?: string;
  onUploadStart?: () => void;
  onUploadSuccess?: (url: string) => void;
  onUploadError?: (error: any) => void;
}

export default function MobileImageUpload({
  value,
  onChange,
  disabled = false,
  aspectRatio = 'free',
  maxSize = 5,
  allowedFormats = ['jpg', 'jpeg', 'png', 'webp'],
  className = '',
  showPreview = true,
  folder,
  onUploadStart,
  onUploadSuccess,
  onUploadError,
}: MobileImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Get aspect ratio for Cloudinary
  const getAspectRatio = () => {
    switch (aspectRatio) {
      case 'square': return '1:1';
      case 'video': return '16:9';
      case 'portrait': return '9:16';
      default: return undefined;
    }
  };

  // Validate file before upload
  const validateFile = (file: File) => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File size must be less than ${maxSize}MB`);
      return false;
    }

    // Check file format
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedFormats.includes(fileExtension)) {
      toast.error(`File format must be one of: ${allowedFormats.join(', ')}`);
      return false;
    }

    return true;
  };

  // Handle successful upload
  const handleUpload = useCallback((result: any) => {
    setIsUploading(false);
    setUploadProgress(0);
    
    if (result.info?.secure_url) {
      onChange(result.info.secure_url);
      onUploadSuccess?.(result.info.secure_url);
      toast.success('Image uploaded successfully!');
    } else {
      const error = result.info?.error || 'Upload failed';
      onUploadError?.(error);
      toast.error(error);
    }
  }, [onChange, onUploadSuccess, onUploadError]);

  // Handle upload start
  const handleUploadStart = useCallback(() => {
    setIsUploading(true);
    setUploadProgress(0);
    onUploadStart?.();
  }, [onUploadStart]);

  // Handle upload error
  const handleUploadError = useCallback((error: any) => {
    setIsUploading(false);
    setUploadProgress(0);
    onUploadError?.(error);
    toast.error('Upload failed. Please try again.');
  }, [onUploadError]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (validateFile(file)) {
        // Trigger upload via the widget (if possible) or show error
        toast.info('Please use the upload button to select images');
      }
    }
  }, [disabled, isUploading]);

  // Remove image
  const handleRemove = useCallback(() => {
    onChange('');
    toast.success('Image removed');
  }, [onChange]);

  // Cloudinary widget options
  const uploadOptions = {
    maxFiles: 1,
    maxFileSize: maxSize * 1024 * 1024, // Convert to bytes
    formats: allowedFormats,
    cropping: aspectRatio !== 'free',
    croppingAspectRatio: getAspectRatio(),
    multiple: false,
    resourceType: 'image',
    clientAllowedFormats: allowedFormats,
    showSkipCropButton: false,
    showPoweredBy: false,
    theme: 'minimal',
    ...(folder ? { folder } : {}),
    text: {
      'gui.v2.main.apply': 'Apply',
      'gui.v2.main.cancel': 'Cancel',
      'gui.v2.main.uploading': 'Uploading...',
    },
  };

  if (value && showPreview) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative group">
          <img
            src={value}
            alt="Uploaded image"
            className="w-full h-full object-cover rounded-lg"
          />
          
          {/* Overlay with remove button */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CldUploadWidget
      onSuccess={handleUpload}
      onUploadAdded={handleUploadStart}
      onError={handleUploadError}
      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
      options={uploadOptions}
    >
      {({ open }) => {
        const handleClick = () => {
          if (!disabled && !isUploading) {
            open();
          }
        };

        return (
          <div
            className={`
              relative border-2 border-dashed rounded-lg transition-all
              ${dragActive ? 'border-blue-400 bg-blue-50/10' : 'border-slate-700 bg-slate-800/50'}
              ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-600 hover:bg-slate-800 cursor-pointer'}
              ${className}
            `}
            onClick={handleClick}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center p-6 text-center">
              {isUploading ? (
                <>
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                  <p className="text-sm text-slate-400">Uploading...</p>
                  {uploadProgress > 0 && (
                    <div className="w-full max-w-xs mt-2">
                      <div className="bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-400 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm font-medium text-slate-300 mb-1">
                    Upload Image
                  </p>
                  <p className="text-xs text-slate-500">
                    {maxSize}MB max • {allowedFormats.join(', ')}
                  </p>
                  {aspectRatio !== 'free' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Aspect ratio: {getAspectRatio()}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Mobile-specific touch feedback */}
            <div className="absolute inset-0 bg-blue-400/20 opacity-0 active:opacity-100 transition-opacity rounded-lg pointer-events-none" />
          </div>
        );
      }}
    </CldUploadWidget>
  );
}

// Specialized upload components
export function TeamLogoUpload({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <MobileImageUpload
      value={value}
      onChange={onChange}
      aspectRatio="square"
      maxSize={2}
      allowedFormats={['jpg', 'jpeg', 'png', 'webp']}
      className={`w-32 h-32 ${className}`}
      showPreview={true}
    />
  );
}

export function PlayerAvatarUpload({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <MobileImageUpload
      value={value}
      onChange={onChange}
      aspectRatio="square"
      maxSize={3}
      allowedFormats={['jpg', 'jpeg', 'png', 'webp']}
      className={`w-24 h-24 ${className}`}
      showPreview={true}
    />
  );
}

export function MatchImageUpload({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <MobileImageUpload
      value={value}
      onChange={onChange}
      aspectRatio="video"
      maxSize={5}
      allowedFormats={['jpg', 'jpeg', 'png', 'webp']}
      className={`w-full h-48 ${className}`}
      showPreview={true}
    />
  );
}
