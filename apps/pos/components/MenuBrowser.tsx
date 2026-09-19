'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LayoutGrid, Rows3, Search, SlidersHorizontal, X } from 'lucide-react';
import type { CachedMenuItem } from '@/lib/db';
import { MenuItemCard, type ViewMode } from '@/components/MenuItemCard';
import { ScrollRail } from '@/components/ScrollRail';

interface Props {
  categories: { id: string; name: string; items: CachedMenuItem[] }[];
  items: CachedMenuItem[];
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  category: string | null;
  onCategory: (id: string | null) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  quantities: Record<string, number>;
  onTap: (item: CachedMenuItem) => void;
  onAvailability?: (item: CachedMenuItem, available: boolean) => void;
  togglingId?: string | null;
  orderTypeControl: ReactNode;
}

/** Layout only: orders and offline state remain in the order-entry page. */
export function MenuBrowser({ categories, items, loading, search, onSearch, category, onCategory, view, onView, quantities, onTap, onAvailability, togglingId, orderTypeControl }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [category, search]);
  const [manageAvailability, setManageAvailability] = useState(false);
  const allCount = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const navigation = [{ id: null, name: 'All items', count: allCount }, ...categories.map(cat => ({ ...cat, count: cat.items.length }))];
  const grid = view === 'grid'
    ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,140px),1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5'
    : 'grid-cols-1 gap-1.5';
  const groups = category
    ? [{ id: category, name: categories.find(cat => cat.id === category)?.name ?? 'Menu', items }]
    : categories.map(cat => ({ ...cat, items: items.filter(item => item.categoryId === cat.id) })).filter(cat => cat.items.length);

  return (
    <section aria-label="Menu" className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-canvas">
      <div className="lg:hidden shrink-0 px-3 pt-3 bg-surface">
        <div className="flex rounded-lg border border-line bg-canvas p-1">{orderTypeControl}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface p-3 sm:px-5 sm:py-4">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-canvas pl-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
          <Search size={18} className="shrink-0 text-ink-3" aria-hidden />
          <input aria-label="Search menu" value={search} onChange={e => onSearch(e.target.value)} placeholder="Search menu items…" className="h-11 min-w-0 flex-1 border-0 rounded-none bg-transparent pr-2 text-[16px] text-ink placeholder:text-ink-3 outline-none focus:shadow-none" />
          {search && <button type="button" aria-label="Clear menu search" onClick={() => onSearch('')} className="grid h-11 w-11 shrink-0 place-items-center text-ink-3 hover:text-ink"><X size={18} /></button>}
        </label>
        {onAvailability && <button type="button" aria-pressed={manageAvailability} title="Manage availability" aria-label="Manage availability" onClick={() => setManageAvailability(!manageAvailability)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${manageAvailability ? 'border-ink bg-ink text-white' : 'border-line text-ink-3'}`}><SlidersHorizontal size={18} /></button>}
        <button type="button" aria-label={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'} onClick={() => onView(view === 'grid' ? 'list' : 'grid')} className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink-2 hover:bg-canvas">
          {view === 'grid' ? <Rows3 size={18} /> : <LayoutGrid size={18} />}<span className="hidden sm:inline">{view === 'grid' ? 'List' : 'Cards'}</span>
        </button>
      </div>
      <div className="lg:hidden shrink-0 border-b border-line bg-surface">
        <ScrollRail aria-label="Menu categories" className="h-[52px] px-3">
          {navigation.map(cat => <button type="button" key={cat.id ?? 'all'} aria-pressed={category === cat.id} onClick={() => onCategory(cat.id)} className={`h-11 shrink-0 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${category === cat.id ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}>{cat.name}</button>)}
        </ScrollRail>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Menu categories" className="hidden lg:flex w-[156px] xl:w-[172px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-3">
          <p className="px-2 pb-2 pt-1 text-xs font-medium text-ink-3">Categories</p>
          {navigation.map(cat => <button type="button" key={cat.id ?? 'all'} aria-pressed={category === cat.id} onClick={() => onCategory(cat.id)} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[13px] leading-5 ${category === cat.id ? 'bg-sunken font-semibold text-ink' : 'text-ink-3 hover:bg-canvas hover:text-ink'}`}>
            <span>{cat.name}</span><span className="text-xs tabular-nums text-ink-3">{cat.count}</span>
          </button>)}
        </nav>
        <div ref={scrollRef} data-testid="menu-scroll" className="min-w-0 min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {manageAvailability && <p className="mb-4 rounded-lg border border-line bg-surface p-3 text-sm text-ink-2">Availability mode · Use the control beside a price to mark an item sold out. Changes require a connection.</p>}
          {loading ? <div className={`grid ${grid}`} aria-busy="true">{Array.from({ length: 12 }, (_, i) => <div key={i} className="h-[122px] rounded-lg border border-line bg-surface p-3.5 animate-pulse"><div className="h-4 w-4/5 rounded bg-sunken" /><div className="mt-12 h-3 w-1/3 rounded bg-sunken" /></div>)}</div> : items.length ? <div className="space-y-6">
            {groups.map(group => <section key={group.id} aria-label={group.name}>
              <header className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-[16px] font-semibold tracking-tight text-ink">{group.name}</h2><span className="text-xs tabular-nums text-ink-3">{group.items.length} items</span>
              </header>
              <div className={`grid ${grid}`}>{group.items.map(item => <MenuItemCard key={item.id} item={item} cartQty={quantities[item.id] ?? 0} onTap={onTap} viewMode={view} onToggleAvailable={manageAvailability ? onAvailability : undefined} isTogglingAvailable={togglingId === item.id} />)}</div>
            </section>)}
          </div> : <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center"><Search size={28} strokeWidth={1.5} className="text-ink-4" /><h2 className="mt-2 text-base font-semibold text-ink">No items found</h2><p className="text-sm text-ink-3">Try another name or category.</p><button type="button" onClick={() => { onSearch(''); onCategory(null); }} className="mt-2 min-h-11 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink">Show all items</button></div>}
        </div>
      </div>
    </section>
  );
}
