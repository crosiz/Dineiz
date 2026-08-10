'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/SocketContext';
import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type OrderStatus = 'PENDING' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  itemName?: string;
  name?: string;
  quantity: number;
}

export interface POSOrder {
  id: string;
  orderNumber: string;
  tokenNumber: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: OrderStatus;
  createdAt: string;
  netAmount?: number;
  totalAmount?: number;
  total?: number;
  items: OrderItem[];
}

export function useActiveOrders(branchId: string | null) {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['activeOrders', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const res = await fetch(`${API_URL}/api/orders/live?branchId=${branchId}`, { 
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      return data.orders as POSOrder[];
    },
    enabled: !!branchId,
    refetchInterval: 30000,
  });

  const { kdsSocket: socket, isKdsConnected } = useSocket();

  useEffect(() => {
    if (!branchId || !socket || !isKdsConnected) return;

    socket.emit('join_branch', branchId);

    const handleNewOrder = (order: POSOrder) => {
      queryClient.setQueryData(['activeOrders', branchId], (old: POSOrder[] | undefined) => {
        if (!old) return [order];
        if (old.some(o => o.id === order.id)) return old;
        return [order, ...old];
      });
    };

    const handleOrderUpdated = (order: POSOrder) => {
      queryClient.setQueryData(['activeOrders', branchId], (old: POSOrder[] | undefined) => {
        if (!old) return [];
        if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
          return old.filter(o => o.id !== order.id);
        }
        return old.map(o => o.id === order.id ? order : o);
      });
    };

    const handleOrderCancelled = ({ orderId }: { orderId: string }) => {
      queryClient.setQueryData(['activeOrders', branchId], (old: POSOrder[] | undefined) => {
        if (!old) return [];
        return old.filter(o => o.id !== orderId);
      });
    };

    socket.on('kds:new_order', handleNewOrder);
    socket.on('kds:order_updated', handleOrderUpdated);
    socket.on('kds:order_cancelled', handleOrderCancelled);

    return () => {
      socket.off('kds:new_order', handleNewOrder);
      socket.off('kds:order_updated', handleOrderUpdated);
      socket.off('kds:order_cancelled', handleOrderCancelled);
    };
  }, [branchId, queryClient, socket, isKdsConnected]);

  return { orders, isLoading, refresh: refetch };
}
