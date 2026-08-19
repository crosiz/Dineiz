import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// NOTE: selectedBranchId has been removed from here.
// Branch context is now managed by DashboardContext (contexts/dashboard-context.tsx),
// which persists to sessionStorage under 'dineiz_branch_ctx'.

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  // True once persist has finished reading localStorage. Sidebar.tsx used to
  // track its own separate "mounted" flag and read/write the same
  // localStorage key manually on top of this — two sources of truth for the
  // same value, racing on every load, which is what caused the collapsed
  // sidebar to render expanded (with the full wordmark logo) for a moment
  // before snapping to collapsed. This flag is now the single source of
  // truth for "is it safe to trust sidebarCollapsed yet".
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      hasHydrated: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'dineiz_sidebar_collapsed',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
