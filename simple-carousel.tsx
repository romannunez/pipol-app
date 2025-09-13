import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MediaItem = {
  type: 'photo' | 'video';
  url: string;
  isMain?: boolean;
  order?: number;
};

type SimpleCarouselProps = {
  items: MediaItem[];
  eventTitle: string;
};

const SimpleMediaCarousel = ({ items, eventTitle }: SimpleCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const currentItem = items[currentIndex];

  return (
    <div className="mb-5">
      <h3 className="font-semibold mb-3">Contenido multimedia</h3>
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-black">
        {/* Current media item */}
        {currentItem.type === 'video' ? (
          <video
            key={currentIndex}
            src={currentItem.url}
            className="w-full h-full object-contain"
            preload="metadata"
            controls
          />
        ) : (
          <img
            src={currentItem.url}
            alt={`${eventTitle} - imagen ${currentIndex + 1}`}
            className="w-full h-full object-contain"
          />
        )}

        {/* Navigation arrows */}
        {items.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 text-gray-800 rounded-full p-2 hover:bg-white transition-colors shadow-md"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 text-gray-800 rounded-full p-2 hover:bg-white transition-colors shadow-md"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Pagination indicator */}
        {items.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded">
            {currentIndex + 1} / {items.length}
          </div>
        )}

        {/* Main indicator badge */}
        {currentItem.isMain && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
            Principal
          </div>
        )}
      </div>

      {/* Dot navigation */}
      {items.length > 1 && (
        <div className="flex gap-1 mt-3 justify-center">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SimpleMediaCarousel;