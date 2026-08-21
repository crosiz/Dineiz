import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { toast } from 'sonner';

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';
  supplier: string;
  items: number;
  amount: number;
  estimatedTotal: number;
  totalActual: number | null;
  date: string;
  expectedDate: string | null;
  receivedDate: string | null;
  branchName: string;
}

export interface PurchaseOrderLine {
  id: string;
  ingredientId: string;
  ingredient: { id: string; name: string; unit: string; purchaseUnit: string | null };
  orderedQty: number;
  receivedQty: number;
  unit: string | null;
  estimatedUnitCost: number;
  actualUnitCost: number | null;
  lineTotal: number | null;
  expiryDate: string | null;
  batchNumber: string | null;
}

export interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  status: PurchaseOrderSummary['status'];
  branchId: string;
  branch: { id: string; name: string };
  supplier: { id: string; name: string; whatsapp: string | null; email: string | null } | null;
  createdAt: string;
  expectedDate: string | null;
  receivedDate: string | null;
  supplierName: string | null;
  estimatedTotal: number;
  totalActual: number | null;
  notes: string | null;
  invoiceNumber: string | null;
  invoiceImageUrl: string | null;
  lines: PurchaseOrderLine[];
}

export function usePurchaseOrders(statusFilter?: string) {
  const { selectedBranchId } = useDashboardContext();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory', 'purchase-orders', selectedBranchId, statusFilter],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      if (statusFilter) q.set('status', statusFilter);
      q.set('limit', '100');
      return apiFetch<{ orders: PurchaseOrderSummary[]; pagination: any }>(`/api/inventory/purchase-orders?${q.toString()}`);
    },
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const createPO = useMutation({
    mutationFn: (data: any) => apiFetch('/api/inventory/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Purchase order created'); },
    onError: (err: any) => toast.error('Failed to create purchase order', { description: err.message }),
  });

  const updatePO = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiFetch(`/api/inventory/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Purchase order updated'); },
    onError: (err: any) => toast.error('Failed to update purchase order', { description: err.message }),
  });

  const sendPO = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/inventory/purchase-orders/${id}/send`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success('Purchase order sent to supplier'); },
    onError: (err: any) => toast.error('Failed to send purchase order', { description: err.message }),
  });

  const cancelPO = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/inventory/purchase-orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => { invalidate(); toast.success('Purchase order cancelled'); },
    onError: (err: any) => toast.error('Failed to cancel purchase order', { description: err.message }),
  });

  const receivePO = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiFetch(`/api/inventory/purchase-orders/${id}/receive`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (res: any) => {
      invalidate();
      if (res?.costVarianceWarnings?.length) {
        toast.warning(`Received — ${res.costVarianceWarnings.length} ingredient(s) had a cost variance over 5%`);
      } else {
        toast.success('Purchase order received');
      }
    },
    onError: (err: any) => toast.error('Failed to receive purchase order', { description: err.message }),
  });

  const autoGeneratePO = useMutation({
    mutationFn: () => apiFetch<any[]>('/api/inventory/purchase-orders/auto', { method: 'POST', body: JSON.stringify({ branchId: selectedBranchId }) }),
    onSuccess: (created) => {
      invalidate();
      toast.success(`${created.length} purchase order(s) auto-generated`);
    },
    onError: (err: any) => toast.error(err.message || 'No items are low on stock'),
  });

  return {
    orders: data?.orders ?? [],
    isLoading,
    refetch,
    createPO,
    updatePO,
    sendPO,
    cancelPO,
    receivePO,
    autoGeneratePO,
  };
}

export function usePurchaseOrderDetail(id: string | null) {
  return useQuery({
    queryKey: ['inventory', 'purchase-order', id],
    queryFn: () => apiFetch<PurchaseOrderDetail>(`/api/inventory/purchase-orders/${id}`),
    enabled: !!id,
  });
}
