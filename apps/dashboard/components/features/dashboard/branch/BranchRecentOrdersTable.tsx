import React from 'react';
import { formatPKR } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { TableRowSkeleton } from '@/components/ui/skeleton';

interface BranchRecentOrdersTableProps {
  orders: any[];
  isLoading?: boolean;
}

const ORDER_COLS = [
  { w: 'w-20' },       // Order #
  { w: 'w-14' },       // Time
  { w: 'w-10' },       // Type icon
  { w: 'w-16' },       // Table/Token
  { w: 'w-40' },       // Items
  { w: 'w-16' },       // Total
  { w: 'w-20', pill: true }, // Status
  { w: 'w-6' },        // Actions
];

function getOrderTypeIcon(type: string) {
  switch (type) {
    case 'DINE_IN':   return <span className="material-symbols-outlined text-orange-600 bg-orange-50 p-1.5 rounded-lg">restaurant</span>;
    case 'TAKEAWAY':  return <span className="material-symbols-outlined text-blue-600 bg-blue-50 p-1.5 rounded-lg">shopping_bag</span>;
    case 'DELIVERY':  return <span className="material-symbols-outlined text-purple-600 bg-purple-50 p-1.5 rounded-lg">delivery_dining</span>;
    default:          return <span className="material-symbols-outlined text-slate-600 bg-slate-50 p-1.5 rounded-lg">receipt</span>;
  }
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING:    'bg-amber-100 text-amber-700',
    IN_KITCHEN: 'bg-blue-100 text-blue-700',
    READY:      'bg-emerald-100 text-emerald-700',
    DISPATCHED: 'bg-purple-100 text-purple-700',
    DELIVERED:  'bg-slate-100 text-slate-600',
    COMPLETED:  'bg-slate-100 text-slate-600',
    CANCELLED:  'bg-slate-100 text-slate-500',
  };
  const label: Record<string, string> = { IN_KITCHEN: 'In Kitchen', DELIVERED: 'Completed', COMPLETED: 'Completed' };
  return (
    <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-tighter ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {label[status] ?? status}
    </span>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatItems(items: any[]) {
  if (!items?.length) return 'No items';
  const first = items[0];
  const name = first.item?.name || 'Unknown item';
  return items.length === 1 ? `${name} ×${first.quantity}` : `${name} ×${first.quantity}, …`;
}

export function BranchRecentOrdersTable({ orders, isLoading }: BranchRecentOrdersTableProps) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between">
        <h4 className="font-semibold text-slate-900 text-lg">Recent Orders</h4>
        <div className="flex gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:border-orange-400 outline-none w-48 transition-all" placeholder="Search order ID..." />
          </div>
          <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined text-sm">filter_list</span> Filter
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50">
              {['Order #', 'Time', 'Type', 'Table/Token', 'Items', 'Total', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [0, 100, 200, 300, 400].map((delay) => (
                <TableRowSkeleton key={delay} cols={ORDER_COLS} delay={delay} />
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm">No recent orders found</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 text-sm font-mono whitespace-nowrap">#{order.orderNumber || order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">{formatTime(order.createdAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getOrderTypeIcon(order.type)}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700 text-sm whitespace-nowrap">
                    {order.table?.label ? order.table.label : order.tokenNumber ? `Token ${order.tokenNumber}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm truncate max-w-[200px]">{formatItems(order.items)}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 text-sm whitespace-nowrap">{formatPKR(order.netAmount ?? 0)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-2 text-slate-400 hover:text-orange-600 transition-colors">
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {orders.length >= 10 && (
        <div className="p-4 bg-slate-50/30 flex items-center justify-center">
          <button className="text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors">Load More Orders</button>
        </div>
      )}
    </section>
  );
}
