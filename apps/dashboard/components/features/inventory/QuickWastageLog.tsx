'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, ChevronRight } from 'lucide-react';
import { WastageLog } from './hooks/useInventory';
import { AddWastageModal } from './modals/AddWastageModal';
import { Spinner } from '@/components/ui/Spinner';

interface QuickWastageLogProps {
  logs: WastageLog[];
  isLoading?: boolean;
}

export function QuickWastageLog({ logs, isLoading }: QuickWastageLogProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Wastage Log</h3>
          <p className="text-xs text-slate-500 mt-1">Track spoilage, damage, and expired items</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Log Wastage
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-200 text-xs uppercase text-slate-500 font-medium tracking-wider">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Ingredient</th>
              <th className="px-6 py-4">Quantity Lost</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Branch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-10"><div className="flex items-center justify-center gap-2 text-slate-400"><Spinner size={16} />Loading...</div></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-slate-500">No wastage logs found.</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900">{new Date(log.date).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <Trash2 size={14} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{log.ingredientName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-red-600 font-bold">-{log.quantityLost} {log.unit}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">{log.reason}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{log.branchName}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddWastageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
