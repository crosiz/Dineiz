'use client';

import { Ban, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { formatPKR } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';
interface MenuItemCardProps {
  item: { id: string; name: string; basePrice: number; image?: string | null; categoryName?: string; isAvailable?: boolean; variations?: any[]; addOns?: any[] };
  cartQty: number;
  onTap: (item: any) => void;
  viewMode?: ViewMode;
  onToggleAvailable?: (item: any, nextAvailable: boolean) => void;
  isTogglingAvailable?: boolean;
  showCategory?: boolean;
}

export function MenuItemCard({ item, cartQty, onTap, onToggleAvailable, isTogglingAvailable, showCategory }: MenuItemCardProps) {
  const unavailable = item.isAvailable === false;
  const hasOptions = !!(item.variations?.length || item.addOns?.length);
  return (
    <div className={`relative rounded-xl border overflow-hidden transition-colors ${cartQty ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}>
      <button type="button" data-testid="menu-item" onClick={() => onTap(item)} disabled={unavailable}
        aria-label={`${item.name}, ${formatPKR(item.basePrice)}${unavailable ? ', sold out' : ''}${cartQty ? ', ' + cartQty + ' in order' : ''}`}
        className="flex w-full min-h-[104px] flex-col justify-between gap-3 p-3 text-left hover:bg-sunken/50 disabled:opacity-50">
        <span className="flex w-full items-start gap-2">
          {item.image && <img src={item.image} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />}
          <span className="flex-1 text-sm font-medium leading-5 text-ink line-clamp-2">{item.name}</span>
          {cartQty > 0 && <span className="min-w-5 rounded-md bg-brand px-1 text-center text-xs leading-5 font-semibold text-white tabular-nums">{cartQty}</span>}
        </span>
        {showCategory && <span className="text-xs text-ink-3">{item.categoryName}</span>}
        <span className={`flex w-full items-center justify-between gap-1 ${onToggleAvailable ? 'pr-10' : ''}`}>
          <span className="text-sm font-semibold text-ink-2 tabular-nums">{unavailable ? 'Sold out' : formatPKR(item.basePrice)}</span>
          {hasOptions && !unavailable && <ChevronRight size={16} className="text-ink-3" aria-label="Choose options" />}
        </span>
      </button>
      {onToggleAvailable && <button type="button" disabled={isTogglingAvailable} onClick={() => onToggleAvailable(item, unavailable)}
        aria-label={unavailable ? `Mark ${item.name} available` : `Mark ${item.name} sold out`}
        className="absolute right-0 bottom-0 flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 hover:bg-sunken">
        {isTogglingAvailable ? <Loader2 size={16} className="animate-spin" /> : unavailable ? <RotateCcw size={16} /> : <Ban size={16} />}
      </button>}
    </div>
  );
}
