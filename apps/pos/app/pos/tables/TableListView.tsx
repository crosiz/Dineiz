'use client';

import { TABLE_TONE } from '@/lib/table-tone';
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { formatPKR } from '@/lib/utils';
import { ServiceIllustration } from '@/components/ServiceIllustration';

// ── The phone view of the floor ─────────────────────────────────────────────
//
// A floor plan is a scale drawing of a room, and a room does not fit a phone.
// Fitted to a 375×812 portrait screen, a typical 5×2 layout renders at ~57%:
// tables about 50px across with 6px labels, and roughly 70% of the screen given
// to empty dot grid. Nothing on it is readable or comfortably tappable.
//
// So below `sm` this replaces the canvas entirely. It's the same information —
// which tables are free, which are busy, how long, how much — as a list of real
// tap targets. Every serious POS does exactly this split: the spatial plan is a
// tablet and counter-terminal idea; on a phone a waiter wants the list.
//
// The canvas is still there from `sm` up, unchanged.

export interface TableListRow {
  id: string;
  label: string;
  capacity: number;
  shape?: string;
  status: string;
  occupiedSince?: string | number | Date | null;
  assignedWaiterName?: string | null;
  /** Order total on this table, when it has a live one. */
  amount?: number | null;
}

/** One vocabulary for a table's state, shared by the label and the colour. */

function normalise(status?: string): keyof typeof TABLE_TONE {
  const s = (status || 'FREE').toUpperCase();
  if (s === 'AVAILABLE' || s === 'FREE') return 'FREE';
  if (s === 'READY' || s === 'BILLED' || s === 'BILL_REQUESTED') return 'BILL_REQUESTED';
  if (s === 'RESERVED') return 'RESERVED';
  if (s === 'DIRTY') return 'DIRTY';
  if (s === 'OCCUPIED') return 'OCCUPIED';
  return 'FREE';
}

function elapsed(since?: string | number | Date | null): string | null {
  if (!since) return null;
  const ms = Date.now() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function TableListView({
  tables,
  onTap,
}: {
  tables: TableListRow[];
  onTap: (table: TableListRow) => void;
}) {
  // Free tables first — the one a waiter is usually looking for — then the
  // rest grouped by state, and by label within each group so the order on
  // screen is stable between renders.
  const ordered = useMemo(() => {
    const rank: Record<string, number> = { FREE: 0, DIRTY: 1, RESERVED: 2, OCCUPIED: 3, BILL_REQUESTED: 4 };
    return [...tables].sort((a, b) => {
      const r = rank[normalise(a.status)] - rank[normalise(b.status)];
      if (r !== 0) return r;
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });
  }, [tables]);

  if (ordered.length === 0) {
    return (
      <div className="flex-1 grid place-items-center p-8 text-center">
        <div className="flex flex-col items-center">
          <ServiceIllustration kind="floor" className="w-36 h-28 mb-2" />
          <p className="text-[14px] text-ink-3">No tables to show. Choose another floor or filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {ordered.map((t) => {
          const key = normalise(t.status);
          const s = TABLE_TONE[key];
          const busy = key === 'OCCUPIED' || key === 'BILL_REQUESTED';
          const time = busy ? elapsed(t.occupiedSince) : null;

          return (
            <button
              key={t.id}
              data-testid="table-row"
              data-table-status={key.toLowerCase()}
              onClick={() => onTap(t)}
              className={`text-left rounded-xl border ${s.tile} p-4 min-h-[132px] flex flex-col justify-between transition-colors active:scale-[0.99]`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[22px] font-semibold text-ink leading-none">{t.label}</span>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${s.dot}`} aria-hidden />
              </div>

              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                  <Users className="w-3.5 h-3.5" aria-hidden />
                  <span>{t.capacity} seats</span>
                  <span className="text-ink-4">·</span>
                  <span className="font-medium text-ink-2">{s.label === 'bill' ? 'Bill requested' : s.label === 'to clean' ? 'Cleaning' : s.label.charAt(0).toUpperCase() + s.label.slice(1)}</span>
                </div>

                {busy && (
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    {time && <span className="text-ink-3 tabular-nums">{time}</span>}
                    {typeof t.amount === 'number' && t.amount > 0 && (
                      <span className="font-semibold text-ink tabular-nums">{formatPKR(t.amount)}</span>
                    )}
                  </div>
                )}

                {t.assignedWaiterName && (
                  <div className="text-[11px] text-ink-4 truncate">{t.assignedWaiterName}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
