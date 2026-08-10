'use client';

import React from 'react';
import { Send, CheckCircle2, FileText, XCircle, PackagePlus } from 'lucide-react';
import { PurchaseOrder, useInventory } from './hooks/useInventory';

interface RecentPurchaseOrdersProps {
  orders: PurchaseOrder[];
  isLoading?: boolean;
}

export function RecentPurchaseOrders({ orders, isLoading }: RecentPurchaseOrdersProps) {
  const { receivePO, autoGeneratePO } = useInventory();

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'RECEIVED': return <CheckCircle2 size={20} className="text-green-500" />;
      case 'SENT': return <Send size={20} className="text-blue-500" />;
      case 'DRAFT': return <FileText size={20} className="text-slate-500" />;
      case 'CANCELLED': return <XCircle size={20} className="text-red-500" />;
      default: return <FileText size={20} className="text-slate-500" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch(status) {
      case 'RECEIVED': return 'bg-green-50';
      case 'SENT': return 'bg-blue-50';
      case 'DRAFT': return 'bg-slate-50';
      case 'CANCELLED': return 'bg-red-50';
      default: return 'bg-slate-50';
    }
  };

  const getBadgeColor = (status: string) => {
    switch(status) {
      case 'RECEIVED': return 'bg-green-100 text-green-700';
      case 'SENT': return 'bg-blue-100 text-blue-700';
      case 'DRAFT': return 'bg-slate-100 text-slate-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Purchase Orders</h3>
          <p className="text-xs text-slate-500 mt-1">Manage and receive stock from suppliers</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => autoGeneratePO.mutate()}
            disabled={autoGeneratePO.isPending}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {autoGeneratePO.isPending ? 'Generating...' : 'Auto-Generate PO'}
          </button>
          <button className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Create PO
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-200 text-xs uppercase text-slate-500 font-medium tracking-wider">
            <tr>
              <th className="px-6 py-4">PO Number</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Items</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-500">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-500">No purchase orders found.</td></tr>
            ) : (
              orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getStatusBg(order.status)}`}>
                        {getStatusIcon(order.status)}
                      </div>
                      <span className="text-sm font-bold text-slate-900">{order.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700 font-medium">{order.supplier}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{new Date(order.date).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">{order.items} items</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`${getBadgeColor(order.status)} rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider whitespace-nowrap`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {order.status === 'SENT' ? (
                      <button 
                        onClick={() => receivePO.mutate(order.id)}
                        disabled={receivePO.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <PackagePlus size={14} />
                        Receive
                      </button>
                    ) : (
                      <button className="text-slate-400 hover:text-slate-900 text-xs font-semibold uppercase tracking-wider transition-colors">
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
