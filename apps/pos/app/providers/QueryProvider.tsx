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
            // Keep data fresh for 5 minutes before considering it stale
            staleTime: 5 * 60 * 1000,
            // Retry once on failure (e.g., brief network blip)
            retry: 1,
            // Don't refetch on window focus in a POS environment (prevents mid-transaction flashes)
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
