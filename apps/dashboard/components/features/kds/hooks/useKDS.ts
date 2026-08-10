'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KdsOrderItem {
  id: string;
  name: string;
  quantity: number;
  variation: string | null;
  addons: string[];
  isReady: boolean;
  stationId: string | null;
}

export interface KdsOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableLabel: string | null;
  token: string | null;
  isRush: boolean;
  isDelayed: boolean;
  isNew: boolean;
  createdAt: string;
  secondsElapsed: number;
  items: KdsOrderItem[];
}

export interface KdsSummary {
  inQueue: number;
  inProgress: number;
  completedToday: number;
  avgPrepTimeSeconds: number;
}

export interface KdsStationInfo {
  id: string;
  name: string;
  orderCount: number;
  color: string;
}

export interface KdsAlert {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'error';
  timestamp: string;
}

export type SocketStatus = 'connected' | 'reconnecting' | 'offline';

// ─── Sorting ──────────────────────────────────────────────────────────────────

function sortOrders(orders: KdsOrder[]): KdsOrder[] {
  return [...orders].sort((a, b) => {
    // Rush first, sorted by elapsed desc
    if (a.isRush && !b.isRush) return -1;
    if (!a.isRush && b.isRush) return 1;
    if (a.isRush && b.isRush) return b.secondsElapsed - a.secondsElapsed;
    // New last, sorted by createdAt asc
    if (a.isNew && !b.isNew) return 1;
    if (!a.isNew && b.isNew) return -1;
    // Regular: elapsed desc (oldest first)
    return b.secondsElapsed - a.secondsElapsed;
  });
}

// ─── Audio chime ──────────────────────────────────────────────────────────────

function playKitchenChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const beep = (startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);
      osc.start(startTime);
      osc.stop(startTime + 0.1);
    };
    beep(ctx.currentTime);
    beep(ctx.currentTime + 0.2);
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

import { KDSSettings } from './useKDSSettings';

export function useKDS(settings?: KDSSettings) {
  const { role, branchId: userBranchId } = useUser();

  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [summary, setSummary] = useState<KdsSummary>({
    inQueue: 0, inProgress: 0, completedToday: 0, avgPrepTimeSeconds: 0,
  });
  const [stations, setStations] = useState<KdsStationInfo[]>([]);
  const [alerts, setAlerts] = useState<KdsAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('reconnecting');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketDisconnectedAtRef = useRef<number | null>(null);

  // ── Resolve branchId ──────────────────────────────────────────────────────
  const { selectedBranchId } = useDashboardContext();
  const branchId = selectedBranchId || userBranchId || '';

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!branchId) return;
    try {
      const params = new URLSearchParams({ branchId });
      if (selectedStationId) params.append('stationId', selectedStationId);
      const data = await apiFetch<{
        orders: KdsOrder[];
        summary: KdsSummary;
        stations: KdsStationInfo[];
        alerts: KdsAlert[];
      }>(`/api/kds/orders?${params}`);

      const now = Date.now();
      const ordersWithElapsed = (data.orders ?? []).map(o => {
        const secondsElapsed = Math.floor((now - new Date(o.createdAt).getTime()) / 1000);
        const minutes = Math.floor(secondsElapsed / 60);
        return {
          ...o,
          secondsElapsed,
          isRush: minutes >= (settings?.rushThreshold ?? 15),
          isDelayed: minutes >= (settings?.rushThreshold ?? 15) + 5,
          isNew: minutes < 1,
        };
      });

      setOrders(sortOrders(ordersWithElapsed));
      setSummary(data.summary ?? { inQueue: 0, inProgress: 0, completedToday: 0, avgPrepTimeSeconds: 0 });
      setStations(data.stations ?? []);
      setAlerts(data.alerts ?? []);
    } catch (err) {
      console.error('[KDS] fetch error', err);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, selectedStationId]);

  // Initial fetch + refetch on station change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Client-side elapsed counter (every second) ────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setOrders(prev =>
        prev.map(o => {
          const secondsElapsed = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000);
          const minutes = Math.floor(secondsElapsed / 60);
          return {
            ...o,
            secondsElapsed,
            isRush: minutes >= (settings?.rushThreshold ?? 15),
            isDelayed: minutes >= (settings?.rushThreshold ?? 15) + 5,
            isNew: minutes < 1,
          };
        }),
      );
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Auto-sort every 30s ───────────────────────────────────────────────────
  useEffect(() => {
    sortTimerRef.current = setInterval(() => {
      setOrders(prev => sortOrders(prev));
    }, 30_000);
    return () => { if (sortTimerRef.current) clearInterval(sortTimerRef.current); };
  }, []);

  // ── Polling fallback ──────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(fetchData, 10_000);
  }, [fetchData]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) return;

    const socket = io(`${API_URL}/kds`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      socketDisconnectedAtRef.current = null;
      stopPolling();
      socket.emit('join_branch', branchId);
    });

    socket.on('disconnect', () => {
      setSocketStatus('reconnecting');
      socketDisconnectedAtRef.current = Date.now();
      offlineTimerRef.current = setTimeout(() => {
        setSocketStatus('offline');
        startPolling();
      }, 30_000);
    });

    socket.on('connect_error', () => {
      setSocketStatus('reconnecting');
      if (!offlineTimerRef.current) {
        socketDisconnectedAtRef.current = Date.now();
        offlineTimerRef.current = setTimeout(() => {
          setSocketStatus('offline');
          startPolling();
        }, 30_000);
      }
    });

    // ── New order ────────────────────────────────────────────────────────────
    socket.on('kds:new_order', (raw: any) => {
      const now = Date.now();
      const secondsElapsed = Math.floor((now - new Date(raw.createdAt).getTime()) / 1000);
      const minutes = Math.floor(secondsElapsed / 60);
      const order: KdsOrder = {
        id: raw.id,
        orderNumber: String(raw.orderNumber ?? raw.id.slice(-3)).replace(/\D/g, '').padStart(3, '0'),
        status: raw.status ?? 'PENDING',
        type: raw.type ?? 'DINE_IN',
        tableLabel: raw.table?.label ?? null,
        token: raw.tokenNumber ?? null,
        isRush: minutes >= (settings?.rushThreshold ?? 15),
        isDelayed: minutes >= (settings?.rushThreshold ?? 15) + 5,
        isNew: minutes < 1,
        createdAt: raw.createdAt,
        secondsElapsed,
        items: (raw.items ?? []).map((oi: any) => ({
          id: oi.id,
          name: oi.item?.name ?? oi.name ?? 'Item',
          quantity: oi.quantity ?? 1,
          variation: oi.options?.variation ?? null,
          addons: Array.isArray(oi.options?.addons) ? oi.options.addons : [],
          isReady: oi.kdsStatus === 'DONE',
          stationId: oi.kdsStationId ?? null,
        })),
      };
      setOrders(prev => sortOrders([order, ...prev]));
      setSummary(prev => ({
        ...prev,
        inQueue: prev.inQueue + 1,
      }));
      playKitchenChime();
    });

    // ── Order updated ────────────────────────────────────────────────────────
    socket.on('kds:order_updated', (raw: any) => {
      const doneStatuses = ['READY', 'DELIVERED', 'CANCELLED', 'COMPLETED'];
      if (doneStatuses.includes(raw.status)) {
        // Fade out then remove
        setRemovingIds(prev => new Set(Array.from(prev).concat(raw.id)));
        setTimeout(() => {
          setOrders(prev => prev.filter(o => o.id !== raw.id));
          setRemovingIds(prev => { const s = new Set(prev); s.delete(raw.id); return s; });
          setSummary(prev => ({
            ...prev,
            completedToday: prev.completedToday + 1,
            inProgress: Math.max(0, prev.inProgress - 1),
          }));
        }, 600);
      } else {
        setOrders(prev => {
          const now = Date.now();
          const secondsElapsed = Math.floor((now - new Date(raw.createdAt).getTime()) / 1000);
          const minutes = Math.floor(secondsElapsed / 60);
          const updatedOrder: KdsOrder = {
            id: raw.id,
              orderNumber: String(raw.orderNumber ?? raw.id.slice(-3)).replace(/\D/g, '').padStart(3, '0'),
              status: raw.status ?? 'PENDING',
              type: raw.type ?? 'DINE_IN',
              tableLabel: raw.table?.label ?? null,
              token: raw.tokenNumber ?? null,
              isRush: minutes >= (settings?.rushThreshold ?? 15),
              isDelayed: minutes >= (settings?.rushThreshold ?? 15) + 5,
              isNew: minutes < 1,
              createdAt: raw.createdAt,
              secondsElapsed,
              items: (raw.items ?? []).map((oi: any) => ({
                id: oi.id,
                name: oi.item?.name ?? oi.name ?? 'Item',
                quantity: oi.quantity ?? 1,
                variation: oi.options?.variation ?? null,
                addons: Array.isArray(oi.options?.addons) ? oi.options.addons : [],
                isReady: oi.kdsStatus === 'DONE',
                stationId: oi.kdsStationId ?? null,
              })),
            };
          if (!prev.some(o => o.id === raw.id)) {
            playKitchenChime();
            return sortOrders([updatedOrder, ...prev]);
          }
          return prev.map(o => o.id === raw.id ? updatedOrder : o);
        });
      }
    });

    // ── Order cancelled ──────────────────────────────────────────────────────
    socket.on('kds:order_cancelled', ({ orderId }: { orderId: string }) => {
      setRemovingIds(prev => new Set(Array.from(prev).concat(orderId)));
      setTimeout(() => {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setRemovingIds(prev => { const s = new Set(prev); s.delete(orderId); return s; });
        setSummary(prev => ({ ...prev, inQueue: Math.max(0, prev.inQueue - 1) }));
      }, 600);
    });

    // ── KDS alert ────────────────────────────────────────────────────────────
    socket.on('kds:alert', (alert: KdsAlert) => {
      setAlerts(prev => [{ ...alert, id: alert.id ?? String(Date.now()) }, ...prev]);
    });

    return () => {
      socket.disconnect();
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      stopPolling();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const markItemReady = useCallback(async (orderId: string, itemId: string) => {
    // Optimistic
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? { ...o, items: o.items.map(it => it.id === itemId ? { ...it, isReady: true } : it) }
          : o,
      ),
    );
    try {
      await apiFetch(`/api/kds/items/${itemId}/ready`, { method: 'PATCH' });
    } catch (err) {
      console.error('[KDS] markItemReady error', err);
      // Rollback on error
      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? { ...o, items: o.items.map(it => it.id === itemId ? { ...it, isReady: false } : it) }
            : o,
        ),
      );
    }
  }, []);

  const markOrderReady = useCallback(async (orderId: string) => {
    // Optimistic fade-out
    setRemovingIds(prev => new Set(Array.from(prev).concat(orderId)));
    // Emit via socket for instant broadcast
    socketRef.current?.emit('kds:bump_order', { orderId, branchId });
    try {
      await apiFetch(`/api/kds/orders/${orderId}/bump`, {
        method: 'PATCH',
        body: JSON.stringify({ branchId }),
      });
      setSummary(prev => ({
        ...prev,
        completedToday: prev.completedToday + 1,
        inProgress: Math.max(0, prev.inProgress - 1),
      }));
    } catch (err) {
      console.error('[KDS] markOrderReady error', err);
      setRemovingIds(prev => { const s = new Set(prev); s.delete(orderId); return s; });
    }
    // Remove after animation regardless
    setTimeout(() => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setRemovingIds(prev => { const s = new Set(prev); s.delete(orderId); return s; });
    }, 600);
  }, [branchId]);

  return {
    orders,
    summary,
    stations,
    alerts,
    isLoading,
    socketStatus,
    removingIds,
    selectedStationId,
    setSelectedStationId,
    markItemReady,
    markOrderReady,
    refetch: fetchData,
  };
}
