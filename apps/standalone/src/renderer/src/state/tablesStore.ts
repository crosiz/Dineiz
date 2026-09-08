import { create } from 'zustand'

type FloorPlan = Awaited<ReturnType<typeof window.dineiz.tables.getAll>>
type Floor = FloorPlan['floors'][number]

interface TablesState {
  floors: Floor[]
  loading: boolean
  loaded: boolean
  refresh: () => Promise<void>
}

// Same "load once, refresh after any mutation" pattern as menuStore — table
// occupancy changes constantly (every order lifecycle event touches it), so
// every screen reading it must call refresh() when it becomes visible, not
// just once at launch the way the menu can get away with.
export const useTablesStore = create<TablesState>((set) => ({
  floors: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true })
    const { floors } = await window.dineiz.tables.getAll()
    set({ floors, loading: false, loaded: true })
  }
}))
