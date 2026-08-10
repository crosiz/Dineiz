'use client';
import React from 'react';
import { CalendarClock, FileText, ChevronRight } from 'lucide-react';
import { ReportType } from '../page';

const CATALOG = [
  {
    category: 'FINANCIAL',
    items: [
      { id: 'DAILY_SALES', name: 'Daily Sales Summary' },
      { id: 'MONTHLY_REVENUE', name: 'Monthly Revenue Report' },
      { id: 'PAYMENT_METHOD', name: 'Payment Method Breakdown' },
      { id: 'TAX_REPORT', name: 'Tax Report (FBR/GST)' },
      { id: 'DISCOUNT_VOID', name: 'Discount and Void Report' },
      { id: 'SHIFT_BALANCE', name: 'Shift Balance Report' },
    ]
  },
  {
    category: 'OPERATIONS',
    items: [
      { id: 'MENU_PERFORMANCE', name: 'Menu Performance Report' },
      { id: 'INVENTORY_CONSUMPTION', name: 'Inventory Consumption' },
      { id: 'WASTAGE_REPORT', name: 'Wastage Report' },
      { id: 'PURCHASE_ORDERS', name: 'Purchase Orders Summary' },
      { id: 'STOCK_VALUATION', name: 'Stock Valuation Report' },
    ]
  },
  {
    category: 'STAFF',
    items: [
      { id: 'STAFF_ATTENDANCE', name: 'Staff Attendance Report' },
      { id: 'STAFF_PERFORMANCE', name: 'Staff Performance Report' },
      { id: 'SHIFT_HOURS', name: 'Shift Hours Report' },
    ]
  },
  {
    category: 'CUSTOMERS',
    items: [
      { id: 'CUSTOMER_ACTIVITY', name: 'Customer Activity Report' },
      { id: 'LOYALTY_POINTS', name: 'Loyalty Points Report' },
      { id: 'TOP_CUSTOMERS', name: 'Top Customers Report' },
    ]
  }
];

export function ReportSidebar({ selected, onSelect }: { selected: ReportType, onSelect: (id: ReportType) => void }) {
  return (
    <div className="py-4">
      {/* Scheduled Reports Item */}
      <div className="px-4 mb-6">
        <button 
          onClick={() => onSelect('SCHEDULED_REPORTS')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            selected === 'SCHEDULED_REPORTS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className={selected === 'SCHEDULED_REPORTS' ? 'text-indigo-400' : 'text-slate-400'} />
            My Scheduled Reports
          </div>
        </button>
      </div>

      {CATALOG.map((group, idx) => (
        <div key={idx} className="mb-6">
          <h3 className="px-5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {group.category}
          </h3>
          <div className="space-y-0.5 px-3">
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  selected === item.id 
                    ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText size={16} className={selected === item.id ? 'text-indigo-500' : 'text-slate-400'} />
                  <span className="truncate">{item.name}</span>
                </div>
                {selected === item.id && <ChevronRight size={16} className="text-indigo-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
