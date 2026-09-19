import { create } from 'zustand';

// The shift's own actions (close it, cash in/out, take a break) live in
// POSTopBar: it owns their dialogs and the checks around them. They were only
// reachable from the avatar menu, which staff don't think to open, so Home
// shows them as buttons too. Those buttons ask the top bar through here
// instead of mounting a second copy of each flow.

export type ShiftAction = 'close' | 'cash' | 'break';

interface ShiftActions {
  request: ShiftAction | null;
  ask: (action: ShiftAction) => void;
  clear: () => void;
}

export const useShiftActions = create<ShiftActions>((set) => ({
  request: null,
  ask: (action) => set({ request: action }),
  clear: () => set({ request: null }),
}));
