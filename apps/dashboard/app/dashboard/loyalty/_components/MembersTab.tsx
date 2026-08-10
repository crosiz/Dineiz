'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Pagination } from '@/components/ui/Pagination';

export function MembersTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      // Sort by loyalty points to get members
      const res = await apiFetch<any>(`/api/customers?page=${currentPage}&limit=${pageSize}&sortBy=loyaltyPoints&sortOrder=desc`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [currentPage, pageSize]);

  const customers = data?.data || [];
  const pagination = data?.meta || { total: 0, page: 1, limit: 25, totalPages: 1 };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Loyalty Members</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Member Name</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Tier</th>
                <th className="px-6 py-4 text-right">Loyalty Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div className="bg-white p-12 text-center flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-slate-300 text-3xl animate-spin mb-4">progress_activity</span>
                      <h3 className="text-[13px] font-bold text-slate-900">Loading members...</h3>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="bg-white p-12 text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-slate-300 text-3xl">stars</span>
                      </div>
                      <h3 className="text-[13px] font-bold text-slate-900">No members found</h3>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c: any) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 text-slate-600 font-bold text-[13px]">
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-900">{c.name}</p>
                          <span className="text-[11px] font-medium text-slate-500">
                            Member since {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-medium text-slate-700">{c.phone || '—'}</p>
                      <p className="text-[11px] text-slate-500">{c.email || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {c.tierBadgeColor ? (
                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded" style={{ backgroundColor: `${c.tierBadgeColor}15`, color: c.tierBadgeColor }}>
                          {c.tierName}
                        </span>
                      ) : (
                        <span className="text-[12px] font-medium text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[14px] font-bold text-[#FF5722]">{c.loyaltyPoints}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {customers.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
            <div>
              Showing <span className="font-bold text-slate-900">{(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-slate-900">{pagination.total}</span> members
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
  );
}
