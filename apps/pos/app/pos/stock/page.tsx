'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useCartStore } from '@/lib/store';
import { getToken } from '@/lib/pos-session';
import { useSocket } from '@/contexts/SocketContext';
import { useTopBar } from '@/hooks/useTopBar';
import { toast } from 'sonner';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Bell,
  EyeOff,
  SlidersHorizontal,
  PackageCheck,
} from 'lucide-react';
import { ManagerOverrideModal } from '@/components/ManagerOverrideModal';
import { Dialog, DialogButton } from '@/components/ui/Dialog';
import { API_URL } from '@/lib/api';
import { cachedRead } from '@/lib/cached-read';


type StockStatus = 'OUT' | 'LOW' | 'OK';
type StockUnit = 'PCS' | 'GRAM' | 'KILOGRAM' | 'ML' | 'LITER';

interface StockItem {
  ingredientId: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  threshold: number;
  status: StockStatus;
  affectedItems: Array<{ id: string; name: string }>;
  estimatedPortions: number | null;
  updatedAt: string;
}

interface StockStatusResponse {
  counts: { out: number; low: number; ok: number };
  items: StockItem[];
}

type FilterKey = 'PROBLEMS' | 'ALL' | 'OUT' | 'LOW' | 'OK';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'PROBLEMS', label: 'Needs Attention' },
  { key: 'ALL', label: 'All' },
  { key: 'OUT', label: 'Out of Stock' },
  { key: 'LOW', label: 'Low Stock' },
  { key: 'OK', label: 'OK' },
];

function formatUnit(unit: string): string {
  switch (unit) {
    case 'GRAM': return 'g';
    case 'KILOGRAM': return 'kg';
    case 'ML': return 'ml';
    case 'LITER': return 'L';
    default: return 'pcs';
  }
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? q.toLocaleString() : q.toFixed(2);
}

function timeAgo(date: Date | null, nowMs: number): string {
  if (!date) return 'just now';
  const mins = Math.floor((nowMs - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return '1 hr ago';
  if (hrs < 24) return `${hrs} hrs ago`;
  return date.toLocaleDateString();
}

export default function StockPage() {
  const session = useCartStore((s) => s.session);
  const { posSocket } = useSocket();
  const isManager = session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN';

  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('PROBLEMS');
  const [now, setNow] = useState(() => Date.now());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [offlineSnapshot, setOfflineSnapshot] = useState(false);

  // Stock status shares the app-wide React Query cache, so coming back to this
  // tab within staleTime is instant instead of a cold "Loading stock status…".
  const branchId = session?.branchId;
  const stockQuery = useQuery<StockStatusResponse>({
    networkMode: 'always',
    retry: false,
    queryKey: ['pos-stock-status', branchId ?? null],
    enabled: !!branchId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await cachedRead<StockStatusResponse>(`/api/pos/stock-status?branchId=${branchId}`);
      setOfflineSnapshot(result.offline);
      return result.data;
    },
  });
  const data = stockQuery.data ?? null;
  const loading = stockQuery.isLoading;
  const refreshing = stockQuery.isFetching;
  const lastFetchedAt = stockQuery.dataUpdatedAt ? new Date(stockQuery.dataUpdatedAt) : null;
  const refetchStock = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pos-stock-status'] });
  }, [queryClient]);

  useEffect(() => {
    if (stockQuery.isError) toast.error('Could not load stock status');
  }, [stockQuery.isError]);

  // Quick Adjust flow: capture the new quantity first, then gate the actual
  // write behind the manager PIN + reason (ManagerOverrideModal).
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustStep, setAdjustStep] = useState<'qty' | 'pin' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh whenever the backend says inventory moved for this branch.
  useEffect(() => {
    if (!posSocket) return;
    const handler = (payload: any) => {
      if (payload?.branchId && session?.branchId && payload.branchId !== session.branchId) return;
      refetchStock();
    };
    posSocket.on('inventory:updated', handler);
    return () => { posSocket.off('inventory:updated', handler); };
  }, [posSocket, session?.branchId, refetchStock]);

  const mostRecentUpdate = useMemo(() => {
    if (!data || data.items.length === 0) return lastFetchedAt;
    const max = data.items.reduce((acc, item) => {
      const t = new Date(item.updatedAt).getTime();
      return t > acc ? t : acc;
    }, 0);
    return max > 0 ? new Date(max) : lastFetchedAt;
  }, [data, lastFetchedAt]);

  useTopBar({
    pageTitle: 'Stock Status',
    breadcrumb: `${session?.branchName ? `${session.branchName} • ` : ''}Updated ${timeAgo(mostRecentUpdate, now)}`,
    rightActions: (
      <button
        onClick={() => refetchStock()}
        className={`p-1.5 rounded-full text-ink-3 hover:bg-hover transition-colors ${refreshing ? 'animate-spin text-brand' : ''}`}
        title="Refresh"
      >
        <RefreshCw size={18} />
      </button>
    ),
  });

  const handleMarkUnavailable = async (item: StockItem) => {
    if (item.affectedItems.length === 0) {
      toast.info('No menu items are linked to this ingredient yet.');
      return;
    }
    const key = `${item.ingredientId}-unavailable`;
    setBusyKey(key);
    try {
      const res = await fetch(`${API_URL}/api/menu/items/bulk-availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          itemIds: item.affectedItems.map((i) => i.id),
          isAvailable: false,
          branchId: session.branchId,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${item.affectedItems.length} item${item.affectedItems.length > 1 ? 's' : ''} marked unavailable`);
    } catch {
      toast.error('Could not update item availability');
    } finally {
      setBusyKey(null);
    }
  };

  const handleNotifyManager = async (item: StockItem) => {
    const key = `${item.ingredientId}-notify`;
    setBusyKey(key);
    try {
      const res = await fetch(`${API_URL}/api/pos/stock/notify-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ branchId: session.branchId, ingredientId: item.ingredientId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.sent) throw new Error();
      toast.success(`Manager notified about ${item.name}`);
    } catch {
      toast.error('Could not notify manager');
    } finally {
      setBusyKey(null);
    }
  };

  const openQuickAdjust = (item: StockItem) => {
    setAdjustItem(item);
    setAdjustQty(formatQty(item.quantity));
    setAdjustStep('qty');
  };

  const closeQuickAdjust = () => {
    setAdjustItem(null);
    setAdjustQty('');
    setAdjustStep(null);
  };

  const submitQtyStep = () => {
    const qtyNum = parseFloat(adjustQty);
    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    setAdjustStep('pin');
  };

  const handleQuickAdjustConfirm = async (pin: string, reason: string) => {
    if (!adjustItem) return;
    const qtyNum = parseFloat(adjustQty);
    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      throw new Error('Enter a valid quantity');
    }

    const pinRes = await fetch(`${API_URL}/api/pos/auth/validate-manager-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ pin, branchId: session.branchId }),
    });
    if (!pinRes.ok) {
      const err = await pinRes.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid PIN');
    }

    const adjustRes = await fetch(`${API_URL}/api/pos/stock/quick-adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        branchId: session.branchId,
        ingredientId: adjustItem.ingredientId,
        quantity: qtyNum,
        reason,
      }),
    });
    if (!adjustRes.ok) {
      throw new Error('Failed to update stock');
    }

    toast.success(`${adjustItem.name} updated to ${formatQty(qtyNum)} ${formatUnit(adjustItem.unit)}`);
    closeQuickAdjust();
    refetchStock();
  };

  // Stock is one of the few screens with a genuine remote first load (it isn't
  // in the event store). Say so plainly — the same quiet, centred line Tickets
  // uses for order history — rather than drawing placeholder bars that don't
  // match the rows they stand in for.
  if (loading && !data) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--pos-bg-base,#F8FAFC)]">
        <p className="text-ink-4 text-[13px] font-medium">Loading stock status…</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const counts = data?.counts ?? { out: 0, low: 0, ok: 0 };
  const noProblems = counts.out === 0 && counts.low === 0;

  const filteredItems = items.filter((i) => {
    switch (filter) {
      case 'ALL': return true;
      case 'OUT': return i.status === 'OUT';
      case 'LOW': return i.status === 'LOW';
      case 'OK': return i.status === 'OK';
      case 'PROBLEMS':
      default:
        return i.status === 'OUT' || i.status === 'LOW';
    }
  });

  return (
    <div className="h-full bg-canvas text-ink pb-24 font-body-md select-none overflow-y-auto">
      <main className="max-w-3xl mx-auto p-4 lg:p-6 space-y-5">
        {offlineSnapshot && <p role="status" className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-ink-2">Offline · Last saved stock levels. Changes from other terminals will appear after reconnecting.</p>}
        {stockQuery.isError && !data && <p role="alert" className="rounded-xl border border-line bg-surface p-4 text-sm">Stock has not been downloaded on this terminal. Connect once to save a copy.</p>}
        {/* Summary cards */}
        <section className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setFilter('OUT')}
            className={`rounded-2xl p-4 text-left border transition-all active:scale-[0.98] ${
              filter === 'OUT' ? 'bg-rose-600 border-rose-600 shadow-md' : 'bg-white border-line hover:border-rose-200'
            }`}
          >
            <AlertTriangle size={18} className={filter === 'OUT' ? 'text-white' : 'text-rose-600'} />
            <p className={`text-[26px] font-bold mt-2 ${filter === 'OUT' ? 'text-white' : 'text-ink'}`}>{counts.out}</p>
            <p className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 ${filter === 'OUT' ? 'text-white/80' : 'text-ink-3'}`}>Out of Stock</p>
          </button>
          <button
            onClick={() => setFilter('LOW')}
            className={`rounded-2xl p-4 text-left border transition-all active:scale-[0.98] ${
              filter === 'LOW' ? 'bg-amber-500 border-amber-500 shadow-md' : 'bg-white border-line hover:border-amber-200'
            }`}
          >
            <AlertCircle size={18} className={filter === 'LOW' ? 'text-white' : 'text-amber-600'} />
            <p className={`text-[26px] font-bold mt-2 ${filter === 'LOW' ? 'text-white' : 'text-ink'}`}>{counts.low}</p>
            <p className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 ${filter === 'LOW' ? 'text-white/80' : 'text-ink-3'}`}>Low Stock</p>
          </button>
          <button
            onClick={() => setFilter('OK')}
            className={`rounded-2xl p-4 text-left border transition-all active:scale-[0.98] ${
              filter === 'OK' ? 'bg-emerald-600 border-emerald-600 shadow-md' : 'bg-white border-line hover:border-emerald-200'
            }`}
          >
            <CheckCircle2 size={18} className={filter === 'OK' ? 'text-white' : 'text-emerald-600'} />
            <p className={`text-[26px] font-bold mt-2 ${filter === 'OK' ? 'text-white' : 'text-ink'}`}>{counts.ok}</p>
            <p className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 ${filter === 'OK' ? 'text-white/80' : 'text-ink-3'}`}>OK</p>
          </button>
        </section>

        {/* Filter tabs */}
        <section className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-[12px] font-bold tracking-wide transition-colors border ${
                filter === tab.key
                  ? 'bg-ink border-ink text-white'
                  : 'bg-white border-line text-ink-3 hover:bg-sunken'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {/* Items */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-line shadow-sm p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <PackageCheck size={26} className="text-emerald-600" />
            </div>
            <h3 className="text-[16px] font-bold text-ink">
              {noProblems && (filter === 'PROBLEMS' || filter === 'OUT' || filter === 'LOW') ? 'All stocked up' : 'No items in this view'}
            </h3>
            <p className="text-[13px] text-ink-3 mt-1 max-w-[280px]">
              {noProblems && (filter === 'PROBLEMS' || filter === 'OUT' || filter === 'LOW')
                ? 'Every ingredient is above its low-stock threshold. Nice work.'
                : 'Try a different filter to see more ingredients.'}
            </p>
          </div>
        ) : (
          <section className="space-y-3">
            {filteredItems.map((item) => (
              <StockItemCard
                key={item.ingredientId}
                item={item}
                isManager={isManager}
                busyKey={busyKey}
                onMarkUnavailable={() => handleMarkUnavailable(item)}
                onNotifyManager={() => handleNotifyManager(item)}
                onQuickAdjust={() => openQuickAdjust(item)}
              />
            ))}
          </section>
        )}
      </main>

      {/* Quick Adjust — step 1: new quantity */}
      <Dialog
        open={adjustStep === 'qty' && !!adjustItem}
        onClose={closeQuickAdjust}
        z={110}
        icon={SlidersHorizontal}
        title="Adjust stock"
        description={adjustItem ? `${adjustItem.name}: set the quantity on hand now.` : undefined}
        footer={
          <>
            <DialogButton onClick={closeQuickAdjust}>Cancel</DialogButton>
            <DialogButton variant="ink" onClick={submitQtyStep} disabled={adjustQty.trim() === ''}>Continue</DialogButton>
          </>
        }
      >
        {adjustItem && (
          <label className="block">
            <span className="block text-[12px] font-medium text-ink-3 mb-1.5">
              New quantity ({formatUnit(adjustItem.unit)})
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitQtyStep()}
              className="w-full h-12 px-4 bg-surface border border-line-strong rounded-xl text-[16px] font-semibold text-ink tabular-nums focus:outline-none focus:border-ink"
            />
          </label>
        )}
      </Dialog>

      {/* Quick Adjust — step 2: manager PIN + reason. Only mounted while
          active so its internal PIN/reason state starts fresh each time. */}
      {adjustStep === 'pin' && adjustItem && (
        <ManagerOverrideModal
          isOpen={true}
          onClose={() => setAdjustStep('qty')}
          onConfirm={handleQuickAdjustConfirm}
          title="Adjust stock"
          description={`Set ${adjustItem.name} to ${formatQty(parseFloat(adjustQty) || 0)} ${formatUnit(adjustItem.unit)}.`}
          reasonLabel="Reason"
          reasonPlaceholder="e.g. Recount, waste, delivery received"
          confirmLabel="Adjust"
        />
      )}
    </div>
  );
}

function StockItemCard({
  item,
  isManager,
  busyKey,
  onMarkUnavailable,
  onNotifyManager,
  onQuickAdjust,
}: {
  item: StockItem;
  isManager: boolean;
  busyKey: string | null;
  onMarkUnavailable: () => void;
  onNotifyManager: () => void;
  onQuickAdjust: () => void;
}) {
  const isOut = item.status === 'OUT';
  const isLow = item.status === 'LOW';

  const statusStyles = isOut
    ? { border: 'border-rose-200', badgeBg: 'bg-rose-50', badgeText: 'text-rose-600', label: 'OUT' }
    : isLow
      ? { border: 'border-amber-200', badgeBg: 'bg-amber-50', badgeText: 'text-amber-600', label: 'LOW' }
      : { border: 'border-line', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-600', label: 'OK' };

  const StatusIcon = isOut ? AlertTriangle : isLow ? AlertCircle : CheckCircle2;

  const affectedNames = item.affectedItems.map((a) => a.name);
  const affectedLabel = affectedNames.length > 3
    ? `${affectedNames.slice(0, 3).join(', ')} +${affectedNames.length - 3} more`
    : affectedNames.join(', ');

  const isMarkingUnavailable = busyKey === `${item.ingredientId}-unavailable`;
  const isNotifying = busyKey === `${item.ingredientId}-notify`;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${statusStyles.border}`}>
      <div className="p-4 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${statusStyles.badgeBg}`}>
          <StatusIcon size={20} className={statusStyles.badgeText} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-ink truncate">{item.name}</h3>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusStyles.badgeBg} ${statusStyles.badgeText}`}>
              {statusStyles.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[13px] text-ink-3 font-medium">
            <span>{formatQty(item.quantity)} {formatUnit(item.unit)} on hand</span>
            {item.estimatedPortions !== null && (
              <>
                <span className="text-ink-4">•</span>
                <span>Est. {item.estimatedPortions} more portion{item.estimatedPortions === 1 ? '' : 's'}</span>
              </>
            )}
          </div>

          {affectedNames.length > 0 && (isOut || isLow) && (
            <p className={`text-[13px] font-semibold mt-2 leading-snug ${isOut ? 'text-rose-700' : 'text-amber-700'}`}>
              Affects: {affectedLabel}
            </p>
          )}
        </div>
      </div>

      {(isOut || isLow) && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          <button
            onClick={onMarkUnavailable}
            disabled={isMarkingUnavailable}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-white text-[12px] font-bold hover:bg-ink disabled:opacity-60 active:scale-95 transition-all"
          >
            <EyeOff size={14} />
            {isMarkingUnavailable ? 'Updating…' : 'Mark Items Unavailable'}
          </button>
          <button
            onClick={onNotifyManager}
            disabled={isNotifying}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-line text-ink-2 text-[12px] font-bold hover:bg-canvas disabled:opacity-60 active:scale-95 transition-all"
          >
            <Bell size={14} />
            {isNotifying ? 'Notifying…' : 'Notify Manager'}
          </button>
          {isManager && (
            <button
              onClick={onQuickAdjust}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-line text-ink-2 text-[12px] font-bold hover:bg-canvas active:scale-95 transition-all"
            >
              <SlidersHorizontal size={14} />
              Quick Adjust
            </button>
          )}
        </div>
      )}
    </div>
  );
}
