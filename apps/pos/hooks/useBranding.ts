'use client';

import { useState, useEffect } from 'react';

export interface PosBranding {
  restaurantName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}

export function useBranding(): PosBranding {
  const [branding, setBranding] = useState<PosBranding>({
    restaurantName: 'Dineiz POS',
    primaryColor: 'var(--pos-primary)',
    secondaryColor: 'var(--pos-bg-card)',
    accentColor: '#FFB300',
    logoUrl: null,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pos_branding');
      if (stored) {
        setBranding({ ...branding, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
  }, []);

  return branding;
}
