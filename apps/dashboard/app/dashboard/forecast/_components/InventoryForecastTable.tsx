'use client';
import React from 'react';
import { ShoppingCart, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { usePurchaseOrders } from '@/components/features/inventory/hooks/usePurchaseOrders';

export function InventoryForecastTable({ data }: { data: any[] }) {
  const { autoGeneratePO } = usePurchaseOrders();
  const generating = autoGeneratePO.isPending;

  if (!data || data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
        <Package className="text-slate-300 mb-3" size={32} />
        <p>No inventory predictions available.</p>
        <p className="text-xs mt-1">Make sure recipes are linked to your menu items.</p>
      </div>
    );
  }

  // Sort: items that will run out first at the top
  const sorted = [...data].sort((a, b) => {
    if (a.daysUntilStockout !== null && b.daysUntilStockout !== null) {
      return a.daysUntilStockout - b.daysUntilStockout;
    }
    if (a.daysUntilStockout !== null) return -1;
    if (b.daysUntilStockout !== null) return 1;
    return a.stockAfter - b.stockAfter;
  });

  const handleGeneratePO = () => {
    autoGeneratePO.mutate(undefined, {
      onSuccess: () => toast.success('Draft purchase order created for items running low'),
      onError: (err: any) => toast.error(err?.message || 'Failed to generate purchase order'),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto border border-slate-200 rounded-xl mb-4">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
              <th className="p-3 pl-4">Ingredient</th>
              <th className="p-3 text-right">Current</th>
              <th className="p-3 text-right">Usage</th>
              <th className="p-3 text-right">After</th>
              <th className="p-3 pr-4 text-right">Stockout In</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.slice(0, 15).map(item => {
              const isDanger = item.stockAfter <= 0;
              const isWarning = !isDanger && item.daysUntilStockout !== null && item.daysUntilStockout <= 7;
              
              return (
                <tr key={item.ingredientId} className={isDanger ? "bg-rose-50/50" : isWarning ? "bg-amber-50/50" : ""}>
                  <td className="p-3 pl-4 font-medium text-slate-700 flex items-center gap-2">
                    {isDanger && <AlertCircle size={14} className="text-rose-500" />}
                    {item.ingredientName}
                  </td>
                  <td className="p-3 text-right text-slate-600">{item.currentStock.toFixed(1)}</td>
                  <td className="p-3 text-right text-slate-600">-{item.projectedUsage.toFixed(1)}</td>
                  <td className={`p-3 text-right font-semibold ${isDanger ? 'text-rose-600' : 'text-slate-700'}`}>
                    {item.stockAfter.toFixed(1)}
                  </td>
                  <td className={`p-3 pr-4 text-right font-medium ${isDanger ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-green-600'}`}>
                    {item.daysUntilStockout === null ? '>30 days' : 
                     item.daysUntilStockout <= 0 ? 'Out of stock' : 
                     `${item.daysUntilStockout} days`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-auto">
        <button 
          onClick={handleGeneratePO}
          disabled={generating}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            'Generating...'
          ) : (
            <>
              <ShoppingCart size={18} /> Generate Purchase Order
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Add the Package icon import inside the file if missing
import { Package } from 'lucide-react';
