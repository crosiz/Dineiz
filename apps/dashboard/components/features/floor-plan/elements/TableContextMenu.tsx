'use client';

import React, { useEffect } from 'react';
import { Play, ArrowRightLeft, Sparkles } from 'lucide-react';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';
import { useRouter } from 'next/navigation';
import { floorPlanApi } from '../../../../lib/api/floor-plan';
import { apiFetch } from '../../../../lib/api';
import { toast } from 'sonner';

interface TableContextMenuProps {
  tableId: string;
  x: number;
  y: number;
  onTransfer: () => void;
  onReserve: () => void;
  onClose: () => void;
}

export function TableContextMenu({ tableId, x, y, onTransfer, onReserve, onClose }: TableContextMenuProps) {
  const { updateTable, tables, selectedBranchId } = useFloorPlanStore();
  const router = useRouter();
  const table = tables.find(t => t.id === tableId);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = () => onClose();

    window.addEventListener('keydown', handleEscape);
    window.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  if (!table) return null;

  // Prevent menu from going off screen
  const menuWidth = 192; // 48 * 4 (w-48)
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;

  const handleStatusChange = async (newStatus: 'available' | 'dirty') => {
    const previousStatus = table.status;
    updateTable(table.id, { status: newStatus });
    
    try {
      await apiFetch(`/api/v1/floor-plan/tables/${table.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(`Table marked as ${newStatus}`);
    } catch (e: any) {
      updateTable(table.id, { status: previousStatus });
      toast.error(e.response?.data?.message ?? 'Failed to update status');
    }
  };

  return (
    <div 
      className="absolute bg-white rounded-lg shadow-xl border border-slate-200 flex flex-col w-48 z-[100] overflow-hidden"
      style={{ left: adjustedX, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {(table.status === 'available' || table.status === 'occupied') && (
        <button 
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          onClick={() => {
            if (table.status === 'occupied' && table.activeOrderId) {
              router.push(`/dashboard/orders?highlight=${table.activeOrderId}`);
            } else {
              router.push(`/pos?tableId=${table.id}&tableName=${table.label}`);
            }
            onClose();
          }}
        >
          <Play size={14} className="text-orange-500" />
          {table.status === 'occupied' ? 'View Order' : 'Open Order'}
        </button>
      )}

      {table.status === 'reserved' && (
        <>
          <button 
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => {
              router.push(`/pos?tableId=${table.id}&tableName=${table.label}`);
              onClose();
            }}
          >
            <Play size={14} className="text-orange-500" />
            Seat Guests
          </button>
          <button 
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-slate-50 transition-colors"
            onClick={() => {
              toast.info('Cancel reservation coming soon');
              onClose();
            }}
          >
            Cancel Reservation
          </button>
        </>
      )}

      {table.status === 'occupied' && (
        <button 
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          onClick={() => {
            onTransfer();
            onClose();
          }}
        >
          <ArrowRightLeft size={14} className="text-blue-500" />
          Transfer Table
        </button>
      )}

      {(table.status === 'dirty' || table.status === 'occupied') && (
        <button 
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          onClick={() => {
            handleStatusChange('available');
            onClose();
          }}
        >
          <Sparkles size={14} className="text-green-500" />
          Mark Available
        </button>
      )}

      {table.status !== 'dirty' && (
        <button 
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          onClick={() => {
            handleStatusChange('dirty');
            onClose();
          }}
        >
          <Sparkles size={14} className="text-yellow-500" />
          Mark Dirty
        </button>
      )}

      {table.status === 'dirty' && (
        <button 
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
          disabled
        >
          <Sparkles size={14} className="text-slate-300" />
          Mark Dirty
        </button>
      )}

      {table.status === 'available' && table.allowReservations && (
        <button 
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
          onClick={() => {
            onReserve();
            onClose();
          }}
        >
          <span className="w-3.5 h-3.5 rounded-full bg-blue-100 border border-blue-500 block"></span>
          Add Reservation
        </button>
      )}
    </div>
  );
}
