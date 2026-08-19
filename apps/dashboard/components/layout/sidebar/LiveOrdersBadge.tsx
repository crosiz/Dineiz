'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL } from '@/lib/api';
import { io, Socket } from 'socket.io-client';

export function LiveOrdersBadge({ branchId }: { branchId?: string }) {
  const queryClient = useQueryClient();
  const [socketRef, setSocketRef] = useState<Socket | null>(null);

  const { data, isLoading } = useQuery<{ count: number }>({
    queryKey: ['active-orders-count', branchId],
    queryFn: () => {
      const url = branchId 
        ? `/api/orders/active-count?branchId=${branchId}` 
        : `/api/orders/active-count`;
      return apiFetch(url);
    },
    refetchInterval: 60000, // fallback polling
  });

  useEffect(() => {
    if (!branchId) return;

    // Connect to order namespace
    const socket = io(`${API_URL}/orders`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    setSocketRef(socket);

    socket.on('connect', () => {
      socket.emit('join_branch', branchId);
    });

    // Invalidate count on order updates
    const handleOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['active-orders-count', branchId] });
    };

    socket.on('order:created', handleOrderEvent);
    socket.on('order:status_changed', handleOrderEvent);

    return () => {
      socket.off('order:created', handleOrderEvent);
      socket.off('order:status_changed', handleOrderEvent);
      socket.disconnect();
    };
  }, [branchId, queryClient]);

  const count = data?.count || 0;

  if (isLoading || count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#FF5722] text-white text-[10px] font-bold shadow-sm">
      {count > 99 ? '99+' : count}
    </span>
  );
}
