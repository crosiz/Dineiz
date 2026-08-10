'use client';

import { useRouter } from 'next/navigation';
import { clearPosSession, getPosSession } from '@/lib/pos-session';
import { useBranding } from '@/hooks/useBranding';
import { useEffect, useState } from 'react';

interface QuickMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickMenu({ isOpen, onClose }: QuickMenuProps) {
  const router = useRouter();
  const branding = useBranding();
  const [session, setSession] = useState(getPosSession());

  useEffect(() => {
    if (isOpen) {
      setSession(getPosSession());
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  const handleLogOut = () => {
    clearPosSession();
    router.replace('/login');
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.3)] border-t border-surface-border animate-in slide-in-from-bottom-full duration-300 max-h-[80vh] flex flex-col">
        <div className="w-full flex justify-center py-3" onClick={onClose}>
          <div className="w-16 h-1.5 bg-surface-border rounded-full cursor-pointer hover:bg-muted transition-colors" />
        </div>
        
        <div className="p-6 pt-2 pb-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Quick Settings</h2>
            {session && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Current Shift:</span>
                <span className="text-sm font-semibold text-[var(--pos-orange)]">{session.name}</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button 
              onClick={() => handleAction(() => router.push('/pos/tables'))}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-surface-border/30 border border-surface-border hover:bg-surface-border hover:border-[var(--pos-orange)] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-[var(--pos-orange)] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">table_restaurant</span>
              </div>
              <span className="font-medium text-foreground">View Table Map</span>
            </button>
            
            <button 
              onClick={() => handleAction(() => console.log('Print Test Receipt'))}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-surface-border/30 border border-surface-border hover:bg-surface-border hover:border-[var(--pos-orange)] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-[var(--pos-orange)] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">receipt_long</span>
              </div>
              <span className="font-medium text-foreground">Print Test Receipt</span>
            </button>

            <button 
              onClick={() => handleAction(() => console.log('Today Summary'))}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-surface-border/30 border border-surface-border hover:bg-surface-border hover:border-[var(--pos-orange)] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-[var(--pos-orange)] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">query_stats</span>
              </div>
              <span className="font-medium text-foreground">Today's Summary</span>
            </button>

            <button 
              onClick={() => handleAction(() => console.log('Sync Menu'))}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-surface-border/30 border border-surface-border hover:bg-surface-border hover:border-[var(--pos-orange)] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-[var(--pos-orange)] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">sync</span>
              </div>
              <span className="font-medium text-foreground">Sync Menu</span>
            </button>

            <button 
              onClick={() => handleAction(() => router.push('/pos/shift/close'))}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">lock_clock</span>
              </div>
              <span className="font-medium text-red-500">Close Shift</span>
            </button>

            <button 
              onClick={() => handleAction(handleLogOut)}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-surface-border/30 border border-surface-border hover:bg-surface-border hover:border-muted transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-muted group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">logout</span>
              </div>
              <span className="font-medium text-foreground">Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

