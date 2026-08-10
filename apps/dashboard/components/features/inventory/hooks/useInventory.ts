import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  inStock: number;
  minThreshold: number;
  status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  branches: string[];
  imageUrl?: string | null;
}

export interface PurchaseOrder {
  id: string;
  status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  supplier: string;
  items: number;
  amount: string;
  date: string;
  branchName: string;
}

export interface WastageLog {
  id: string;
  date: string;
  ingredientName: string;
  quantityLost: number;
  unit: string;
  reason: string;
  reportedBy: string;
  branchName: string;
}

export interface InventoryStats {
  totalIngredients: number;
  lowStock: number;
  outOfStock: number;
  healthy: number;
  criticalAlerts: string[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useInventory() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Stock Levels');
  const queryClient = useQueryClient();

  // Branch from global context
  const { selectedBranchId } = useDashboardContext();

  // ── Summary stats ────────────────────────────────────────────────────────────
  const { data: statsRaw, isLoading: isStatsLoading } = useQuery({
    queryKey: ['inventory', 'summary', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      return apiFetch<{
        total: number;
        lowStock: number;
        outOfStock: number;
        healthy: number;
        criticalAlerts: string[];
      }>(`/api/inventory/summary${q.toString() ? '?' + q.toString() : ''}`);
    },
    staleTime: 60_000,
  });

  // Map backend field `total` → frontend field `totalIngredients`
  const stats: InventoryStats = {
    totalIngredients: statsRaw?.total ?? 0,
    lowStock: statsRaw?.lowStock ?? 0,
    outOfStock: statsRaw?.outOfStock ?? 0,
    healthy: statsRaw?.healthy ?? 0,
    criticalAlerts: statsRaw?.criticalAlerts ?? [],
  };

  // ── Ingredients list ──────────────────────────────────────────────────────────
  const { data: ingredientsData, isLoading: isIngredientsLoading } = useQuery({
    queryKey: ['inventory', 'ingredients', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      return apiFetch<{ ingredients: any[]; pagination: any }>(
        `/api/inventory/ingredients${q.toString() ? '?' + q.toString() : ''}`
      );
    },
    staleTime: 60_000,
  });

  // Map backend shape → frontend InventoryItem
  const inventoryList: InventoryItem[] = (ingredientsData?.ingredients ?? []).map((ing: any) => ({
    id: ing.id,
    name: ing.name,
    category: ing.category ?? 'Uncategorized',
    unit: ing.unit,
    inStock: ing.inStock ?? ing.currentStock ?? 0,
    minThreshold: ing.minThreshold ?? 0,
    status: ing.status ?? 'HEALTHY',
    branches: Array.isArray(ing.branches)
      ? ing.branches.map((b: any) => (typeof b === 'string' ? b : b.name))
      : [],
    imageUrl: ing.imageUrl ?? null,
  }));

  // ── Purchase orders ──────────────────────────────────────────────────────────
  const { data: posData, isLoading: isPOsLoading } = useQuery({
    queryKey: ['inventory', 'purchase-orders', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      return apiFetch<{ orders: PurchaseOrder[]; pagination: any }>(
        `/api/inventory/purchase-orders${q.toString() ? '?' + q.toString() : ''}`
      );
    },
    staleTime: 60_000,
  });

  // ── Wastage logs ──────────────────────────────────────────────────────────────
  const { data: wastageData, isLoading: isWastageLoading } = useQuery({
    queryKey: ['inventory', 'wastage', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      return apiFetch<{ logs: WastageLog[]; pagination: any }>(
        `/api/inventory/wastage${q.toString() ? '?' + q.toString() : ''}`
      );
    },
    staleTime: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createIngredient = useMutation({
    mutationFn: (data: any) =>
      apiFetch('/api/inventory/ingredients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Ingredient added successfully');
      setIsAddModalOpen(false);
    },
    onError: (err: any) => {
      toast.error('Failed to add ingredient', { description: err.message });
    },
  });

  const adjustStock = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/api/inventory/ingredients/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock adjusted');
    },
    onError: (err: any) => {
      toast.error('Failed to adjust stock', { description: err.message });
    },
  });

  const receivePO = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/purchase-orders/${id}/receive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId })
      });
      if (!res.ok) throw new Error('Failed to receive PO');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Purchase order received');
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryStats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });

  const autoGeneratePO = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/inventory/purchase-orders/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to auto-generate PO');
      return data;
    },
    onSuccess: () => {
      toast.success('Auto-generated PO created');
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const createWastage = useMutation({
    mutationFn: (data: any) =>
      apiFetch('/api/inventory/wastage', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Wastage logged');
    },
    onError: (err: any) => {
      toast.error('Failed to log wastage', { description: err.message });
    },
  });

  return {
    inventoryList,
    stats,
    recentPOs: posData?.orders ?? [],
    wastageLogs: wastageData?.logs ?? [],
    isLoading: isStatsLoading || isIngredientsLoading || isPOsLoading || isWastageLoading,
    isStatsLoading,
    isIngredientsLoading,
    isAddModalOpen,
    setIsAddModalOpen,
    activeTab,
    setActiveTab,
    createIngredient,
    adjustStock,
    receivePO,
    autoGeneratePO,
    createWastage,
  };
}
