'use client';

import { useState } from 'react';
import { Ban, ChevronRight, Loader2, Plus, RotateCcw } from 'lucide-react';
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

export function MenuItemCard({ item, cartQty, onTap, viewMode = 'grid', onToggleAvailable, isTogglingAvailable, showCategory }: MenuItemCardProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const unavailable = item.isAvailable === false;
  const hasOptions = !!(item.variations?.length || item.addOns?.length);
  const isList = viewMode === 'list';
  const photo = item.image && failedImage !== item.image;

  return (
    <div className={`relative h-full overflow-hidden rounded-lg border transition-colors ${cartQty ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong'}`}>
      <button type="button" data-testid="menu-item" onClick={() => onTap(item)} disabled={unavailable}
        aria-label={`${item.name}, ${formatPKR(item.basePrice)}${hasOptions ? ', choose options' : ''}${unavailable ? ', sold out' : ''}${cartQty ? ', ' + cartQty + ' in order' : ''}`}
        className={`group flex w-full h-full gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:opacity-50 ${isList ? 'min-h-[72px] items-center px-3 py-2' : 'min-h-[120px] flex-col justify-between p-3.5 hover:bg-canvas/40'}`}>
        <span className={`flex min-w-0 gap-3 ${isList ? 'flex-1 items-center' : 'w-full items-start'}`}>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] sm:text-[15px] font-semibold leading-5 text-ink line-clamp-2" title={item.name}>{item.name}</span>
            {showCategory && item.categoryName && <span className="mt-1 block truncate text-xs text-ink-3">{item.categoryName}</span>}
          </span>
          {photo && <img src={item.image!} alt="" loading="lazy" onError={() => setFailedImage(item.image!)} className={`${isList ? 'h-10 w-10' : 'h-12 w-12'} shrink-0 rounded-md object-cover`} />}
        </span>
        <span className={`flex items-center justify-between gap-2 ${isList ? 'shrink-0' : 'w-full'} ${onToggleAvailable ? 'pr-10' : ''}`}>
          <span className="text-[13px] sm:text-sm font-medium text-ink-2 tabular-nums">{unavailable ? 'Sold out' : formatPKR(item.basePrice)}</span>
          {!unavailable && <span className={`flex h-7 min-w-7 shrink-0 items-center justify-center gap-1 rounded-md ${cartQty ? 'bg-brand text-on-brand px-1.5' : 'bg-sunken text-ink-3 group-hover:bg-hover'}`} aria-hidden>
            {cartQty > 0 && <span className="text-xs font-semibold tabular-nums">{cartQty}</span>}
            {hasOptions ? <ChevronRight size={15} /> : <Plus size={15} />}
          </span>}
        </span>
      </button>
      {onToggleAvailable && <button type="button" disabled={isTogglingAvailable} onClick={() => onToggleAvailable(item, unavailable)}
        aria-label={unavailable ? `Mark ${item.name} available` : `Mark ${item.name} sold out`}
        className={`absolute right-0 flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 hover:bg-sunken focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${isList ? 'top-1/2 -translate-y-1/2' : 'bottom-1.5'}`}>
        {isTogglingAvailable ? <Loader2 size={16} className="animate-spin" /> : unavailable ? <RotateCcw size={16} /> : <Ban size={16} />}
      </button>}
    </div>
  );
}
