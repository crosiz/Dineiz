'use client';

import { Ban, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { formatPKR } from '@/lib/utils';

// ── The menu card ───────────────────────────────────────────────────────────
//
// TEXT-FIRST, deliberately. A cashier is not choosing a dish — they are finding
// a name they already know, as fast as possible. Every serious restaurant POS
// (Square, Toast, Clover, TouchBistro, Lightspeed) puts the name and the price
// on the button and nothing else; photography belongs on the customer-facing
// surfaces (QR menu, self-order kiosk) where someone actually is choosing.
//
// It also matches the data. In the seeded tenant, 1 of 36 items has an image —
// which is normal for this market, nobody photographs 36 dishes. An
// image-shaped card therefore isn't a card with an occasional gap: the gap IS
// the normal state. The previous version filled it with a monogram tile, and
// before that with a keyword→emoji lookup ('kabab' → 🍢), and either way ~60%
// of every card was given over to nothing. On a phone that meant TWO items
// visible at a time out of thirty-six.
//
// So: no image, no image area. When an item does have one it becomes a small
// leading thumbnail, which keeps every row the same height on a mixed menu
// instead of making the grid ragged.

export type ViewMode = 'grid' | 'list';

interface MenuItemCardProps {
  item: {
    id: string;
    name: string;
    basePrice: number;
    image?: string | null;
    categoryName?: string;
    isAvailable?: boolean;
    variations?: any[];
    addOns?: any[];
  };
  cartQty: number;
  onTap: (item: any) => void;
  viewMode?: ViewMode;
  /** Shows the sold-out ("86") toggle. Manager-only; omitted for a cashier. */
  onToggleAvailable?: (item: any, nextAvailable: boolean) => void;
  isTogglingAvailable?: boolean;
  /** Only when the surrounding context doesn't already name the category. */
  showCategory?: boolean;
}

export function MenuItemCard({
  item,
  cartQty,
  onTap,
  viewMode = 'grid',
  onToggleAvailable,
  isTogglingAvailable,
  showCategory = false,
}: MenuItemCardProps) {
  const unavailable = item.isAvailable === false;
  const hasOptions = !!(item.variations?.length || item.addOns?.length);
  const inCart = cartQty > 0;
  const isList = viewMode === 'list';

  // A div, not a <button>: the card itself is already a button, and nesting
  // buttons is invalid HTML and breaks hydration.
  const soldOutToggle = onToggleAvailable ? (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={isTogglingAvailable}
      aria-label={unavailable ? `Mark ${item.name} available` : `Mark ${item.name} sold out`}
      onClick={(e) => { e.stopPropagation(); if (!isTogglingAvailable) onToggleAvailable(item, unavailable); }}
      onKeyDown={(e) => {
        if (isTogglingAvailable) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleAvailable(item, unavailable); }
      }}
      title={unavailable ? 'Mark available' : 'Mark sold out'}
      className={`shrink-0 grid place-items-center w-6 h-6 rounded-full border transition-colors ${
        isTogglingAvailable ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
      } ${
        unavailable
          ? 'bg-ink border-ink text-white'
          : 'bg-surface border-line text-ink-4 hover:text-danger hover:border-danger/40'
      }`}
    >
      {isTogglingAvailable
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : unavailable ? <RotateCcw className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
    </div>
  ) : null;

  const thumb = item.image ? (
    <img
      src={item.image}
      alt=""
      className={`shrink-0 rounded-md object-cover border border-line ${isList ? 'w-10 h-10' : 'w-8 h-8'}`}
    />
  ) : null;

  const qtyBadge = inCart ? (
    <span className="shrink-0 grid place-items-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-white font-semibold text-[12px] tabular-nums">
      {cartQty}
    </span>
  ) : null;

  const price = (
    <span className={`text-[13px] font-semibold tabular-nums tracking-tight ${unavailable ? 'text-ink-4' : 'text-ink-2'}`}>
      {formatPKR(item.basePrice)}
    </span>
  );

  const frame =
    `group relative w-full text-left rounded-xl border transition-colors ${
      inCart ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-sunken hover:border-line-strong'
    } ${unavailable ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'}`;

  // ── LIST — one item per row, name left, price right ───────────────────────
  // The price column aligns down the page, which is the fastest thing to scan
  // when a cashier is checking a total rather than finding a dish.
  if (isList) {
    return (
      <button
        data-testid="menu-item"
        onClick={() => !unavailable && onTap(item)}
        disabled={unavailable}
        className={`${frame} flex items-center gap-3 min-h-[56px] px-3 py-2`}
      >
        {thumb}
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] leading-tight text-ink truncate">{item.name}</span>
          {(showCategory && item.categoryName) || unavailable ? (
            <span className="block text-[11px] leading-tight text-ink-4 truncate">
              {unavailable ? 'Sold out' : item.categoryName}
            </span>
          ) : null}
        </span>
        {hasOptions && !unavailable && <ChevronRight className="w-4 h-4 shrink-0 text-ink-4" aria-label="Has options" />}
        {price}
        {qtyBadge}
        {soldOutToggle}
      </button>
    );
  }

  // ── GRID — compact tiles, big tap target, several columns ─────────────────
  return (
    <button
      data-testid="menu-item"
      onClick={() => !unavailable && onTap(item)}
      disabled={unavailable}
      className={`${frame} flex flex-col justify-between gap-1 min-h-[76px] p-2.5`}
    >
      <span className="flex items-start gap-2">
        {thumb}
        <span className="flex-1 min-w-0 text-[14px] leading-snug text-ink line-clamp-2">{item.name}</span>
        {qtyBadge}
      </span>

      <span className="flex items-end justify-between gap-2">
        {unavailable
          ? <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-4">Sold out</span>
          : price}
        <span className="flex items-center gap-1 shrink-0">
          {hasOptions && !unavailable && <ChevronRight className="w-3.5 h-3.5 text-ink-4" aria-label="Has options" />}
          {soldOutToggle}
        </span>
      </span>
    </button>
  );
}
