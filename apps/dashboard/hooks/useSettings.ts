import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiFetch, API_URL } from '@/lib/api';

export function useSettings(tenantId?: string) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let socket: Socket | null = null;
    let mounted = true;

    const fetchInitial = async () => {
      try {
        const data = await apiFetch<any>('/api/settings');
        if (mounted) {
          setSettings(data);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchInitial();

    if (tenantId) {
      socket = io(API_URL || 'http://localhost:3001', {
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        socket?.emit('join_tenant', tenantId);
      });

      socket.on('tenant:settings_updated', (newSettings) => {
        if (mounted) {
          setSettings((prev: any) => {
            if (!prev) return newSettings;
            // The API payload has nested fields (general, pos, etc.)
            // so we deep merge or just shallow merge if it's the whole settings object
            return { ...prev, ...newSettings };
          });
        }
      });
      
      socket.on('tenant:branding_updated', (newBranding) => {
        if (mounted) {
          setSettings((prev: any) => {
            if (!prev) return prev;
            return { ...prev, branding: { ...prev.branding, ...newBranding } };
          });
        }
      });
    }

    return () => {
      mounted = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [tenantId]);

  return { settings, setSettings, loading, error };
}
