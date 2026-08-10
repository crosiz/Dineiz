import { useDashboardContext } from '@/contexts/dashboard-context';

export function useBranchFilter() {
  const { selectedBranchId, selectedBranchName } = useDashboardContext();

  return {
    branchId: selectedBranchId,
    branchName: selectedBranchName,
    isAllBranches: !selectedBranchId,
    queryParam: selectedBranchId ? `branchId=${selectedBranchId}` : '',
  };
}
