'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React, { useState } from 'react';
import { X, User, UtensilsCrossed, CreditCard, Printer, Receipt, Undo2, ChevronDown } from 'lucide-react';
import { OrderTimeline } from './OrderTimeline';

interface OrderDetailModalProps {
  order: any;
  onClose: () => void;
  onReverse: (orderId: string) => Promise<void>;
}

export function OrderDetailModal({ order, onClose, onReverse }: OrderDetailModalProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  if (!order) return null;

  const handleReverse = async () => {
    setIsReversing(true);
    try {
      await onReverse(order.id);
      onClose();
    } catch (e) {
      // Handle error visually if needed
      console.error(e);
    } finally {
      setIsReversing(false);
    }
  };

  const subtotal = order.subtotal || order.total || 0;
  const tax = order.tax || 0;
  const total = order.netAmount || order.total || 0;
  const discount = order.discount || 0;

  return (
    <>
      {/* Slide-Over Overlay */}
      <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-sm flex justify-end transition-opacity" onClick={onClose}>
        {/* Slide-Over Panel */}
        <div 
          role="dialog"
          className="w-[460px] h-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 shrink-0">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[20px] font-bold text-slate-900">Order #{order.orderNumber}</h2>
                  <button className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-blue-100">
                    {order.status}
                    <ChevronDown size={14} />
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(order.createdAt))}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <User size={16} className="text-slate-400" />
                {order.customerName || 'Walk-in Customer'}
              </div>
              {order.tableName && (
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <UtensilsCrossed size={16} className="text-slate-400" />
                  {order.tableName}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Items Section */}
            <div>
              <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4">Items ({order.items?.length || 0})</h3>
              <div className="space-y-4">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-600 shrink-0">
                        {item.quantity}x
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{item.menuItem?.name || item.name}</p>
                        {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                      </div>
                    </div>
                    <span className="font-semibold text-slate-900">{formatPKR(((item.price || 0) * item.quantity))}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Section */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatPKR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax</span>
                <span>{formatPKR(tax)}</span>
              </div>
              <div className="h-[1px] bg-slate-200"></div>
              <div className="flex justify-between text-lg font-bold text-slate-900">
                <span>Total</span>
                <span>{formatPKR(total)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Paid via</p>
                  <p className="font-bold text-slate-900">{order.paymentMethod || 'Cash'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Status</p>
                <p className="text-green-600 font-bold">{order.paymentStatus || 'Paid'}</p>
              </div>
            </div>

            {/* Timeline */}
            <OrderTimeline order={order} />
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col gap-3 shrink-0">
            {showConfirm ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col gap-3">
                <p className="text-sm font-bold text-red-800 text-center">Are you sure you want to reverse this order?</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 bg-white border border-slate-200 rounded text-sm font-bold text-slate-600">Cancel</button>
                  <button onClick={handleReverse} disabled={isReversing} className="flex-1 py-2 bg-red-600 text-white rounded text-sm font-bold disabled:opacity-50">
                    {isReversing ? 'Reversing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                    <Printer size={18} />
                    Reprint KOT
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                    <Receipt size={18} />
                    Print Receipt
                  </button>
                </div>
                {order.status !== 'CANCELLED' && order.status !== 'REVERSED' && (
                  <button 
                    onClick={() => setShowConfirm(true)}
                    className="w-full py-3 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Undo2 size={18} />
                    Reverse Order
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
