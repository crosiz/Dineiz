'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export function OrderTimeline({ order }: { order: any }) {
  // Mock timeline events if not provided by backend
  // A real implementation would map order.history
  const events = [
    { title: 'Order Created', time: order.createdAt, detail: `By ${order.cashierName || 'System'}` },
    { title: 'Sent to Kitchen', time: new Date(new Date(order.createdAt).getTime() + 2 * 60000).toISOString(), detail: 'KDS Terminal 1' },
  ];

  if (['READY', 'COMPLETED', 'DELIVERED', 'SERVED'].includes(order.status)) {
    events.push({ title: 'Marked Ready', time: new Date(new Date(order.createdAt).getTime() + 15 * 60000).toISOString(), detail: 'By Kitchen Staff' });
  }

  if (['COMPLETED', 'DELIVERED', 'SERVED'].includes(order.status)) {
    events.push({ title: 'Completed', time: order.updatedAt, detail: 'Order finalized' });
  }

  return (
    <div>
      <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-6">Order History</h3>
      <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
        
        {events.map((evt, idx) => (
          <div key={idx} className="relative flex items-center gap-4 pl-8">
            <div className="absolute left-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center z-10">
              <CheckCircle2 size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{evt.title}</p>
              <p className="text-xs text-slate-500">
                {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(evt.time))} • {evt.detail}
              </p>
            </div>
          </div>
        ))}
        
        {!['COMPLETED', 'DELIVERED', 'SERVED'].includes(order.status) && (
          <div className="relative flex items-center gap-4 pl-8 opacity-50">
            <div className="absolute left-0 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center z-10">
              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400">Completed</p>
              <p className="text-xs text-slate-400">Pending...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
