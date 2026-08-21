'use client';

import React, { useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useCounts, CountSession } from '../hooks/useCounts';
import { formatVariance } from '@/lib/formatters';
import { LARGE_VARIANCE_NOTES_THRESHOLD } from './countConstants';

interface CompleteCountModalProps {
  session: CountSession;
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export function CompleteCountModal({ session, isOpen, onClose, onCompleted }: CompleteCountModalProps) {
  const { completeCount } = useCounts();
  const [notes, setNotes] = useState('');

  const countedLines = useMemo(() => session.lines.filter((l) => l.countedQty !== null), [session.lines]);
  const itemsWithVariance = countedLines.filter((l) => (l.variance ?? 0) !== 0).length;
  const totalVarianceValue = countedLines.reduce((sum, l) => sum + (l.varianceValue ?? 0), 0);
  const totalItems = session.lines.length;

  const biggestVariances = useMemo(
    () =>
      [...countedLines]
        .filter((l) => (l.varianceValue ?? 0) !== 0)
        .sort((a, b) => Math.abs(b.varianceValue ?? 0) - Math.abs(a.varianceValue ?? 0))
        .slice(0, 5),
    [countedLines]
  );

  const requiresNotes = Math.abs(totalVarianceValue) >= LARGE_VARIANCE_NOTES_THRESHOLD;
  const canSubmit = !requiresNotes || notes.trim().length > 0;

  if (!isOpen) return null;

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    completeCount.mutate(
      { sessionId: session.id, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          setNotes('');
          onCompleted();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">Complete Count</h2>
            <p className="text-[13px] text-slate-500">Count #{session.countNumber}</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Completing this count will <strong>overwrite stock levels</strong> to the counted quantities. This cannot be undone from the UI.
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-slate-900">{countedLines.length}/{totalItems}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">Items Counted</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-slate-900">{itemsWithVariance}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">With Variance</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-center">
              <p className={`text-lg font-bold ${totalVarianceValue < 0 ? 'text-red-600' : totalVarianceValue > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {formatVariance(totalVarianceValue)}
              </p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">Total Variance</p>
            </div>
          </div>

          {countedLines.length < totalItems && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {totalItems - countedLines.length} item(s) haven&apos;t been counted yet and will keep their current system stock level.
            </p>
          )}

          {biggestVariances.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Largest Variances</p>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {biggestVariances.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-slate-700">{l.ingredient.name}</span>
                    <span className={`text-sm font-semibold ${(l.varianceValue ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatVariance(l.varianceValue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Notes {requiresNotes ? '*' : '(Optional)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={requiresNotes ? 'Variance is large — explain what happened...' : 'Anything worth noting...'}
              className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors resize-none ${
                requiresNotes && !notes.trim() ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {requiresNotes && (
              <p className="text-xs text-amber-600 mt-1">Total variance is {formatVariance(totalVarianceValue)} — please add a note before completing.</p>
            )}
          </div>

          {completeCount.error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {(completeCount.error as any)?.message ?? 'Failed to complete count'}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={completeCount.isPending || !canSubmit}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completeCount.isPending ? 'Completing...' : 'Complete Count & Update Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
