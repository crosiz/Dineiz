'use client';

import React from 'react';

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  PENDING: { label: 'Pending', dot: 'bg-slate-400' },
  IN_TRANSIT: { label: 'In Transit', dot: 'bg-blue-500' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', dot: 'bg-amber-500' },
  RECEIVED: { label: 'Received', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-red-500' },
};

// Small dot+label pill matching PO/InventoryTable's status badge style.
export function TransferStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400' };
  return (
    <span className="flex items-center gap-2 text-[13px] text-slate-500 font-medium whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  );
}

export const TRANSFER_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'CANCELLED', label: 'Cancelled' },
];
