'use client';

import React, { useState, useEffect } from 'react';
import { Square, RectangleHorizontal, Circle, Plus, X } from 'lucide-react';
import { useFloorPlanStore } from '../../../store/useFloorPlanStore';
import { floorPlanApi } from '../../../lib/api/floor-plan';
import { toast } from 'sonner';

interface AddTablePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
}

export function AddTablePopover({ isOpen, onClose, branchId }: AddTablePopoverProps) {
  const { tables, activeFloor, addTable, pushUndoState } = useFloorPlanStore();

  const [tableNumber, setTableNumber] = useState<string>('');
  const [capacity, setCapacity] = useState<number>(4);
  const [shape, setShape] = useState<'square' | 'rectangle' | 'round'>('square');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill next available table number when opened
  useEffect(() => {
    if (isOpen) {
      const numbers = tables
        .map((t) => {
          const match = t.label.match(/\d+/);
          return match ? parseInt(match[0], 10) : null;
        })
        .filter((n): n is number => n !== null);

      let nextNum = 1;
      while (numbers.includes(nextNum)) {
        nextNum++;
      }
      setTableNumber(nextNum.toString());
      setCapacity(4);
      setShape('square');
    }
  }, [isOpen, tables]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!branchId) {
      toast.error('Please select a branch first.');
      return;
    }

    const label = tableNumber.trim() ? (tableNumber.toLowerCase().startsWith('t-') ? tableNumber : `T-${tableNumber}`) : `T-1`;

    let width = 90;
    let height = 90;
    if (shape === 'rectangle') {
      width = 130;
      height = 80;
    } else if (shape === 'round') {
      width = 100;
      height = 100;
    }

    const positionX = Math.round(600 - width / 2);
    const positionY = Math.round(350 - height / 2);

    setIsSubmitting(true);
    pushUndoState();

    try {
      const newTableData = await floorPlanApi.createTable(branchId, {
        branchId,
        label,
        capacity,
        shape,
        positionX,
        positionY,
        width,
        height,
        rotation: 0,
        floorNumber: activeFloor,
        isActive: true,
      });

      const storeTable = {
        id: newTableData.id,
        label: newTableData.label || label,
        capacity: newTableData.capacity || capacity,
        shape: (newTableData.shape as any) || shape,
        x: newTableData.positionX ?? positionX,
        y: newTableData.positionY ?? positionY,
        width: newTableData.width || width,
        height: newTableData.height || height,
        rotation: newTableData.rotation || 0,
        floor: newTableData.floorNumber || activeFloor,
        allowReservations: true,
        joinable: false,
        isActive: true,
        status: 'available' as const,
      };

      addTable(storeTable);
      toast.success(`Table ${label} added`);
      onClose();
    } catch (err: any) {
      console.error('Failed to create table:', err);
      toast.error(err.message || 'Failed to add table');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute top-16 left-16 z-50 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-slate-800">Add New Table</h4>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Table Number */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Table Number
          </label>
          <input
            type="text"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="e.g. 1"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-slate-800"
          />
        </div>

        {/* Capacity Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-slate-600">
              Capacity (Seats)
            </label>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {capacity} seats
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={12}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>2</span>
            <span>6</span>
            <span>12</span>
          </div>
        </div>

        {/* Shape Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Shape
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setShape('square')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                shape === 'square'
                  ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Square className="w-5 h-5 mb-1" />
              Square
            </button>

            <button
              type="button"
              onClick={() => setShape('rectangle')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                shape === 'rectangle'
                  ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <RectangleHorizontal className="w-5 h-5 mb-1" />
              Rectangle
            </button>

            <button
              type="button"
              onClick={() => setShape('round')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                shape === 'round'
                  ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Circle className="w-5 h-5 mb-1" />
              Round
            </button>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full mt-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {isSubmitting ? 'Adding...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
