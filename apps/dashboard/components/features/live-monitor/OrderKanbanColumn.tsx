'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { OrderCard } from './OrderCard';
import type { LiveOrder } from './hooks/useOrderMonitor';

interface OrderKanbanColumnProps {
  title: string;
  orders: LiveOrder[];
  dotColor: string;
  badgeColors: string;
  statusConfig: { color: string; borderClass: string; bgClass?: string; isCompleted?: boolean };
  onAction: (orderId: string, newStatus: string) => void;
  showBranch?: boolean;
}

export function OrderKanbanColumn({
  title,
  orders,
  dotColor,
  badgeColors,
  statusConfig,
  onAction,
  showBranch = false,
}: OrderKanbanColumnProps) {
  return (
    <div className="bg-slate-50 flex flex-col overflow-hidden w-full h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${dotColor}`} />
          <h2 className="text-base font-black uppercase text-slate-900 tracking-wider">{title}</h2>
          <span className={`${badgeColors} text-xs font-bold px-2 py-0.5 rounded-full`}>
            {orders.length}
          </span>
        </div>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 kanban-column">
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onAction={onAction}
            statusConfig={statusConfig}
            showBranch={showBranch}
          />
        ))}
        {orders.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[120px]">
            <span className="text-[13px] font-medium text-[#9CA3AF]">
              NO ORDERS
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
