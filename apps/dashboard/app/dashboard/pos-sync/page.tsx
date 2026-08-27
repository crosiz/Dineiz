'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api-client';
import { InlineLoader } from '@/components/ui/Spinner';
import { WifiOff, RefreshCw, CheckCircle2, AlertOctagon, Clock } from 'lucide-react';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { toast } from 'sonner';

interface DeadLetter {
  id: string;
  branchId: string;
  terminalId: string;
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  attempts: number;
  lastError: string | null;
  poisonedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// A POS terminal's local outbox (lib/core/outbox.ts, apps/pos) gives up on
// an event after a few permanently-rejected retries and marks it POISONED
// — that state only lives in the terminal's own IndexedDB until it reports
// itself here. This page is that report: things a terminal tried to send
// to the server and the server refused, that nothing since has resolved.
export default function PosSyncPage() {
  const queryClient = useQueryClient();
  const [includeResolved, setIncludeResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { branchId, queryParam } = useBranchFilter();

  const queryKey = ['pos-dead-letters', branchId ?? null, includeResolved] as const;
  const { data: items = [], isLoading: loading, isError } = useQuery<DeadLetter[]>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams(queryParam);
      if (includeResolved) params.set('includeResolved', 'true');
      return apiGet<DeadLetter[]>(`/api/pos/dead-letters?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => {
    if (isError) toast.error('Failed to load sync issues');
  }, [isError]);

  const fetchDeadLetters = () => queryClient.invalidateQueries({ queryKey: ['pos-dead-letters'] });

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await apiPut(`/api/pos/dead-letters/${id}/resolve`);
      queryClient.setQueryData<DeadLetter[]>(queryKey, (prev) => (prev ?? []).filter((i) => i.id !== id));
      toast.success('Marked resolved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to resolve');
    } finally {
      setResolvingId(null);
      fetchDeadLetters();
    }
  };

  const unresolvedCount = items.filter((i) => !i.resolvedAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <WifiOff className="text-rose-500" size={22} />
            POS Sync Issues
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Orders and changes a terminal tried to send that the server permanently rejected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIncludeResolved((v) => !v)}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
              includeResolved
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 size={14} />
            {includeResolved ? 'Showing Resolved' : 'Show Resolved'}
          </button>
          <button
            onClick={fetchDeadLetters}
            className="h-9 px-3.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {unresolvedCount > 0 && (
        <div className="bg-rose-50/80 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
          <AlertOctagon size={16} className="text-rose-600 shrink-0" />
          <span>
            <strong className="font-bold">{unresolvedCount} unresolved sync issue{unresolvedCount !== 1 ? 's' : ''}</strong> — these
            never reached the server and won't retry again on their own.
          </span>
        </div>
      )}

      {loading ? (
        <InlineLoader />
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={28} />
          <p className="text-sm font-semibold text-slate-700">No sync issues</p>
          <p className="text-xs text-slate-400 mt-1">Every terminal is caught up with the server.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-4 ${
                item.resolvedAt ? 'border-slate-200 opacity-60' : 'border-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      {item.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{item.aggregateType} · {item.aggregateId.slice(-8)}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={11} /> {item.attempts} attempt{item.attempts !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {item.lastError && (
                    <p className="text-xs text-slate-600 mt-1.5 font-mono break-all">{item.lastError}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Terminal {item.terminalId} · {new Date(item.poisonedAt).toLocaleString()}
                    {item.resolvedAt && ` · Resolved ${new Date(item.resolvedAt).toLocaleString()}`}
                  </p>
                </div>
                {!item.resolvedAt && (
                  <button
                    onClick={() => handleResolve(item.id)}
                    disabled={resolvingId === item.id}
                    className="h-8 px-3 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {resolvingId === item.id ? 'Resolving…' : 'Mark Resolved'}
                  </button>
                )}
              </div>
              <details className="mt-2.5">
                <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                  View raw event payload
                </summary>
                <pre className="mt-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded-lg p-2.5 overflow-x-auto text-slate-600">
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
