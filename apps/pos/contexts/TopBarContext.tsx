'use client';

import React, { createContext, useState, ReactNode } from 'react';

export interface TopBarConfig {
  pageTitle: string;
  breadcrumb?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightActions?: React.ReactNode;
  showBackButton?: boolean;
  backPath?: string;
}

const defaultConfig: TopBarConfig = {
  pageTitle: '',
};

export const TopBarStateContext = createContext<TopBarConfig>(defaultConfig);
export const TopBarDispatchContext = createContext<React.Dispatch<React.SetStateAction<TopBarConfig>>>(() => {});

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TopBarConfig>(defaultConfig);

  return (
    <TopBarDispatchContext.Provider value={setConfig}>
      <TopBarStateContext.Provider value={config}>
        {children}
      </TopBarStateContext.Provider>
    </TopBarDispatchContext.Provider>
  );
}
