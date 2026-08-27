import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// Fleet reads share the app-wide React Query cache (see components/providers.tsx)
// like every other screen, so revisiting the page is a cache hit. Deliveries
// still poll every 10s because that view tracks riders live.
export function useDeliveries(branchId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['fleet', 'deliveries', branchId ?? null] as const;
  const { data, error } = useQuery<any>({
    queryKey,
    queryFn: () => apiFetch<any>(`/api/fleet/deliveries?branchId=${branchId}`),
    enabled: !!branchId,
    refetchInterval: 10_000,
  });

  return {
    deliveries: data || [],
    isLoading: !!branchId && !error && !data,
    isError: error,
    mutate: () => queryClient.invalidateQueries({ queryKey: ['fleet', 'deliveries'] }),
  };
}

export function useRiders(branchId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['fleet', 'riders', branchId ?? null] as const;
  const { data, error } = useQuery<any>({
    queryKey,
    queryFn: () => apiFetch<any>(`/api/fleet/riders/dashboard?branchId=${branchId}`),
    enabled: !!branchId,
  });

  return {
    riders: data || [],
    isLoading: !!branchId && !error && !data,
    isError: error,
    mutate: () => queryClient.invalidateQueries({ queryKey: ['fleet', 'riders'] }),
  };
}

export async function assignRiderToOrder(orderId: string, riderId: string) {
  return apiFetch(`/api/fleet/deliveries/${orderId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ riderId }),
  });
}

export async function updateDeliveryStatus(orderId: string, status: string) {
  return apiFetch(`/api/fleet/deliveries/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}
