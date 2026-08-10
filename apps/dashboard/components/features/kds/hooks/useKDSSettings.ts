'use client';
import { useState, useEffect } from 'react';

export interface KDSSettings {
  rushThreshold: number;
  autoRefreshInterval: number;
  soundEnabled: boolean;
  showCompleted: boolean;
  cardFontSize: 'sm' | 'md' | 'lg';
  autoFullscreen: boolean;
  theme: 'dark' | 'light';
}

const defaultSettings: KDSSettings = {
  rushThreshold: 15,
  autoRefreshInterval: 10,
  soundEnabled: true,
  showCompleted: false,
  cardFontSize: 'md',
  autoFullscreen: false,
  theme: 'dark',
};

export function useKDSSettings() {
  const [settings, setSettings] = useState<KDSSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kds_settings');
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch {}
    setMounted(true);
  }, []);

  const updateSettings = (updates: Partial<KDSSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('kds_settings', JSON.stringify(next));
      return next;
    });
  };

  return { settings, updateSettings, mounted };
}
