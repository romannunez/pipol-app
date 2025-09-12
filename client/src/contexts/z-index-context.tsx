import React, { createContext, useContext, useState, useCallback } from 'react';

type ZIndexContextType = {
  getNextZIndex: () => number;
  resetZIndex: () => void;
  baseZIndex: number;
};

const ZIndexContext = createContext<ZIndexContextType | undefined>(undefined);

export const ZIndexProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentZIndex, setCurrentZIndex] = useState(100);
  const baseZIndex = 100;

  const getNextZIndex = useCallback(() => {
    setCurrentZIndex(prev => prev + 10);
    return currentZIndex + 10;
  }, [currentZIndex]);

  const resetZIndex = useCallback(() => {
    setCurrentZIndex(baseZIndex);
  }, [baseZIndex]);

  return (
    <ZIndexContext.Provider value={{ getNextZIndex, resetZIndex, baseZIndex }}>
      {children}
    </ZIndexContext.Provider>
  );
};

export const useZIndex = () => {
  const context = useContext(ZIndexContext);
  if (context === undefined) {
    throw new Error('useZIndex must be used within a ZIndexProvider');
  }
  return context;
};