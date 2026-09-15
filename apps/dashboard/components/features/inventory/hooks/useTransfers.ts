import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { toast } from 'sonner';

export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface TransferLine {
  id: string;
  ingredientId: string;
  ingredient: { id: string; name: string; unit: string; purchaseUnit: string | null };
  requestedQty: number;
  dispatchedQty: number | null;
  receivedQty: number | null;
  unit: string | null;
}

export interface Transfer {
  id: string;
  transferNumber: string;
  status: TransferStatus;
  fromBranchId: string;
  toBranchId: string;
  fromBranch: { id: string; name: string };
  toBranch: { id: string; name: string };
  requestedByName: string;
  notes: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  lines: TransferLine[];
}

export function useTransfers(statusFilter?: string) {
  const { selectedBranchId } = useDashboardContext();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory', 'transfers', selectedBranchId, statusFilter],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      if (statusFilter) q.set('status', statusFilter);
      return apiFetch<Transfer[]>(`/api/inventory/transfers${q.toString() ? '?' + q.toString() : ''}`);
    },
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] });

  const createTransfer = useMutation({
    mutationFn: (data: { fromBranchId: string; toBranchId: string; notes?: string; lines: { ingredientId: string; requestedQty: number; unit?: string }[] }) =>
      apiFetch('/api/inventory/transfers', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Transfer created'); },
    onError: (err: any) => toast.error('Failed to create transfer', { description: err.message }),
  });

  const dispatchTransfer = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { lines: { ingredientId: string; dispatchedQty: number }[] } }) =>
      apiFetch(`/api/inventory/transfers/${id}/dispatch`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Transfer dispatched'); },
    onError: (err: any) => toast.error('Failed to dispatch transfer', { description: err.message }),
  });

  const receiveTransfer = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { lines: { ingredientId: string; receivedQty: number }[] } }) =>
      apiFetch(`/api/inventory/transfers/${id}/receive`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Transfer received'); },
    onError: (err: any) => toast.error('Failed to receive transfer', { description: err.message }),
  });

  const cancelTransfer = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/inventory/transfers/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success('Transfer cancelled'); },
    onError: (err: any) => toast.error('Failed to cancel transfer', { description: err.message }),
  });

  return {
    transfers: data ?? [],
    isLoading,
    isError,
    refetch,
    createTransfer,
    dispatchTransfer,
    receiveTransfer,
    cancelTransfer,
  };
}

export function useTransferDetail(id: string | null) {
  return useQuery({
    queryKey: ['inventory', 'transfer', id],
    queryFn: () => apiFetch<Transfer>(`/api/inventory/transfers/${id}`),
    enabled: !!id,
  });
}

/** Ingredient stock at a specific branch, independent of the dashboard's globally selected branch — used
 * so the transfer/dispatch pickers always show accurate availability for the branch actually being acted on. */
export function useBranchIngredientStock(branchId: string | null) {
  return useQuery({
    queryKey: ['inventory', 'ingredients', branchId],
    queryFn: async () => {
      const q = new URLSearchParams({ branchId: branchId!, limit: '200' });
      const res = await apiFetch<{ ingredients: any[]; pagination: any }>(`/api/inventory/ingredients?${q.toString()}`);
      return res.ingredients ?? [];
    },
    enabled: !!branchId,
    staleTime: 30_000,
  });
}
