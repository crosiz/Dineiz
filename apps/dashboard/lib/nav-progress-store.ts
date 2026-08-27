import { create } from 'zustand';

/**
 * Drives the single global navigation progress bar (see
 * components/layout/NavigationProgress.tsx).
 *
 * `start()` is called the instant a client navigation begins — from a sidebar
 * click, a `router.push` in a card/row/breadcrumb, or a browser back/forward.
 * `done()` is called once the new route has painted. Every screen shares this
 * one indicator, so no page renders its own page-entry spinner any more.
 *
 * `token` bumps on every `start()` so a slow/stale safety timeout can tell
 * whether the navigation it was watching is still the current one.
 */
interface NavProgressState {
  active: boolean;
  token: number;
  start: () => void;
  done: () => void;
}

export const useNavProgress = create<NavProgressState>((set) => ({
  active: false,
  token: 0,
  start: () => set((s) => ({ active: true, token: s.token + 1 })),
  done: () => set({ active: false }),
}));

/** Non-hook accessor for call sites outside React (event handlers, patches). */
export const navProgress = {
  start: () => useNavProgress.getState().start(),
  done: () => useNavProgress.getState().done(),
};
