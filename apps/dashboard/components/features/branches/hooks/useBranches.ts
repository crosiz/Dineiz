import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';


export interface BranchStats {
  todayRevenue: number;
  todayOrders: number;
  isCurrentlyOpen: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  openingTime: string | null;
  closingTime: string | null;
  isActive: boolean;
  colorHex: string | null;
  initial: string | null;
  imageUrl: string | null;
  branchCode: string | null;
  stats: BranchStats;
}

export interface BranchesSummary {
  total: number;
  active: number;
  inactive: number;
  primaryCity: string;
}

export interface BranchesResponse {
  branches: Branch[];
  summary: BranchesSummary;
}

export function useBranches() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<BranchesResponse>({
    queryKey: ['branches'],
    queryFn: () => apiFetch('/api/branches'),
    refetchInterval: 60000, // refresh every 60 seconds
    staleTime: 30000
  });


  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return apiFetch(`/api/branches/${id}/toggle-status`, {
        method: 'PUT',
        body: '{}'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    }
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/api/branches/${id}`, {
        method: 'DELETE',
        body: '{}'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    }
  });

  const addBranchMutation = useMutation({
    mutationFn: async (newBranch: any) => {
      return apiFetch(`/api/branches`, {
        method: 'POST',
        body: JSON.stringify(newBranch)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    }
  });

  const updateBranchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return apiFetch(`/api/branches/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    }
  });

  return {
    branches: data?.branches || [],
    summary: data?.summary || { total: 0, active: 0, inactive: 0, primaryCity: 'N/A' },
    isLoading,
    error,
    refetch,
    toggleStatusMutation,
    deleteBranchMutation,
    addBranchMutation,
    updateBranchMutation
  };
}
