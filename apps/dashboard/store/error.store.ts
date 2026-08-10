'use client';

import { create } from 'zustand';

interface ErrorStore {
  errorCount: number;
  /** Only call for UNRECOVERABLE errors — not retryable query failures */
  addError: (message?: string) => void;
  incrementError: () => void; // kept for backward compat
  clearErrors: () => void;
}

export const useErrorStore = create<ErrorStore>((set) => ({
  errorCount: 0,
  addError: () => set((state) => ({ errorCount: state.errorCount + 1 })),
  incrementError: () => set((state) => ({ errorCount: state.errorCount + 1 })),
  clearErrors: () => set({ errorCount: 0 }),
}));
