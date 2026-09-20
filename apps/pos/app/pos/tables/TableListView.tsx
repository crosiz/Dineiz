'use client';

import { TABLE_TONE } from '@/lib/table-tone';
import { useMemo } from 'react';
import { ArrowUpRight, Clock, Users } from 'lucide-react';
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

/**
 * How much a card leans on colour, on top of the shared dot+caption. A dot
 * alone reads fine one table at a time but disappears when scanning a full
 * floor of them — the two states worth spotting from across the room (bill
 * waiting, reserved) get a tinted card and a coloured number; the rest stay
 * closer to neutral so those two still stand out. Same restraint as the
 * floor-plan canvas (PremiumTable), just applied to a list row instead of a
 * spatial tile.
 */
const CARD_TONE: Record<keyof typeof TABLE_TONE, { border: string; wash: string; label: string }> = {
  FREE: { border: 'border-line hover:border-line-strong', wash: '', label: 'text-ink' },
  OCCUPIED: { border: 'border-info/40 hover:border-info/60', wash: 'bg-info/[0.04]', label: 'text-ink' },
  BILL_REQUESTED: { border: 'border-brand/50 hover:border-brand/70', wash: 'bg-brand/[0.06]', label: 'text-brand-strong' },
  RESERVED: { border: 'border-special/40 hover:border-special/60', wash: 'bg-special/[0.05]', label: 'text-special' },
  DIRTY: { border: 'border-line border-dashed hover:border-line-strong', wash: 'bg-sunken', label: 'text-ink-3' },
};

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
  // Keep each number in a predictable position when another table changes
  // status. Staff can use the status filters when looking for a free table.
  const ordered = useMemo(() => [...tables].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  ), [tables]);

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
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 pb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
        {ordered.map((t) => {
          const key = normalise(t.status);
          const s = TABLE_TONE[key];
          const tone = CARD_TONE[key];
          const busy = key === 'OCCUPIED' || key === 'BILL_REQUESTED';
          const time = busy ? elapsed(t.occupiedSince) : null;

          return (
            <button
              key={t.id}
              data-testid="table-row"
              data-table-status={key.toLowerCase()}
              aria-label={`${/^table\b/i.test(t.label) ? t.label : 'Table ' + t.label}, ${t.capacity} seats, ${key === 'FREE' ? 'available' : s.label}`}
              onClick={() => onTap(t)}
              className={`group flex min-h-[164px] min-w-0 flex-col rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${tone.border} ${tone.wash || 'bg-surface'}`}
            >
              <div className="flex w-full items-start justify-between gap-2 p-3 sm:p-3.5">
                <div className="min-w-0">
                  <span className="block text-[12px] font-medium text-ink-3">{/^table\b/i.test(t.label) ? 'Dine-in' : 'Table'}</span>
                  <span className={`mt-1 block break-words text-[24px] font-semibold leading-tight tracking-tight ${tone.label}`}>{t.label}</span>
                </div>
                <span className="mt-1 flex items-center gap-1 text-xs text-ink-3"><Users size={14} aria-hidden />{t.capacity}</span>
              </div>
              <div className="flex flex-1 items-end justify-between gap-2 px-3 sm:px-3.5 pb-3.5">
                <span className="min-w-0">
                  {busy && typeof t.amount === 'number' && t.amount > 0
                    ? <span className="block text-[13px] font-semibold text-ink tabular-nums">{formatPKR(t.amount)}</span>
                    : <span className="block text-xs text-ink-3">{key === 'FREE' ? 'Start an order' : key === 'DIRTY' ? 'Prepare for guests' : key === 'RESERVED' ? 'Reserved for guests' : 'Order in progress'}</span>}
                  {t.assignedWaiterName && <span className="mt-1 block truncate text-xs text-ink-3">{t.assignedWaiterName}</span>}
                </span>
                {key === 'FREE' && <ArrowUpRight size={16} className="shrink-0 text-ink-4 group-hover:text-ink" aria-hidden />}
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-1 border-t border-line bg-canvas/50 px-3 sm:px-3.5 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />{key === 'FREE' ? 'Available' : key === 'BILL_REQUESTED' ? 'Bill requested' : key === 'DIRTY' ? 'To clean' : key === 'RESERVED' ? 'Reserved' : 'Occupied'}</span>
                {time && <span className="inline-flex items-center gap-1 text-[11px] text-ink-3 tabular-nums"><Clock size={12} />{time}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
