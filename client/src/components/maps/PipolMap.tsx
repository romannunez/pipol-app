import React, { useEffect, useRef, useState } from "react";
import mapboxgl, { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { useMap } from '@/contexts/MapContext';

// Configurar token de Mapbox
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || "";

type EventPoint = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  emoji?: string;
  creatorAvatar?: string;
  category?: string;
  organizerId?: number;
  organizerName?: string;
  organizerEmail?: string;
};

type Props = {
  events: EventPoint[];
  styleUrl?: string;
  center?: [number, number];
  onEventClick?: (eventId: string, coordinates?: [number, number]) => void;
};

export default function PipolMap({ 
  events, 
  styleUrl, 
  center = [-64.1888, -31.4201], // Córdoba Centro
  onEventClick 
}: Props) {
  const { setMapInstance, saveCameraState, clearMapInstance } = useMap();
  const mapRef = useRef<MapboxMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Limpiar marcadores existentes
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl || "mapbox://styles/mapbox/light-v11",
      center: center,
      zoom: 15,
      pitch: 60,   // INCLINACIÓN "Snap"
      bearing: -20, // ROTACIÓN "Snap"
      attributionControl: false // Eliminar controles de atribución
    });

    // Controles básicos - ELIMINADOS COMPLETAMENTE
    // No agregar ningún control para mantener la interfaz limpia

    map.on("load", async () => {
      // --- (1) Terreno (DEM) + Cielo ---
      // Fuente DEM de Mapbox (igual approach que Snap)
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14
        });
      }
      // Activa terreno (exageración leve para "pop" 3D)
      // @ts-ignore
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.1 });

      // Capa de cielo (profundidad 3D)
      if (!map.getLayer("sky")) {
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 0.0],
            "sky-atmosphere-sun-intensity": 15
          }
        });
      }

      // --- (2) Edificios extruidos 3D (idéntico a Snap) ---
      // Busca la capa de labels para insertar edificios por debajo
      const layers = map.getStyle().layers || [];
      const labelLayerId = layers.find((l) => l.type === "symbol" && (l.layout as any)?.["text-field"])?.id;

      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#e6e6e6",
            "fill-extrusion-height": ["coalesce", ["get", "height"], 12],
            "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.9
          }
        },
        labelLayerId // inserta debajo de labels
      );

      // --- (3) Clúster de eventos (performance al estilo Snap) ---
      // Creamos un GeoJSON dinámico con tus eventos
      const geojson = {
        type: "FeatureCollection" as const,
        features: events.map((ev) => ({
          type: "Feature" as const,
          properties: { 
            id: ev.id, 
            title: ev.title,
            category: ev.category,
            emoji: ev.emoji,
            creatorAvatar: ev.creatorAvatar
          },
          geometry: { type: "Point" as const, coordinates: [ev.lng, ev.lat] }
        }))
      };

      if (!map.getSource("events")) {
        map.addSource("events", {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50
        });

        // Capa de clusters (burbujas)
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "events",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#ffffff",
            "circle-stroke-color": "#00000022",
            "circle-stroke-width": 2,
            "circle-radius": [
              "step",
              ["get", "point_count"],
              16, 10,
              20, 25,
              28
            ]
          }
        });

        // Números dentro del cluster
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "events",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["to-string", ["get", "point_count_abbreviated"]],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12
          },
          paint: { "text-color": "#444" }
        });

        // Puntos individuales (no cluster) - círculos simples en zoom bajo
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "events",
          filter: ["!", ["has", "point_count"]],
          maxzoom: 15, // Solo visible hasta zoom 15
          paint: {
            "circle-color": "#ffffff",
            "circle-radius": 10,
            "circle-stroke-color": "#00000022",
            "circle-stroke-width": 2
          }
        });
      }

      // Zoom al hacer click en cluster
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0].properties?.cluster_id;
        // @ts-ignore
        map.getSource("events").getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });

      // Click en punto individual con zoom
      map.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0];
        if (feature && onEventClick) {
          const coordinates = (feature.geometry as any).coordinates as [number, number];
          
          // Guardar posición actual de la cámara ANTES de hacer zoom usando el contexto
          console.log("🚨 PipolMap: ANTES de llamar saveCameraState");
          saveCameraState();
          console.log("🚨 PipolMap: DESPUÉS de llamar saveCameraState");
          
          // Hacer zoom al marker con animación suave
          map.flyTo({
            center: coordinates,
            zoom: 18, // Zoom más cercano para efecto focal
            duration: 1200, // Animación más larga y suave
            essential: true,
            pitch: 60, // Mantener vista 3D
            bearing: map.getBearing() // Mantener rotación actual
          });
          
          // Llamar callback con coordenadas para informar al padre
          onEventClick(feature.properties?.id, coordinates);
        }
      });

      // Cursor "pointer"
      ["clusters", "unclustered-point"].forEach((id) => {
        map.on("mouseenter", id, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", id, () => {
          map.getCanvas().style.cursor = "";
        });
      });

      setIsLoaded(true);
    });

    // Manejar cambios de zoom para mostrar/ocultar marcadores DOM
    map.on("zoom", () => {
      const zoom = map.getZoom();
      if (zoom >= 15) {
        // Mostrar marcadores DOM estilo Snap
        addDomMarkers();
      } else {
        // Ocultar marcadores DOM, mostrar círculos
        clearMarkers();
      }
    });

    mapRef.current = map;
    
    // Configurar la instancia del mapa en el contexto
    console.log("🗺️ PipolMap: Configurando mapa en contexto...");
    setMapInstance(map);
    console.log("🗺️ PipolMap: Mapa configurado en contexto");
    return () => { 
      clearMarkers();
      map.remove(); 
      mapRef.current = null; 
    };
  }, [styleUrl, center]);

  // Actualizar datos cuando cambien los eventos
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: events.map((ev) => ({
        type: "Feature" as const,
        properties: { 
          id: ev.id, 
          title: ev.title,
          category: ev.category,
          emoji: ev.emoji,
          creatorAvatar: ev.creatorAvatar
        },
        geometry: { type: "Point" as const, coordinates: [ev.lng, ev.lat] }
      }))
    };

    const source = mapRef.current.getSource("events") as GeoJSONSource;
    if (source) {
      source.setData(geojson);
      
      // Si estamos en zoom alto, actualizar marcadores DOM
      if (mapRef.current.getZoom() >= 15) {
        addDomMarkers();
      }
    }
  }, [events, isLoaded]);

  // Función para agregar marcadores DOM estilo Snap
  const addDomMarkers = () => {
    if (!mapRef.current) return;
    
    clearMarkers();
    
    const bounds = mapRef.current?.getBounds();
    const visibleEvents = events.filter(event => 
      bounds && bounds.contains([event.lng, event.lat])
    );

    visibleEvents.forEach(event => {
      const el = document.createElement("div");
      el.className = "snap-marker";
      el.innerHTML = `
        <div class="relative flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-xl border-2 border-white cursor-pointer hover:scale-110 transition-transform">
          ${event.creatorAvatar ? 
            `<img src="${event.creatorAvatar}" alt="creator" class="w-10 h-10 rounded-full object-cover avatar-clickeable" data-creator-id="${event.organizerId}" />` :
            `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 avatar-clickeable" data-creator-id="${event.organizerId}"></div>`
          }
          ${event.emoji ? 
            `<span class="absolute -bottom-1 -right-1 text-lg leading-none">${event.emoji}</span>` : 
            ''
          }
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = e.target as HTMLElement;
        
        // Si se clickea en el avatar, mostrar perfil del creador
        if (target.classList.contains('avatar-clickeable') && event.organizerId) {
          // Trigger user profile display (implementation will be added globally)
          console.log('Avatar clicked for user:', event.organizerId);
          // For now just show event details with zoom
          if (onEventClick && mapRef.current) {
            // Guardar estado de la cámara ANTES del zoom (DOM markers - avatar click)
            saveCameraState();
            // Hacer zoom al marker de la misma forma
            mapRef.current.flyTo({
              center: [event.lng, event.lat],
              zoom: 18,
              duration: 1200,
              essential: true,
              pitch: 60,
              bearing: mapRef.current.getBearing()
            });
            onEventClick(event.id, [event.lng, event.lat]);
          }
        } else {
          // Si se clickea en otra parte, mostrar detalles del evento con zoom
          if (onEventClick && mapRef.current) {
            // Guardar estado de la cámara ANTES del zoom (DOM markers - general click)
            saveCameraState();
            // Hacer zoom al marker de la misma forma
            mapRef.current.flyTo({
              center: [event.lng, event.lat],
              zoom: 18,
              duration: 1200,
              essential: true,
              pitch: 60,
              bearing: mapRef.current.getBearing()
            });
            onEventClick(event.id, [event.lng, event.lat]);
          }
        }
      });

      const marker = new mapboxgl.Marker(el, { anchor: "center" })
        .setLngLat([event.lng, event.lat])
        .addTo(mapRef.current!);
      
      markersRef.current.push(marker);
    });
  };

  return <div ref={containerRef} className="w-full h-full" />;
}