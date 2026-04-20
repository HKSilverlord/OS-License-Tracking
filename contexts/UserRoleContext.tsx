import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'admin' | 'user' | null;

interface UserRoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isAdmin: boolean;
  isViewer: boolean;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export const UserRoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = role === 'admin';
  const isViewer = role === 'user' || (role === null && !isLoading);

  return (
    <UserRoleContext.Provider value={{ role, setRole, isAdmin, isViewer, isLoading, setIsLoading }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
};
