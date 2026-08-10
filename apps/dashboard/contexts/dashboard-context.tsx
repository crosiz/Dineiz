'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './user-context';

export interface DashboardContextType {
  selectedBranchId: string | null; // null = All Branches
  setSelectedBranchId: (id: string | null, name?: string) => void;
  selectedBranchName: string;      // "All Branches" or "Clifton Branch"
  userRole: string;
  userBranchId: string | null;
}

const DashboardContext = createContext<DashboardContextType>({
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  selectedBranchName: 'All Branches',
  userRole: 'TENANT_ADMIN',
  userBranchId: null,
});

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { role, branchId: userBranchId, branch } = useUser();
  const isBranchManager = role === 'BRANCH_MANAGER';

  // Read from sessionStorage so selection survives page refresh but resets on new session
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(() => {
    if (isBranchManager) return userBranchId ?? null;
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('swiftserve_branch') || null;
    }
    return null;
  });

  const [selectedBranchName, setSelectedBranchName] = useState('All Branches');

  const setSelectedBranchId = (id: string | null, name?: string) => {
    if (isBranchManager) return; // no-op for branch managers
    setSelectedBranchIdState(id);
    setSelectedBranchName(name || 'All Branches');
    
    // Persist to sessionStorage
    if (id) {
      sessionStorage.setItem('swiftserve_branch', id);
      sessionStorage.setItem('swiftserve_branch_name', name || 'All Branches');
    } else {
      sessionStorage.removeItem('swiftserve_branch');
      sessionStorage.removeItem('swiftserve_branch_name');
    }
  };

  // Lock branch context for branch managers and sync branch name
  useEffect(() => {
    if (isBranchManager && userBranchId) {
      setSelectedBranchIdState(userBranchId);
      setSelectedBranchName(branch?.name || 'My Branch');
    }
  }, [isBranchManager, userBranchId, branch]);

  // Restore branch name from sessionStorage on mount
  useEffect(() => {
    if (isBranchManager) {
      setSelectedBranchName(branch?.name || 'My Branch');
    } else {
      const savedName = sessionStorage.getItem('swiftserve_branch_name');
      if (savedName) setSelectedBranchName(savedName);
    }
  }, [isBranchManager, branch]);

  return (
    <DashboardContext.Provider
      value={{
        selectedBranchId,
        setSelectedBranchId,
        selectedBranchName,
        userRole: role,
        userBranchId: userBranchId ?? null,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext(): DashboardContextType {
  return useContext(DashboardContext);
}

