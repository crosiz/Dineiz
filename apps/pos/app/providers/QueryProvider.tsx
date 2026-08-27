'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // One QueryClient per session — created lazily inside useState to avoid SSR issues
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Fresh for 5 minutes; within that window a revisit renders from
            // cache with no network call — which is every screen switch in a
            // shift. (Left refetchOnMount at its default so a genuinely stale
            // screen still refreshes itself in the background on re-entry.)
            staleTime: 5 * 60 * 1000,
            // Keep unused screen data in memory for 30 min so switching away
            // and back is still a cache hit.
            gcTime: 30 * 60 * 1000,
            // Don't refetch on focus in a POS environment (prevents
            // mid-transaction flashes).
            refetchOnWindowFocus: false,
            // One retry for a network blip; don't hammer a 4xx.
            retry: (count, err: any) => {
              const status = err?.status ?? err?.response?.status;
              if (typeof status === 'number' && status >= 400 && status < 500) return false;
              return count < 1;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
