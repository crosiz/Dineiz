'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// Lightweight branch list for dropdowns/selectors (BranchSelector,
// branch-select.tsx, MenuPage, ReportConfigPanel, AddIngredientPanel, etc.)
// This intentionally shares the ['branches'] query key with the richer
// hook in components/features/branches/hooks/useBranches.ts — same
// endpoint, same cached response, just a thinner `select`. staleTime here
// matches that hook's refetchInterval so the two don't fight over how
// often the shared cache entry refetches.
export interface Branch {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
  colorHex: string;
  initial: string;
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      return await apiFetch<{ branches: Branch[] }>('/api/branches');
    },
    select: (data: any) => data?.branches ?? [],
    staleTime: 60 * 1000,
    retry: 2,
  });
}
