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
