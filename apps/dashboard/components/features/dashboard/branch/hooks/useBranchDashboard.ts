import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/contexts/user-context';

export function useBranchDashboard() {
  const { user } = useUser() as any;
  const { branchId: contextBranchId } = useUser();
  const branchId = user?.branchId || contextBranchId;

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-summary', branchId],
    queryFn: () => apiGet<any>('/api/analytics/dashboard-summary', {
      ...(branchId ? { branchId } : {}),
      period: 'today'
    }),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const [liveCounts, setLiveCounts] = useState({
    pending: 0, inKitchen: 0, ready: 0, dispatched: 0,
  });

  useEffect(() => {
    if (kpis) {
      setLiveCounts({
        pending: kpis.pendingOrders || 0,
        inKitchen: kpis.inKitchenOrders || 0,
        ready: kpis.readyOrders || 0,
        dispatched: kpis.dispatchedOrders || 0,
      });
    }
  }, [kpis]);

  return {
    branchId, shift, kpis, tableData, heatmap,
    recentOrders: recentOrdersData?.orders ?? [],
    liveCounts,
    isLoadingKpis: isLoadingKpis || !branchId,
    isLoadingOrders,
    isLoadingHeatmap,
  };
}
