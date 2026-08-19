'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { formatPKR } from '@/lib/formatters';
import { Receipt } from 'lucide-react';

export default function ShiftReportPage() {
  const { data: currentShift, isLoading: shiftLoading } = useQuery({
    queryKey: ['shift-report-current'],
    queryFn: () => apiGet<any>('/api/shifts/current'),
  });

  const shiftId = currentShift?.id;

  const { data: shift, isLoading: reportLoading, isError, refetch } = useQuery({
    queryKey: ['reports-shift', shiftId],
    queryFn: () => apiGet<any>('/api/reports/shift', { shiftId }),
    enabled: !!shiftId,
  });

  const isLoading = shiftLoading || (!!shiftId && reportLoading);
  const orders: any[] = shift?.orders || [];
  const netTotal = orders.reduce((sum: number, o: any) => sum + (o.netAmount ?? o.totalAmount ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shift Report</h1>
        <p className="text-slate-500 text-sm mt-1">Orders and totals for your current shift.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>
      ) : !shiftId ? (
        <div className="text-sm text-slate-400 py-12 text-center">No shift is currently open — open a shift to see its report here.</div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-red-500">Couldn't load the shift report.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-[#ff5722] hover:underline">Try again</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Opened</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{shift?.openedAt ? new Date(shift.openedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Orders</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{orders.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Net sales</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{formatPKR(netTotal)}</p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="text-sm text-slate-400 py-12 text-center">No orders placed on this shift yet.</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {orders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Receipt size={15} className="text-slate-300 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{o.orderNumber}</p>
                      <p className="text-xs text-slate-400">{o.table?.name ? `Table ${o.table.name} · ` : ''}{new Date(o.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatPKR(o.netAmount ?? o.totalAmount)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
