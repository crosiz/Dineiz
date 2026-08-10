import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SOUND_PREF_KEY = 'swiftserve_sound_pref';

export interface LiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableLabel: string | null;
  token: string | null;
  customerName: string | null;
  items: Array<{ name: string; qty: number; variation: string | null }>;
  total: number;
  cashierName: string;
  branchName: string;
  branchId: string;
  createdAt: string;
  completedAt?: string;
  minutesElapsed: number;
}

export interface LiveSummary {
  todayOrderCount: number;
  todayRevenue: number;
  avgPrepTime: number;
  inProgressCount: number;
}

type SocketStatus = 'connected' | 'reconnecting' | 'offline';

// ─── Web Audio chime ──────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useOrderMonitor() {
  const { role, branchId: userBranchId, tenantId } = useUser();
  const isBranchManager = role === 'BRANCH_MANAGER';

  // ── State ────────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [summary, setSummary] = useState<LiveSummary>({
    todayOrderCount: 0, todayRevenue: 0, avgPrepTime: 0, inProgressCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('reconnecting');
  const [soundOn, setSoundOnState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_PREF_KEY);
    return stored === null ? true : stored === 'true';
  });

  // ── Filters ──────────────────────────────────────────────────────────────────
  // Read from global context — no local branch state
  const { selectedBranchId } = useDashboardContext();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      const data = await apiFetch<{ orders: LiveOrder[]; summary: LiveSummary }>(
        `/api/orders/live${params.toString() ? '?' + params.toString() : ''}`,
      );
      setOrders(data.orders ?? []);
      setSummary(data.summary ?? { todayOrderCount: 0, todayRevenue: 0, avgPrepTime: 0, inProgressCount: 0 });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[Live Orders] fetch error', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  // ── Initial fetch + 30s polling ───────────────────────────────────────────────
  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, 30_000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  // ── Sound toggle persistence ──────────────────────────────────────────────────
  const setSoundOn = useCallback((val: boolean) => {
    setSoundOnState(val);
    localStorage.setItem(SOUND_PREF_KEY, String(val));
  }, []);

  // ── Socket.IO ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(`${API_URL}/kds`, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      // Join rooms
      if (selectedBranchId) socket.emit('join_branch', selectedBranchId);
      else if (userBranchId) socket.emit('join_branch', userBranchId);
      else if (role === 'TENANT_ADMIN' && tenantId) socket.emit('join_tenant', tenantId);
    });

    socket.on('disconnect', () => {
      setSocketStatus('reconnecting');
      offlineTimerRef.current = setTimeout(() => setSocketStatus('offline'), 10_000);
    });

    socket.on('connect_error', () => {
      setSocketStatus('reconnecting');
      if (!offlineTimerRef.current) {
        offlineTimerRef.current = setTimeout(() => setSocketStatus('offline'), 10_000);
      }
    });

    // ── new order ──────────────────────────────────────────────────────────────
    socket.on('kds:new_order', (order: any) => {
      const mapped: LiveOrder = {
        id: order.id,
        orderNumber: String(order.orderNumber || order.id.slice(-4)).padStart(3, '0'),
        status: order.status ?? 'PENDING',
        type: order.type ?? 'DINE_IN',
        tableLabel: order.table?.label ?? null,
        token: order.tokenNumber ?? null,
        customerName: null,
        items: (order.items || []).map((it: any) => ({
          name: it.item?.name ?? it.name ?? 'Item',
          qty: it.quantity,
          variation: null,
        })),
        total: order.netAmount ?? 0,
        cashierName: order.shift?.user?.name ?? 'N/A',
        branchName: order.branch?.name ?? '',
        branchId: order.branchId,
        createdAt: order.createdAt,
        minutesElapsed: 0,
      };
      setOrders(prev => [mapped, ...prev]);
      setSummary(prev => ({
        ...prev,
        todayOrderCount: prev.todayOrderCount + 1,
        inProgressCount: prev.inProgressCount + 1,
      }));
      setLastUpdated(new Date());
      if (soundRef.current) playChime();
    });

    // ── order updated ──────────────────────────────────────────────────────────
    socket.on('kds:order_updated', (order: any) => {
      setOrders(prev =>
        prev.map(o =>
          o.id === order.id ? { ...o, status: order.status ?? o.status } : o,
        ),
      );
      setSummary(prev => {
        const isNowComplete = ['DELIVERED', 'CANCELLED'].includes(order.status);
        return {
          ...prev,
          inProgressCount: Math.max(0, prev.inProgressCount + (isNowComplete ? -1 : 0)),
          todayRevenue: order.status === 'DELIVERED'
            ? prev.todayRevenue + (order.netAmount ?? 0)
            : prev.todayRevenue,
        };
      });
      setLastUpdated(new Date());
    });

    // ── order cancelled ────────────────────────────────────────────────────────
    socket.on('kds:order_cancelled', ({ orderId }: { orderId: string }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setSummary(prev => ({ ...prev, inProgressCount: Math.max(0, prev.inProgressCount - 1) }));
      setLastUpdated(new Date());
    });

    return () => {
      socket.disconnect();
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, userBranchId, tenantId, role]);

  // ── Update minutesElapsed every 60s ──────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setOrders(prev =>
        prev.map(o => ({
          ...o,
          minutesElapsed: Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000),
        })),
      );
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // ── updateOrderStatus via REST + socket ───────────────────────────────────────
  const updateOrderStatus = useCallback(async (orderId: string, newStatus: string) => {
    // Optimistic
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    try {
      await apiFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to update status', err);
      fetchOrders(); // rollback via refetch
    }
  }, [fetchOrders]);

  return {
    orders,
    summary,
    isLoading,
    lastUpdated,
    socketStatus,
    soundOn,
    setSoundOn,
    selectedBranchId,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    isBranchManager,
    updateOrderStatus,
    refetch: fetchOrders,
  };
}
