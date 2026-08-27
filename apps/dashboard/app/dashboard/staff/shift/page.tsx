'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Clock, ShoppingBag } from 'lucide-react';
import { InlineLoader } from '@/components/ui/Spinner';

function formatSince(openedAt: string) {
  const ms = Date.now() - new Date(openedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Branch-scoped: the API auto-restricts /api/shifts/active to the caller's
 * own branch when the caller is a BRANCH_MANAGER, so no branchId param is
 * needed here — a tenant admin hitting this URL would see every branch,
 * but this route isn't in TENANT_ADMIN_NAV, it's branch-manager only. */
export default function StaffOnShiftPage() {
  const { data: shifts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-on-shift'],
    queryFn: () => apiGet<any[]>('/api/shifts/active'),
    refetchInterval: 30_000,
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Staff on Shift</h1>
        <p className="text-slate-500 text-sm mt-1">Everyone currently clocked in at your branch.</p>
      </div>

      {isLoading ? (
        <InlineLoader />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-red-500">Couldn't load active shifts.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-[#ff5722] hover:underline">Try again</button>
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-sm text-slate-400 py-12 text-center">No one is currently on shift.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {shifts.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: s.user?.avatarColor || '#FF5722' }}
                >
                  {(s.user?.name || '?').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.user?.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> On shift {formatSince(s.openedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                <ShoppingBag size={14} className="text-slate-400" />
                {s._count?.orders ?? 0} orders
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
