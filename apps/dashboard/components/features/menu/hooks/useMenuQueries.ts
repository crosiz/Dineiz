import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { menuApi, UpdateItemDto } from '@/lib/api/menu';

// ─── Categories ──────────────────────────────────────────────────────────────

export function useCategories(tenantId: string, branchId?: string | null) {
  return useQuery({
    queryKey: ['menu', 'categories', tenantId, branchId],
    queryFn: () => menuApi.getCategories(tenantId, branchId),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuApi.createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
      toast.success('Category created');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      menuApi.updateCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
      toast.success('Category updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useToggleCategoryAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: { isAvailable: boolean; branchId?: string | null } }) =>
      menuApi.toggleCategoryAvailability(categoryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
      toast.success('Category availability updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
      toast.success('Category deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? e.message),
  });
}

// ─── Items ───────────────────────────────────────────────────────────────────

export function useMenuItems(params: {
  tenantId: string;
  categoryId?: string;
  search?: string;
  isAvailable?: boolean;
  branchId?: string | null;
}) {
  return useQuery({
    queryKey: ['menu', 'items', params],
    queryFn: () => menuApi.getItems(params),
    enabled: !!params.tenantId,
    staleTime: 30_000,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuApi.createItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateItemDto }) =>
      menuApi.updateItem(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
      toast.success('Item updated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
      toast.success('Item deleted');
    },
    onError: () => toast.error('Failed to delete item'),
  });
}

export function useToggleAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable, branchId }: { id: string; isAvailable: boolean; branchId?: string | null }) =>
      menuApi.toggleAvailability(id, isAvailable, branchId),
    onMutate: async ({ id, isAvailable }) => {
      await qc.cancelQueries({ queryKey: ['menu', 'items'] });
      const snapshots: [any, any][] = [];
      qc.getQueriesData({ queryKey: ['menu', 'items'] }).forEach(([key, data]: any) => {
        snapshots.push([key, data]);
        qc.setQueryData(key, (old: any) =>
          Array.isArray(old) ? old.map((i: any) => (i.id === id ? { ...i, isAvailable } : i)) : old
        );
      });
      return { snapshots };
    },
    onError: (_e, _v, ctx: any) => {
      ctx?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
      toast.error('Failed to update availability');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
    },
  });
}

export function useDuplicateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuApi.duplicateItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
      qc.invalidateQueries({ queryKey: ['menu', 'categories'] });
      toast.success('Item duplicated');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Variations ──────────────────────────────────────────────────────────────

export function useVariations(itemId: string) {
  return useQuery({
    queryKey: ['menu', 'variations', itemId],
    queryFn: () => menuApi.getVariations(itemId),
    enabled: !!itemId,
  });
}

export function useCreateVariation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { name: string; price: number } }) =>
      menuApi.createVariation(itemId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['menu', 'variations', vars.itemId] });
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteVariation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteVariation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'variations'] });
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Add-ons ─────────────────────────────────────────────────────────────────

export function useAddOns(itemId: string) {
  return useQuery({
    queryKey: ['menu', 'addons', itemId],
    queryFn: () => menuApi.getAddOns(itemId),
    enabled: !!itemId,
  });
}

export function useCreateAddOn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { name: string; price: number } }) =>
      menuApi.createAddOn(itemId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['menu', 'addons', vars.itemId] });
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteAddOn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: menuApi.deleteAddOn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', 'addons'] });
      qc.invalidateQueries({ queryKey: ['menu', 'items'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Publish ─────────────────────────────────────────────────────────────────

export function usePublishMenu() {
  return useMutation({
    mutationFn: ({ tenantId, params }: { tenantId: string; params?: { sourceBranchId: string; branchIds: string[] } }) =>
      menuApi.publishMenu(tenantId, params),
    onSuccess: (data: any) =>
      toast.success(`Menu published to ${data.syncedChannels ?? 0} branch(es)`),
    onError: (e: any) => toast.error(e.message),
  });
}
