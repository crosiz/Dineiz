'use client';

import React, { useState } from 'react';
import { useCounts, CountLine } from '../hooks/useCounts';
import { formatVariance } from '@/lib/formatters';
import { VARIANCE_WARN_PCT, VARIANCE_ALERT_PCT } from './countConstants';

function varianceColorClasses(systemQty: number, variance: number | null): string {
  if (variance === null) return 'text-slate-300';
  if (variance === 0) return 'text-emerald-600';
  const pct = systemQty !== 0 ? (Math.abs(variance) / systemQty) * 100 : Infinity;
  if (pct <= VARIANCE_WARN_PCT) return 'text-emerald-600';
  if (pct <= VARIANCE_ALERT_PCT) return 'text-amber-600';
  return 'text-red-600';
}

interface CountLineRowProps {
  line: CountLine;
  sessionId: string;
  readOnly: boolean;
  onSaved: () => void;
}

export function CountLineRow({ line, sessionId, readOnly, onSaved }: CountLineRowProps) {
  const { updateLine } = useCounts();
  const [qtyInput, setQtyInput] = useState<string>(line.countedQty !== null ? String(line.countedQty) : '');
  const [notesInput, setNotesInput] = useState<string>(line.notes ?? '');

  const parsedQty = qtyInput.trim() === '' ? null : Number(qtyInput);
  const hasValidQty = parsedQty !== null && !Number.isNaN(parsedQty) && parsedQty >= 0;

  // Live preview variance from whatever is currently in the input, falling
  // back to the last-saved server value once nothing is being typed.
  const previewVariance = hasValidQty ? (parsedQty as number) - line.systemQty : line.variance;

  const save = () => {
    if (!hasValidQty || readOnly) return;
    if (parsedQty === line.countedQty && notesInput === (line.notes ?? '')) return; // nothing changed
    updateLine.mutate(
      { sessionId, ingredientId: line.ingredientId, countedQty: parsedQty as number, notes: notesInput.trim() || undefined },
      { onSuccess: onSaved }
    );
  };

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-6 py-3">
        <span className="text-sm font-semibold text-slate-900">{line.ingredient.name}</span>
      </td>
      <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">
        {line.systemQty.toLocaleString()} {line.ingredient.unit}
      </td>
      <td className="px-6 py-3">
        <input
          type="number"
          min="0"
          step="any"
          disabled={readOnly}
          value={qtyInput}
          placeholder="—"
          onChange={(e) => setQtyInput(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-28 h-9 px-2.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors disabled:bg-slate-50 disabled:text-slate-400"
        />
      </td>
      <td className={`px-6 py-3 text-sm font-semibold whitespace-nowrap ${varianceColorClasses(line.systemQty, previewVariance)}`}>
        {previewVariance === null ? '—' : `${previewVariance > 0 ? '+' : ''}${previewVariance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${line.ingredient.unit}`}
        {line.varianceValue !== null && line.countedQty !== null && (
          <span className="block text-xs font-normal text-slate-400">{formatVariance(line.varianceValue)}</span>
        )}
      </td>
      <td className="px-6 py-3">
        <input
          type="text"
          disabled={readOnly}
          value={notesInput}
          placeholder="Optional note..."
          onChange={(e) => setNotesInput(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-full min-w-[140px] h-9 px-2.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors disabled:bg-slate-50 disabled:text-slate-400"
        />
      </td>
    </tr>
  );
}
