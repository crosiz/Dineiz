import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

export interface Supplier {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  paymentTerms?: string | null;
  deliveryDays: string[];
  minOrderValue?: number | null;
  rating?: number | null;
  notes?: string | null;
  isActive: boolean;
}

export function useSuppliers() {
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => apiFetch<Supplier[]>('/api/inventory/suppliers'),
    staleTime: 60_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });

  const createSupplier = useMutation({
    mutationFn: (data: Partial<Supplier>) => apiFetch<Supplier>('/api/inventory/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Supplier added'); },
    onError: (err: any) => toast.error('Failed to add supplier', { description: err.message }),
  });

  const updateSupplier = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Supplier> }) => apiFetch<Supplier>(`/api/inventory/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Supplier updated'); },
    onError: (err: any) => toast.error('Failed to update supplier', { description: err.message }),
  });

  const deleteSupplier = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/inventory/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success('Supplier removed'); },
    onError: (err: any) => toast.error('Failed to remove supplier', { description: err.message }),
  });

  return { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier };
}
