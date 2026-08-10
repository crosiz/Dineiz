'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React, { useEffect, useState } from 'react';
import { Utensils, ShoppingBag, Bike, Timer, CheckCircle, MapPin, User, Clock, UtensilsCrossed } from 'lucide-react';
import type { LiveOrder } from './hooks/useOrderMonitor';

function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000 / 60)
}

function formatElapsed(createdAt: string): string {
  const totalSeconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${seconds}s`
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function formatCompletedTime(completedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(completedAt).getTime()) / 1000 / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m ago`
}

function getUrgencyStyle(createdAt: string) {
  const minutes = getElapsedMinutes(createdAt)
  if (minutes < 10) return {
    timerColor: 'text-green-500',
    timerBg: 'bg-green-50',
    borderLeft: 'border-l-4 border-green-400'
  }
  if (minutes < 20) return {
    timerColor: 'text-orange-500',
    timerBg: 'bg-orange-50',
    borderLeft: 'border-l-4 border-orange-400'
  }
  return {
    timerColor: 'text-red-500 font-bold animate-pulse',
    timerBg: 'bg-red-50',
    borderLeft: 'border-l-4 border-red-500'
  }
}

interface OrderCardProps {
  order: LiveOrder;
  onAction: (orderId: string, newStatus: string) => void;
  statusConfig: { color: string; borderClass: string; bgClass?: string; isCompleted?: boolean };
  showBranch?: boolean;
  isNew?: boolean;
}

const TYPE_CONFIG = {
  DINE_IN:  { icon: UtensilsCrossed, label: 'Dine-in' },
  TAKEAWAY: { icon: ShoppingBag, label: 'Takeaway' },
  DELIVERY: { icon: Bike, label: 'Delivery' },
};

// timerColor is removed

export function OrderCard({ order, onAction, statusConfig, showBranch = false, isNew = false }: OrderCardProps) {
  const [, forceRender] = useState(0);

  // Sync re-render for elapsed timer display every 1s
  useEffect(() => {
    if (statusConfig.isCompleted) return;
    const iv = setInterval(() => forceRender(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, [statusConfig.isCompleted]);

  const urgency = getUrgencyStyle(order.createdAt);
  const finalBorderClass = statusConfig.isCompleted ? statusConfig.borderClass : urgency.borderLeft;
  const { icon: TypeIcon, label: typeLabel } = TYPE_CONFIG[order.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.DINE_IN;

  let locationText = '';
  if (order.type === 'DINE_IN') locationText = order.tableLabel ? `T${order.tableLabel}` : '';
  else if (order.type === 'TAKEAWAY') locationText = order.token ? `#${order.token}` : '';
  else locationText = order.customerName ? `#${order.customerName}` : '';

  const fullLocation = locationText ? `${typeLabel} • ${locationText}` : typeLabel;

  // Items — show first 2, then "+N more"
  const visibleItems = order.items.slice(0, 2);
  const extraCount = order.items.length - 2;

  // Action button
  let btnText: string | null = null;
  let nextStatus: string | null = null;
  let btnColor = 'bg-[#ff5722] hover:bg-[#e64a19] text-white';
  if (order.status === 'PENDING') {
    btnText = 'Confirm → Kitchen';
    nextStatus = 'IN_KITCHEN';
  } else if (order.status === 'IN_KITCHEN') {
    btnText = 'Mark Ready';
    nextStatus = 'READY';
  } else if (order.status === 'READY') {
    btnText = 'Complete';
    nextStatus = 'COMPLETED';
    btnColor = 'bg-emerald-600 hover:bg-emerald-700 text-white';
  }

  return (
    <div
      className={[
        'rounded-xl shadow-sm p-4 flex flex-col gap-2 group transition-all duration-300',
        finalBorderClass,
        statusConfig.isCompleted ? statusConfig.bgClass : 'bg-white',
        isNew ? 'animate-slide-in' : '',
        'hover:shadow-md',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex justify-between items-start">
        <div>
          <p className="font-mono text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
          <div className="flex items-center gap-1">
            <TypeIcon className="w-3 h-3 text-slate-400" />
            <span className="text-[9px] font-bold text-slate-500 uppercase">{fullLocation}</span>
            {showBranch && order.branchName && (
               <span className="text-[9px] font-bold text-slate-400 uppercase">• {order.branchName}</span>
            )}
          </div>
        </div>

        {/* Timer */}
        {statusConfig.isCompleted ? (
          <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase whitespace-nowrap">
            Served {formatCompletedTime(order.completedAt || order.createdAt)}
          </span>
        ) : (
          <div className={`flex items-center gap-1 ${urgency.timerBg} px-2 py-1 rounded-full`}>
            <Clock className={`w-3.5 h-3.5 ${urgency.timerColor}`} />
            <span className={`text-xs font-semibold ${urgency.timerColor}`}>
              {formatElapsed(order.createdAt)}
            </span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="text-[13px] text-slate-700 font-medium truncate">
        {visibleItems.map(item => `${item.name}${item.variation ? ` (${item.variation})` : ''} x${item.qty}`).join(', ')}
        {extraCount > 0 && ` +${extraCount} more`}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <span className={`font-bold text-base ${statusConfig.isCompleted ? 'text-slate-500' : ''}`}>
          {formatPKR((order.total || 0))}
        </span>
        {btnText && nextStatus && !statusConfig.isCompleted && (
          <button
            onClick={() => onAction(order.id, nextStatus!)}
            className={`${btnColor} text-[10px] font-bold px-3 py-1.5 rounded uppercase transition-colors`}
          >
            {btnText}
          </button>
        )}
      </div>
    </div>
  );
}
