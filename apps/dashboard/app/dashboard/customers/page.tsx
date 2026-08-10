'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@dineiz/ui/src/components/button';
import { getCustomers, createCustomer } from '@/lib/api/customers';
import { AdminOnly } from '@/components/admin-only';
import { toast } from 'sonner';
import { CustomerDetailSlideOver } from './_components/CustomerDetailSlideOver';
import { CreateCustomerSlideOver } from './_components/CreateCustomerSlideOver';
import { Pagination } from '@/components/ui/Pagination';

export default function CRMCustomersPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchCustomers = async () => {
    setLoading(true);
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
      <div className="space-y-8 pb-12 font-sans max-w-7xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
            <p className="text-gray-500 mt-1.5 text-sm font-medium">Your restaurant's most valuable asset.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-full shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-200 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">upload</span> Import
            </button>
            <button className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-full shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-200 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">download</span> Export
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-6 py-2.5 bg-[#FF5722] hover:bg-[#E64A19] text-white text-sm font-semibold rounded-full shadow-[0_8px_16px_rgba(255,87,34,0.3)] hover:shadow-[0_12px_24px_rgba(255,87,34,0.4)] transition-all flex items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span> Add Customer
            </button>
          </div>
        </div>

        {/* Minimal Summary Stats */}
        <div className="flex flex-wrap items-center gap-y-6 gap-x-8 mb-6 bg-white py-4 px-6 rounded-xl border border-slate-100 shadow-sm mt-6">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Customers</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">{stats.totalCustomers}</h3>
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100 hidden md:block"></div>
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active (30d)</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">{stats.activeCustomers}</h3>
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100 hidden lg:block"></div>
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">New This Month</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">{stats.newCustomers}</h3>
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100 hidden lg:block"></div>
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Avg Lifetime Value</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">PKR {Math.round(stats.avgLtv).toLocaleString()}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-[13px] outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-400"
              placeholder="Search name, phone, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {segmentPills.map(s => (
              <button
                key={s}
                onClick={() => { setSegment(s); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors focus:outline-none ${segment === s
                    ? 'bg-slate-100 text-slate-900 font-bold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Orders & Spend</th>
                  <th className="px-6 py-4 text-right">Last Visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="bg-white p-12 text-center flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-slate-300 text-3xl animate-spin mb-4">progress_activity</span>
                        <h3 className="text-[13px] font-bold text-slate-900">Loading customers...</h3>
                      </div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="bg-white p-12 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                          <span className="material-symbols-outlined text-slate-300 text-3xl">group</span>
                        </div>
                        <h3 className="text-[13px] font-bold text-slate-900">No customers found</h3>
                        <p className="text-slate-500 mt-2 text-[13px] font-medium max-w-sm">When customers place orders, their profiles will automatically appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 text-slate-600 font-bold text-[13px]">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                              {c.name}
                              {c.segment && (
                                <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-bold rounded uppercase tracking-wide">
                                  {c.segment.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="text-[13px] font-medium text-slate-600">
                          {c.phone || c.email || '—'}
                        </div>
                      </td>

                      {/* Orders & Spend */}
                      <td className="px-6 py-4">
                        <div className="text-[13px] font-medium text-slate-600 flex items-center gap-3">
                          <span className="font-bold">{c.totalOrders}</span> orders
                          <span className="text-slate-300">•</span>
                          <span>PKR {c.totalSpend.toLocaleString()}</span>
                        </div>
                      </td>

                      {/* Last Visit */}
                      <td className="px-6 py-4 text-right">
                        <div className="text-[13px] font-medium text-slate-500">
                          {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && customers.length > 0 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
              <div>
                Showing <span className="font-bold text-slate-900">{(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-slate-900">{pagination.total}</span> customers
              </div>
              <Pagination 
                currentPage={pagination.page} 
                totalPages={Math.max(1, pagination.totalPages)} 
                onPageChange={setCurrentPage} 
                pageSize={pagination.limit}
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
          onUpdate={fetchCustomers}
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
