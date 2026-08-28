import { create } from 'zustand';
import { getDB } from './db';

// ─── Terminal-local settings (spec Part 9) ────────────────────────────────
//
// Per-device, never synced: printer, sound, display, cash drawer, language,
// the terminal's display name. Persisted as one JSON blob in the Dexie
// `keyValue` table so it survives reloads but is invisible to every other
// terminal and to the server. Tenant-wide settings are a separate thing —
// they come from branding and are read-only here.

export interface TerminalSettings {
  terminalName: string;
  language: string;
  // Printer
  printMode: 'PDF' | 'PRINTER';
  paperWidth: '58mm' | '80mm';
  printerName: string;
  // Sound
  soundEnabled: boolean;
  soundVolume: number; // 0–100
  // Display
  fontScale: 'small' | 'normal' | 'large';
  keepAwake: boolean;
  // Cash drawer
  cashDrawerPort: string;
}

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  terminalName: '',
  language: 'en',
  printMode: 'PDF',
  paperWidth: '80mm',
  printerName: '',
  soundEnabled: true,
  soundVolume: 70,
  fontScale: 'normal',
  keepAwake: false,
  cashDrawerPort: '',
};

const KEY = 'terminal_settings';

interface Store {
  settings: TerminalSettings;
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => Promise<void>;
  reset: () => Promise<void>;
}

export const useTerminalSettings = create<Store>((set, get) => ({
  settings: DEFAULT_TERMINAL_SETTINGS,
  loaded: false,
  load: async () => {
    try {
      const row = await getDB().keyValue.get(KEY);
      const parsed = row?.value ? JSON.parse(row.value) : {};
      set({ settings: { ...DEFAULT_TERMINAL_SETTINGS, ...parsed }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  set: async (key, value) => {
    const next = { ...get().settings, [key]: value };
    set({ settings: next });
    try {
      await getDB().keyValue.put({ key: KEY, value: JSON.stringify(next) });
    } catch { /* quota / private mode — the in-memory value still applies this session */ }
  },
  reset: async () => {
    set({ settings: DEFAULT_TERMINAL_SETTINGS });
    try { await getDB().keyValue.delete(KEY); } catch { /* ignore */ }
  },
}));
