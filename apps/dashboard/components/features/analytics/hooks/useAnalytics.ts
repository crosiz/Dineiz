import { useQuery } from '@tanstack/react-query';
import { useAnalyticsStore } from '../store/analyticsStore';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { apiGet } from '@/lib/api-client';

export function useAnalytics() {
  const { startDate, endDate, autoRefreshInterval } = useAnalyticsStore();
  const { branchId } = useBranchFilter();

  const queryResult = useQuery({
    queryKey: ['analytics', 'dashboard', startDate, endDate, branchId],
    queryFn: async () => {
      const qs = new URLSearchParams({ startDate, endDate });
      if (branchId) qs.append('branchId', branchId);
      
      const res = await apiGet(`/api/analytics/dashboard?${qs.toString()}`);
      return res as any;
    },
    refetchInterval: autoRefreshInterval > 0 ? autoRefreshInterval * 60 * 1000 : false,
    staleTime: 5 * 60 * 1000
  });

  return queryResult;
}
