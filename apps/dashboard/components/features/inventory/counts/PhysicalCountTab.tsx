'use client';

import React, { useState } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { useCounts, CountSession } from '../hooks/useCounts';
import { SkeletonTableRows } from '@/components/ui/skeleton';
import { formatVariance } from '@/lib/formatters';
import { StartCountModal } from './StartCountModal';
import { CountInProgress } from './CountInProgress';

const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export function PhysicalCountTab() {
  const { sessions, isLoading } = useCounts();
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  if (activeSessionId) {
    return <CountInProgress sessionId={activeSessionId} onBack={() => setActiveSessionId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Physical Count Sessions</h2>
          <p className="text-sm text-slate-500 mt-0.5">Start a count to reconcile system stock against what&apos;s actually on the shelf</p>
        </div>
        <button
          onClick={() => setIsStartOpen(true)}
          className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Start New Count
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3">Count #</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Started By</th>
                <th className="px-6 py-3">Started At</th>
                <th className="px-6 py-3">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <SkeletonTableRows
                  rows={5}
                  columns={[120, { w: 72, pill: true }, { w: 120, avatar: true }, 100, 90]}
                />
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center">
                        <ClipboardList size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">No counts yet</p>
                        <p className="text-sm text-slate-500 mt-0.5">Start your first physical count to see it here</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((s: CountSession) => (
                  <tr key={s.id} onClick={() => setActiveSessionId(s.id)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-900">{s.countNumber}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{s.countType}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{s.branch?.name ?? '—'}</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[s.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{s.startedByName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-500 whitespace-nowrap">{new Date(s.startedAt).toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-sm font-medium whitespace-nowrap">
                      {s.status === 'COMPLETED' ? (
                        <span className={s.totalVarianceValue && s.totalVarianceValue < 0 ? 'text-red-600' : s.totalVarianceValue && s.totalVarianceValue > 0 ? 'text-emerald-600' : 'text-slate-500'}>
                          {formatVariance(s.totalVarianceValue)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StartCountModal isOpen={isStartOpen} onClose={() => setIsStartOpen(false)} onStarted={(session) => setActiveSessionId(session.id)} />
    </div>
  );
}
