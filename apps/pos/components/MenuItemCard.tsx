'use client';

import { Ban, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { formatPKR } from '@/lib/utils';

// ── The menu card ───────────────────────────────────────────────────────────
//
// Two layouts, grid and list. There used to be five (`grid | compact | large |
// detailed | minimal`), three of them reachable from a three-way toggle above
// the grid, all rendering the same four facts in a different arrangement — a
// choice a cashier has to make mid-service that changes nothing about the job.
//
// There was also a 32-entry THEMES table mapping English keywords to a food
// emoji and a pastel gradient — 'kabab' → 🍢, 'biryani' → 🍛, 'lassi' → 🥛 —
// used as the placeholder for any item without a photo, and ALSO printed next
// to the category label on every single card. It made the menu look like
// clip-art, and it only worked for a tenant whose categories happen to be named
// in English with those exact words; everyone else got 🍽️ on every item. An
// item with no photo now gets a quiet monogram of its own name, which is
// honest, works in any language, and reads as deliberate.

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
  /** The category is already stated by the section heading when browsing All. */
  showCategory?: boolean;
}

/** Up to two letters from the item's own name — no lookup table, no language assumption. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Monogram({ name, className = '' }: { name: string; className?: string }) {
  return (
    <div className={`w-full h-full flex items-center justify-center bg-sunken select-none ${className}`}>
      <span className="font-semibold text-ink-4 tracking-wide" style={{ fontSize: 'clamp(14px, 32%, 34px)' }}>
        {monogram(name)}
      </span>
    </div>
  );
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

  // A div rather than a <button>: every layout's outer element is already a
  // button, and nesting buttons is invalid HTML and breaks hydration.
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
      className={`shrink-0 grid place-items-center w-7 h-7 rounded-full border transition-colors ${
        isTogglingAvailable ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
      } ${
        unavailable
          ? 'bg-ink border-ink text-white'
          : 'bg-surface border-line text-ink-4 hover:text-danger hover:border-danger/40'
      }`}
    >
      {isTogglingAvailable
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : unavailable ? <RotateCcw className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
    </div>
  ) : null;

  const priceEl = (
    <span className={`font-semibold tabular-nums tracking-tight ${unavailable ? 'text-ink-4' : 'text-ink'}`}>
      {formatPKR(item.basePrice)}
    </span>
  );

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <button
        data-testid="menu-item"
        onClick={() => !unavailable && onTap(item)}
        disabled={unavailable}
        className={`group w-full text-left flex items-center gap-3 h-[64px] pl-2 pr-3 rounded-xl border transition-colors ${
          inCart
            ? 'border-brand bg-brand-soft'
            : 'border-line bg-surface hover:bg-sunken'
        } ${unavailable ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-line">
          {item.image
            ? <img src={item.image} alt="" className="w-full h-full object-cover" />
            : <Monogram name={item.name} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[15px] text-ink truncate">{item.name}</span>
            {unavailable && <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-4 shrink-0">Sold out</span>}
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            {priceEl}
            {hasOptions && !unavailable && <span className="text-ink-4 text-[12px]">· options</span>}
          </div>
        </div>

        {inCart && (
          <span className="shrink-0 grid place-items-center min-w-6 h-6 px-1.5 rounded-full bg-brand text-white font-semibold text-[12px] tabular-nums">
            {cartQty}
          </span>
        )}
        {soldOutToggle}
      </button>
    );
  }

  // ── GRID ──────────────────────────────────────────────────────────────────
  return (
    <button
      data-testid="menu-item"
      onClick={() => !unavailable && onTap(item)}
      disabled={unavailable}
      className={`group relative w-full text-left flex flex-col rounded-xl border overflow-hidden transition-all ${
        inCart
          ? 'border-brand ring-1 ring-brand/30'
          : 'border-line hover:border-line-strong hover:shadow-sm'
      } ${unavailable ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-sunken">
        {item.image
          ? <img src={item.image} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : <Monogram name={item.name} />}

        {inCart && (
          <span className="absolute top-2 right-2 grid place-items-center min-w-6 h-6 px-1.5 rounded-full bg-brand text-white font-semibold text-[12px] tabular-nums shadow-sm">
            {cartQty}
          </span>
        )}
        {unavailable && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-[10px] font-semibold uppercase tracking-widest text-center py-1">
            Sold out
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-1 p-3 bg-surface">
        {/* Only when the surrounding context doesn't already say it — browsing a
            single category, or under a category heading, it's noise. It used to
            print on every card in every mode, next to a food emoji. */}
        {showCategory && item.categoryName && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-4 truncate">
            {item.categoryName}
          </span>
        )}

        <span className="text-[14px] leading-snug text-ink line-clamp-2 font-medium">{item.name}</span>

        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
          <span className="text-[15px]">{priceEl}</span>
          <div className="flex items-center gap-1 shrink-0">
            {hasOptions && !unavailable && (
              <ChevronRight className="w-4 h-4 text-ink-4" aria-label="Has options" />
            )}
            {soldOutToggle}
          </div>
        </div>
      </div>
    </button>
  );
}
