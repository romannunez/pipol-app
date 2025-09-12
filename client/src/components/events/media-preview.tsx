import React, { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

type MediaPreviewProps = {
  file?: File;
  url?: string;
  previewUrl?: string;
  type: 'photo' | 'video';
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
};

const MediaPreview: React.FC<MediaPreviewProps> = ({ 
  file, 
  url,
  previewUrl,
  type,
  onLoad,
  onError,
  className = ''
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    // Si hay una URL de vista previa existente, usarla
    if (previewUrl) {
      setPreview(previewUrl);
      return;
    }
    
    // Si hay una URL para un archivo remoto, usarla
    if (url) {
      setPreview(url);
      return;
    }
    
    // Si hay un archivo local, generar URL de vista previa
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      
      // Cleanup al desmontar
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }
  }, [file, url, previewUrl]);
  
  const handleLoad = () => {
    setLoading(false);
    if (onLoad) onLoad();
  };
  
  const handleError = () => {
    setLoading(false);
    setError(true);
    if (onError) onError();
  };
  
  if (!preview) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <LoadingSpinner size="md" />
      </div>
    );
  }
  
  if (type === 'video') {
    return (
      <div className={`relative ${className}`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <LoadingSpinner size="md" />
          </div>
        )}
        <video 
          src={preview}
          className={`w-full h-full object-cover ${error ? 'hidden' : ''}`}
          onLoadedData={handleLoad}
          onError={handleError}
          muted
          preload="metadata"
        />
        {error && (
          <div className="flex flex-col items-center justify-center w-full h-full bg-red-50 text-red-500">
            <span className="text-xs">Error al cargar video</span>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <LoadingSpinner size="md" />
        </div>
      )}
      <img 
        src={preview}
        className={`w-full h-full object-cover ${error ? 'hidden' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        alt="Media preview"
      />
      {error && (
        <div className="flex flex-col items-center justify-center w-full h-full bg-red-50 text-red-500">
          <span className="text-xs">Error al cargar imagen</span>
        </div>
      )}
    </div>
  );
};

export default MediaPreview;