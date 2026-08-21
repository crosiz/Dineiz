'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useCountDetail, useCounts } from '../hooks/useCounts';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatVariance } from '@/lib/formatters';
import { CountLineRow } from './CountLineRow';
import { CompleteCountModal } from './CompleteCountModal';

const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

interface CountInProgressProps {
  sessionId: string;
  onBack: () => void;
}

export function CountInProgress({ sessionId, onBack }: CountInProgressProps) {
  const { data: session, isLoading, isError, refetch } = useCountDetail(sessionId);
  const { cancelCount } = useCounts();
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  const lines = session?.lines ?? [];
  const countedLines = useMemo(() => lines.filter((l) => l.countedQty !== null), [lines]);
  const totalVarianceValue = useMemo(() => countedLines.reduce((sum, l) => sum + (l.varianceValue ?? 0), 0), [countedLines]);

  if (isLoading && !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={24} />
      </div>
    );
  }

  if (isError || !session) {
    return <ErrorState message="Couldn't load this count session." onRetry={refetch} />;
  }

  const isInProgress = session.status === 'IN_PROGRESS';

  const handleCancel = () => {
    cancelCount.mutate(session.id, {
      onSuccess: () => {
        setIsCancelConfirmOpen(false);
        onBack();
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3">
            <ArrowLeft size={15} />
            Back to sessions
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Count #{session.countNumber}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[session.status] ?? 'bg-slate-100 text-slate-500'}`}>
              {session.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {session.countType} count &middot; started by {session.startedByName} on {new Date(session.startedAt).toLocaleString()}
            {session.branch ? ` · ${session.branch.name}` : ''}
          </p>
        </div>

        {isInProgress && (
          <button
            onClick={() => setIsCancelConfirmOpen(true)}
            className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors px-3 py-2 rounded-md hover:bg-red-50"
          >
            Cancel Count
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {countedLines.length} of {lines.length} items counted
          </p>
          <div className="w-56 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-[#ff5722] rounded-full transition-all"
              style={{ width: lines.length ? `${(countedLines.length / lines.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
        {session.notes && <p className="text-xs text-slate-500 max-w-xs text-right">{session.notes}</p>}
      </div>

      {/* Lines table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold tracking-wider sticky top-0">
              <tr>
                <th className="px-6 py-3">Ingredient</th>
                <th className="px-6 py-3">System Qty</th>
                <th className="px-6 py-3">Counted</th>
                <th className="px-6 py-3">Variance</th>
                <th className="px-6 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500 text-sm">No lines in this session.</td>
                </tr>
              ) : (
                lines.map((line) => (
                  <CountLineRow key={`${line.id}-${line.countedQty}-${line.notes}`} line={line} sessionId={session.id} readOnly={!isInProgress} onSaved={() => refetch()} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky footer */}
      {isInProgress && (
        <div className="sticky bottom-0 bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Counted</p>
              <p className="text-sm font-semibold text-slate-900">{countedLines.length} / {lines.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Running Variance</p>
              <p className={`text-sm font-semibold ${totalVarianceValue < 0 ? 'text-red-600' : totalVarianceValue > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {formatVariance(totalVarianceValue)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCompleteOpen(true)}
            disabled={countedLines.length === 0}
            className="bg-[#ff5722] hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Complete Count
          </button>
        </div>
      )}

      {/* Cancel confirmation */}
      {isCancelConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCancelConfirmOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Cancel this count?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">All progress on Count #{session.countNumber} will be discarded. Stock levels won&apos;t be changed. This can&apos;t be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsCancelConfirmOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                Keep Counting
              </button>
              <button onClick={handleCancel} disabled={cancelCount.isPending} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                {cancelCount.isPending ? 'Cancelling...' : 'Cancel Count'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCompleteOpen && (
        <CompleteCountModal
          session={session}
          isOpen={isCompleteOpen}
          onClose={() => setIsCompleteOpen(false)}
          onCompleted={() => {
            setIsCompleteOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
