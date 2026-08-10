'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Search, Calendar, ChevronDown, Download, X, Loader2, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useOrders, DatePreset } from './hooks/useOrders';
import { OrdersTable } from './OrdersTable';
import { OrderDetailPanel } from './OrderDetailPanel';
import { apiFetch } from '@/lib/api';

// ─── Date preset dropdown ─────────────────────────────────────────────────────
const DATE_OPTIONS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Custom Range', value: 'custom' },
];

function DateDropdown({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }: {
  preset: DatePreset; setPreset: (v: DatePreset) => void;
  customFrom: string; setCustomFrom: (v: string) => void;
  customTo: string; setCustomTo: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = DATE_OPTIONS.find(o => o.value === preset)?.label ?? 'Today';

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg text-sm pl-9 pr-3 py-2 hover:border-[#ff5722] focus:outline-none transition-colors"
      >
        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <span className={preset !== 'today' ? 'text-[#ff5722] font-semibold' : ''}>{currentLabel}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[210px] py-1 overflow-hidden">
          {DATE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setPreset(opt.value); if (opt.value !== 'custom') setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                preset === opt.value ? 'bg-orange-50 text-[#ff5722] font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
              {preset === opt.value && <Check size={14} />}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="px-4 py-3 border-t border-slate-100 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-sm focus:border-[#ff5722] outline-none" />
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-sm focus:border-[#ff5722] outline-none" />
              <button onClick={() => setOpen(false)} className="mt-1 bg-[#ff5722] text-white text-xs font-bold py-1.5 rounded-lg">Apply</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



// ─── Simple select filter ────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { label: string; value: string }[]; placeholder: string;
}) {
  return (
    <select
      className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:border-[#ff5722] outline-none hover:border-slate-300 transition-colors"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
import { useDashboardContext } from '@/contexts/dashboard-context';

export function OrdersPage() {
  const hook = useOrders();
  const { selectedBranchId } = useDashboardContext();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const { data: cashiersData } = useQuery({
    queryKey: ['staff', 'cashiers', selectedBranchId],
    queryFn: () => apiFetch<any>(`/api/staff?role=CASHIER&limit=100&hasOrders=true${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`),
  });
  const cashierOptions = (cashiersData?.staff || []).map((c: any) => ({ label: c.name, value: c.id }));

  const { data: waitersData } = useQuery({
    queryKey: ['staff', 'waiters', selectedBranchId],
    queryFn: () => apiFetch<any>(`/api/staff?role=WAITER&limit=100${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`),
  });
  const waiterOptions = (waitersData?.staff || (Array.isArray(waitersData) ? waitersData : waitersData?.data) || []).map((w: any) => ({ label: w.name, value: w.id }));

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await apiFetch<any>(`/api/orders/history?${hook.buildExportParams()}`);
      const orders = data.orders ?? [];

      // Dynamically import xlsx
      const XLSX = await import('xlsx');

      // ── Sheet 1: Orders Summary ───────────────────────────────────────────────
      const fmtDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      };
      const orderRows = orders.map((o: any) => ({
        'Order #': `#${o.orderNumber}`,
        'Date/Time': fmtDate(o.dateTime),
        'Branch': o.branchName,
        'Type': o.type.replace('_', ' '),
        'Customer': o.customerName ?? 'Guest',
        'Table': o.tableLabel ?? '-',
        'Items': o.itemCount,
        'Subtotal (PKR)': o.subtotal,
        'Tax (PKR)': o.tax,
        'Discount (PKR)': o.discount,
        'Total (PKR)': o.total,
        'Status': o.status,
        'Payment Method': o.paymentMethod,
        'Cashier': o.cashierName,
        'Waiter': o.waiterName || 'N/A',
      }));

      const ws1 = XLSX.utils.json_to_sheet(orderRows);
      // Style header row
      const headerRange = XLSX.utils.decode_range(ws1['!ref'] ?? 'A1');
      for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
        const cell = ws1[XLSX.utils.encode_cell({ r: 0, c: C })];
        if (cell) {
          cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'FF5722' } } };
        }
      }
      // Auto width
      ws1['!cols'] = Object.keys(orderRows[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 14) }));

      // ── Sheet 2: Payment Breakdown ────────────────────────────────────────────
      const payMap: Record<string, number> = {};
      orders.forEach((o: any) => { payMap[o.paymentMethod] = (payMap[o.paymentMethod] ?? 0) + o.total; });
      const payRows = Object.entries(payMap).map(([method, total]) => ({ 'Payment Method': method, 'Total (PKR)': total }));
      const ws2 = XLSX.utils.json_to_sheet(payRows.length > 0 ? payRows : [{ 'Payment Method': 'N/A', 'Total (PKR)': 0 }]);

      // ── Sheet 3: Summary ──────────────────────────────────────────────────────
      const summaryRows = [
        { 'Field': 'Total Orders', 'Value': data.summary?.totalOrders ?? orders.length },
        { 'Field': 'Total Revenue (PKR)', 'Value': data.summary?.totalRevenue ?? orders.reduce((s: number, o: any) => s + o.total, 0) },
        { 'Field': 'Avg Order Value (PKR)', 'Value': orders.length ? Math.round(orders.reduce((s: number, o: any) => s + o.total, 0) / orders.length) : 0 },
        { 'Field': 'Date From', 'Value': hook.customFrom || 'Today' },
        { 'Field': 'Date To', 'Value': hook.customTo || 'Today' },
        { 'Field': 'Export Time', 'Value': fmtDate(new Date().toISOString()) },
      ];
      const ws3 = XLSX.utils.json_to_sheet(summaryRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Orders Summary');
      XLSX.utils.book_append_sheet(wb, ws2, 'Payment Breakdown');
      XLSX.utils.book_append_sheet(wb, ws3, 'Summary');

      const dateTag = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Dineiz-Go-Orders-${dateTag}.xlsx`);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const periodLabel = hook.datePreset === 'today'
    ? `${hook.summary.totalOrders} orders today`
    : `${hook.summary.totalOrders} orders in selected period`;

  return (
    <>
      {/* Title Row */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900">Order History</h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1">{periodLabel}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm disabled:opacity-60"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : exportDone ? <Check size={16} className="text-emerald-600" /> : <Download size={16} />}
          {exporting ? 'Exporting…' : exportDone ? 'Downloaded!' : 'Export Excel'}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex items-center gap-3 flex-wrap border border-slate-100">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-[220px] pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-[#ff5722] focus:ring-0 outline-none transition-colors"
            placeholder="Order #, customer…"
            value={hook.search}
            onChange={e => hook.setSearch(e.target.value)}
          />
          {hook.search && (
            <button onClick={() => hook.setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Date filter */}
        <div className="relative">
          <DateDropdown
            preset={hook.datePreset}
            setPreset={p => { hook.setDatePreset(p); hook.setPage(1); }}
            customFrom={hook.customFrom}
            setCustomFrom={hook.setCustomFrom}
            customTo={hook.customTo}
            setCustomTo={hook.setCustomTo}
          />
        </div>


        {/* Type */}
        <FilterSelect
          value={hook.typeFilter}
          onChange={v => { hook.setTypeFilter(v); hook.setPage(1); }}
          placeholder="Type: All"
          options={[
            { label: 'Dine-In', value: 'DINE_IN' },
            { label: 'Takeaway', value: 'TAKEAWAY' },
            { label: 'Delivery', value: 'DELIVERY' },
          ]}
        />

        {/* Status */}
        <FilterSelect
          value={hook.statusFilter}
          onChange={v => { hook.setStatusFilter(v); hook.setPage(1); }}
          placeholder="Status: All"
          options={[
            { label: 'Pending', value: 'PENDING' },
            { label: 'In Kitchen', value: 'IN_KITCHEN' },
            { label: 'Ready', value: 'READY' },
            { label: 'Delivered', value: 'DELIVERED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ]}
        />

        {/* Payment (Step 4 — NEW) */}
        <FilterSelect
          value={hook.paymentFilter}
          onChange={v => { hook.setPaymentFilter(v); hook.setPage(1); }}
          placeholder="Payment: All"
          options={[
            { label: 'Cash', value: 'CASH' },
            { label: 'Card', value: 'CARD' },
            { label: 'Online', value: 'ONLINE' },
            { label: 'Split', value: 'SPLIT' },
          ]}
        />

        {/* Source Filter */}
        <FilterSelect
          value={hook.sourceFilter}
          onChange={v => { hook.setSourceFilter(v); hook.setPage(1); }}
          placeholder="Source: All"
          options={[
            { label: 'POS', value: 'POS' },
            { label: 'QR Code', value: 'QR_CODE' },
            { label: 'Kiosk', value: 'KIOSK' },
            { label: 'Foodpanda', value: 'FOODPANDA' },
            { label: 'Careem', value: 'CAREEM' },
            { label: 'Talabat', value: 'TALABAT' },
          ]}
        />

        {/* Cashier */}
        <FilterSelect
          value={hook.cashierId}
          onChange={v => { hook.setCashierId(v); hook.setPage(1); }}
          placeholder="Cashier: All"
          options={cashierOptions}
        />

        {/* Waiter */}
        <FilterSelect
          value={hook.waiterId}
          onChange={v => { hook.setWaiterId(v); hook.setPage(1); }}
          placeholder="Waiter: All"
          options={waiterOptions}
        />

        {/* Clear filters */}
        {hook.hasActiveFilters && (
          <button
            onClick={hook.clearFilters}
            className="text-slate-500 text-sm font-semibold hover:text-[#ff5722] transition-colors flex items-center gap-1"
          >
            <X size={13} /> Clear
          </button>
        )}

        {/* Results count */}
        <div className="ml-auto text-sm text-slate-500">
          {hook.isFetching && !hook.isLoading ? (
            <Loader2 size={14} className="animate-spin inline mr-1 text-[#ff5722]" />
          ) : null}
          <span className="font-bold text-slate-900">{hook.pagination.total.toLocaleString()}</span> results
        </div>
      </div>

      {/* Table */}
      <OrdersTable
        orders={hook.orders}
        isLoading={hook.isLoading}
        onOrderClick={id => setSelectedOrderId(id)}
        page={hook.pagination.page}
        totalOrders={hook.pagination.total}
        totalPages={hook.pagination.totalPages}
        limit={hook.limit}
        setPage={hook.setPage}
        setLimit={hook.setLimit}
        isBranchManager={hook.isBranchManager}
        selectedBranchId={selectedBranchId}
      />

      {/* Detail slide-over */}
      {selectedOrderId && (
        <OrderDetailPanel
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onReverse={hook.reverseOrder}
        />
      )}
    </>
  );
}
