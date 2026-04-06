'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  buildCloudinaryUrl, 
  getDeviceSpecificTransformations, 
  generateSrcSet,
  generatePlaceholderUrl,
  getProgressiveImageUrls,
  mobileTransformations 
} from '@/lib/cloudinary';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  transformation?: keyof typeof mobileTransformations;
  customTransformations?: Record<string, any>;
  sizes?: string;
  lazy?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  placeholder?: 'blur' | 'empty' | 'custom';
  blurDataURL?: string;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  transformation,
  customTransformations = {},
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  lazy = true,
  onLoad,
  onError,
  placeholder = 'blur',
  blurDataURL,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);

  // Get transformations based on device and type
  const getTransformations = useCallback(() => {
    let baseTransformations = customTransformations;

    if (transformation && mobileTransformations[transformation]) {
      baseTransformations = { ...mobileTransformations[transformation], ...customTransformations };
    }

    return getDeviceSpecificTransformations(baseTransformations);
  }, [transformation, customTransformations]);

  // Generate Cloudinary URLs
  const transformations = getTransformations();
  const cloudinaryUrl = buildCloudinaryUrl(src, transformations);
  const placeholderUrl = placeholder === 'blur' 
    ? (blurDataURL || generatePlaceholderUrl(src, 20, 20))
    : undefined;

  // Progressive loading for mobile
  useEffect(() => {
    if (!lazy || priority) {
      setCurrentSrc(cloudinaryUrl);
      return;
    }

    // Check if image is in viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCurrentSrc(cloudinaryUrl);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [cloudinaryUrl, lazy, priority]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  }, [onError]);

  // Generate srcset for responsive images
  const srcSet = width && height ? generateSrcSet(src, transformations) : undefined;

  if (hasError) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-800 text-slate-400 ${className}`}
        style={{ width, height }}
      >
        <span className="text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse rounded-lg" />
      )}
      
      <img
        ref={imgRef}
        src={currentSrc || placeholderUrl}
        alt={alt}
        width={width}
        height={height}
        srcSet={srcSet}
        sizes={sizes}
        loading={lazy && !priority ? 'lazy' : 'eager'}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} ${
          width && height ? '' : 'w-full h-full object-cover'
        }`}
        style={{
          maxWidth: '100%',
          height: 'auto',
        }}
      />
    </div>
  );
}

// Specialized components for common use cases
export function TeamLogo({
  src,
  alt,
  size = 'medium',
  className = '',
}: {
  src: string;
  alt: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  const sizeMap = {
    small: 'logo_small',
    medium: 'logo_medium',
    large: 'avatar',
  };

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      transformation={sizeMap[size] as keyof typeof mobileTransformations}
      className={`rounded-lg ${className}`}
      priority={size === 'small'} // Prioritize small logos
    />
  );
}

export function PlayerAvatar({
  src,
  alt,
  size = 'medium',
  className = '',
}: {
  src: string;
  alt: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  const sizeMap = {
    small: 'avatar',
    medium: 'avatar_large',
    large: 'avatar_large',
  };

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      transformation={sizeMap[size] as keyof typeof mobileTransformations}
      className={`rounded-full ${className}`}
      priority={size === 'small'} // Prioritize small avatars
    />
  );
}

export function MatchImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      transformation="card"
      className={`rounded-lg ${className}`}
      priority={false}
    />
  );
}

export function HeroImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      transformation="hero"
      className={`rounded-lg ${className}`}
      priority={true} // Prioritize hero images
      sizes="100vw"
    />
  );
}
