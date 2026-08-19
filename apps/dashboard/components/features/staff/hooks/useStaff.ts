import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

import { useDashboardContext } from '@/contexts/dashboard-context';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  branch: { id: string; name: string } | null;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  lastActiveAt: string | null;
  avatarInitials: string;
  avatarColor: string;
  hasPin: boolean;
}

export interface StaffSummary {
  total: number;
  activeNow: number;
  managers: number;
  pendingInvites: number;
}

interface StaffFilters {
  branchId?: string;
  role?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

export function useStaff(initialFilters: Partial<StaffFilters> = {}) {
  const queryClient = useQueryClient();
  const { selectedBranchId } = useDashboardContext();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filters, setFilters] = useState<StaffFilters>({
    page: 1,
    limit: 10,
    ...initialFilters
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['staff', 'summary', selectedBranchId, filters.branchId],
    queryFn: async () => {
      const q = new URLSearchParams();
      const activeBranchId = selectedBranchId || filters.branchId;
      if (activeBranchId && activeBranchId !== 'All Branches') q.set('branchId', activeBranchId);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return apiFetch<StaffSummary>(`/api/staff/summary${qs}`);
    }
  });

  const { data: staffData, isLoading: isStaffLoading, isError: isStaffError, refetch: refetchStaff } = useQuery({
    queryKey: ['staff', 'list', selectedBranchId, filters],
    queryFn: async () => {
      const q = new URLSearchParams();
      const activeBranchId = selectedBranchId || filters.branchId;
      if (activeBranchId && activeBranchId !== 'All Branches') q.set('branchId', activeBranchId);
      if (filters.role && filters.role !== 'All Roles') q.set('role', filters.role);
      if (filters.status && filters.status !== 'All Status') q.set('status', filters.status);
      if (filters.search) q.set('search', filters.search);
      q.set('page', filters.page.toString());
      q.set('limit', filters.limit.toString());
      
      return apiFetch<{ staff: StaffMember[], pagination: any }>(`/api/staff?${q.toString()}`);
    }
  });

  const createStaff = useMutation({
    mutationFn: (data: any) => apiFetch('/api/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member created successfully');
      setIsAddModalOpen(false);
    },
    onError: (error: any) => {
      toast.error('Failed to create staff member', { description: error.message });
    }
  });

  const updateStaff = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => apiFetch(`/api/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update staff member', { description: error.message });
    }
  });

  const toggleStatus = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/staff/${id}/toggle-status`, {
      method: 'PUT',
      body: '{}'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Status updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update status', { description: error.message });
    }
  });

  const deleteStaff = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/staff/${id}`, {
      method: 'DELETE',
      body: '{}'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete staff member', { description: error.message });
    }
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/staff/${id}/resend-invite`, {
      method: 'PUT',
      body: '{}'
    }),
    onSuccess: () => {
      toast.success('Invite email resent');
    },
    onError: (error: any) => {
      toast.error('Failed to resend invite', { description: error.message });
    }
  });

  const resetPin = useMutation({
    mutationFn: ({ id, newPin }: { id: string, newPin: string }) => apiFetch(`/api/staff/${id}/reset-pin`, {
      method: 'PUT',
      body: JSON.stringify({ newPin })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('PIN reset successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to reset PIN', { description: error.message });
    }
  });

  return {
    staffList: staffData?.staff || [],
    pagination: staffData?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 },
    stats: stats || { total: 0, activeNow: 0, managers: 0, pendingInvites: 0 },
    isLoading: isStatsLoading || isStaffLoading,
    isError: isStaffError,
    refetch: refetchStaff,
    filters,
    setFilters,
    isAddModalOpen,
    setIsAddModalOpen,
    createStaff,
    updateStaff,
    toggleStatus,
    deleteStaff,
    resetPin,
    resendInvite
  };
}
