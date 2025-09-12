import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  username?: string;
  bio?: string;
  avatar?: string;
  createdAt?: string;
}

interface UserProfileContextType {
  selectedUser: User | null;
  isProfileOpen: boolean;
  showUserProfile: (user: User) => void;
  hideUserProfile: () => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ children }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const showUserProfile = (user: User) => {
    setSelectedUser(user);
    setIsProfileOpen(true);
  };

  const hideUserProfile = () => {
    setIsProfileOpen(false);
    setSelectedUser(null);
  };

  return (
    <UserProfileContext.Provider
      value={{
        selectedUser,
        isProfileOpen,
        showUserProfile,
        hideUserProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};