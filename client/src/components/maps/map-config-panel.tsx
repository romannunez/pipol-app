import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Settings, X, SunMoon, MapIcon, Layers, Globe, Building2, Mountain, Eye, Image } from 'lucide-react';
import { MapConfigOptions, LightPreset, MapTheme, MapFont, applyMapConfig, MapStyle, getLightPresetByTime } from '@/lib/mapbox';
import mapboxgl from 'mapbox-gl';

interface MapConfigPanelProps {
  map: mapboxgl.Map | null;
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: (config: Partial<MapConfigOptions>) => void;
  config: MapConfigOptions;
  is3DMode?: boolean;
}

export default function MapConfigPanel({ 
  map, 
  isOpen, 
  onClose, 
  onConfigChange, 
  config,
  is3DMode = true
}: MapConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<MapConfigOptions>(config);
  
  // Update local config when props change
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Apply changes when a setting is modified
  const handleSettingChange = (key: keyof MapConfigOptions, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigChange({ [key]: value });
    
    // Apply immediately if map is available
    if (map) {
      applyMapConfig(map, { [key]: value });
    }
  };

  // Helper function to toggle boolean settings
  const toggleSetting = (key: keyof MapConfigOptions) => {
    const newValue = !localConfig[key];
    
    // Caso especial para useAutoLightPreset
    if (key === 'useAutoLightPreset' && newValue === true && map) {
      try {
        // Si estamos activando la iluminación automática, obtener y aplicar preset según hora actual
        // Determinar el preset según la hora actual
        const currentHour = new Date().getHours();
        let currentTimePreset: LightPreset;
        
        if (currentHour >= 6 && currentHour < 8) {
          // Early morning (6:00 AM - 8:00 AM)
          currentTimePreset = LightPreset.DAWN;
        } else if (currentHour >= 8 && currentHour < 18) {
          // Daytime (8:00 AM - 6:00 PM)
          currentTimePreset = LightPreset.DAWN;
        } else if (currentHour >= 18 && currentHour < 20) {
          // Evening (6:00 PM - 8:00 PM)
          currentTimePreset = LightPreset.DUSK;
        } else {
          // Night (8:00 PM - 6:00 AM)
          currentTimePreset = LightPreset.NIGHT;
        }
        
        console.log(`Activando iluminación automática, aplicando preset: ${currentTimePreset}`);
        
        // Actualizar configuración local
        const updatedConfig = { 
          ...localConfig, 
          useAutoLightPreset: true,
          lightPreset: currentTimePreset 
        };
        setLocalConfig(updatedConfig);
        
        // Notificar al componente padre
        onConfigChange({ 
          useAutoLightPreset: true,
          lightPreset: currentTimePreset 
        });
        
        // Aplicar directamente al mapa
        map.setConfigProperty('basemap', 'lightPreset', currentTimePreset);
        map.setConfigProperty('basemap', 'useAutoLightPreset', true);
        
        return; // Salir, ya que manejamos todo aquí
      } catch (err) {
        console.error("Error al aplicar iluminación automática:", err);
        // Si falla, seguir con el comportamiento normal
      }
    }
    
    // Comportamiento normal para otros casos
    handleSettingChange(key, newValue);
  };

  // Set the light preset and disable auto time of day
  const setLightPreset = (preset: LightPreset) => {
    // Update local state
    setLocalConfig(prev => ({
      ...prev,
      lightPreset: preset,
      useAutoLightPreset: false
    }));
    
    // Notify parent component
    onConfigChange({ 
      lightPreset: preset,
      useAutoLightPreset: false 
    });
    
    // Apply directly to map if available
    if (map) {
      try {
        map.setConfigProperty('basemap', 'lightPreset', preset);
        map.setConfigProperty('basemap', 'useAutoLightPreset', false);
      } catch (err) {
        console.error("Error applying lightPreset:", err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: "100%", scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: "100%", scale: 0.9 }}
        transition={{
          type: "spring",
          damping: 25,
          stiffness: 300,
          duration: 0.4
        }}
        className="absolute top-20 right-4 z-10 w-72 bg-white/10 backdrop-blur-lg rounded-lg shadow-2xl border border-white/20 overflow-hidden"
      >
        <div className="flex items-center justify-between p-3 bg-white/10 text-white">
          <div className="flex items-center gap-2">
            <Settings size={18} />
            <h3 className="font-medium">
              {is3DMode ? "Configuración del Mapa 3D" : "Configuración del Mapa"}
            </h3>
          </div>
          <button onClick={onClose} className="text-white hover:text-white/80 transition-all duration-200">
            <X size={18} />
          </button>
        </div>

      <Tabs defaultValue={is3DMode ? "visual" : "style"} className="w-full">
        <TabsList className={`w-full grid ${is3DMode ? 'grid-cols-3' : 'grid-cols-1'} bg-white/10`}>
          {is3DMode && (
            <TabsTrigger value="visual" className="text-xs">
              <div className="flex flex-col items-center gap-1">
                <Eye size={16} />
                <span>Visual</span>
              </div>
            </TabsTrigger>
          )}
          
          {is3DMode && (
            <TabsTrigger value="lighting" className="text-xs">
              <div className="flex flex-col items-center gap-1">
                <SunMoon size={16} />
                <span>Iluminación</span>
              </div>
            </TabsTrigger>
          )}
          
          <TabsTrigger value="style" className="text-xs">
            <div className="flex flex-col items-center gap-1">
              <Layers size={16} />
              <span>Estilo</span>
            </div>
          </TabsTrigger>
        </TabsList>
        
        {/* Visual Settings Tab */}
        <TabsContent value="visual" className="p-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="show3dObjects" className="text-sm flex items-center gap-1">
                <Building2 size={16} />
                Mostrar edificios 3D
              </Label>
              <Switch 
                id="show3dObjects" 
                checked={localConfig.show3dObjects}
                onCheckedChange={() => toggleSetting('show3dObjects')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="showPlaceLabels" className="text-sm flex items-center gap-1">
                <MapIcon size={16} />
                Mostrar etiquetas de lugares
              </Label>
              <Switch 
                id="showPlaceLabels" 
                checked={localConfig.showPlaceLabels}
                onCheckedChange={() => toggleSetting('showPlaceLabels')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="showRoadLabels" className="text-sm flex items-center gap-1">
                <MapIcon size={16} />
                Mostrar nombres de calles
              </Label>
              <Switch 
                id="showRoadLabels" 
                checked={localConfig.showRoadLabels}
                onCheckedChange={() => toggleSetting('showRoadLabels')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="showPointOfInterestLabels" className="text-sm flex items-center gap-1">
                <MapIcon size={16} />
                Puntos de interés
              </Label>
              <Switch 
                id="showPointOfInterestLabels" 
                checked={localConfig.showPointOfInterestLabels}
                onCheckedChange={() => toggleSetting('showPointOfInterestLabels')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="showTransitLabels" className="text-sm flex items-center gap-1">
                <MapIcon size={16} />
                Transporte público
              </Label>
              <Switch 
                id="showTransitLabels" 
                checked={localConfig.showTransitLabels}
                onCheckedChange={() => toggleSetting('showTransitLabels')}
              />
            </div>
          </div>
        </TabsContent>
        
        {/* Lighting Settings Tab */}
        <TabsContent value="lighting" className="p-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="useAutoLightPreset" className="text-sm flex items-center gap-1">
                <SunMoon size={16} />
                Iluminación automática
              </Label>
              <Switch 
                id="useAutoLightPreset" 
                checked={localConfig.useAutoLightPreset}
                onCheckedChange={() => toggleSetting('useAutoLightPreset')}
              />
            </div>
            
            <Separator className="my-2" />
            
            <div className="space-y-2">
              <Label className="text-sm">Hora del día</Label>
              <RadioGroup 
                value={localConfig.lightPreset} 
                onValueChange={(value) => setLightPreset(value as LightPreset)}
                className="grid grid-cols-2 gap-2"
                disabled={localConfig.useAutoLightPreset}
              >
                <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md">
                  <RadioGroupItem value="night" id="night" />
                  <Label htmlFor="night" className="flex items-center gap-1 cursor-pointer">
                    <span>Noche</span>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md">
                  <RadioGroupItem value="dawn" id="dawn" />
                  <Label htmlFor="dawn" className="flex items-center gap-1 cursor-pointer">
                    <span>Amanecer</span>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md">
                  <RadioGroupItem value="dusk" id="dusk" />
                  <Label htmlFor="dusk" className="flex items-center gap-1 cursor-pointer">
                    <span>Atardecer</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </TabsContent>
        
        {/* Style Settings Tab */}
        <TabsContent value="style" className="p-3 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Tipo de mapa</Label>
            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant="outline"
                className="justify-start" 
                onClick={() => {
                  if (map) {
                    map.setStyle(is3DMode ? MapStyle.STANDARD_3D : MapStyle.STREETS_2D);
                  }
                }}
              >
                <Globe className="mr-2 h-4 w-4" />
                Mapa estándar
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => {
                  if (map) {
                    map.setStyle(is3DMode ? MapStyle.STANDARD_SATELLITE : MapStyle.SATELLITE_2D);
                  }
                }}
              >
                <Image className="mr-2 h-4 w-4" />
                Mapa satélite
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </motion.div>
    </AnimatePresence>
  );
}