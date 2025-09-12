import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X } from "lucide-react";

type EventFiltersProps = {
  onClose: () => void;
  onApply?: (filters: {
    categories: string[];
    paymentTypes: string[];
    dateFilter: string;
    distance: number;
    genderFilter: string;
  }) => void;
};

const EventFilters = ({ onClose, onApply }: EventFiltersProps) => {
  // State for selected filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPaymentTypes, setSelectedPaymentTypes] = useState<string[]>([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");
  const [selectedDistance, setSelectedDistance] = useState<number>(100);
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>("todos");
  
  // Distance options: 1km → 5km → 10km → 20km → +50km → +80km → +100km
  const distanceOptions = [1, 5, 10, 20, 50, 80, 100];
  
  // Convert slider value to distance option
  const getDistanceFromSliderValue = (value: number) => {
    return distanceOptions[value] || 1;
  };
  
  // Convert distance option to slider value
  const getSliderValueFromDistance = (distance: number) => {
    const index = distanceOptions.indexOf(distance);
    return index !== -1 ? index : 0;
  };
  
  // Get distance label según la lógica exacta especificada
  const getDistanceLabel = (distance: number) => {
    if (distance >= 100) return '+100km';
    if (distance >= 80) return '+80km';
    if (distance >= 50) return '+50km';
    return `${distance}km`;
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSelectedCategories([]);
    setSelectedPaymentTypes([]);
    setSelectedDateFilter("all");
    setSelectedDistance(100);
    setSelectedGenderFilter("todos");
  };

  // Category options with icons
  const categories = [
    { id: "social", label: "Social", icon: "👥" },
    { id: "music", label: "Música", icon: "🎵" },
    { id: "spiritual", label: "Espiritual", icon: "✨" },
    { id: "education", label: "Educación", icon: "📚" },
    { id: "sports", label: "Deportes", icon: "🏆" },
    { id: "food", label: "Comida", icon: "🍽️" },
    { id: "art", label: "Arte", icon: "🎨" },
    { id: "technology", label: "Tecnología", icon: "💻" },
    { id: "games", label: "Juegos", icon: "🎮" },
    { id: "outdoor", label: "Aire Libre", icon: "🏕️" },
    { id: "networking", label: "Networking", icon: "🤝" },
    { id: "workshop", label: "Talleres", icon: "🔧" },
    { id: "conference", label: "Conferencias", icon: "🎤" },
    { id: "party", label: "Fiestas", icon: "🎉" },
    { id: "fair", label: "Ferias", icon: "🎪" },
    { id: "exhibition", label: "Exposiciones", icon: "🖼️" },
  ];

  // Payment type options
  const paymentTypes = [
    { id: "free", label: "Publico" },
    { id: "paid", label: "De pago" },
  ];

  // Date filter options
  const dateFilters = [
    { id: "all", label: "Todas las fechas" },
    { id: "today", label: "Hoy" },
    { id: "tomorrow", label: "Mañana" },
    { id: "this_week", label: "Esta Semana" },
    { id: "next_week", label: "Próxima Semana" },
    { id: "weekend", label: "Fin de Semana" },
  ];

  // Gender filter options  
  const genderFilters = [
    { id: "todos", label: "Todos" },
    { id: "men", label: "Hombres" },
    { id: "women", label: "Mujeres" },
  ];

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  // Toggle payment type selection
  const togglePaymentType = (typeId: string) => {
    if (selectedPaymentTypes.includes(typeId)) {
      setSelectedPaymentTypes(selectedPaymentTypes.filter(id => id !== typeId));
    } else {
      setSelectedPaymentTypes([...selectedPaymentTypes, typeId]);
    }
  };

  // Set date filter
  const setDateFilter = (filterId: string) => {
    setSelectedDateFilter(filterId);
  };

  // Apply filters
  const handleApplyFilters = () => {
    if (onApply) {
      onApply({
        categories: selectedCategories,
        paymentTypes: selectedPaymentTypes,
        dateFilter: selectedDateFilter,
        distance: selectedDistance,
        genderFilter: selectedGenderFilter,
      });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        transition={{
          type: "spring",
          damping: 25,
          stiffness: 300,
          duration: 0.4
        }}
        className="absolute top-16 left-4 right-4 z-10 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 p-3 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-white">Descubrir eventos</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-all duration-200 text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Gender Filter */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-white/80 mb-2">Para:</h4>
          <select
            value={selectedGenderFilter}
            onChange={(e) => setSelectedGenderFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white/10 text-white/80 border border-white/20 rounded-lg"
          >
            {genderFilters.map(filter => (
              <option key={filter.id} value={filter.id} className="bg-gray-800 text-white">
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      
        {/* Category Filter */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-white/80 mb-2">Tema:</h4>
          <select
            value={selectedCategories.length > 0 ? selectedCategories[0] : "all"}
            onChange={(e) => {
              if (e.target.value === "all") {
                setSelectedCategories([]);
              } else {
                setSelectedCategories([e.target.value]);
              }
            }}
            className="w-full px-3 py-2 text-sm bg-white/10 text-white/80 border border-white/20 rounded-lg"
          >
            <option value="all" className="bg-gray-800 text-white">Todos</option>
            {categories.map(category => (
              <option key={category.id} value={category.id} className="bg-gray-800 text-white">
                {category.icon} {category.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Distance Filter */}
        <div className="mb-1">
          <h4 className="text-sm font-medium text-white/80 mb-1">Distancia:</h4>
          <div className="px-2 py-1">
            <Slider
              value={[getSliderValueFromDistance(selectedDistance)]}
              defaultValue={[6]}
              onValueChange={(values) => setSelectedDistance(getDistanceFromSliderValue(values[0]))}
              max={6}
              min={0}
              step={1}
              className="slider-distance w-full"
            />
            <div className="text-center mt-1 text-white/60 text-xs">
              {getDistanceLabel(selectedDistance)}
            </div>
          </div>
        </div>
        
        {/* Date Filter */}
        <div className="mb-2">
          <h4 className="text-sm font-medium text-white/80 mb-2">Fecha:</h4>
          <select
            value={selectedDateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white/10 text-white/80 border border-white/20 rounded-lg"
          >
            {dateFilters.map(filter => (
              <option key={filter.id} value={filter.id} className="bg-gray-800 text-white">
                {filter.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Clear Filters */}
        <div className="mb-2">
          <Button
            variant="outline"
            className="w-full py-2 bg-white/10 text-white/80 rounded-lg font-medium border border-white/20 hover:bg-white/20 transition-all duration-200"
            onClick={resetFilters}
          >
            Limpiar Filtros
          </Button>
        </div>
      
      <div className="mb-4">
        <Button
          className="w-full py-3 bg-white/20 text-white rounded-xl font-medium border border-white/30 hover:bg-white/30 transition-all duration-200"
          onClick={handleApplyFilters}
        >
          Aplicar Filtros
        </Button>
      </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EventFilters;
