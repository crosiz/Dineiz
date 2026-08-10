'use client';

import React, { useState } from 'react';
import { useFloorPlanStore } from '../../../store/useFloorPlanStore';
import { Plus, Check, Trash2, Grid, AlertTriangle } from 'lucide-react';
import { authClient } from '../../../lib/auth-client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';

export function FloorPlanTopBar() {
  const {
    floors,
    activeFloor,
    setActiveFloor,
    addFloor,
    removeFloor,
    isDirty,
    selectedBranchId,
    setSelectedBranchId,
    showGrid,
    toggleGrid,
  } = useFloorPlanStore();

  const { selectedBranchId: globalBranchId } = useDashboardContext();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const isTenantAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Floor deletion confirmation state
  const [floorToDelete, setFloorToDelete] = useState<number | null>(null);

  const { data: branches } = useQuery({
    queryKey: ['branches', user?.tenantId],
    queryFn: async () => {
      const res = await apiFetch<{ branches: any[] }>('/api/branches');
      return res.branches;
    },
    enabled: !!isTenantAdmin,
  });

  const confirmDeleteFloor = () => {
    if (floorToDelete !== null) {
      removeFloor(floorToDelete);
      setFloorToDelete(null);
    }
  };

  return (
    <>
      <div className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-6 z-20 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Floor Plan Editor</h1>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Floor Tabs / Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {floors.map((f) => (
              <div
                key={f}
                className={`group flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeFloor === f
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFloor(f)}
                  className="outline-none"
                >
                  Floor {f}
                </button>

                {/* Delete Floor Button (only if more than 1 floor exists) */}
                {floors.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFloorToDelete(f);
                    }}
                    title={`Delete Floor ${f}`}
                    className="p-0.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-70 group-hover:opacity-100 ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Floor Button */}
            <button
              type="button"
              onClick={() => addFloor()}
              disabled={!selectedBranchId}
              title="Add New Floor"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Floor</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Gridlines & Smart Guidelines Toggle Button */}
          <button
            type="button"
            onClick={toggleGrid}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
              showGrid
                ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-2xs'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Gridlines: {showGrid ? 'ON' : 'OFF'}</span>
          </button>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 text-xs font-medium">
            {isDirty ? (
              <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Changes
              </span>
            ) : (
              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-semibold">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delete Floor Confirmation Consent Box Modal */}
      {floorToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Floor {floorToDelete}?</h3>
                <p className="text-xs text-slate-500">Confirm floor removal</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong>Floor {floorToDelete}</strong>? All tables currently placed on this floor will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFloorToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteFloor}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-colors"
              >
                Delete Floor
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
