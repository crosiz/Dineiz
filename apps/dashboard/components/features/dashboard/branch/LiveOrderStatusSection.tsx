import React from 'react';
import Link from 'next/link';

interface LiveOrderStatusSectionProps {
  counts: {
    pending: number;
    inKitchen: number;
    ready: number;
    dispatched: number;
  };
}

export function LiveOrderStatusSection({ counts }: LiveOrderStatusSectionProps) {
  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
          <h4 className="font-h2 text-h2 text-slate-900 font-semibold text-lg">Live Order Status</h4>
        </div>
        <Link href="/dashboard/orders/live" className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
          View Monitor <span className="material-symbols-outlined text-sm">open_in_new</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100 text-center transition-all duration-300">
          <p className="text-2xl font-black text-amber-600">{counts.pending}</p>
          <p className="text-[10px] font-black text-amber-700 tracking-widest uppercase mt-1">Pending</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-center transition-all duration-300">
          <p className="text-2xl font-black text-blue-600">{counts.inKitchen}</p>
          <p className="text-[10px] font-black text-blue-700 tracking-widest uppercase mt-1">In Kitchen</p>
        </div>
        <div className="p-4 rounded-xl bg-green-50/50 border border-green-100 text-center transition-all duration-300">
          <p className="text-2xl font-black text-emerald-600">{counts.ready}</p>
          <p className="text-[10px] font-black text-emerald-700 tracking-widest uppercase mt-1">Ready</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center transition-all duration-300">
          <p className="text-2xl font-black text-slate-500">{counts.dispatched}</p>
          <p className="text-[10px] font-black text-slate-600 tracking-widest uppercase mt-1">Dispatched</p>
        </div>
      </div>
    </section>
  );
}
