'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { formatElapsed } from '@/lib/time';

export type TableStatus =
  | 'FREE'
  | 'OCCUPIED'
  | 'BILL_REQUESTED'
  | 'RESERVED'
  | 'DIRTY'
  | 'free'
  | 'occupied'
  | 'bill_requested'
  | 'reserved'
  | 'dirty'
  | 'available'
  | 'ready'
  | 'billed';

export interface PremiumTableProps {
  label: string;
  capacity: number;
  shape?: 'square' | 'rectangle' | 'round' | 'long' | string;
  status?: TableStatus | string;
  occupiedSince?: string | number | Date;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

// One table on the floor plan.
//
// It was drawn with a glowing coloured outline (a 14-24px coloured box-shadow
// per status), a white-to-grey gradient surface, grey dots for chairs, and a
// red outline that pulsed forever on every occupied table — which on a busy
// floor meant half the screen throbbing. Now: a flat surface in the status
// colour (the same palette as Home's table grid, lib/table-tone.ts), short
// seat bars around it, and the one number that matters on an occupied table,
// how long it's been sat.

const STATUS: Record<string, { surface: string; label: string; sub: string; seat: string; caption: (mins: string, cap: number) => string }> = {
  FREE: {
    surface: 'bg-surface border-line-strong',
    label: 'text-ink',
    sub: 'text-ink-3',
    seat: 'bg-line-strong',
    caption: (_m, cap) => `${cap} seats`,
  },
  OCCUPIED: {
    surface: 'bg-surface border-info/60',
    label: 'text-ink',
    sub: 'text-ink-3',
    seat: 'bg-info/20',
    caption: (m) => m ? `Occupied · ${m}` : 'Occupied',
  },
  BILL_REQUESTED: {
    surface: 'bg-surface border-brand/70',
    label: 'text-brand-strong',
    sub: 'text-brand-strong/80',
    seat: 'bg-brand/40',
    caption: (m) => (m ? `Bill · ${m}` : 'Bill'),
  },
  RESERVED: {
    surface: 'bg-special/10 border-special/60',
    label: 'text-special',
    sub: 'text-special/80',
    seat: 'bg-special/35',
    caption: () => 'Reserved',
  },
  DIRTY: {
    surface: 'bg-sunken border-line-strong border-dashed',
    label: 'text-ink-3',
    sub: 'text-ink-3',
    seat: 'bg-line',
    caption: () => 'To clean',
  },
};

function normalizeStatus(status?: string): string {
  if (!status) return 'FREE';
  const s = status.toUpperCase();
  if (s === 'AVAILABLE' || s === 'FREE') return 'FREE';
  if (s === 'READY' || s === 'BILLED' || s === 'BILL_REQUESTED') return 'BILL_REQUESTED';
  if (s === 'OCCUPIED') return 'OCCUPIED';
  if (s === 'RESERVED') return 'RESERVED';
  if (s === 'DIRTY') return 'DIRTY';
  return 'FREE';
}

/**
 * A table's drawn size, and the padding its chair decoration needs around it.
 *
 * Exported because the floor plan has to know the real extent of what it's
 * laying out in order to fit a floor to the viewport.
 *
 * (x, y) is the table's TOP-LEFT. The wrapper this component renders is
 * `CHAIR_PAD` larger on every side, and the caller offsets by that much.
 */
export const CHAIR_PAD = 20;

export function getTableDimensions(shape?: string, capacity: number = 4) {
  const normShape = (shape || '').toLowerCase();

  if (normShape === 'round' || normShape === 'table_round') {
    return { width: 96, height: 96, borderRadius: '50%' };
  }
  if (normShape === 'long' || capacity >= 9) {
    return { width: 180, height: 80, borderRadius: '12px' };
  }
  if (normShape === 'rectangle' || (capacity >= 5 && capacity <= 8)) {
    return { width: 130, height: 88, borderRadius: '12px' };
  }
  return { width: 88, height: 88, borderRadius: '12px' };
}

interface Seat {
  x: number;
  y: number;
  /** h = a seat above/below the table (wide), v = beside it (tall), d = round table */
  o: 'h' | 'v' | 'd';
}

const SEAT_LONG = 22;
const SEAT_SHORT = 10;
const SEAT_GAP = 4;

function calculateSeats(capacity: number, shape: string, w: number, h: number): Seat[] {
  const seats: Seat[] = [];
  const cap = Math.max(0, Math.min(20, Math.floor(capacity || 0)));
  const isRound = shape.toLowerCase() === 'round' || shape.toLowerCase() === 'table_round';
  const P = CHAIR_PAD;

  if (isRound) {
    const cx = P + w / 2;
    const cy = P + h / 2;
    const radius = w / 2 + SEAT_GAP + 4;
    for (let i = 0; i < cap; i++) {
      const angle = ((2 * Math.PI) / cap) * i - Math.PI / 2;
      seats.push({ x: Math.round(cx + radius * Math.cos(angle) - 4), y: Math.round(cy + radius * Math.sin(angle) - 4), o: 'd' });
    }
    return seats;
  }

  const sideCount = cap > 2 ? 2 : 0;
  const topCount = Math.ceil((cap - sideCount) / 2);
  const bottomCount = Math.floor((cap - sideCount) / 2);
  for (const [count, y] of [[topCount, P - SEAT_GAP - SEAT_SHORT], [bottomCount, P + h + SEAT_GAP]]) {
    for (let i = 0; i < count; i++) {
      seats.push({ x: Math.round(P + w * (i + 1) / (count + 1) - SEAT_LONG / 2), y, o: 'h' });
    }
  }
  if (sideCount) {
    seats.push({ x: P - SEAT_GAP - SEAT_SHORT, y: P + h / 2 - SEAT_LONG / 2, o: 'v' });
    seats.push({ x: P + w + SEAT_GAP, y: P + h / 2 - SEAT_LONG / 2, o: 'v' });
  }
  return seats.slice(0, cap);
}

export function PremiumTable({
  label,
  capacity,
  shape = 'square',
  status = 'FREE',
  occupiedSince,
  isSelected = false,
  onClick,
  className = '',
  style = {},
}: PremiumTableProps) {
  const norm = normalizeStatus(status);
  const tone = STATUS[norm];
  const timed = norm === 'OCCUPIED' || norm === 'BILL_REQUESTED';

  const { width, height, borderRadius } = getTableDimensions(shape, capacity);

  const [, tick] = useState(0);
  useEffect(() => {
    if (!timed || !occupiedSince) return;
    const h = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(h);
  }, [timed, occupiedSince]);
  // Only a real timestamp: a table without one shows its seats, never a
  // made-up duration.
  const elapsed = timed && occupiedSince ? formatElapsed(occupiedSince as any) : '';

  const seats = useMemo(() => calculateSeats(capacity, shape, width, height), [capacity, shape, width, height]);

  return (
    <div
      data-testid="table-node"
      onClick={onClick}
      style={{ width: width + CHAIR_PAD * 2, height: height + CHAIR_PAD * 2, position: 'relative', userSelect: 'none', ...style }}
      className={`group cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${className}`}
      role="button"
      tabIndex={0}
      aria-label={`Table ${label}, ${capacity} seats, ${norm.replace('_', ' ').toLowerCase()}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
    >
      {seats.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className={`absolute rounded-[4px] border border-black/[0.06] shadow-[0_1px_1px_rgba(15,23,42,0.06)] ${tone.seat}`}
          style={{
            left: s.x,
            top: s.y,
            width: s.o === 'h' ? SEAT_LONG : s.o === 'v' ? SEAT_SHORT : 8,
            height: s.o === 'h' ? SEAT_SHORT : s.o === 'v' ? SEAT_LONG : 8,
          }}
        />
      ))}

      <div
        style={{ left: CHAIR_PAD, top: CHAIR_PAD, width, height, borderRadius }}
        className={`absolute z-10 flex flex-col items-center justify-center text-center border-[1.5px] shadow-[0_3px_0_0_rgba(148,163,184,0.18),0_5px_8px_-5px_rgba(15,23,42,0.12)] transition-[transform,box-shadow] duration-150 group-hover:shadow-[0_4px_14px_rgba(15,23,42,0.10)] ${tone.surface} ${
          isSelected ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : ''
        }`}
      >
        {timed && <span aria-hidden className={`absolute top-3 h-1 w-5 rounded-full ${norm === 'BILL_REQUESTED' ? 'bg-brand' : 'bg-info'}`} />}
        <span className={`text-[21px] font-semibold leading-none tracking-tight ${tone.label}`}>{label}</span>
        <span className={`mt-1.5 text-[10px] font-medium leading-none tabular-nums ${tone.sub}`}>
          {tone.caption(elapsed, capacity)}
        </span>
      </div>
    </div>
  );
}
