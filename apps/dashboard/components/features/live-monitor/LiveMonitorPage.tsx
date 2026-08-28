'use client';

import React, { useMemo } from 'react';
import { MonitorTopBar } from './MonitorTopBar';
import { MonitorFooterBar } from './MonitorFooterBar';
import { OrderKanbanColumn } from './OrderKanbanColumn';
import { useOrderMonitor } from './hooks/useOrderMonitor';

const PENDING_STATUSES   = ['PENDING'];
const KITCHEN_STATUSES   = ['CONFIRMED', 'IN_KITCHEN', 'IN_PREPARATION'];
const READY_STATUSES     = ['READY'];
const COMPLETED_STATUSES = ['DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

export function LiveMonitorPage() {
  const {
    orders,
    summary,
    isLoading,
    lastUpdated,
    socketStatus,
    soundOn,
    setSoundOn,
    selectedBranchId,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    isBranchManager,
    updateOrderStatus,
    refetch,
  } = useOrderMonitor();

  // ── Apply client-side type filter ────────────────────────────────────────────
  const visibleOrders = useMemo(() => {
    let filtered = orders;
    if (selectedType) filtered = filtered.filter(o => o.type === selectedType);
    return filtered;
  }, [orders, selectedType]);

  // ── Sort into columns ─────────────────────────────────────────────────────────
  const pendingOrders   = visibleOrders.filter(o => PENDING_STATUSES.includes(o.status));
  const kitchenOrders   = visibleOrders.filter(o => KITCHEN_STATUSES.includes(o.status));
  const readyOrders     = visibleOrders.filter(o => READY_STATUSES.includes(o.status));
  const completedOrders = visibleOrders.filter(o => COMPLETED_STATUSES.includes(o.status));

  // ── Status filter — show/hide columns ────────────────────────────────────────
  const showPending   = !selectedStatus || selectedStatus === 'PENDING';
  const showKitchen   = !selectedStatus || selectedStatus === 'IN_KITCHEN';
  const showReady     = !selectedStatus || selectedStatus === 'READY';
  const showCompleted = !selectedStatus || selectedStatus === 'COMPLETED';

  const showBranch = !isBranchManager;

  if (isLoading) {
    return (
      <main className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 w-full">
        <MonitorTopBar
          soundOn={soundOn} onSoundToggle={setSoundOn}
          lastUpdated={new Date()}
          selectedType={selectedType}
          onTypeChange={setSelectedType} selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          onRefresh={refetch}
        />
        <section className="flex-1 grid grid-cols-4 gap-px bg-slate-200 p-px overflow-hidden pb-12">
          {[0, 1, 2, 3].map(colIdx => (
            <div key={colIdx} className="bg-slate-50 h-full flex flex-col overflow-hidden">
              <div className="h-[65px] bg-white border-b border-slate-200 px-6 flex items-center shrink-0">
                <div className="h-4 w-32 skeleton-shimmer rounded" />
              </div>
              <div className="flex-1 p-4 space-y-3">
                {[0, 100, 200].map(delay => (
                  <div key={delay} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <div className="h-6 w-24 skeleton-shimmer rounded" style={{ animationDelay: `${delay}ms` }} />
                      <div className="h-4 w-12 skeleton-shimmer rounded-full" style={{ animationDelay: `${delay}ms` }} />
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="h-3 w-full skeleton-shimmer rounded" style={{ animationDelay: `${delay}ms` }} />
                      <div className="h-3 w-3/4 skeleton-shimmer rounded" style={{ animationDelay: `${delay}ms` }} />
                    </div>
                    <div className="h-10 w-full skeleton-shimmer rounded mt-4" style={{ animationDelay: `${delay}ms` }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
        <MonitorFooterBar summary={summary} socketStatus={socketStatus} />
      </main>
    );
  }

  // Build columns array respecting selectedStatus filter
  const columns = [
    showPending && {
      key: 'pending',
      title: 'Pending',
      orders: pendingOrders,
      dotColor: 'bg-amber-500',
      badgeColors: 'bg-amber-100 text-amber-800',
      statusConfig: { color: 'text-amber-600', borderClass: 'border-amber-500' },
    },
    showKitchen && {
      key: 'kitchen',
      title: 'In Kitchen',
      orders: kitchenOrders,
      dotColor: 'bg-blue-500',
      badgeColors: 'bg-blue-100 text-blue-800',
      statusConfig: { color: 'text-blue-600', borderClass: 'border-blue-500' },
    },
    showReady && {
      key: 'ready',
      title: 'Ready',
      orders: readyOrders,
      dotColor: 'bg-emerald-500',
      badgeColors: 'bg-emerald-100 text-emerald-800',
      statusConfig: { color: 'text-emerald-600', borderClass: 'border-emerald-500' },
    },
    showCompleted && {
      key: 'completed',
      title: 'Completed',
      orders: completedOrders,
      dotColor: 'bg-slate-500',
      badgeColors: 'bg-slate-200 text-slate-800',
      statusConfig: { color: 'text-slate-500', borderClass: 'border-slate-400', bgClass: 'bg-slate-100/50 opacity-70', isCompleted: true },
    },
  ].filter(Boolean) as NonNullable<(typeof columns)[number]>[];

  const colCount = columns.length;

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 w-full">
      <MonitorTopBar
        soundOn={soundOn}
        onSoundToggle={setSoundOn}
        lastUpdated={lastUpdated}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        onRefresh={refetch}
      />

      <section
        className="flex-1 grid grid-cols-4 gap-px bg-slate-200 p-px overflow-hidden pb-12"
      >
        {columns.map(col => (
          <OrderKanbanColumn
            key={col.key}
            title={col.title}
            orders={col.orders}
            dotColor={col.dotColor}
            badgeColors={col.badgeColors}
            statusConfig={col.statusConfig}
            showBranch={showBranch}
            onAction={updateOrderStatus}
          />
        ))}
      </section>

      <MonitorFooterBar summary={summary} socketStatus={socketStatus} />
    </main>
  );
}
