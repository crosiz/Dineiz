'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

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
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
