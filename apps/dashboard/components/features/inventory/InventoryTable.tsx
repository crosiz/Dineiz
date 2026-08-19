'use client';

import React, { useState } from 'react';
import { Edit2, ArrowRightLeft, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { InventoryItem } from './hooks/useInventory';
import { AdjustStockModal } from './modals/AdjustStockModal';
import { Pagination } from '../../ui/Pagination';

interface InventoryTableProps {
  inventoryList: InventoryItem[];
}

export function InventoryTable({ inventoryList }: InventoryTableProps) {
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.ceil(inventoryList.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedInventory = inventoryList.slice(startIndex, startIndex + pageSize);

  const getStockColor = (status: string) => {
    switch(status) {
      case 'LOW_STOCK': return 'text-amber-600 font-bold';
      case 'OUT_OF_STOCK': return 'text-red-600 font-bold';
      default: return 'text-slate-900';
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'HEALTHY': 
        return <span className="flex items-center gap-2 text-[13px] text-slate-500 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Healthy</span>;
      case 'LOW_STOCK': 
        return <span className="flex items-center gap-2 text-[13px] text-slate-500 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Low Stock</span>;
      case 'OUT_OF_STOCK': 
        return <span className="flex items-center gap-2 text-[13px] text-slate-500 font-medium whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Out of Stock</span>;
      default: 
        return <span className="flex items-center gap-2 text-[13px] text-slate-500 font-medium capitalize"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{status.toLowerCase()}</span>;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-100 overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
            <tr>
              <th className="w-[280px] px-6 py-4">Ingredient</th>
              <th className="w-32 px-6 py-4">Unit</th>
              <th className="w-32 px-6 py-4">In Stock</th>
              <th className="w-40 px-6 py-4">Min Threshold</th>
              <th className="w-32 px-6 py-4">Status</th>
              <th className="w-40 px-6 py-4">Branches</th>
              <th className="w-20 px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedInventory.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center text-slate-400 text-[10px] font-bold">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : 'IMG'}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-900 leading-tight">{item.name}</p>
                      <span className="text-[9px] font-bold bg-slate-50 text-slate-400 rounded px-1.5 uppercase tracking-wide mt-1 inline-block">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[13px] font-medium text-slate-700">{item.unit}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[13px] ${getStockColor(item.status) === 'text-slate-900' ? 'font-bold text-slate-900' : getStockColor(item.status)}`}>
                    {item.inStock} {item.unit}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[13px] font-medium text-slate-500">{item.minThreshold} {item.unit}</span>
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(item.status)}
                </td>
                <td className="px-6 py-4">
                  <span className="text-[12px] font-medium text-slate-500 whitespace-nowrap inline-flex items-center">{item.branches.join(', ')}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => toast.info('Editing ingredient details is coming soon')}
                      aria-label={`Edit ${item.name}`}
                      title="Edit"
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setAdjustItem(item)}
                      aria-label={`Adjust stock for ${item.name}`}
                      title="Adjust stock"
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-slate-400 hover:bg-slate-100 hover:text-[#ff5722]`}
                    >
                      <ArrowRightLeft size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {inventoryList.length > 0 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
          <div>
            Showing <span className="font-bold text-slate-900">{Math.min(startIndex + 1, inventoryList.length)}-{Math.min(startIndex + pageSize, inventoryList.length)}</span> of <span className="font-bold text-slate-900">{inventoryList.length}</span> items
          </div>
          <Pagination 
            currentPage={currentPage} 
            totalPages={Math.max(1, totalPages)} 
            onPageChange={setCurrentPage} 
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      <AdjustStockModal 
        item={adjustItem} 
        isOpen={!!adjustItem} 
        onClose={() => setAdjustItem(null)} 
      />
    </div>
  );
}
