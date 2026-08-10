'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePrinter } from '@/hooks/usePrinter';

export default function PosStatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  const { status: printerStatus, deviceName: printerName } = usePrinter();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <footer className="bg-surface-container-highest dark:bg-[#15181a] border-t border-outline-variant h-[36px] fixed bottom-0 w-full z-50 flex items-center justify-between px-4 text-[12px] font-medium text-on-surface-variant">
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1.5 ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isOnline ? 'System Online' : 'System Offline (Saving Locally)'}</span>
        </div>
        <div className="w-px h-3 bg-outline-variant"></div>
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">print</span>
          <span>{printerStatus === 'ready' ? `Printer: ${printerName}` : 'No Printer'}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">receipt_long</span>
          <span>47 Orders Today</span>
        </div>
        <div className="w-px h-3 bg-outline-variant"></div>
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">timer</span>
          <span>Shift Time: 02:34:12</span>
        </div>
      </div>
    </footer>
  );
}
