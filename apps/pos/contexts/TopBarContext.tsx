'use client';

import React, { createContext, useState, ReactNode } from 'react';

/** A page action for the phone's "…" menu, where there's no room for icons. */
export interface TopBarMenuAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  /** Shows a tick: the action is a toggle that's on. */
  active?: boolean;
}

export interface TopBarConfig {
  pageTitle: string;
  /** One plain line under the title: something useful about this screen now. */
  breadcrumb?: React.ReactNode;
  /** Labelled versions of rightActions, shown in a "…" menu on phones. */
  menuActions?: TopBarMenuAction[];
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
