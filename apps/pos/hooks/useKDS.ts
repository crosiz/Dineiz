'use client';

/**
 * useKDS.ts
 * Socket.IO client hook for the Kitchen Display System.
 *
 * Connects to the /kds namespace on the API server, joins the branch room,
 * and maintains a reactive order queue that updates in real-time.
 *
 * Initial queue is hydrated via REST (GET /api/kds/orders) on mount,
 * then kept live via WebSocket events from the server.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '@/contexts/SocketContext';
import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface KDSOrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  kdsStatus: 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'VOIDED';
  createdAt?: string;
  item: { name: string; image?: string };
  options?: unknown;
}

export interface KDSOrder {
  id: string;
  orderNumber: string;
  tokenNumber: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: OrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: KDSOrderItem[];
}

export interface UseKDSReturn {
  orders: KDSOrder[];
  isConnected: boolean;
  isLoading: boolean;
  stats: { pending: number; inKitchen: number; ready: number };
  startOrder: (orderId: string) => void;
  bumpOrder: (orderId: string) => void;
  recallOrder: (orderId: string) => void;
  cancelOrder: (orderId: string, reason?: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKDS(branchId: string | null): UseKDSReturn {
  const socketRef = useRef<Socket | null>(null);
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Hydrate queue from REST on mount ────────────────────────────────────
  useEffect(() => {
    if (!branchId) return;
    setIsLoading(true);
    fetch(`${API_URL}/api/kds/orders?branchId=${branchId}`, { 
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
      .then((r) => r.json())
      .then((data: KDSOrder[]) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [branchId]);

  const { kdsSocket, isKdsConnected } = useSocket();

  // ── Socket.IO connection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId || !kdsSocket || !isKdsConnected) return;

    socketRef.current = kdsSocket;
    setIsConnected(true);
    kdsSocket.emit('join_branch', branchId);

    const handleNewOrder = (order: KDSOrder) => {
      setOrders((prev) => {
        // Avoid duplicates if REST already loaded it
        if (prev.some((o) => o.id === order.id)) return prev;
        playAlert();
        return [order, ...prev]; // Newest at the front
      });
    };

    const handleOrderUpdated = (updated: KDSOrder) => {
      setOrders((prev) => {
        // Remove DELIVERED and CANCELLED from the active queue
        if (updated.status === 'DELIVERED' || updated.status === 'CANCELLED' || updated.status === 'COMPLETED') {
          return prev.filter((o) => o.id !== updated.id);
        }
        
        // If it exists, update it. If not, add it.
        if (!prev.some((o) => o.id === updated.id)) {
          playAlert();
          return [updated, ...prev]; // Newest at the front
        }
        
        return prev.map((o) => (o.id === updated.id ? updated : o));
      });
    };

    const handleOrderCancelled = ({ orderId }: { orderId: string }) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    };

    kdsSocket.on('kds:new_order', handleNewOrder);
    kdsSocket.on('kds:order_updated', handleOrderUpdated);
    kdsSocket.on('kds:order_cancelled', handleOrderCancelled);

    return () => {
      kdsSocket.off('kds:new_order', handleNewOrder);
      kdsSocket.off('kds:order_updated', handleOrderUpdated);
      kdsSocket.off('kds:order_cancelled', handleOrderCancelled);
      socketRef.current = null;
    };
  }, [branchId, kdsSocket, isKdsConnected]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const emit = useCallback((event: string, data: object) => {
    socketRef.current?.emit(event, { ...data, branchId });
  }, [branchId]);

  const startOrder  = useCallback((orderId: string) => emit('kds:start_order',  { orderId }), [emit]);
  const bumpOrder   = useCallback((orderId: string) => emit('kds:bump_order',   { orderId }), [emit]);
  const recallOrder = useCallback((orderId: string) => emit('kds:recall_order', { orderId }), [emit]);
  const cancelOrder = useCallback((orderId: string, reason?: string) =>
    emit('kds:cancel_order', { orderId, reason }), [emit]);

  const safeOrders = Array.isArray(orders) ? orders : [];
  
  // ── Derived stats ────────────────────────────────────────────────────────
  const stats = {
    pending:    safeOrders.filter((o) => o.status === 'PENDING').length,
    inKitchen:  safeOrders.filter((o) => o.status === 'IN_KITCHEN').length,
    ready:      safeOrders.filter((o) => o.status === 'READY').length,
  };

  return { orders: safeOrders, isConnected, isLoading, stats, startOrder, bumpOrder, recallOrder, cancelOrder };
}

// ─── Audio alert ─────────────────────────────────────────────────────────────

function playAlert(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* AudioContext blocked by browser policy — user hasn't interacted yet */ }
}
