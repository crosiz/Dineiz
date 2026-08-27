import { create } from 'zustand';

/**
 * Drives the single global navigation progress bar
 * (components/NavigationProgress.tsx).
 *
 * `start()` is called the instant a screen change begins — a bottom-nav tap,
 * a `router.push` from the top bar / a card, or a back/forward. `done()` fires
 * once the new screen has painted. Every screen shares this one indicator, so
 * no screen renders its own screen-entry spinner.
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

/** Non-hook accessor for event handlers / history patches. */
export const navProgress = {
  start: () => useNavProgress.getState().start(),
  done: () => useNavProgress.getState().done(),
};
