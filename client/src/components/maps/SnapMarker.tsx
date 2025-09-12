import React from "react";

export function SnapBubble({ 
  avatar, 
  emoji, 
  onClick,
  size = "w-12 h-12"
}: { 
  avatar?: string; 
  emoji?: string; 
  onClick?: () => void;
  size?: string;
}) {
  return (
    <div 
      className={`relative flex items-center justify-center ${size} bg-white rounded-full shadow-xl border-2 border-white cursor-pointer hover:scale-110 transition-transform`}
      onClick={onClick}
    >
      {avatar ? (
        <img 
          src={avatar} 
          alt="creator" 
          className={`${size === "w-12 h-12" ? "w-10 h-10" : "w-8 h-8"} rounded-full object-cover`} 
        />
      ) : (
        <div className={`${size === "w-12 h-12" ? "w-10 h-10" : "w-8 h-8"} rounded-full bg-gradient-to-br from-blue-400 to-purple-500`} />
      )}
      {emoji && (
        <span className="absolute -bottom-1 -right-1 text-lg leading-none">
          {emoji}
        </span>
      )}
    </div>
  );
}

// Función helper para crear marcadores DOM en Mapbox
export function createSnapMarkerElement(
  avatar?: string, 
  emoji?: string, 
  onClick?: () => void
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "snap-marker";
  
  el.innerHTML = `
    <div class="relative flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-xl border-2 border-white cursor-pointer hover:scale-110 transition-transform">
      ${avatar ? 
        `<img src="${avatar}" alt="creator" class="w-10 h-10 rounded-full object-cover" />` :
        `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500"></div>`
      }
      ${emoji ? 
        `<span class="absolute -bottom-1 -right-1 text-lg leading-none">${emoji}</span>` : 
        ''
      }
    </div>
  `;

  if (onClick) {
    el.addEventListener("click", onClick);
  }

  return el;
}