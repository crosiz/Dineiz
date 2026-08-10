'use client';

import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';

interface TableTransferModalProps {
  sourceTableId: string;
  onClose: () => void;
}

export function TableTransferModal({ sourceTableId, onClose }: TableTransferModalProps) {
  const { tables, updateTable } = useFloorPlanStore();
  const [targetTableId, setTargetTableId] = useState<string>('');

  const sourceTable = tables.find(t => t.id === sourceTableId);
  const availableTables = tables.filter(t => t.id !== sourceTableId && t.status !== 'occupied');

  const handleTransfer = () => {
    if (!targetTableId || !sourceTable) return;
    
    // Transfer logic: move activeOrderId and guestCount to target, reset source
    updateTable(targetTableId, {
      status: 'occupied',
      activeOrderId: sourceTable.activeOrderId,
      guestCount: sourceTable.guestCount,
      occupiedSince: sourceTable.occupiedSince
    });

    updateTable(sourceTable.id, {
      status: 'dirty',
      activeOrderId: undefined,
      guestCount: undefined,
      occupiedSince: undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[400px] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Transfer Table</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col items-center gap-1 p-3 bg-orange-50 border border-orange-200 rounded-lg w-32">
              <span className="font-bold text-orange-600">{sourceTable?.label}</span>
              <span className="text-xs text-orange-500">Current</span>
            </div>
            <ArrowRight size={20} className="text-slate-300" />
            <div className="flex flex-col items-center gap-1 p-3 bg-slate-50 border border-slate-200 rounded-lg w-32">
              <span className="font-bold text-slate-700">
                {tables.find(t => t.id === targetTableId)?.label || '?'}
              </span>
              <span className="text-xs text-slate-500">Destination</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Select Target Table</label>
            <select 
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
            >
              <option value="">Select an available table...</option>
              {availableTables.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.capacity} Seats) - {t.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleTransfer}
            disabled={!targetTableId}
            className="px-4 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            Confirm Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
