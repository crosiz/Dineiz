import { apiFetch, API_URL } from '@/lib/api';

export interface CreateItemDto {
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string;
  basePrice: number;
  isAvailable?: boolean;
  variations?: Array<{ name: string; price: number }>;
  addOns?: Array<{ name: string; price: number }>;
  tags?: string[];
  branchId?: string | null;
}

export interface UpdateItemDto {
  categoryId?: string;
  name?: string;
  description?: string;
  basePrice?: number;
  isAvailable?: boolean;
  variations?: Array<{ name: string; price: number }>;
  addOns?: Array<{ name: string; price: number }>;
  tags?: string[];
}

export const menuApi = {

  // ─── Categories ─────────────────────────────────────────────────────────────

  getCategories: (tenantId: string, branchId?: string | null) => {
    const query = new URLSearchParams({ tenantId });
    if (branchId) query.append('branchId', branchId);
    return apiFetch(`/api/v1/menu/categories?${query.toString()}`);
  },

  createCategory: (data: { tenantId: string; name: string; description?: string; branchId?: string | null }) =>
    apiFetch(`/api/v1/menu/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (categoryId: string, data: { name?: string; description?: string }) =>
    apiFetch(`/api/v1/menu/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleCategoryAvailability: (categoryId: string, data: { isAvailable: boolean; branchId?: string | null }) =>
    apiFetch(`/api/v1/menu/categories/${categoryId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCategory: (categoryId: string) =>
    apiFetch(`/api/v1/menu/categories/${categoryId}`, { method: 'DELETE' }),

  reorderCategories: (tenantId: string, ids: string[]) =>
    apiFetch(`/api/v1/menu/categories/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ tenantId, ids }),
    }),

  // ─── Items ──────────────────────────────────────────────────────────────────

  getItems: (params: {
    tenantId: string;
    categoryId?: string;
    search?: string;
    isAvailable?: boolean;
    branchId?: string | null;
  }) => {
    const query = new URLSearchParams();
    query.append('tenantId', params.tenantId);
    if (params.categoryId) query.append('categoryId', params.categoryId);
    if (params.search) query.append('search', params.search);
    if (params.isAvailable !== undefined) query.append('isAvailable', String(params.isAvailable));
    if (params.branchId) query.append('branchId', params.branchId);
    return apiFetch(`/api/v1/menu/items?${query.toString()}`);
  },

  getItem: (itemId: string) =>
    apiFetch(`/api/v1/menu/items/${itemId}`),

  createItem: (data: CreateItemDto) =>
    apiFetch(`/api/v1/menu/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateItem: (itemId: string, data: UpdateItemDto) =>
    apiFetch(`/api/v1/menu/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteItem: (itemId: string) =>
    apiFetch(`/api/v1/menu/items/${itemId}`, { method: 'DELETE' }),

  duplicateItem: async (itemId: string) => {
    // Fetch original then create a copy
    const item = await apiFetch<any>(`/api/v1/menu/items/${itemId}`);
    return apiFetch(`/api/v1/menu/items`, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: item.tenantId,
        categoryId: item.categoryId,
        name: `${item.name} (Copy)`,
        description: item.description,
        basePrice: item.basePrice,
        isAvailable: item.isAvailable,
        variations: item.variations?.map((v: any) => ({ name: v.name, price: v.price })),
        addOns: item.addOns?.map((a: any) => ({ name: a.name, price: a.price })),
      }),
    });
  },

  toggleAvailability: (itemId: string, isAvailable: boolean, branchId?: string | null) =>
    apiFetch(`/api/v1/menu/items/${itemId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable, branchId }),
    }),

  uploadImage: (itemId: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return fetch(`${API_URL}/api/v1/menu/items/${itemId}/image`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      return r.json();
    });
  },

  deleteImage: (itemId: string) =>
    apiFetch(`/api/v1/menu/items/${itemId}/image`, { method: 'DELETE' }),

  // ─── Variations ─────────────────────────────────────────────────────────────

  getVariations: (itemId: string) =>
    apiFetch(`/api/v1/menu/items/${itemId}/variations`),

  createVariation: (itemId: string, data: { name: string; price: number }) =>
    apiFetch(`/api/v1/menu/items/${itemId}/variations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateVariation: (variationId: string, data: { name?: string; price?: number }) =>
    apiFetch(`/api/v1/menu/variations/${variationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteVariation: (variationId: string) =>
    apiFetch(`/api/v1/menu/variations/${variationId}`, { method: 'DELETE' }),

  // ─── Add-ons ────────────────────────────────────────────────────────────────

  getAddOns: (itemId: string) =>
    apiFetch(`/api/v1/menu/items/${itemId}/addons`),

  createAddOn: (itemId: string, data: { name: string; price: number }) =>
    apiFetch(`/api/v1/menu/items/${itemId}/addons`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAddOn: (addOnId: string, data: { name?: string; price?: number }) =>
    apiFetch(`/api/v1/menu/addons/${addOnId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAddOn: (addOnId: string) =>
    apiFetch(`/api/v1/menu/addons/${addOnId}`, { method: 'DELETE' }),

  // ─── Publish ────────────────────────────────────────────────────────────────

  publishMenu: (tenantId: string, params?: { sourceBranchId: string; branchIds: string[] }) =>
    apiFetch(`/api/v1/menu/publish`, {
      method: 'POST',
      body: JSON.stringify({ tenantId, ...params }),
    }),

  // ─── AI Description ─────────────────────────────────────────────────────────

  generateAIDescription: async (
    itemName: string,
    categoryName: string,
    onChunk?: (chunk: string) => void
  ) => {
    const response = await fetch(`${API_URL}/api/v1/menu/ai/description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName, categoryName }),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to generate description');
    }
    const data = await response.json();
    if (onChunk) onChunk(data.description);
    return data as { description: string };
  },

  // ─── Bulk Upload ─────────────────────────────────────────────────────────────

  bulkUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_URL}/api/v1/menu/bulk-upload`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Upload failed');
      return json as { created: number; failed: number; errors: Array<{ row: number; message: string }> };
    });
  },
};
