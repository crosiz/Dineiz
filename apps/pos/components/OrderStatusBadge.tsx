'use client';

import { useState, useEffect } from 'react';

// Shared with TicketsDashboard so an order looks the same wherever it's
// shown — previously Home rendered a stripped-down chip with none of this
// signal while Tickets showed the full picture for the exact same order.

export const TicketTimer = ({ createdAt }: { createdAt: string }) => {
  const [timeStr, setTimeStr] = useState('');
  const [colorClass, setColorClass] = useState('text-green-500 bg-green-500/10 border-green-500/20');
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const update = () => {
      const ms = Date.now() - new Date(createdAt).getTime();
      const totalMins = Math.max(0, Math.floor(ms / 60000));
      if (totalMins < 60) {
        setTimeStr(`${totalMins}m`);
      } else {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        setTimeStr(`${h}h ${m}m`);
      }

      if (totalMins < 15) {
        setColorClass('text-green-500 bg-green-500/10 border-green-500/20');
        setPulse(false);
      } else if (totalMins < 30) {
        setColorClass('text-orange-500 bg-orange-500/10 border-orange-500/20');
        setPulse(false);
      } else {
        setColorClass('text-red-500 bg-red-500/10 border-red-500/20');
        setPulse(true);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-bold tracking-wide shrink-0 ${colorClass} ${pulse ? 'animate-pulse' : ''}`}>
      <span className="material-symbols-outlined text-[14px]">schedule</span>
      {timeStr}
    </div>
  );
};

export const StatusBadge = ({ status }: { status: string }) => {
  let color = 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  let label = status;
  let icon = '';

  switch (status) {
    case 'PENDING':
      color = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      icon = 'pending_actions';
      break;
    case 'IN_KITCHEN':
      color = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      icon = 'local_fire_department';
      label = 'IN KITCHEN';
      break;
    case 'READY':
      color = 'bg-green-500/10 text-green-500 border-green-500/20';
      icon = 'check_circle';
      break;
    case 'BILL_REQUESTED':
      color = 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      icon = 'receipt_long';
      label = 'BILL REQUESTED';
      break;
  }

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold tracking-wider shrink-0 ${color}`}>
      {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
      {label}
    </div>
  );
};
