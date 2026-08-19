'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api';

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/unread`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCount(data?.count ?? 0);
      }
    } catch {
      // silently fail — non-critical
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={() => toast.info('Notification center is coming soon')}
      title="Notifications"
      className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors rounded-lg hover:bg-slate-100"
    >
      {/* Bell icon */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
      </svg>
      {count > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white" style={{ background: '#ef4444' }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
