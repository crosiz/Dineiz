'use client';

import React, { useState } from 'react';
import { Plus, Undo, Save } from 'lucide-react';
import { useFloorPlanStore } from '../../../store/useFloorPlanStore';
import { AddTablePopover } from './AddTablePopover';
import { floorPlanApi } from '../../../lib/api/floor-plan';
import { toast } from 'sonner';

interface FloorPlanToolbarProps {
  disabled?: boolean;
}

export function FloorPlanToolbar({ disabled }: FloorPlanToolbarProps) {
  const {
    undo,
    undoStack,
    isDirty,
    tables,
    selectedBranchId,
    markClean,
  } = useFloorPlanStore();

  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canUndo = undoStack.length > 0;

  const handleSaveAll = async () => {
    if (!selectedBranchId) {
      toast.error('No branch selected');
      return;
    }

    setIsSaving(true);
    try {
      const updateDtos = tables.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape,
        positionX: t.x,
        positionY: t.y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        floorNumber: t.floor,
        isActive: t.isActive,
      }));

      await floorPlanApi.bulkUpdateTables(selectedBranchId, updateDtos);
      markClean();
      toast.success('All tables saved successfully');
    } catch (err: any) {
      console.error('Failed to save all tables:', err);
      toast.error(err.message || 'Failed to save tables');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative z-40 flex flex-col gap-3 p-3 bg-white border-r border-slate-200 shadow-sm w-16 items-center">
      {/* Add Table Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsAddPopoverOpen((prev) => !prev)}
          disabled={disabled}
          title="Add Table"
          className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all shadow-sm ${isAddPopoverOpen
              ? 'bg-amber-600 text-white shadow-amber-200 shadow-md'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Inline Popover */}
        <AddTablePopover
          isOpen={isAddPopoverOpen}
          onClose={() => setIsAddPopoverOpen(false)}
          branchId={selectedBranchId}
        />
      </div>

      <div className="w-8 h-[1px] bg-slate-200 my-1" />

      {/* Undo Button */}
      <button
        type="button"
        onClick={undo}
        disabled={disabled || !canUndo}
        title="Undo"
        className="flex flex-col items-center justify-center w-11 h-11 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Undo className="w-5 h-5" />
      </button>

      {/* Save All Button */}
      <button
        type="button"
        onClick={handleSaveAll}
        disabled={disabled || isSaving || !isDirty}
        title="Save All"
        className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all relative ${isDirty
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            : 'text-slate-400 hover:bg-slate-100'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <Save className="w-5 h-5" />
        {isDirty && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-400 border-2 border-white rounded-full" />
        )}
      </button>
    </div>
  );
}
