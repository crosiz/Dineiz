'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/contexts/user-context';
import { apiGet } from '@/lib/api-client';
import { formatPKR } from '@/lib/formatters';
import { Receipt } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodaysReportPage() {
  const { branchId } = useUser();
  const date = todayISO();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports-daily', branchId, date],
    queryFn: () => apiGet<any>('/api/reports/daily', { branchId: branchId || '', date }),
    enabled: !!branchId,
    refetchInterval: 60_000,
  });

  const orders: any[] = data?.orders || [];
  const netTotal = orders.reduce((sum, o) => sum + (o.netAmount ?? o.totalAmount ?? 0), 0);
  const byMethod: Record<string, number> = {};
  for (const o of orders) {
    for (const p of o.payments || []) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Today's Report</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — completed orders at your branch.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-12"><Spinner size={16} />Loading…</div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-red-500">Couldn't load today's report.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-[#ff5722] hover:underline">Try again</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Orders</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{orders.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Net sales</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatPKR(netTotal)}</p>
            </div>
            {Object.entries(byMethod).map(([method, amount]) => (
              <div key={method} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{method}</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatPKR(amount)}</p>
              </div>
            ))}
          </div>

          {orders.length === 0 ? (
            <div className="text-sm text-slate-400 py-12 text-center">No completed orders yet today.</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {orders
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Receipt size={15} className="text-slate-300 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{o.orderNumber}</p>
                        <p className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
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
