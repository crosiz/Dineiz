'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null; // Defaults to POS namespace for backward compatibility
  posSocket: Socket | null;
  kdsSocket: Socket | null;
  isConnected: boolean;
  isKdsConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  posSocket: null,
  kdsSocket: null,
  isConnected: false,
  isKdsConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [posSocket, setPosSocket] = useState<Socket | null>(null);
  const [kdsSocket, setKdsSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isKdsConnected, setIsKdsConnected] = useState(false);

  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = typeof window !== 'undefined' ? localStorage.getItem('pos_token') : null;

    // Connect to /pos namespace
    const posInstance = io(`${SOCKET_URL}/pos`, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    posInstance.on('connect', () => setIsConnected(true));
    posInstance.on('disconnect', () => setIsConnected(false));
    setPosSocket(posInstance);

    // Connect to /kds namespace
    const kdsInstance = io(`${SOCKET_URL}/kds`, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    kdsInstance.on('connect', () => setIsKdsConnected(true));
    kdsInstance.on('disconnect', () => setIsKdsConnected(false));
    setKdsSocket(kdsInstance);

    return () => {
      posInstance.disconnect();
      kdsInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socket: posSocket, // Alias for backward compatibility 
      posSocket, 
      kdsSocket, 
      isConnected,
      isKdsConnected
    }}>
      {children}
    </SocketContext.Provider>
  );
}
