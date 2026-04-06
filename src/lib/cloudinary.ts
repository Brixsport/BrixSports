/**
 * Cloudinary Configuration for Mobile Optimization
 * Provides responsive image transformations and optimizations for mobile devices
 */

// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'brix_uploads',
};

// Mobile-optimized transformations
export const mobileTransformations = {
  // Team logos and player avatars
  avatar: {
    crop: 'fill',
    gravity: 'face',
    width: 80,
    height: 80,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  avatar_large: {
    crop: 'fill',
    gravity: 'face',
    width: 200,
    height: 200,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  
  // Team logos for mobile
  logo_small: {
    crop: 'fill',
    gravity: 'center',
    width: 40,
    height: 40,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  logo_medium: {
    crop: 'fill',
    gravity: 'center',
    width: 60,
    height: 60,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  
  // Match and news images
  thumbnail: {
    crop: 'fill',
    gravity: 'auto',
    width: 150,
    height: 100,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  card: {
    crop: 'fill',
    gravity: 'auto',
    width: 300,
    height: 200,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  hero: {
    crop: 'fill',
    gravity: 'auto',
    width: 400,
    height: 250,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  
  // Full screen images
  fullscreen: {
    crop: 'fill',
    gravity: 'auto',
    width: 800,
    height: 600,
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  },
  
  // Placeholder images
  placeholder: {
    crop: 'fill',
    gravity: 'center',
    width: 100,
    height: 100,
    quality: 'auto:low',
    format: 'auto',
    dpr: 'auto',
    blur: 100,
  },
};

// Build Cloudinary URL with transformations
export function buildCloudinaryUrl(
  publicId: string,
  transformations: Record<string, any> = {}
): string {
  if (!cloudinaryConfig.cloudName) {
    // Fallback to original URL if Cloudinary not configured
    return publicId;
  }

  const params = new URLSearchParams();
  
  // Add transformations
  Object.entries(transformations).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });

  const baseUrl = `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload`;
  return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
}

// Get responsive image URLs for different screen sizes
export function getResponsiveImageUrls(
  publicId: string,
  baseTransformations: Record<string, any> = {}
) {
  const sizes = {
    small: { ...baseTransformations, width: Math.min(baseTransformations.width || 300, 300) },
    medium: { ...baseTransformations, width: Math.min(baseTransformations.width || 600, 600) },
    large: { ...baseTransformations, width: Math.min(baseTransformations.width || 900, 900) },
  };

  return {
    small: buildCloudinaryUrl(publicId, sizes.small),
    medium: buildCloudinaryUrl(publicId, sizes.medium),
    large: buildCloudinaryUrl(publicId, sizes.large),
  };
}

// Get device-specific transformations
export function getDeviceSpecificTransformations(baseTransformations: Record<string, any> = {}) {
  const isMobile = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const isTablet = typeof window !== 'undefined' && 
    /iPad|Android(?!.*Mobile)|Tablet/i.test(navigator.userAgent);

  if (isMobile) {
    return {
      ...baseTransformations,
      // Optimize for mobile
      quality: 'auto:good',
      format: 'webp', // WebP for better compression
      width: Math.min(baseTransformations.width || 400, 400),
      height: Math.min(baseTransformations.height || 300, 300),
    };
  }

  if (isTablet) {
    return {
      ...baseTransformations,
      quality: 'auto:good',
      format: 'webp',
      width: Math.min(baseTransformations.width || 600, 600),
      height: Math.min(baseTransformations.height || 450, 450),
    };
  }

  // Desktop
  return {
    ...baseTransformations,
    quality: 'auto',
    format: 'auto',
  };
}

// Generate srcset for responsive images
export function generateSrcSet(
  publicId: string,
  baseTransformations: Record<string, any> = {},
  sizes: number[] = [320, 480, 768, 1024, 1200]
): string {
  return sizes
    .map(size => {
      const transformed = { ...baseTransformations, width: size };
      const url = buildCloudinaryUrl(publicId, transformed);
      return `${url} ${size}w`;
    })
    .join(', ');
}

// Lazy loading placeholder generator
export function generatePlaceholderUrl(
  publicId: string,
  width: number = 100,
  height: number = 100
): string {
  return buildCloudinaryUrl(publicId, {
    crop: 'fill',
    gravity: 'center',
    width,
    height,
    quality: 'auto:low',
    format: 'auto',
    blur: 100,
    dpr: 1,
  });
}

// Progressive image loading URLs
export function getProgressiveImageUrls(publicId: string) {
  return {
    placeholder: generatePlaceholderUrl(publicId, 20, 20),
    small: buildCloudinaryUrl(publicId, { ...mobileTransformations.thumbnail, quality: 'auto:low' }),
    medium: buildCloudinaryUrl(publicId, mobileTransformations.card),
    large: buildCloudinaryUrl(publicId, mobileTransformations.hero),
  };
}
