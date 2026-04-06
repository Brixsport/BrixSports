'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';

interface Ad {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: 'top' | 'bottom' | 'sidebar' | 'inline';
  size: 'small' | 'medium' | 'large';
}

interface AdBannerProps {
  position: 'top' | 'bottom' | 'sidebar' | 'inline';
  className?: string;
}

const sizeClasses = {
  small: 'h-16 w-full max-w-md',
  medium: 'h-24 w-full max-w-lg',
  large: 'h-32 w-full max-w-2xl',
};

export default function AdBanner({ position, className = '' }: AdBannerProps) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const fetchAd = async () => {
      try {
        const response = await fetch(`/api/ads?position=${position}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.ad) {
            setAd(data.ad);
          }
        }
      } catch (error) {
        console.error('Error fetching ad:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAd();
  }, [position]);

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal in session storage so it doesn't show again this session
    sessionStorage.setItem(`ad-dismissed-${ad?.id}`, 'true');
  };

  if (loading || isDismissed || !ad) return null;

  // Check if user already dismissed this ad
  if (typeof window !== 'undefined' && sessionStorage.getItem(`ad-dismissed-${ad.id}`)) {
    return null;
  }

  const positionClasses = {
    top: 'fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm',
    bottom: 'fixed bottom-[72px] left-0 right-0 z-40 bg-background/95 backdrop-blur-sm',
    sidebar: 'sticky top-20 hidden lg:block',
    inline: 'my-4',
  };

  return (
    <div className={`${positionClasses[position]} ${className}`}>
      <div className="relative mx-auto overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-3 h-3" />
        </button>
        
        <Link 
          href={ad.linkUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block relative"
        >
          <div className={`relative ${sizeClasses[ad.size]} overflow-hidden`}>
            <Image
              src={ad.imageUrl}
              alt={ad.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <span className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
              Ad
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
