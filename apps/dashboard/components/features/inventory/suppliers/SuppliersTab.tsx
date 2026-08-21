'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Star, Pencil, Trash2, RotateCcw, Truck, Phone } from 'lucide-react';
import { useSuppliers, Supplier } from '../hooks/useSuppliers';
import { Spinner } from '@/components/ui/Spinner';
import { SupplierFormModal } from './SupplierFormModal';

function RatingStars({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-xs text-slate-300">Not rated</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
      ))}
    </div>
  );
}

export function SuppliersTab() {
  const { suppliers, isLoading, deleteSupplier, updateSupplier } = useSuppliers();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.isActive), [suppliers]);
  const inactiveSuppliers = useMemo(() => suppliers.filter((s) => !s.isActive), [suppliers]);
  const visibleSuppliers = showInactive ? suppliers : activeSuppliers;

  const openAdd = () => {
    setEditSupplier(null);
    setIsFormOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditSupplier(s);
    setIsFormOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    deleteSupplier.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) });
  };

  const reactivate = (s: Supplier) => {
    updateSupplier.mutate({ id: s.id, data: { isActive: true } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Suppliers</h2>
          <p className="text-sm text-slate-500 mt-0.5">Contacts, terms, and delivery schedules for your vendors</p>
        </div>
        <div className="flex items-center gap-3">
          {inactiveSuppliers.length > 0 && (
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              {showInactive ? 'Hide inactive' : `Show inactive (${inactiveSuppliers.length})`}
            </button>
          )}
          <button
            onClick={openAdd}
            className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Payment Terms</th>
                <th className="px-6 py-3">Rating</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <Spinner size={16} />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : visibleSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Truck size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">No suppliers yet</p>
                        <p className="text-sm text-slate-500 mt-0.5">Add your first supplier to start tracking vendors</p>
                      </div>
                      <button onClick={openAdd} className="mt-1 bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Plus size={16} />
                        Add Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleSuppliers.map((s) => (
                  <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${!s.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-semibold text-slate-900">{s.name}</span>
                      {s.deliveryDays?.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">Delivers {s.deliveryDays.join(', ')}</p>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{s.contactName || '—'}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {s.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          {s.phone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{s.paymentTerms || '—'}</td>
                    <td className="px-6 py-3.5"><RatingStars rating={s.rating} /></td>
                    <td className="px-6 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.isActive ? (
                          <>
                            <button onClick={() => openEdit(s)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDeleteConfirm(s)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => reactivate(s)} disabled={updateSupplier.isPending} className="flex items-center gap-1.5 text-xs font-medium text-[#ff5722] hover:underline px-2 py-1">
                            <RotateCcw size={12} />
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SupplierFormModal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditSupplier(null); }} editSupplier={editSupplier} />

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Remove {deleteConfirm.name}?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This marks the supplier inactive and hides it from pickers. You can reactivate it later from the &ldquo;Show inactive&rdquo; list.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteSupplier.isPending} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleteSupplier.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
