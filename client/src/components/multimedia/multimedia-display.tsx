import React, { useState } from 'react';

interface MediaItem {
  type: 'photo' | 'video';
  url: string;
  isMain?: boolean;
  order?: number;
}

interface MultimediaDisplayProps {
  mediaItems?: string | MediaItem[] | null;
  mainMediaType?: string | null;
  mainMediaUrl?: string | null;
  fallbackCategory?: string;
  eventTitle?: string;
  className?: string;
}

const MultimediaDisplay: React.FC<MultimediaDisplayProps> = ({
  mediaItems,
  mainMediaType,
  mainMediaUrl,
  fallbackCategory = 'default',
  eventTitle = '',
  className = 'w-full h-full'
}) => {
  const [imageError, setImageError] = useState(false);

  // Parse multimedia items safely
  const parseMediaItems = (): MediaItem[] => {
    if (!mediaItems) return [];
    
    try {
      if (typeof mediaItems === 'string') {
        return JSON.parse(mediaItems);
      }
      if (Array.isArray(mediaItems)) {
        return mediaItems;
      }
    } catch (error) {
      console.error('Error parsing media items:', error);
    }
    
    return [];
  };

  // Get the main media item
  const getMainMedia = (): { type: string; url: string } | null => {
    const items = parseMediaItems();
    
    // Try to find main item from mediaItems
    const mainItem = items.find(item => item.isMain) || items[0];
    if (mainItem?.url) {
      return { type: mainItem.type, url: mainItem.url };
    }
    
    // Fallback to mainMediaType and mainMediaUrl
    if (mainMediaType && mainMediaUrl) {
      return { type: mainMediaType, url: mainMediaUrl };
    }
    
    return null;
  };

  const mainMedia = getMainMedia();

  // Handle image error with multiple fallbacks
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    
    if (!target.src.includes('/images/')) {
      // First fallback: try local images
      target.src = `/images/1.jpg`;
    } else if (target.src.includes('1.jpg')) {
      // Second fallback: try another local image
      target.src = `/images/2.jpg`;
    } else {
      // Final fallback: SVG placeholder
      const svgPlaceholder = `data:image/svg+xml;base64,${btoa(`
        <svg width="600" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#e5e7eb"/>
          <text x="50%" y="50%" text-anchor="middle" dy="0.3em" 
                font-family="sans-serif" font-size="16" fill="#6b7280">
            ${eventTitle || 'Evento'}
          </text>
        </svg>
      `)}`;
      target.src = svgPlaceholder;
      setImageError(true);
    }
  };

  // Render multimedia content
  if (!mainMedia) {
    // No media available - show placeholder
    return (
      <div className={`${className} bg-neutral-200 flex items-center justify-center`}>
        <div className="text-center text-neutral-500">
          <div className="text-2xl mb-2">🖼️</div>
          <div className="text-sm">Sin multimedia</div>
        </div>
      </div>
    );
  }

  if (mainMedia.type === 'video') {
    return (
      <div className={`${className} relative`}>
        <video
          src={mainMedia.url}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          onError={(e) => {
            console.error('Video load error:', mainMedia.url);
          }}
        />
        {/* Video play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Default to image display
  return (
    <img
      src={mainMedia.url}
      alt={eventTitle}
      className={`${className} object-cover`}
      onError={handleImageError}
      loading="lazy"
    />
  );
};

export default MultimediaDisplay;