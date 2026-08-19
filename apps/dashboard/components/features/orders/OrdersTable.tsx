'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Utensils, ShoppingBag, Bike, Loader2, User } from 'lucide-react';
import type { HistoryOrder } from './hooks/useOrders';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pagination } from '../../ui/Pagination';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api';

interface OrdersTableProps {
  orders: HistoryOrder[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onOrderClick: (id: string) => void;
  page: number;
  totalPages: number;
  limit: number;
  totalOrders: number;
  setPage: (p: number) => void;
  setLimit: (l: number) => void;
  isBranchManager: boolean;
  selectedBranchId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashColor(str: string) {
  const PALETTE = [
    'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700', 'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700', 'bg-pink-100 text-pink-700',
  ];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

function SourceBadge({ source }: { source: string }) {
  if (source === 'FOODPANDA') return <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-bold uppercase tracking-wider">🐼 Foodpanda</div>;
  if (source === 'CAREEM') return <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider">🚙 Careem</div>;
  if (source === 'TALABAT') return <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold uppercase tracking-wider">🧡 Talabat</div>;
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const dotMap: Record<string, string> = {
    PENDING: 'bg-amber-500', IN_KITCHEN: 'bg-blue-500', READY: 'bg-orange-500',
    DELIVERED: 'bg-emerald-500', COMPLETED: 'bg-emerald-500', CANCELLED: 'bg-slate-400',
    DISPATCHED: 'bg-purple-500',
  };
  const label: Record<string, string> = {
    IN_KITCHEN: 'In Kitchen', DELIVERED: 'Completed', COMPLETED: 'Completed',
    DISPATCHED: 'Dispatched',
  };
  return (
    <div className="inline-flex items-center gap-2 h-6">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotMap[status] ?? 'bg-slate-300'}`} />
      <span className="text-xs text-slate-600 capitalize whitespace-nowrap leading-none mt-0.5">
        {(label[status] ?? status).toLowerCase()}
      </span>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const icon = type === 'DINE_IN' ? <Utensils size={14} className="text-slate-400 shrink-0" /> : type === 'TAKEAWAY' ? <ShoppingBag size={14} className="text-slate-400 shrink-0" /> : <Bike size={14} className="text-slate-400 shrink-0" />;
  return (
    <div className="inline-flex items-center gap-2 h-6">
      {icon}
      <span className="text-xs text-slate-600 capitalize whitespace-nowrap leading-none mt-0.5">
        {type.replace('_', ' ').toLowerCase()}
      </span>
    </div>
  );
}
function PaymentBadge({ method }: { method: string }) {
  const labels: Record<string, string> = { CASH: 'Cash', CARD: 'Card', ONLINE: 'Online', SPLIT: 'Split' };
  return <span className="text-[11px] text-slate-600">{labels[method] ?? method}</span>;
}

// ── Actions dropdown ────────────────────────────────────────────────────────────
function ActionsMenu({ order, onView, onCancel }: {
  order: HistoryOrder;
  onView: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-700"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-44 py-1 overflow-hidden">
          <button
            onClick={e => { e.stopPropagation(); onView(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            View Details
          </button>
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); toast.info('Printing from the dashboard is coming soon — use the POS terminal for now'); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Reprint KOT
          </button>
          {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
            <button
              onClick={e => { e.stopPropagation(); onCancel(); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancel Order
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function OrdersTable({
  orders, isLoading, isError, onRetry, onOrderClick, page, totalPages, limit, totalOrders, setPage, setLimit, isBranchManager, selectedBranchId
}: OrdersTableProps) {
  const [cancelTarget, setCancelTarget] = useState<HistoryOrder | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalOrders);

  const rowVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end 
    : 0;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 min-h-[500px] flex flex-col">
        <div ref={parentRef} className="overflow-auto flex-1 max-h-[600px]">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  'Order #', 'Date & Time',
                  ...((!isBranchManager && !selectedBranchId) ? ['Branch'] : []),
                  'Type', 'Customer', 'Items',
                  'Total',
                  'Payment', 'Waiter', 'Status', 'Actions',
                ].map(h => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isError ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center">
                    <p className="text-sm font-medium text-red-500">Couldn't load orders.</p>
                    {onRetry && (
                      <button onClick={onRetry} className="mt-2 text-sm font-semibold text-[#ff5722] hover:underline">
                        Try again
                      </button>
                    )}
                  </td>
                </tr>
              ) : isLoading ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center">
                    <Loader2 size={28} className="animate-spin text-[#ff5722] mx-auto" />
                    <p className="mt-3 text-sm text-slate-400 font-medium">Loading orders…</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-400 font-medium text-sm">
                    No orders found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && <tr><td style={{ height: paddingTop }} colSpan={13} /></tr>}
                  {virtualItems.map(virtualRow => {
                    const order = orders[virtualRow.index];
                    return (
                      <tr
                        key={order.id}
                        className="h-[52px] hover:bg-orange-50/30 transition-colors cursor-pointer group"
                        onClick={() => onOrderClick(order.id)}
                      >
                        <td className="px-5 whitespace-nowrap font-mono text-[#FF5722] text-sm group-hover:underline">
                          #{order.orderNumber}
                        </td>
                        <td className="px-5 text-sm text-slate-600 whitespace-nowrap">
                          {fmtDateTime(order.dateTime)}
                        </td>
                        {(!isBranchManager && !selectedBranchId) && (
                          <td className="px-5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-tight ${hashColor(order.branchName)}`}>
                              {order.branchName || 'Main'}
                            </span>
                          </td>
                        )}
                        <td className="px-5 whitespace-nowrap">
                          <div className="flex flex-col items-start justify-center gap-1">
                            <div className="flex items-center gap-2">
                              <TypeBadge type={order.type} />
                              {order.source && !['POS', 'KIOSK', 'QR_CODE'].includes(order.source) && (
                                <SourceBadge source={order.source} />
                              )}
                            </div>
                            {order.type === 'DINE_IN' && order.tableLabel && (
                              <div className="text-xs text-gray-400 mt-0.5">Table {order.tableLabel}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 text-[13px] text-slate-700 whitespace-nowrap">
                          {order.customerName ?? (order.tableLabel ? `Table ${order.tableLabel}` : 'Guest')}
                        </td>
                        <td className="px-5 whitespace-nowrap">
                          <span className="text-[13px] text-slate-500 font-mono tracking-tight">{order.itemCount} items</span>
                        </td>
                        <td className="px-5 text-[13px] text-slate-900 font-mono tracking-tight whitespace-nowrap">
                          {formatPKR(order.total)}
                        </td>
                        <td className="px-5 whitespace-nowrap"><PaymentBadge method={order.paymentMethod} /></td>
                        <td className="px-5 text-xs text-slate-600 whitespace-nowrap">
                          {order.waiterName ? (
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 w-fit px-2 py-0.5 rounded border border-blue-100">
                              <User size={11} />
                              {order.waiterName.split(' ')[0]}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-5 whitespace-nowrap"><StatusBadge status={order.status} /></td>
                        <td className="px-5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <ActionsMenu
                            order={order}
                            onView={() => onOrderClick(order.id)}
                            onCancel={() => setCancelTarget(order)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && <tr><td style={{ height: paddingBottom }} colSpan={13} /></tr>}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-between border-t border-slate-100 bg-white flex-wrap gap-3">
          <div className="text-sm text-slate-500">
            Showing <span className="text-slate-900">{totalOrders === 0 ? 0 : start}-{end}</span> of{' '}
            <span className="text-slate-900">{totalOrders.toLocaleString()}</span> orders
          </div>
          <div className="flex items-center gap-6">
            <Pagination 
              currentPage={page} 
              totalPages={Math.max(1, totalPages)} 
              onPageChange={setPage} 
              pageSize={limit}
              onPageSizeChange={(newSize) => {
                setLimit(newSize);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setCancelTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[380px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Cancel Order?</h3>
            <p className="text-sm text-slate-500 mb-5">
              Are you sure you want to cancel order <span className="font-bold text-slate-800">#{cancelTarget.orderNumber}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Keep Order
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch(`${API_URL}/api/orders/${cancelTarget.id}`, {
                      method: 'PUT', credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'CANCELLED' }),
                    });
                  } finally { setCancelTarget(null); }
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
