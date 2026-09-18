'use client';

import { Armchair, Bike, ShoppingBag } from 'lucide-react';

type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | string | null | undefined;

const typeConfig = (type: OrderType) => {
  switch (type) {
    case 'DINE_IN':
      return { label: 'Dine-in', Icon: Armchair, className: 'bg-info/10 text-info border-info/20' };
    case 'TAKEAWAY':
      return { label: 'Takeaway', Icon: ShoppingBag, className: 'bg-brand-soft text-brand-strong border-brand-dim' };
    case 'DELIVERY':
      return { label: 'Delivery', Icon: Bike, className: 'bg-special/10 text-special border-special/20' };
    default:
      return { label: 'Order', Icon: ShoppingBag, className: 'bg-sunken text-ink-2 border-line' };
  }
};

/**
 * A service type is operational information, not decoration. Keeping this
 * compact marker identical on Home, Tickets and order detail makes a crowded
 * board scannable without using another row of prose or colour conventions.
 */
export function OrderTypeBadge({ type, compact = false }: { type: OrderType; compact?: boolean }) {
  const { label, Icon, className } = typeConfig(type);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-semibold whitespace-nowrap ${className} ${
      compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
    }`}>
      <Icon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden />
      {label}
    </span>
  );
}
