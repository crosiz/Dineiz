import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { toast } from 'sonner';

export interface WastageLog {
  id: string;
  date: string;
  ingredientName: string;
  quantityLost: number;
  unit: string;
  reason: string;
  notes: string | null;
  costImpact: number;
  reportedBy: string;
  approvedBy: string | null;
  branchName: string;
  photoUrl: string | null;
}

export interface WastageAnalytics {
  totalCost: number;
  byDay: { date: string; cost: number }[];
  byReason: { reason: string; cost: number }[];
  topIngredients: { name: string; cost: number }[];
  insight: string | null;
}

export const WASTAGE_REASONS = ['EXPIRED', 'SPOILED', 'DROPPED', 'OVER_PREP', 'PEST_DAMAGE', 'POWER_OUTAGE', 'QUALITY_REJECT', 'OTHER'];

export function useWastage() {
  const { selectedBranchId } = useDashboardContext();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory', 'wastage', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      q.set('limit', '100');
      return apiFetch<{ logs: WastageLog[]; pagination: any }>(`/api/inventory/wastage?${q.toString()}`);
    },
    staleTime: 30_000,
  });

  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ['inventory', 'wastage-analytics', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      return apiFetch<WastageAnalytics>(`/api/inventory/wastage/analytics?${q.toString()}`);
    },
    staleTime: 60_000,
  });

  const createWastage = useMutation({
    mutationFn: (data: any) => apiFetch('/api/inventory/wastage', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Wastage logged');
    },
    onError: (err: any) => toast.error('Failed to log wastage', { description: err.message }),
  });

  return {
    logs: data?.logs ?? [],
    isLoading,
    refetch,
    analytics,
    isAnalyticsLoading,
    createWastage,
  };
}
