import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { toast } from 'sonner';

export interface CountLine {
  id: string;
  ingredientId: string;
  ingredient: { id: string; name: string; unit: string; costPerUnit: number };
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  varianceValue: number | null;
  notes: string | null;
}

export interface CountSession {
  id: string;
  countNumber: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  countType: 'FULL' | 'PARTIAL' | 'SPOT';
  startedByName: string;
  totalVarianceValue: number | null;
  itemsCounted: number;
  itemsWithVariance: number;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  lines: CountLine[];
  branch?: { id: string; name: string };
}

export function useCounts() {
  const { selectedBranchId } = useDashboardContext();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['inventory', 'counts', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      return apiFetch<CountSession[]>(`/api/inventory/counts?${q.toString()}`);
    },
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'counts'] });

  const startCount = useMutation({
    mutationFn: (data: { branchId: string; countType: 'FULL' | 'PARTIAL' | 'SPOT'; categories?: string[]; ingredientIds?: string[] }) =>
      apiFetch<CountSession>('/api/inventory/counts/start', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Physical count started'); },
    onError: (err: any) => toast.error('Failed to start count', { description: err.message }),
  });

  const updateLine = useMutation({
    mutationFn: ({ sessionId, ingredientId, countedQty, notes }: { sessionId: string; ingredientId: string; countedQty: number; notes?: string }) =>
      apiFetch(`/api/inventory/counts/${sessionId}/line`, { method: 'PUT', body: JSON.stringify({ ingredientId, countedQty, notes }) }),
    onSuccess: () => invalidate(),
    onError: (err: any) => toast.error('Failed to save count', { description: err.message }),
  });

  const completeCount = useMutation({
    mutationFn: ({ sessionId, notes }: { sessionId: string; notes?: string }) =>
      apiFetch(`/api/inventory/counts/${sessionId}/complete`, { method: 'POST', body: JSON.stringify({ notes }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Count applied — stock levels updated');
    },
    onError: (err: any) => toast.error('Failed to complete count', { description: err.message }),
  });

  const cancelCount = useMutation({
    mutationFn: (sessionId: string) => apiFetch(`/api/inventory/counts/${sessionId}/cancel`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success('Count cancelled'); },
    onError: (err: any) => toast.error('Failed to cancel count', { description: err.message }),
  });

  return { sessions, isLoading, refetch, startCount, updateLine, completeCount, cancelCount };
}

export function useCountDetail(id: string | null) {
  return useQuery({
    queryKey: ['inventory', 'count', id],
    queryFn: () => apiFetch<CountSession>(`/api/inventory/counts/${id}`),
    enabled: !!id,
    refetchInterval: 5000,
  });
}
