import { create } from 'zustand'

export interface BrandingStore {
  branding: Record<string, any>
  setBranding: (b: Record<string, any>) => void
}

const getInitialBranding = () => {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem('pos_branding') ?? '{}')
  } catch (e) {
    return {}
  }
}

export const useBrandingStore = create<BrandingStore>((set) => ({
  branding: getInitialBranding(),
  setBranding: (b) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_branding', JSON.stringify(b))
    }
    set({ branding: b })
  },
}))

/**
 * The tenant's settings, flattened, for non-React code.
 *
 * `pos_branding` carries the Part-13 POS config under `.pos` and the rest at
 * the top level, and every consumer has to merge the two — a dozen modules were
 * each doing their own `JSON.parse(localStorage.getItem('pos_branding'))`, and
 * several read only the top level, so a value delivered under `.pos` was
 * silently missed. This is the one merge, off the reactive store (which stays
 * current with live admin pushes; a localStorage snapshot does not).
 */
export function getBrandingConfig(): Record<string, any> {
  const b = useBrandingStore.getState().branding ?? {}
  return { ...((b as any).pos ?? {}), ...b }
}
