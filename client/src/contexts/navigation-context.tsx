import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NavigationContextType {
  isNavigationVisible: boolean;
  hideNavigation: () => void;
  showNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: ReactNode;
}

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);

  const hideNavigation = () => {
    console.log("🎯 NavigationContext: hideNavigation() called");
    setIsNavigationVisible(false);
  };
  
  const showNavigation = () => {
    console.log("🎯 NavigationContext: showNavigation() called");
    setIsNavigationVisible(true);
  };

  return (
    <NavigationContext.Provider 
      value={{ 
        isNavigationVisible, 
        hideNavigation, 
        showNavigation 
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};