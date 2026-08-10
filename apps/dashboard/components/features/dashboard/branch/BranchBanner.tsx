import React from 'react';
import { useUser } from '@/contexts/user-context';

interface BranchBannerProps {
  shift: any;
  branchName?: string;
}

export function BranchBanner({ shift, branchName = 'Branch' }: BranchBannerProps) {
  const { name } = useUser();
  
  // Format current date: Wednesday, April 23 2026
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }).format(new Date());

  const shiftOpenTime = shift?.open && shift.openedAt 
    ? new Date(shift.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <section className="h-[72px] bg-gradient-to-r from-primary-container to-[#FF8A50] rounded-xl flex items-center justify-between px-6 text-white shadow-md">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined bg-white/20 p-1.5 rounded-lg">location_on</span>
        <div>
          <p className="text-xs font-bold opacity-90 uppercase tracking-wider">{branchName}</p>
          <p className="text-sm font-medium">{dateStr}</p>
        </div>
      </div>

      {shift?.open ? (
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold">Open since {shiftOpenTime}</span>
          </div>
          <div className="h-6 w-px bg-white/20"></div>
          {/* Mocked closing time for now, as shift structure might not have it strictly defined yet */}
          <span className="text-sm font-medium opacity-90">Shift Active</span>
        </div>
      ) : (
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-red-100">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span className="text-sm font-semibold">No Shift Open</span>
          </div>
          <button className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors">
            Open Shift
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        {shift?.open && (
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold opacity-80">Current Shift</p>
            <p className="text-sm font-semibold">{shift.openedBy?.name || name || 'Cashier'}</p>
          </div>
        )}
        <button className="px-4 py-2 border border-white/40 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">
          {shift?.open ? 'Change Shift' : 'Manage Shifts'}
        </button>
      </div>
    </section>
  );
}
