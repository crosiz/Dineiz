import { apiFetch } from '../api';

export interface CustomerQuery {
  page?: number;
  limit?: number;
  search?: string;
  segment?: string;
  sortBy?: 'totalSpend' | 'lastVisitAt' | 'totalOrders' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export const getCustomers = async (query?: CustomerQuery) => {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
  }
  return apiFetch(`/api/customers?${params.toString()}`);
};

export const getCustomer = async (id: string) => {
  return apiFetch(`/api/customers/${id}`);
};

export const getCustomerOrders = async (id: string, page = 1, limit = 20) => {
  return apiFetch(`/api/customers/${id}/orders?page=${page}&limit=${limit}`);
};

export const getCustomerLoyalty = async (id: string, page = 1, limit = 50) => {
  return apiFetch(`/api/customers/${id}/loyalty?page=${page}&limit=${limit}`);
};

export const createCustomer = async (data: any) => {
  return apiFetch('/api/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateCustomer = async (id: string, data: any) => {
  return apiFetch(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteCustomer = async (id: string) => {
  return apiFetch(`/api/customers/${id}`, {
    method: 'DELETE',
  });
};

export const addCustomerNote = async (id: string, noteText: string) => {
  return apiFetch(`/api/customers/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ noteText }),
  });
};

export const adjustLoyaltyPoints = async (id: string, points: number, reason: string) => {
  return apiFetch(`/api/customers/${id}/points/adjust`, {
    method: 'POST',
    body: JSON.stringify({ points, reason }),
  });
};

export const lookupCustomer = async (phone: string) => {
  return apiFetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
};
