'use client';
import React from 'react';
import { Download } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';
import { jsPDF } from 'jspdf';

interface ReceiptPreviewProps {
  order: any;
  type: 'CUSTOMER_BILL' | 'PAID_RECEIPT';
}

function generatePDF(order: any, type: string) {
  const doc = new jsPDF({ format: [80, 200], unit: 'mm' });
  let y = 10;
  const MARGIN = 5;
  const PAPER_WIDTH = 80;

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text('DINEIZ', PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text('--------------------------------', PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  doc.text(`Order: #${order.orderNumber}`, MARGIN, y);
  y += 4.5;
  const dt = new Date(order.createdAt).toLocaleString('en-PK', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  doc.text(`Time: ${dt}`, MARGIN, y);
  y += 4.5;
  if (order.table?.label) {
    doc.text(`Table: T-${order.table.label}`, MARGIN, y);
    y += 4.5;
  }
  doc.text('--------------------------------', PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  doc.text('QTY ITEM', MARGIN, y);
  doc.text('PRICE', PAPER_WIDTH - MARGIN - 16, y, { align: 'right' });
  doc.text('AMT', PAPER_WIDTH - MARGIN, y, { align: 'right' });
  y += 5;

  order.items?.forEach((item: any) => {
    let name = `${item.quantity}x ${item.item?.name || item.name || 'Item'}`;
    const priceStr = (item.unitPrice || 0).toLocaleString();
    const amtStr = (item.subtotal || 0).toLocaleString();

    const lines = doc.splitTextToSize(name, PAPER_WIDTH - MARGIN * 2 - 24);
    lines.forEach((line: string, i: number) => {
      if (i === 0) {
        doc.text(line, MARGIN, y);
        doc.text(priceStr, PAPER_WIDTH - MARGIN - 16, y, { align: 'right' });
        doc.text(amtStr, PAPER_WIDTH - MARGIN, y, { align: 'right' });
      } else {
        doc.text(line, MARGIN, y);
      }
      y += 4.5;
    });
  });

  doc.text('--------------------------------', PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  doc.text('Subtotal', MARGIN, y);
  doc.text(formatPKR(order.totalAmount || 0), PAPER_WIDTH - MARGIN, y, { align: 'right' });
  y += 4.5;

  if (order.discountAmount > 0) {
    doc.text('Discount', MARGIN, y);
    doc.text(`-${formatPKR(order.discountAmount)}`, PAPER_WIDTH - MARGIN, y, { align: 'right' });
    y += 4.5;
  }
  
  if (order.taxAmount > 0) {
    doc.text('Tax', MARGIN, y);
    doc.text(formatPKR(order.taxAmount), PAPER_WIDTH - MARGIN, y, { align: 'right' });
    y += 4.5;
  }

  doc.text('--------------------------------', PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('courier', 'bold');
  doc.text('TOTAL', MARGIN, y);
  doc.text(formatPKR(order.netAmount || 0), PAPER_WIDTH - MARGIN, y, { align: 'right' });
  doc.setFont('courier', 'normal');
  y += 4.5;

  if (type === 'PAID_RECEIPT') {
    const p = order.payments?.[0];
    if (p) {
      doc.text(`Paid via ${p.method}`, MARGIN, y);
      doc.text(formatPKR(p.amount), PAPER_WIDTH - MARGIN, y, { align: 'right' });
      y += 4.5;
    }
  }

  doc.text('--------------------------------', PAPER_WIDTH / 2, y, { align: 'center' });
  y += 6;
  doc.text('POWERED BY DINEIZ', PAPER_WIDTH / 2, y, { align: 'center' });

  doc.save(`RECEIPT-${order.orderNumber}.pdf`);
}

export function ReceiptPreview({ order, type }: ReceiptPreviewProps) {
  if (!order) return null;

  return (
    <div className="flex flex-col items-center bg-slate-100 p-6 rounded-2xl border border-slate-200 shadow-inner">
      <div className="bg-white p-6 shadow-md shadow-slate-200/50 w-[300px] max-w-full rounded-sm font-mono text-[11px] leading-tight text-slate-900 mx-auto relative overflow-hidden"
           style={{ fontFamily: '"Courier New", Courier, monospace' }}>
        
        {/* Receipt content */}
        <div className="text-center font-bold text-sm mb-2">DINEIZ</div>
        {type === 'CUSTOMER_BILL' && <div className="text-center mb-2 uppercase font-bold text-xs">Customer Bill</div>}
        {type === 'PAID_RECEIPT' && <div className="text-center mb-2 uppercase font-bold text-xs">Paid Receipt</div>}
        
        <div className="border-b border-dashed border-slate-400 mb-2 pb-2 text-[10px]">
          <div className="flex justify-between">
            <span>Order: #{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Time: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {order.table?.label && (
            <div className="flex justify-between">
              <span>Table: T-{order.table.label}</span>
            </div>
          )}
          {order.cashier?.name && (
            <div className="flex justify-between">
              <span>Cashier: {order.cashier.name}</span>
            </div>
          )}
        </div>

        <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
          <div className="flex font-bold mb-1">
            <span className="flex-1">QTY ITEM</span>
            <span className="w-16 text-right">AMT</span>
          </div>
          {order.items?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-start mb-1">
              <span className="flex-1 pr-2">
                {item.quantity}x {item.item?.name || item.name || 'Item'}
                {item.variationName && ` (${item.variationName})`}
              </span>
              <span className="w-16 text-right">{formatPKR(item.subtotal || 0)}</span>
            </div>
          ))}
        </div>

        <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
          <div className="flex justify-between mb-1">
            <span>Subtotal</span>
            <span>{formatPKR(order.totalAmount || 0)}</span>
          </div>
          {(order.discountAmount || 0) > 0 && (
            <div className="flex justify-between mb-1">
              <span>Discount</span>
              <span>-{formatPKR(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatPKR(order.taxAmount || 0)}</span>
          </div>
        </div>

        <div className="flex justify-between font-bold text-xs mb-2">
          <span>TOTAL</span>
          <span>{formatPKR(order.netAmount || 0)}</span>
        </div>

        {type === 'PAID_RECEIPT' && order.payments?.length > 0 && (
          <div className="border-t border-dashed border-slate-400 pt-2 mb-2">
            {order.payments.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <span>Paid via {p.method}</span>
                <span>{formatPKR(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-6 text-[9px] text-slate-500">
          POWERED BY DINEIZ
        </div>

        {/* Zigzag bottom edge effect using CSS */}
        <div className="absolute -bottom-2 left-0 w-full h-4 bg-slate-100" style={{
          maskImage: 'radial-gradient(circle at 4px 100%, transparent 4px, black 5px)',
          maskSize: '8px 10px',
          maskRepeat: 'repeat-x',
          maskPosition: 'bottom'
        }} />
      </div>

      <button 
        onClick={() => generatePDF(order, type)}
        className="mt-6 flex items-center justify-center gap-2 w-[300px] py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <Download size={16} /> Download PDF
      </button>
    </div>
  );
}
