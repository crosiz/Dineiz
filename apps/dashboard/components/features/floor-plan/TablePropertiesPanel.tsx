'use client';

import React, { useState } from 'react';
import { Square, RectangleHorizontal, Circle, Trash2, Check, X } from 'lucide-react';
import { useFloorPlanStore } from '../../../store/useFloorPlanStore';
import { floorPlanApi, TableElement } from '../../../lib/api/floor-plan';
import { toast } from 'sonner';

interface TablePropertiesPanelProps {
  table: TableElement;
}

export function TablePropertiesPanel({ table }: TablePropertiesPanelProps) {
  const { updateTable, deleteTable, selectTable, pushUndoState } = useFloorPlanStore();

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdate = async (updates: Partial<TableElement>) => {
    pushUndoState();
    updateTable(table.id, updates);

    try {
      const apiUpdates: any = {};
      if (updates.label !== undefined) apiUpdates.label = updates.label;
      if (updates.capacity !== undefined) apiUpdates.capacity = updates.capacity;
      if (updates.shape !== undefined) {
        apiUpdates.shape = updates.shape;
        let width = 90;
        let height = 90;
        if (updates.shape === 'rectangle') {
          width = 130;
          height = 80;
        } else if (updates.shape === 'round') {
          width = 100;
          height = 100;
        }
        apiUpdates.width = width;
        apiUpdates.height = height;
        updateTable(table.id, { width, height });
      }

      await floorPlanApi.putTable(table.id, apiUpdates);
    } catch (err: any) {
      console.error('Failed to update table:', err);
      toast.error(err.message || 'Failed to update table');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    pushUndoState();
    try {
      await floorPlanApi.deleteTable(table.id);
      deleteTable(table.id);
      selectTable(null);
      toast.success(`Table ${table.label} deleted`);
    } catch (err: any) {
      console.error('Failed to delete table:', err);
      toast.error(err.message || 'Failed to delete table');
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  // Position above the table centered horizontally
  const leftPos = table.x + table.width / 2;
  const topPos = table.y - 12;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPos}px`,
        top: `${topPos}px`,
        transform: 'translate(-50%, -100%)',
      }}
      className="z-50 min-w-[280px] bg-slate-900 text-white rounded-2xl shadow-2xl p-3 border border-slate-800 animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Down arrow pointing to table */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-slate-900" />

      {isConfirmingDelete ? (
        <div className="flex items-center justify-between gap-3 py-1 px-1">
          <span className="text-xs font-semibold text-rose-400">
            Delete {table.label}?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(false)}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {isDeleting ? 'Deleting...' : 'Confirm'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Header row: Label + Delete */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                Label:
              </span>
              <input
                type="text"
                value={table.label}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                className="w-20 px-2 py-0.5 text-xs font-bold bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:border-amber-500 text-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Delete Table"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="h-[1px] bg-slate-800 w-full" />

          {/* Capacity row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Capacity:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={table.capacity}
                onChange={(e) => handleUpdate({ capacity: Number(e.target.value) })}
                className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-xs font-bold text-amber-400 min-w-[20px] text-right">
                {table.capacity}p
              </span>
            </div>
          </div>

          {/* Shape row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Shape:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleUpdate({ shape: 'square' })}
                title="Square"
                className={`p-1.5 rounded-lg transition-all ${
                  table.shape === 'square'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleUpdate({ shape: 'rectangle' })}
                title="Rectangle"
                className={`p-1.5 rounded-lg transition-all ${
                  table.shape === 'rectangle'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <RectangleHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleUpdate({ shape: 'round' })}
                title="Round"
                className={`p-1.5 rounded-lg transition-all ${
                  table.shape === 'round'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Circle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
