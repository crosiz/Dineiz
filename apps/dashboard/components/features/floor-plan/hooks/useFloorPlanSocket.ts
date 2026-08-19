import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';

export function useFloorPlanSocket(branchId: string, enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const updateTable = useFloorPlanStore(state => state.updateTable);

  useEffect(() => {
    if (!enabled || !branchId) return;

    // Connect to Socket.IO namespace for POS where table events are emitted
    const socket = io(`${API_URL}/pos`, {
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
    
    // No 'order:completed' listener here — the backend never emitted it (see
    // audit), and order completion already flips the table to 'free' via the
    // 'table:status_changed' handler below (emitTableStatusChanged, fired
    // from handleUpdateOrder). Adding a second, competing emit for the same
    // transition would race against that already-correct path rather than
    // fill a real gap.

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
