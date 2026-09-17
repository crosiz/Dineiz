'use client';

import { useEffect, useState } from 'react';
import { useBrandingStore } from '@/lib/branding-store';

export interface PosBranding {
  restaurantName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}

// Real colour values, never `var(--pos-primary)`.
//
// The defaults here used to be self-referential — `primaryColor:
// 'var(--pos-primary)'` — and ClientAppProvider feeds this straight into
// `root.style.setProperty('--pos-primary', branding.primaryColor)`. That
// resolves to `--pos-primary: var(--pos-primary)`, a cycle, which CSS discards:
// the custom property ends up INVALID, not merely unset. Every
// `var(--pos-primary)` in the app then fell back to nothing, which is why ~100
// call sites carried a `,#F59E0B` fallback to paper over it. Fixing the value
// here removes the reason those fallbacks existed.
const DEFAULTS: PosBranding = {
  restaurantName: 'Dineiz POS',
  primaryColor: '#FF6B35',
  secondaryColor: '#FFFFFF',
  accentColor: '#FFB300',
  logoUrl: null,
};

export function useBranding(): PosBranding {
  // Reads the same reactive store the rest of the app uses, so a live
  // tenant:branding_updated push reaches this too — it used to load
  // localStorage once on mount and never update again.
  const branding = useBrandingStore((s) => s.branding);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before hydration the store may be empty; returning the defaults keeps the
  // server and first client render in agreement.
  if (!mounted) return DEFAULTS;

  return {
    restaurantName: branding.restaurantName || DEFAULTS.restaurantName,
    primaryColor: branding.primaryColor || DEFAULTS.primaryColor,
    secondaryColor: branding.secondaryColor || DEFAULTS.secondaryColor,
    accentColor: branding.accentColor || DEFAULTS.accentColor,
    logoUrl: branding.logoUrl ?? DEFAULTS.logoUrl,
  };
}
