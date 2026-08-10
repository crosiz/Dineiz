import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

const fetcher = (url: string) => apiFetch(url);

export function useDeliveries(branchId?: string) {
  const { data, error, mutate } = useSWR(
    branchId ? `/api/fleet/deliveries?branchId=${branchId}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  return {
    deliveries: data || [],
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useRiders(branchId?: string) {
  const { data, error, mutate } = useSWR(
    branchId ? `/api/fleet/riders/dashboard?branchId=${branchId}` : null,
    fetcher
  );

  return {
    riders: data || [],
    isLoading: !error && !data,
    isError: error,
    mutate,
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
