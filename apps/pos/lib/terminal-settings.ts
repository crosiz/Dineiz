import { create } from 'zustand';
import { getDB } from './db';

// ─── Terminal-local settings (spec Part 9) ────────────────────────────────
//
// Per-device, never synced: printer, sound, keep-awake, and the terminal's
// display name. Persisted as one JSON blob in the Dexie `keyValue` table so it
// survives reloads but is invisible to every other terminal and to the server.
// Tenant-wide settings are a separate thing — they come from branding and are
// read-only here.
//
// Every field here is consumed somewhere: printMode / paperWidth in
// print.service.ts, soundEnabled / soundVolume by the KDS chime, keepAwake by
// POSLayout's Wake Lock, terminalName on the KOT header. A setting that nothing
// reads doesn't belong in this file.

export interface TerminalSettings {
  terminalName: string;
  // Printer
  printMode: 'PDF' | 'PRINTER';
  paperWidth: '58mm' | '80mm';
  // Sound
  soundEnabled: boolean;
  soundVolume: number; // 0–100
  // Display
  keepAwake: boolean;
}

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  terminalName: '',
  printMode: 'PDF',
  paperWidth: '80mm',
  soundEnabled: true,
  soundVolume: 70,
  keepAwake: false,
};

const KEY = 'terminal_settings';

interface Store {
  settings: TerminalSettings;
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => Promise<void>;
  reset: () => Promise<void>;
}

// One in-flight load shared by every caller. `load()` is async (IndexedDB) but
// consumers like print.service.ts read the store synchronously at the moment
// they act — before it resolves they'd see DEFAULT_TERMINAL_SETTINGS and, for
// example, print a PDF on a terminal configured for a thermal printer. Anything
// that must not run on defaults awaits `ensureTerminalSettings()` first.
let loadPromise: Promise<void> | null = null;

export const useTerminalSettings = create<Store>((set, get) => ({
  settings: DEFAULT_TERMINAL_SETTINGS,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const row = await getDB().keyValue.get(KEY);
        const parsed = row?.value ? JSON.parse(row.value) : {};
        set({ settings: { ...DEFAULT_TERMINAL_SETTINGS, ...parsed }, loaded: true });
      } catch {
        set({ loaded: true });
      } finally {
        loadPromise = null;
      }
    })();
    return loadPromise;
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

/**
 * Resolve the terminal's real settings, loading them from IndexedDB the first
 * time. Await this before any decision that would be wrong on defaults —
 * printing above all, where the default (PDF) silently overrides a terminal
 * configured for a thermal printer if the read hasn't landed yet.
 */
export async function ensureTerminalSettings(): Promise<TerminalSettings> {
  const s = useTerminalSettings.getState();
  if (!s.loaded) await s.load();
  return useTerminalSettings.getState().settings;
}
