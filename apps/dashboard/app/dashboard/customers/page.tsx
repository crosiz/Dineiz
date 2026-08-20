'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCustomers, createCustomer } from '@/lib/api/customers';
import { AdminOnly } from '@/components/admin-only';
import { toast } from 'sonner';
import { CustomerDetailSlideOver } from './_components/CustomerDetailSlideOver';
import { CreateCustomerSlideOver } from './_components/CreateCustomerSlideOver';
import { Pagination } from '@/components/ui/Pagination';
import { Upload, Download, UserPlus, Search, Users } from 'lucide-react';
import { PageLoader } from '@/components/ui/Spinner';

export default function CRMCustomersPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    () => searchParams.get('customerId')
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchCustomers = async () => {
    setLoading(true);
    setIsError(false);
    try {
      const res = await getCustomers({
        page: currentPage,
        limit: pageSize,
        ...(search && { search }),
        ...(segment !== 'ALL' && { segment })
      });
      setData(res);
    } catch (e) {
      console.error(e);
      setIsError(true);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, segment, currentPage, pageSize]);

  const stats = data?.stats || { totalCustomers: 0, activeCustomers: 0, newCustomers: 0, avgLtv: 0 };
  const customers = data?.data || [];
  const pagination = data?.meta || { total: 0, page: 1, limit: 25, totalPages: 1 };

  const segmentPills = ['ALL', 'VIP', 'REGULAR', 'NEW', 'AT_RISK', 'LOST'];

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await getCustomers({ page: 1, limit: 10000, ...(segment !== 'ALL' && { segment }) });
      const rows: any[] = (res as any)?.data || [];
      const header = ['Name', 'Phone', 'Email', 'Segment', 'Total Orders', 'Total Spend', 'Loyalty Points', 'Last Visit'];
      const csvEscape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        header.join(','),
        ...rows.map(c => [
          c.name, c.phone, c.email, c.segment, c.totalOrders, c.totalSpend, c.loyaltyPoints,
          c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : '',
        ].map(csvEscape).join(',')),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} customers`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to export customers');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateCustomer = async (formData: any) => {
    try {
      await createCustomer(formData);
      toast.success('Customer created successfully');
      fetchCustomers();
      setIsCreateOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create customer');
    }
  };

  return (
    <AdminOnly>
      <div className="space-y-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Customer Management</h1>
            <p className="text-slate-500 mt-0.5 text-xs font-medium">Customer database, guest lifetime values, and visit history</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info('Bulk import is available via CSV upload')}
              className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Upload size={14} className="text-slate-400" /> Import
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-60"
            >
              <Download size={14} className="text-slate-400" /> {isExporting ? 'Exporting…' : 'Export'}
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="h-9 px-4 bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <UserPlus size={15} /> Add Customer
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">Total Customers</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">{stats.totalCustomers}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">Active (30 Days)</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">{stats.activeCustomers}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">New This Month</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">{stats.newCustomers}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">Avg Lifetime Value</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">PKR {Math.round(stats.avgLtv).toLocaleString()}</h3>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex-wrap justify-between">
          <div className="relative min-w-[240px] max-w-[320px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="w-full h-8 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-[#FF5722] focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            {segmentPills.map(s => (
              <button
                key={s}
                onClick={() => { setSegment(s); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors focus:outline-none ${segment === s
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Orders & Spend</th>
                  <th className="px-5 py-3 text-right">Last Visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isError ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="p-12 text-center flex flex-col items-center">
                        <p className="text-xs font-bold text-red-500 mb-2">Couldn't load customers.</p>
                        <button onClick={fetchCustomers} className="text-xs font-semibold text-[#FF5722] hover:underline">
                          Try again
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={4}>
                      <PageLoader label="Loading customers..." className="min-h-0 py-16" />
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-3 text-slate-400">
                          <Users size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">No customers found</h3>
                        <p className="text-slate-500 mt-1 text-xs max-w-sm">When customers place orders, their profiles will automatically appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      {/* Name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-slate-100 text-slate-700 font-bold text-xs">
                            {c.name ? c.name.substring(0, 2).toUpperCase() : 'G'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                              {c.name}
                              {c.segment && (
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded uppercase">
                                  {c.segment.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3">
                        <div className="text-xs text-slate-600 font-mono">
                          {c.phone || c.email || '—'}
                        </div>
                      </td>

                      {/* Spend */}
                      <td className="px-5 py-3">
                        <div className="text-xs">
                          <span className="font-bold text-slate-900 font-mono">PKR {(c.totalSpend || 0).toLocaleString()}</span>
                          <span className="text-slate-400 ml-1.5">({c.totalOrders || 0} orders)</span>
                        </div>
                      </td>

                      {/* Last Visit */}
                      <td className="px-5 py-3 text-right">
                        <div className="text-xs text-slate-500">
                          {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : 'Never'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && customers.length > 0 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
              <div>
                Showing <span className="font-bold text-slate-900 font-mono">{customers.length}</span> of <span className="font-bold text-slate-900 font-mono">{pagination.total}</span> customers
              </div>
              <Pagination 
                currentPage={currentPage} 
                totalPages={Math.max(1, pagination.totalPages)} 
                onPageChange={setCurrentPage} 
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>

      </div>

      {selectedCustomerId && (
        <CustomerDetailSlideOver
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onCustomerUpdated={fetchCustomers}
        />
      )}

      <CreateCustomerSlideOver
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateCustomer}
      />
    </AdminOnly>
  );
}
