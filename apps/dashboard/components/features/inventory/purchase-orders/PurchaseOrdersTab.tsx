'use client';

import React, { useState } from 'react';
import { Plus, Sparkles, Edit2, Send, XCircle, PackagePlus, FileText, AlertTriangle, LucideIcon } from 'lucide-react';
import { usePurchaseOrders, PurchaseOrderSummary } from '../hooks/usePurchaseOrders';
import { POStatusBadge, PO_STATUS_FILTERS } from './StatusBadge';
import { CreatePOModal } from './CreatePOModal';
import { ReceiveGoodsModal } from './ReceiveGoodsModal';
import { PODetailModal } from './PODetailModal';
import { SkeletonTable } from '@/components/ui/skeleton';

// ─── Small action pill for row-level actions ───────────────────────────────────
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
      ? 'text-[#ff5722] hover:bg-orange-50'
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
function EmptyPOState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 py-16 flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
        <FileText size={24} className="text-slate-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-900">No purchase orders yet</p>
        <p className="text-sm text-slate-500 mt-1">Create one manually, or auto-generate from low-stock ingredients</p>
      </div>
      <button
        onClick={onCreate}
        className="mt-2 bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
      >
        <Plus size={16} />
        Create Purchase Order
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function PurchaseOrdersTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const { orders, isLoading, createPO, updatePO, sendPO, cancelPO, receivePO, autoGeneratePO } = usePurchaseOrders(statusFilter || undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [autoGenResult, setAutoGenResult] = useState<any[] | null>(null);

  const detailSummary = orders.find((o) => o.id === detailId) ?? null;

  const confirmCancel = () => {
    if (!cancelConfirmId) return;
    cancelPO.mutate(cancelConfirmId, { onSuccess: () => setCancelConfirmId(null) });
  };

  const renderActions = (order: PurchaseOrderSummary) => {
    switch (order.status) {
      case 'DRAFT':
        return (
          <>
            <ActionPill icon={Edit2} label="Edit" onClick={() => setEditId(order.id)} />
            <ActionPill icon={Send} label="Send" tone="brand" onClick={() => sendPO.mutate(order.id)} disabled={sendPO.isPending} />
            <ActionPill icon={XCircle} label="Cancel" tone="danger" onClick={() => setCancelConfirmId(order.id)} />
          </>
        );
      case 'SENT':
      case 'PARTIALLY_RECEIVED':
        return (
          <>
            <ActionPill icon={PackagePlus} label="Receive" tone="brand" onClick={() => setReceiveId(order.id)} />
            <ActionPill icon={XCircle} label="Cancel" tone="danger" onClick={() => setCancelConfirmId(order.id)} />
          </>
        );
      default:
        return (
          <button onClick={() => setDetailId(order.id)} className="text-xs font-semibold text-slate-400 hover:text-slate-900 uppercase tracking-wider transition-colors">
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
          {PO_STATUS_FILTERS.map((f) => (
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => autoGeneratePO.mutate(undefined, { onSuccess: (created: any[]) => setAutoGenResult(created) })}
            disabled={autoGeneratePO.isPending}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Sparkles size={15} className="text-[#ff5722]" />
            {autoGeneratePO.isPending ? 'Generating...' : 'Auto-Generate from Low Stock'}
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <SkeletonTable
          className="!border-slate-100 rounded-lg"
          rows={6}
          columns={[110, { w: 130, avatar: true }, 90, 60, 90, { w: 72, pill: true }, { w: 56, align: 'right' }]}
        />
      ) : orders.length === 0 ? (
        <EmptyPOState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">PO Number</th>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setDetailId(order.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-bold text-slate-900">{order.poNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-medium text-slate-700">{order.supplier || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-slate-500">{order.branchName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-slate-700">{order.items}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-semibold text-slate-800">
                        PKR {(order.totalActual ?? order.estimatedTotal).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <POStatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-slate-500">{new Date(order.date).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">{renderActions(order)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ────────────────────────────────────────────── */}
      <CreatePOModal
        isOpen={createOpen || !!editId}
        onClose={() => {
          setCreateOpen(false);
          setEditId(null);
        }}
        editId={editId}
        createPO={createPO}
        updatePO={updatePO}
        sendPO={sendPO}
      />

      {/* ── Receive goods modal ────────────────────────────────────────────── */}
      <ReceiveGoodsModal poId={receiveId} isOpen={!!receiveId} onClose={() => setReceiveId(null)} receivePO={receivePO} />

      {/* ── Read-only detail modal ─────────────────────────────────────────── */}
      <PODetailModal
        poId={detailId}
        summary={detailSummary}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onEdit={(id) => {
          setDetailId(null);
          setEditId(id);
        }}
        onReceive={(id) => {
          setDetailId(null);
          setReceiveId(id);
        }}
        onCancelRequest={(id) => {
          setDetailId(null);
          setCancelConfirmId(id);
        }}
        sendPO={sendPO}
      />

      {/* ── Cancel confirmation ────────────────────────────────────────────── */}
      {cancelConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCancelConfirmId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Cancel this purchase order?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This can't be undone. If it was already sent, the supplier isn't notified of the cancellation automatically.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelConfirmId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                Keep Order
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelPO.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelPO.isPending ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auto-generate result summary ───────────────────────────────────── */}
      {autoGenResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAutoGenResult(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-[#ff5722]" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {autoGenResult.length === 0 ? 'Nothing to reorder' : `${autoGenResult.length} draft purchase order(s) created`}
              </h3>
            </div>
            {autoGenResult.length === 0 ? (
              <p className="text-sm text-slate-600 mb-4">No ingredients are currently at or below their reorder threshold.</p>
            ) : (
              <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {autoGenResult.map((po: any) => {
                  const supplierLabel = po.supplier?.name || po.supplier || po.supplierName || 'Unassigned supplier';
                  const itemCount = po.items ?? po.lines?.length ?? '—';
                  const amount = po.estimatedTotal ?? po.amount ?? 0;
                  return (
                    <li key={po.id ?? po.poNumber ?? supplierLabel} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="font-semibold text-slate-800">{supplierLabel}</p>
                        <p className="text-xs text-slate-500">{itemCount} item(s)</p>
                      </div>
                      <span className="font-bold text-slate-900">PKR {Number(amount).toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-slate-400 mb-4">These were created as drafts — review and send them from the list below.</p>
            <div className="flex justify-end">
              <button onClick={() => setAutoGenResult(null)} className="px-5 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
