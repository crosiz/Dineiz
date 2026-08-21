'use client';

import React from 'react';

export type POStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  DRAFT: { label: 'Draft', dot: 'bg-slate-400' },
  SENT: { label: 'Sent', dot: 'bg-blue-500' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', dot: 'bg-amber-500' },
  FULLY_RECEIVED: { label: 'Fully Received', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-red-500' },
};

// Small dot+label pill matching InventoryTable.tsx's status badge style.
export function POStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400' };
  return (
    <span className="flex items-center gap-2 text-[13px] text-slate-500 font-medium whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  );
}

export const PO_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SENT', label: 'Sent' },
  { key: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { key: 'FULLY_RECEIVED', label: 'Fully Received' },
  { key: 'CANCELLED', label: 'Cancelled' },
];
