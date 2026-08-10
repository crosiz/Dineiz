import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// NOTE: selectedBranchId has been removed from here.
// Branch context is now managed by DashboardContext (contexts/dashboard-context.tsx),
// which persists to sessionStorage under 'swiftserve_branch_ctx'.

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: 'swiftserve_sidebar_collapsed',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
