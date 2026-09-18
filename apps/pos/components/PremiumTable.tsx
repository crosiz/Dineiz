'use client';

import React, { useEffect, useMemo, useState } from 'react';

export type TableStatus =
  | 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'RESERVED' | 'DIRTY'
  | 'free' | 'occupied' | 'bill_requested' | 'reserved' | 'dirty' | 'available' | 'ready' | 'billed';

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

export const CHAIR_PAD = 20;

export function getTableDimensions(shape?: string, capacity: number = 4) {
  const kind = (shape || '').toLowerCase();
  if (kind === 'round' || kind === 'table_round') return { width: 96, height: 96, borderRadius: '9999px' };
  if (kind === 'long' || capacity >= 9) return { width: 176, height: 80, borderRadius: '12px' };
  if (kind === 'rectangle' || (capacity >= 5 && capacity <= 8)) return { width: 128, height: 88, borderRadius: '12px' };
  return { width: 88, height: 88, borderRadius: '12px' };
}

function normaliseStatus(status?: string): 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'RESERVED' | 'DIRTY' {
  const value = status?.toUpperCase();
  if (value === 'OCCUPIED') return 'OCCUPIED';
  if (value === 'READY' || value === 'BILLED' || value === 'BILL_REQUESTED') return 'BILL_REQUESTED';
  if (value === 'RESERVED') return 'RESERVED';
  if (value === 'DIRTY') return 'DIRTY';
  return 'FREE';
}

const STATUS_STYLE = {
  FREE: { marker: 'bg-ok', label: 'Free', surface: 'bg-surface border-ok/45', text: 'text-ok' },
  OCCUPIED: { marker: 'bg-danger', label: 'Occupied', surface: 'bg-danger/5 border-danger/50', text: 'text-danger' },
  BILL_REQUESTED: { marker: 'bg-info', label: 'Bill due', surface: 'bg-info/5 border-info/50', text: 'text-info' },
  RESERVED: { marker: 'bg-special', label: 'Reserved', surface: 'bg-special/5 border-special/50', text: 'text-special' },
  DIRTY: { marker: 'bg-warn', label: 'To clean', surface: 'bg-warn/5 border-warn/50', text: 'text-warn' },
} as const;

function duration(since?: string | number | Date) {
  if (!since) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60_000));
  if (!Number.isFinite(minutes)) return null;
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * Tables are operational controls, not a decorative restaurant illustration.
 * One quiet surface, state marker and readable label remain legible at map
 * zoom; gradients, pulses and heavy glass effects made the prior canvas harder
 * to scan precisely when the room was busy.
 */
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
  const kind = normaliseStatus(status);
  const config = STATUS_STYLE[kind];
  const { width, height, borderRadius } = getTableDimensions(shape, capacity);
  const [elapsed, setElapsed] = useState(() => duration(occupiedSince));

  useEffect(() => {
    if (kind !== 'OCCUPIED' && kind !== 'BILL_REQUESTED') {
      setElapsed(null);
      return;
    }
    const update = () => setElapsed(duration(occupiedSince));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [kind, occupiedSince]);

  const seatMarkers = useMemo(() => Array.from({ length: Math.min(Math.max(capacity, 1), 8) }), [capacity]);

  return (
    <button
      type="button"
      data-testid="table-node"
      onClick={onClick}
      aria-label={`${label}, ${config.label}, ${capacity} seats`}
      style={{ width: width + CHAIR_PAD * 2, height: height + CHAIR_PAD * 2, ...style }}
      className={`group relative grid place-items-center text-left ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
        {seatMarkers.map((_, index) => {
          const angle = (Math.PI * 2 * index) / seatMarkers.length - Math.PI / 2;
          const x = Math.cos(angle) * (width / 2 + 8);
          const y = Math.sin(angle) * (height / 2 + 8);
          return <i key={index} className="absolute size-1.5 rounded-full bg-line-strong" style={{ transform: `translate(${x}px, ${y}px)` }} />;
        })}
      </span>
      <span
        style={{ width, height, borderRadius }}
        className={`relative z-10 flex flex-col items-center justify-center border-2 transition-[transform,border-color,background-color] duration-150 group-hover:-translate-y-0.5 ${config.surface} ${
          isSelected ? 'ring-2 ring-brand ring-offset-2 ring-offset-canvas' : ''
        }`}
      >
        <span className="text-[15px] font-bold leading-none text-ink tabular-nums">{label}</span>
        <span className="mt-1 text-[10px] font-medium leading-none text-ink-3">{capacity} seats</span>
        {(elapsed || kind === 'BILL_REQUESTED') && (
          <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold leading-none ${config.text}`}>
            <i className={`size-1.5 rounded-full ${config.marker}`} />
            {kind === 'BILL_REQUESTED' ? 'Bill due' : elapsed}
          </span>
        )}
      </span>
    </button>
  );
}
