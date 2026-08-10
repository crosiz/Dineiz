import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';

export function useFloorPlanSocket(branchId: string, enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const updateTable = useFloorPlanStore(state => state.updateTable);

  useEffect(() => {
    if (!enabled || !branchId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Connect to Socket.IO namespace for POS where table events are emitted
    const socket = io(`${apiUrl}/pos`, {
      path: '/socket.io', // standard socket.io path
      query: { branchId }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket for floor plan real-time updates');
      socket.emit('join_branch', branchId);
    });

    socket.on('order:created', ({ tableId, orderId, status }: any) => {
      if (tableId) {
        updateTable(tableId, { 
          status: 'occupied',
          activeOrderId: orderId,
          occupiedSince: new Date().toISOString()
        });
      }
    });
    
    socket.on('order:completed', ({ tableId }: any) => {
      if (tableId) {
        updateTable(tableId, { 
          status: 'dirty',    // After order done, table needs cleaning
          activeOrderId: undefined,
          occupiedSince: undefined
        });
      }
    });
    
    socket.on('order:cancelled', ({ tableId }: any) => {
      if (tableId) {
        updateTable(tableId, { status: 'available', activeOrderId: undefined });
      }
    });
    
    socket.on('table:status_changed', ({ tableId, status }: any) => {
      updateTable(tableId, { status });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [branchId, enabled, updateTable]);
}
