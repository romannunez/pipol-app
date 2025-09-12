import React from 'react';
import LoadingSpinner from './loading-spinner';

interface LoadingWrapperProps {
  isLoading: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  spinnerClassName?: string;
}

const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  isLoading,
  children,
  size = 'md',
  className = '',
  spinnerClassName = ''
}) => {
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <LoadingSpinner size={size} className={spinnerClassName} />
      </div>
    );
  }

  return <>{children}</>;
};

export default LoadingWrapper;