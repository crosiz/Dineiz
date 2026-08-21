import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  name: string;
  nameUrdu?: string | null;
  sku?: string | null;
  barcode?: string | null;
  category: string;
  unit: string;
  purchaseUnit?: string | null;
  purchaseToBase: number;
  inStock: number;
  minThreshold: number;
  costPerUnit: number;
  stockValue: number;
  status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCKED';
  branches: string[];
  imageUrl?: string | null;
  supplier?: { id: string; name: string } | null;
  supplierName?: string | null;
  shelfLifeDays?: number | null;
  storageType?: string | null;
  isActive: boolean;
}

export interface InventoryStats {
  totalIngredients: number;
  lowStock: number;
  outOfStock: number;
  healthy: number;
  overstocked: number;
  stockValue: number;
  criticalAlerts: string[];
}

export interface InventoryFilterState {
  search: string;
  status: string;
  sortBy: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useInventory() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editIngredient, setEditIngredient] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState('Stock Levels');
  const [filters, setFilters] = useState<InventoryFilterState>({ search: '', status: '', sortBy: '' });
  const queryClient = useQueryClient();

  const { selectedBranchId } = useDashboardContext();

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['inventory'] });

  // ── Summary stats ────────────────────────────────────────────────────────────
  const { data: statsRaw, isLoading: isStatsLoading } = useQuery({
    queryKey: ['inventory', 'summary', selectedBranchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      return apiFetch<{
        total: number; lowStock: number; outOfStock: number; healthy: number;
        overstocked: number; stockValue: number; criticalAlerts: string[];
      }>(`/api/inventory/summary${q.toString() ? '?' + q.toString() : ''}`);
    },
    staleTime: 60_000,
  });

  const stats: InventoryStats = {
    totalIngredients: statsRaw?.total ?? 0,
    lowStock: statsRaw?.lowStock ?? 0,
    outOfStock: statsRaw?.outOfStock ?? 0,
    healthy: statsRaw?.healthy ?? 0,
    overstocked: statsRaw?.overstocked ?? 0,
    stockValue: statsRaw?.stockValue ?? 0,
    criticalAlerts: statsRaw?.criticalAlerts ?? [],
  };

  // ── Ingredients list ──────────────────────────────────────────────────────────
  const { data: ingredientsData, isLoading: isIngredientsLoading, isError: isIngredientsError, refetch: refetchIngredients } = useQuery({
    queryKey: ['inventory', 'ingredients', selectedBranchId, filters],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedBranchId) q.set('branchId', selectedBranchId);
      if (filters.search) q.set('search', filters.search);
      if (filters.status) q.set('status', filters.status);
      if (filters.sortBy) q.set('sortBy', filters.sortBy);
      q.set('limit', '200');
      return apiFetch<{ ingredients: any[]; pagination: any }>(`/api/inventory/ingredients?${q.toString()}`);
    },
    staleTime: 30_000,
  });

  const inventoryList: InventoryItem[] = (ingredientsData?.ingredients ?? []).map((ing: any) => ({
    id: ing.id,
    name: ing.name,
    nameUrdu: ing.nameUrdu,
    sku: ing.sku,
    barcode: ing.barcode,
    category: ing.category ?? 'Uncategorized',
    unit: ing.unit,
    purchaseUnit: ing.purchaseUnit,
    purchaseToBase: ing.purchaseToBase ?? 1,
    inStock: ing.inStock ?? 0,
    minThreshold: ing.minThreshold ?? 0,
    costPerUnit: ing.costPerUnit ?? 0,
    stockValue: ing.stockValue ?? 0,
    status: ing.status ?? 'HEALTHY',
    branches: Array.isArray(ing.branches) ? ing.branches.map((b: any) => (typeof b === 'string' ? b : b.name)) : [],
    imageUrl: ing.imageUrl ?? null,
    supplier: ing.supplier ?? null,
    supplierName: ing.supplierName ?? null,
    shelfLifeDays: ing.shelfLifeDays ?? null,
    storageType: ing.storageType ?? null,
    isActive: ing.isActive ?? true,
  }));

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createIngredient = useMutation({
    mutationFn: (data: any) => apiFetch('/api/inventory/ingredients', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Ingredient added successfully');
      setIsAddModalOpen(false);
    },
    onError: (err: any) => toast.error('Failed to add ingredient', { description: err.message }),
  });

  const updateIngredient = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiFetch(`/api/inventory/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Ingredient updated');
      setEditIngredient(null);
    },
    onError: (err: any) => toast.error('Failed to update ingredient', { description: err.message }),
  });

  const deleteIngredient = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/inventory/ingredients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Ingredient removed');
    },
    onError: (err: any) => toast.error('Failed to remove ingredient', { description: err.message }),
  });

  const adjustStock = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiFetch(`/api/inventory/ingredients/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Stock adjusted');
    },
    onError: (err: any) => toast.error('Failed to adjust stock', { description: err.message }),
  });

  const importCsv = useMutation({
    mutationFn: (csv: string) => apiFetch<{ created: number; errors: string[] }>('/api/inventory/ingredients/import', { method: 'POST', body: JSON.stringify({ csv }) }),
    onSuccess: (res) => {
      invalidateAll();
      if (res.errors.length) toast.warning(`Imported ${res.created} ingredients, ${res.errors.length} row(s) failed`);
      else toast.success(`Imported ${res.created} ingredients`);
    },
    onError: (err: any) => toast.error('Import failed', { description: err.message }),
  });

  const fetchIngredientUsage = async (id: string) => apiFetch<{ itemId: string; itemName: string }[]>(`/api/inventory/ingredients/${id}/usage`);

  return {
    inventoryList,
    stats,
    isLoading: isStatsLoading || isIngredientsLoading,
    isStatsLoading,
    isIngredientsLoading,
    isIngredientsError,
    refetchIngredients,
    isAddModalOpen,
    setIsAddModalOpen,
    editIngredient,
    setEditIngredient,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    createIngredient,
    updateIngredient,
    deleteIngredient,
    adjustStock,
    importCsv,
    fetchIngredientUsage,
  };
}
