import React from "react";

type EventPinProps = {
  category: string;
  mainMediaUrl?: string;
  mainMediaType?: "photo" | "video";
  eventTitle?: string;
  showLabel?: boolean;
};

// Helper function for category emojis
const getCategoryEmoji = (category: string): string => {
  const categoryEmojis: Record<string, string> = {
    social: "🥂", // brindis: más cercano a reuniones sociales
    music: "🎶", // notas musicales para más dinamismo
    spiritual: "🧘", // flor de loto: más moderno y espiritual
    education: "🎓", // birrete: representa cursos o clases
    sports: "⛹️‍♂️", // medalla: más genérico que solo fútbol
    food: "🍷", // copa de vino: más lifestyle y foodie
    art: "🗿", // pincel: más artístico y creativo
    technology: "🤖", // robot: más tech y moderno
    games: "🕹️", // joystick retro: más visual
    outdoor: "🌳", // paisaje: transmite naturaleza y aire libre
    networking: "💼", // maletín: networking profesional
    workshop: "🛠️", // herramientas cruzadas
    conference: "🎤", // micrófono: charlas y conferencias
    party: "🎉", // bola de discoteca: más festivo y actual
    fair: "🎡", // rueda gigante: ferias y festivales
    exhibition: "🏛️", // edificio clásico: museos, expos
  };
  return categoryEmojis[category] || "📅";
};

// Componente EventPin MEJORADO - con sistema de etiquetas perfecto
const EventPin = ({ category, mainMediaUrl, mainMediaType, eventTitle, showLabel }: EventPinProps) => {
  const markerSize = 48; // Tamaño total del marker
  const mediaCircleSize = 32; // Tamaño del círculo de media
  
  // Debug logging MEJORADO para verificar prop changes
  React.useEffect(() => {
    console.log(`🏷️ EventPin "${eventTitle}" - showLabel: ${showLabel} (${showLabel ? 'SHOULD BE VISIBLE' : 'SHOULD BE HIDDEN'})`);
  }, [showLabel, eventTitle]);

  return (
    <div className="relative group cursor-pointer">
      {/* Contenedor principal del pin con estilo Nomadtable */}
      <div className="transform transition-transform group-hover:scale-110">
        {/* Círculo principal del marker - SIEMPRE MUESTRA LA IMAGEN PRINCIPAL */}
        <div
          className="rounded-full border-2 border-gray-200 shadow-lg flex items-center justify-center relative z-10 overflow-hidden"
          style={{
            width: markerSize,
            height: markerSize,
            backgroundColor: "white",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          {/* Media principal o fondo gris si no hay imagen */}
          {mainMediaUrl ? (
            mainMediaType === "video" ? (
              <div className="relative w-full h-full">
                <video
                  className="w-full h-full object-cover"
                  src={mainMediaUrl}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                {/* Play icon overlay para videos */}
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            ) : (
              <img
                src={mainMediaUrl}
                alt="Event media"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Si falla la imagen, mostrar fondo gris para que siempre haya dos círculos
                  const parent = (e.target as HTMLElement).parentElement!;
                  parent.style.backgroundColor = "#f3f4f6";
                  parent.innerHTML = `<div class="flex items-center justify-center text-2xl text-gray-400">📷</div>`;
                }}
              />
            )
          ) : (
            // Si no hay imagen, mostrar fondo gris con icono de cámara
            <div 
              className="flex items-center justify-center text-2xl text-gray-400 w-full h-full"
              style={{ backgroundColor: "#f3f4f6" }}
            >
              📷
            </div>
          )}
        </div>

        {/* Círculo pequeño con emoji de categoría - SIEMPRE VISIBLE */}
        <div
          className="absolute rounded-full border-2 border-white shadow-lg flex items-center justify-center z-20"
          style={{
            width: mediaCircleSize,
            height: mediaCircleSize,
            bottom: -10,
            right: -11,
            backgroundColor: "white",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
        >
          {/* Emoji de la categoría en el círculo secundario */}
          <div className="flex items-center justify-center text-lg">
            {getCategoryEmoji(category)}
          </div>
        </div>

        {/* Puntero/cola del pin */}
        <div
          className="absolute left-1/2 transform -translate-x-1/2"
          style={{
            top: markerSize - 4,
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "12px solid white",
            filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))",
            zIndex: 5,
          }}
        />

        {/* Borde de la cola */}
        <div
          className="absolute left-1/2 transform -translate-x-1/2"
          style={{
            top: markerSize - 5,
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: "13px solid #e5e7eb",
            zIndex: 4,
          }}
        />

        {/* Sistema de etiquetas PERFECTO - siempre renderizado para animaciones fluidas */}
        {eventTitle && (
          <div
            key={`label-${eventTitle}`}
            className={`
              absolute left-1/2 pointer-events-none
              transition-all duration-300 ease-in-out
              ${showLabel 
                ? 'opacity-100 visible scale-100 translate-y-0' 
                : 'opacity-0 invisible scale-90 translate-y-2'
              }
            `}
            data-label-state={showLabel ? 'visible' : 'hidden'}
            style={{
              top: -50,
              maxWidth: "200px",
              zIndex: 50,
              transform: 'translateX(-50%)',
              transformOrigin: 'center bottom',
              willChange: 'transform, opacity',
            }}
          >
            <div 
              className={`
                bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border 
                text-xs font-semibold text-gray-900 whitespace-nowrap text-center
                transition-all duration-300 ease-in-out shadow-lg
                ${showLabel 
                  ? 'border-gray-300 shadow-xl' 
                  : 'border-gray-200 shadow-md'
                }
              `}
              style={{
                minWidth: '60px',
                backdropFilter: 'blur(12px)',
                boxShadow: showLabel 
                  ? '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.08)',
              }}
            >
              {eventTitle}
              {/* Flecha perfecta */}
              <div
                className="absolute left-1/2 -bottom-1.5 transform -translate-x-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "6px solid rgba(255, 255, 255, 0.95)",
                  filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventPin;
