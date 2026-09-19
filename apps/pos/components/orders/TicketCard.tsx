'use client';

import type { ReactNode } from 'react';
import { OrderTypeBadge, StatusBadge, TicketTimer, orderTypeBar } from '@/components/OrderStatusBadge';
import { formatPKR } from '@/lib/utils';

// One order, as a ticket. Used by the Tickets board and Home's active-orders
// row, so an order looks the same wherever it appears.
//
// Built for the order that has 50 lines as much as the one with 2: the card
// shows the first few lines, then a single "+ N more" row with the full count,
// so every card on the board keeps the same shape and nothing pushes the
// action button off the bottom. Identical lines arrive already merged
// (TicketsDashboard's mergeDisplayLines).

export interface TicketLine {
  qty: number;
  name: string;
  note?: string | null;
  modifiers?: string | null;
}

export interface TicketAction {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  /** brand = the next money step; ink = the next kitchen step; quiet = informational */
  tone?: 'brand' | 'ink' | 'quiet';
  busy?: boolean;
}

export function TicketCard({
  orderNumber,
  type,
  tableLabel,
  status,
  createdAt,
  lines,
  totalItems,
  total,
  meta,
  flags,
  primary,
  secondary,
  onOpen,
  compact = false,
  dimmed = false,
  layout = 'grid',
}: {
  orderNumber: string;
  type: string | null | undefined;
  tableLabel?: string | null;
  status: string;
  createdAt?: string | null;
  lines: TicketLine[];
  /** Unit count across every line, for the "+ N more" summary. */
  totalItems?: number;
  total: number;
  /** Small secondary facts: waiter, guests, customer. */
  meta?: Array<string | null | undefined | false>;
  /** Source/payment chips (QR, WhatsApp, Paid online) — rendered as given. */
  flags?: ReactNode;
  primary?: TicketAction | null;
  /** Icon buttons beside the primary action (print, delete, message). */
  secondary?: ReactNode;
  onOpen?: () => void;
  /** Home's row: fewer lines, no action bar. */
  compact?: boolean;
  dimmed?: boolean;
  layout?: 'grid' | 'list';
}) {
  const maxLines = compact ? 2 : 5;
  // When there are more lines than fit, the last visible slot becomes the
  // summary row, so a long order never shows a half-list and a summary both
  // competing for the same space.
  const overflow = lines.length > maxLines;
  const shown = overflow ? lines.slice(0, maxLines - 1) : lines;
  const hiddenLines = lines.length - shown.length;
  const units = totalItems ?? lines.reduce((s, l) => s + (l.qty || 0), 0);
  const metaText = (meta ?? []).filter(Boolean).join(' · ');

  return (
    <article
      data-testid="ticket-card"
      onClick={onOpen}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={`Order ${orderNumber}`}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen?.(); } }}
      className={`group relative flex flex-col bg-surface border border-line rounded-xl overflow-hidden transition-[border-color,box-shadow] ${
        onOpen ? 'cursor-pointer hover:border-line-strong hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]' : ''
      } ${dimmed ? 'opacity-70' : ''} ${compact ? 'min-w-0 w-full' : layout === 'list' ? 'sm:grid sm:grid-cols-[minmax(180px,1fr)_minmax(200px,2fr)]' : 'h-full'}`}
    >
      {/* Type accent: the one piece of colour that says what kind of order
          this is from across the room. */}
      <span className={`absolute inset-x-0 top-0 h-[3px] ${orderTypeBar(type)}`} aria-hidden />

      <header className={compact ? 'px-3.5 pt-3.5' : 'px-4 pt-4'}>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <OrderTypeBadge type={type} tableLabel={tableLabel} size={compact ? 'sm' : 'md'} />
          <StatusBadge status={status} />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <h3 className={`font-semibold text-ink tabular-nums break-all tracking-tight ${compact ? 'text-[16px]' : 'text-[18px]'}`}>
            #{orderNumber}
          </h3>
          {createdAt && <TicketTimer createdAt={createdAt} urgent={status === 'PENDING' || status === 'IN_KITCHEN'} />}
        </div>
        {(metaText || flags) && (
          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            {metaText && <p className="text-[12px] text-ink-3 truncate">{metaText}</p>}
            {flags}
          </div>
        )}
      </header>

      <ul className={`flex-1 ${compact ? 'px-3.5 pt-2.5 pb-3 space-y-1' : 'px-4 pt-4 pb-4 space-y-2 min-h-[136px]'}`}>
        {shown.map((l, i) => (
          <li key={i} className="flex gap-2.5 min-w-0">
            <span className={`shrink-0 text-right font-semibold tabular-nums text-ink ${compact ? 'w-4 text-[12px]' : 'w-5 text-[13px]'}`}>
              {l.qty}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-ink-2 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{l.name}</span>
              {!compact && (l.modifiers || l.note) && (
                <span className="block truncate text-[11.5px] text-ink-3">
                  {[l.modifiers, l.note && `“${l.note}”`].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
          </li>
        ))}
        {overflow && (
          <li className="flex gap-2.5">
            <span className={`shrink-0 ${compact ? 'w-4' : 'w-5'}`} />
            <span className={`font-semibold text-ink-3 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
              + {hiddenLines} more {hiddenLines === 1 ? 'line' : 'lines'} · {units} items
            </span>
          </li>
        )}
        {lines.length === 0 && <li className="text-[13px] text-ink-3">No items yet</li>}
      </ul>

      <footer
        className={`flex flex-wrap items-center gap-2 border-t border-line bg-surface ${layout === 'list' ? 'sm:col-span-2' : ''} ${compact ? 'px-3.5 py-2.5' : 'px-4 py-3'}`}
        onClick={(e) => { if (primary || secondary) e.stopPropagation(); }}
      >
        <span className={`mr-auto font-semibold text-ink tabular-nums ${compact ? 'text-[14px]' : 'text-[15px]'}`}>
          {formatPKR(total)}
        </span>
        {!compact && secondary}
        {!compact && primary && (
          <button
            type="button"
            onClick={primary.onClick}
            disabled={primary.disabled || primary.busy}
            className={`w-full min-h-11 px-3.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed ${
              primary.tone === 'brand'
                ? 'bg-brand text-on-brand hover:bg-brand-strong disabled:opacity-60'
                : primary.tone === 'ink'
                  ? 'bg-ink text-white hover:bg-ink-2 disabled:opacity-60'
                  : 'bg-sunken text-ink-3'
            }`}
          >
            {primary.busy ? 'Working…' : primary.label}
          </button>
        )}
      </footer>
    </article>
  );
}

/** A square icon button for a ticket's footer (print, message, delete). */
export function TicketIconButton({
  title,
  onClick,
  disabled,
  tone = 'default',
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-11 h-11 shrink-0 grid place-items-center rounded-lg border border-line transition-colors disabled:opacity-50 ${
        tone === 'danger' ? 'text-danger hover:bg-danger/10 hover:border-danger/30' : 'text-ink-2 hover:bg-sunken hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
