'use client';

import React, { useState } from 'react';
import { Plus, Truck, PackagePlus, XCircle, ArrowRight, LucideIcon } from 'lucide-react';
import { useTransfers, Transfer } from '../hooks/useTransfers';
import { TransferStatusBadge, TRANSFER_STATUS_FILTERS } from './StatusBadge';
import { CreateTransferModal } from './CreateTransferModal';
import { DispatchModal } from './DispatchModal';
import { ReceiveTransferModal } from './ReceiveTransferModal';
import { TransferDetailModal } from './TransferDetailModal';
import { SkeletonTable } from '@/components/ui/skeleton';

// ─── Small action pill for row-level actions — matches PurchaseOrdersTab's ActionPill ──
function ActionPill({
  onClick,
  icon: Icon,
  label,
  tone = 'default',
  disabled,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'brand' | 'danger';
  disabled?: boolean;
}) {
  const toneClasses =
    tone === 'brand'
      ? 'text-brand-primary hover:bg-brand-primary/10'
      : tone === 'danger'
      ? 'text-red-500 hover:bg-red-50'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap ${toneClasses}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyTransfersState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 py-16 flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
        <Truck size={24} className="text-slate-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-900">No stock transfers yet</p>
        <p className="text-sm text-slate-500 mt-1">Move ingredients between branches when one is running low</p>
      </div>
      <button
        onClick={onCreate}
        className="mt-2 bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
      >
        <Plus size={16} />
        Create Transfer
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function TransfersTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const { transfers, isLoading, createTransfer, dispatchTransfer, receiveTransfer, cancelTransfer } = useTransfers(statusFilter || undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [dispatchId, setDispatchId] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const confirmCancel = () => {
    if (!cancelConfirmId) return;
    cancelTransfer.mutate(cancelConfirmId, { onSuccess: () => setCancelConfirmId(null) });
  };

  const renderActions = (t: Transfer) => {
    switch (t.status) {
      case 'PENDING':
        return (
          <>
            <ActionPill icon={PackagePlus} label="Dispatch" tone="brand" onClick={() => setDispatchId(t.id)} />
            <ActionPill icon={XCircle} label="Cancel" tone="danger" onClick={() => setCancelConfirmId(t.id)} />
          </>
        );
      case 'IN_TRANSIT':
      case 'PARTIALLY_RECEIVED':
        return <ActionPill icon={PackagePlus} label="Receive" tone="brand" onClick={() => setReceiveId(t.id)} />;
      default:
        return (
          <button onClick={() => setDetailId(t.id)} className="text-xs font-semibold text-slate-400 hover:text-slate-900 uppercase tracking-wider transition-colors">
            View
          </button>
        );
    }
  };

  return (
    <div>
      {/* ── Top bar: status filters + actions ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {TRANSFER_STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create Transfer
        </button>
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <SkeletonTable
          className="!border-slate-100 rounded-lg"
          rows={6}
          columns={[110, 130, 130, 60, { w: 72, pill: true }, 90, { w: 100, align: 'right' }]}
        />
      ) : transfers.length === 0 ? (
        <EmptyTransfersState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Transfer #</th>
                  <th className="px-6 py-4">From Branch</th>
                  <th className="px-6 py-4">To Branch</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setDetailId(t.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-bold text-slate-900">{t.transferNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-medium text-slate-700">{t.fromBranch?.name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                        <ArrowRight size={12} className="text-slate-300 shrink-0" />
                        {t.toBranch?.name || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-slate-700">{t.lines?.length ?? 0}</span>
                    </td>
                    <td className="px-6 py-4">
                      <TransferStatusBadge status={t.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">{renderActions(t)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create modal ───────────────────────────────────────────────────── */}
      <CreateTransferModal isOpen={createOpen} onClose={() => setCreateOpen(false)} createTransfer={createTransfer} />

      {/* ── Dispatch modal ─────────────────────────────────────────────────── */}
      <DispatchModal transferId={dispatchId} isOpen={!!dispatchId} onClose={() => setDispatchId(null)} dispatchTransfer={dispatchTransfer} />

      {/* ── Receive modal ──────────────────────────────────────────────────── */}
      <ReceiveTransferModal transferId={receiveId} isOpen={!!receiveId} onClose={() => setReceiveId(null)} receiveTransfer={receiveTransfer} />

      {/* ── Read-only detail modal ─────────────────────────────────────────── */}
      <TransferDetailModal
        transferId={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onDispatch={(id) => { setDetailId(null); setDispatchId(id); }}
        onReceive={(id) => { setDetailId(null); setReceiveId(id); }}
        onCancelRequest={(id) => { setDetailId(null); setCancelConfirmId(id); }}
      />

      {/* ── Cancel confirmation ────────────────────────────────────────────── */}
      {cancelConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCancelConfirmId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <XCircle size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Cancel this transfer?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This can't be undone. Only a transfer that hasn't been dispatched yet can be cancelled.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelConfirmId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                Keep Transfer
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelTransfer.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelTransfer.isPending ? 'Cancelling...' : 'Cancel Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
