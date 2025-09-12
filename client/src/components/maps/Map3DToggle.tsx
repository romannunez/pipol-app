import React from "react";
import { Button } from "@/components/ui/button";
import { Layers3, Map } from "lucide-react";

interface Map3DToggleProps {
  is3D: boolean;
  onToggle: (is3D: boolean) => void;
}

export default function Map3DToggle({ is3D, onToggle }: Map3DToggleProps) {
  return (
    <div className="absolute top-4 right-4 z-10">
      <Button
        variant={is3D ? "default" : "outline"}
        size="sm"
        onClick={() => onToggle(!is3D)}
        className="bg-white/90 backdrop-blur-sm border border-white/20 hover:bg-white shadow-lg"
      >
        {is3D ? (
          <>
            <Map className="w-4 h-4 mr-2" />
            2D
          </>
        ) : (
          <>
            <Layers3 className="w-4 h-4 mr-2" />
            3D
          </>
        )}
      </Button>
    </div>
  );
}