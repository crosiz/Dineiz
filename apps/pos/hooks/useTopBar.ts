'use client';

import { useContext, useEffect } from 'react';
import { TopBarDispatchContext, TopBarConfig } from '../contexts/TopBarContext';

export function useTopBar(config: TopBarConfig) {
  const setConfig = useContext(TopBarDispatchContext);

  useEffect(() => {
    setConfig(config);

    return () => {
      setConfig({
        pageTitle: '',
        breadcrumb: undefined,
        centerSlot: null,
        rightActions: null,
        showBackButton: false,
        backPath: undefined,
      });
    };
  }, [
    config.pageTitle,
    config.breadcrumb,
    config.centerSlot,
    config.rightActions,
    config.showBackButton,
    config.backPath,
    setConfig,
  ]);
}
