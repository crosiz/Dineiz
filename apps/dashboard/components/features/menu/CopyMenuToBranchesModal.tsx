'use client';

import React, { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { usePublishMenu } from './hooks/useMenuQueries';

interface CopyMenuToBranchesModalProps {
  tenantId: string;
  branches: any[];
  sourceBranchId: string;
  sourceBranchName: string;
  onClose: () => void;
  onDone?: () => void;
}

export function CopyMenuToBranchesModal({
  tenantId,
  branches,
  sourceBranchId,
  sourceBranchName,
  onClose,
  onDone,
}: CopyMenuToBranchesModalProps) {
  const publishMenu = usePublishMenu();
  const targets = branches.filter((b: any) => b.id !== sourceBranchId);
  const [selected, setSelected] = useState<string[]>(targets.map((b: any) => b.id));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (selected.length === 0) return;
    try {
      await publishMenu.mutateAsync({
        tenantId,
        params: { sourceBranchId, branchIds: selected },
      });
      onDone?.();
      onClose();
    } catch {
      /* toast handled in the mutation */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-slate-900">Copy menu setup to other branches</h3>
            <p className="text-sm text-slate-500 mt-1">
              Copies category and item availability plus any price overrides from{' '}
              <span className="font-medium text-slate-700">{sourceBranchName}</span> to the branches you pick.
              It won't remove anything those branches already have.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Copy to
          </div>
          {targets.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">This tenant has only one branch.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {targets.map((b: any) => {
                const checked = selected.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      checked ? 'border-[#ff5722] bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        checked ? 'bg-[#ff5722] border-[#ff5722] text-white' : 'bg-white border-slate-300 text-transparent'
                      }`}
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(b.id)} />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-slate-800">{b.name}</span>
                      <span className="text-xs text-slate-400">{b.city || 'Pakistan'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={selected.length === 0 || publishMenu.isPending}
            onClick={submit}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#ff5722] hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {publishMenu.isPending && <Loader2 size={14} className="animate-spin" />}
            {publishMenu.isPending ? 'Copying…' : `Copy to ${selected.length || ''} branch${selected.length === 1 ? '' : 'es'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
