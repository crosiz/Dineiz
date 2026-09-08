import { create } from 'zustand'

type Menu = Awaited<ReturnType<typeof window.dineiz.menu.getAll>>
type Category = Menu['categories'][number]

interface MenuState {
  categories: Category[]
  loading: boolean
  loaded: boolean
  refresh: () => Promise<void>
}

// Loaded once at launch (and after any CRUD mutation) rather than re-fetched
// per screen — matches the source proposal's "load everything into memory"
// design. Simplest-correct at single-restaurant menu scale; no need for
// granular cache patching.
export const useMenuStore = create<MenuState>((set) => ({
  categories: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true })
    const { categories } = await window.dineiz.menu.getAll()
    set({ categories, loading: false, loaded: true })
  }
}))
