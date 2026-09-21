'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Module-level singleton, not per-render state: this is a pure client app (no
// server-side prefetching into the cache), so one instance for the tab's
// whole lifetime is safe — and lib/sync-queue.ts needs a stable reference it
// can import directly to invalidate queries after a background sync, outside
// of any React component.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
