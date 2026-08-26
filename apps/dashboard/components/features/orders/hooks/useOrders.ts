import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { apiFetch, API_URL } from '@/lib/api';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface HistoryOrder {
  id: string;
  orderNumber: string;
  dateTime: string;
  branchName: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  customerName: string | null;
  tableLabel: string | null;
  token: string | null;
  itemCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  paymentMethod: string;
  source: string;
  cashierName: string;
  waiterName: string | null;
}

export interface HistoryResponse {
  orders: HistoryOrder[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  summary: { totalRevenue: number; totalOrders: number };
}

function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (preset === 'today') return { dateFrom: fmt(today), dateTo: fmt(today) };
  if (preset === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { dateFrom: fmt(y), dateTo: fmt(y) };
  }
  if (preset === '7d') {
    const d = new Date(today); d.setDate(d.getDate() - 6);
    return { dateFrom: fmt(d), dateTo: fmt(today) };
  }
  if (preset === '30d') {
    const d = new Date(today); d.setDate(d.getDate() - 29);
    return { dateFrom: fmt(d), dateTo: fmt(today) };
  }
  if (preset === 'custom') return { dateFrom: customFrom, dateTo: customTo };
  return { dateFrom: fmt(today), dateTo: fmt(today) };
}

export function useOrders() {
  const { role, tenantId } = useUser();
  const isBranchManager = role === 'BRANCH_MANAGER';
  const qc = useQueryClient();

  // Read the global branch context — single source of truth
  const { selectedBranchId } = useDashboardContext();

  // ── Filter state ──────────────────────────────────────────────────────────────
  const [page, setPageState] = useState(1);
  const [limit, setLimitState] = useState(25);
  const [search, setSearchRaw] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [waiterId, setWaiterId] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPageState(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const setPage = useCallback((p: number) => setPageState(p), []);
  const setLimit = useCallback((l: number) => { setLimitState(l); setPageState(1); }, []);

  // ── Build query params ────────────────────────────────────────────────────────
  const { dateFrom, dateTo } = getDateRange(datePreset, customFrom, customTo);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (searchDebounced) params.set('search', searchDebounced);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  // Use global context branch (null = all branches)
  if (selectedBranchId) params.set('branchId', selectedBranchId);
  if (typeFilter) params.set('type', typeFilter);
  if (statusFilter) params.set('status', statusFilter);
  if (paymentFilter) params.set('paymentMethod', paymentFilter);
  if (sourceFilter) params.set('source', sourceFilter);
  if (cashierId) params.set('cashierId', cashierId);
  if (waiterId) params.set('waiterId', waiterId);

  const queryKey = ['order-history', page, limit, searchDebounced, dateFrom, dateTo, selectedBranchId, typeFilter, statusFilter, paymentFilter, sourceFilter, cashierId, waiterId];

  const { data, isLoading, isFetching, isError, refetch } = useQuery<HistoryResponse>({
    queryKey,
    queryFn: () => apiFetch<HistoryResponse>(`/api/orders/history?${params.toString()}`),
    staleTime: 1000 * 60 * 2, // 2 minutes (respect global default or explicit here)
  });

  // ── Live refresh ──────────────────────────────────────────────────────────────
  // Without this, a payment collected on the POS updates the KPI tiles
  // (tenant-admin-dashboard.tsx listens for the same events) but this list
  // sits on its cached page for up to the 2-minute staleTime above — a
  // manager watching Order History would not see a table flip to COMPLETED
  // until they manually refresh. Same namespace/room convention as
  // useKDS.ts and tenant-admin-dashboard.tsx.
  useEffect(() => {
    const socket = io(`${API_URL}/kds`, { withCredentials: true, transports: ['websocket', 'polling'] });
    const invalidate = () => qc.invalidateQueries({ queryKey: ['order-history'] });

    socket.on('connect', () => {
      if (selectedBranchId) socket.emit('join_branch', selectedBranchId);
      else if (role === 'TENANT_ADMIN' && tenantId) socket.emit('join_tenant', tenantId);
    });
    socket.on('kds:new_order', invalidate);
    socket.on('kds:order_updated', invalidate);
    socket.on('kds:order_cancelled', invalidate);
    socket.on('dashboard:stats_updated', invalidate);

    return () => { socket.disconnect(); };
  }, [selectedBranchId, role, tenantId, qc]);

  // ── Reverse / cancel order ────────────────────────────────────────────────────
  const reverseOrder = useCallback(async (orderId: string) => {
    await apiFetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    qc.invalidateQueries({ queryKey: ['order-history'] });
  }, [qc]);

  const clearFilters = useCallback(() => {
    setSearchRaw(''); setSearchDebounced('');
    setDatePreset('today'); setCustomFrom(''); setCustomTo('');
    setTypeFilter(''); setStatusFilter(''); setPaymentFilter(''); setSourceFilter('');
    setCashierId('');
    setWaiterId('');
    setPageState(1);
  }, []);

  const hasActiveFilters = !!(searchDebounced || typeFilter || statusFilter || paymentFilter || sourceFilter || cashierId || waiterId || datePreset !== 'today');

  return {
    orders: data?.orders ?? [],
    pagination: data?.pagination ?? { total: 0, page: 1, limit, totalPages: 0 },
    summary: data?.summary ?? { totalRevenue: 0, totalOrders: 0 },
    isLoading,
    isFetching,
    isError,
    refetch,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch: setSearchRaw,
    datePreset,
    setDatePreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    sourceFilter,
    setSourceFilter,
    cashierId,
    setCashierId,
    waiterId,
    setWaiterId,
    isBranchManager,
    hasActiveFilters,
    clearFilters,
    reverseOrder,
    // for Export — fetch all pages
    buildExportParams: () => {
      const p = new URLSearchParams(params);
      p.set('limit', '99999'); p.set('page', '1');
      return p.toString();
    },
  };
}
