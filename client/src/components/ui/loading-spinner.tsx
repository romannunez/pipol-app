import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  // Determinar el tamaño del spinner
  const getSize = () => {
    if (typeof size === 'number') {
      return { width: size, height: size };
    }
    
    switch (size) {
      case 'sm': return { width: 16, height: 16 };
      case 'md': return { width: 24, height: 24 };
      case 'lg': return { width: 48, height: 48 };
      case 'xl': return { width: 64, height: 64 };
      default: return { width: 24, height: 24 };
    }
  };

  const dimensions = getSize();

  return (
    <div 
      className={`inline-block animate-spin ${className}`}
      style={dimensions}
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="#FCD34D"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="#FCD34D"
          d="m12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z"
        />
      </svg>
    </div>
  );
};

export default LoadingSpinner;