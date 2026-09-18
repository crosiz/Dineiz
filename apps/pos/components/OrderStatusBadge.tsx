'use client';

import { useEffect, useState } from 'react';
import { Bike, Clock, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { formatElapsed, minutesSince } from '@/lib/time';

// The three small pieces every order display is built from: how long it has
// been waiting, what state it's in, and what kind of order it is. Shared by
// Tickets, Home and the order details sheet so the same order reads the same
// way everywhere.
//
// Previously each was a bordered, uppercase, pastel pill in raw Tailwind
// palette colours (yellow-500, blue-400, green-500…), the timer pulsed once an
// order passed 30 minutes, and a card carried four of them side by side. They
// are quieter now and on the token set: colour carries the signal, weight
// stays low, and nothing blinks.

/** Minutes after which a waiting order reads as late (warn) and very late (danger). */
const LATE_AFTER = 15;
const VERY_LATE_AFTER = 30;

export const TicketTimer = ({ createdAt, className = '' }: { createdAt: string; className?: string }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(h);
  }, []);

  const mins = minutesSince(createdAt);
  const tone = mins >= VERY_LATE_AFTER ? 'text-danger' : mins >= LATE_AFTER ? 'text-warn' : 'text-ink-3';

  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums whitespace-nowrap ${tone} ${className}`}>
      <Clock className="w-3.5 h-3.5" strokeWidth={2.25} />
      {formatElapsed(createdAt)}
    </span>
  );
};

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  PENDING: { label: 'Pending', dot: 'bg-warn', text: 'text-ink-2' },
  IN_KITCHEN: { label: 'In kitchen', dot: 'bg-info', text: 'text-ink-2' },
  READY: { label: 'Ready', dot: 'bg-ok', text: 'text-ok' },
  SERVED: { label: 'Served', dot: 'bg-ink-4', text: 'text-ink-2' },
  BILL_REQUESTED: { label: 'Bill requested', dot: 'bg-brand', text: 'text-brand' },
  HELD: { label: 'On hold', dot: 'bg-ink-4', text: 'text-ink-2' },
  COMPLETED: { label: 'Paid', dot: 'bg-ok', text: 'text-ink-2' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-danger', text: 'text-ink-3' },
  VOIDED: { label: 'Voided', dot: 'bg-danger', text: 'text-ink-3' },
};

export const StatusBadge = ({ status, className = '' }: { status: string; className?: string }) => {
  const s = STATUS[status] ?? { label: status.replace(/_/g, ' ').toLowerCase(), dot: 'bg-ink-4', text: 'text-ink-2' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap ${s.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label.charAt(0).toUpperCase() + s.label.slice(1)}
    </span>
  );
};

// ─── Order type ──────────────────────────────────────────────────────────
//
// Dine-in, takeaway and delivery each get one colour and one icon, used on
// every screen, so which kind of order it is can be read at a glance across a
// busy board without reading a word. Dine-in names the table, because that is
// what staff act on.

const TYPE = {
  DINE_IN: { label: 'Dine-in', Icon: UtensilsCrossed, chip: 'bg-info/10 text-info', bar: 'bg-info' },
  TAKEAWAY: { label: 'Takeaway', Icon: ShoppingBag, chip: 'bg-brand/10 text-brand-strong', bar: 'bg-brand' },
  DELIVERY: { label: 'Delivery', Icon: Bike, chip: 'bg-special/10 text-special', bar: 'bg-special' },
} as const;

export type OrderTypeKey = keyof typeof TYPE;

export function normaliseOrderType(type: string | null | undefined): OrderTypeKey {
  const t = (type ?? '').toUpperCase().replace('-', '_');
  return t === 'TAKEAWAY' || t === 'DELIVERY' ? t : 'DINE_IN';
}

/** The type's accent colour as a background utility, for a card's edge. */
export function orderTypeBar(type: string | null | undefined): string {
  return TYPE[normaliseOrderType(type)].bar;
}

export const OrderTypeBadge = ({
  type,
  tableLabel,
  size = 'md',
  className = '',
}: {
  type: string | null | undefined;
  tableLabel?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}) => {
  const t = TYPE[normaliseOrderType(type)];
  const table = normaliseOrderType(type) === 'DINE_IN' && tableLabel ? tableLabel : null;
  const dims = size === 'sm' ? 'h-5 px-1.5 text-[11px] gap-1' : 'h-6 px-2 text-[12px] gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-md font-semibold whitespace-nowrap ${dims} ${t.chip} ${className}`}>
      <t.Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} strokeWidth={2.25} />
      {table ? (
        <>
          <span>{table}</span>
          <span className="opacity-60 font-medium">Dine-in</span>
        </>
      ) : (
        t.label
      )}
    </span>
  );
};
