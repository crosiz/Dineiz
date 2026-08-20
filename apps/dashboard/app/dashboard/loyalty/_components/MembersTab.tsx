'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Pagination } from '@/components/ui/Pagination';
import { Sparkles } from 'lucide-react';
import { PageLoader } from '@/components/ui/Spinner';

export function MembersTab() {
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [data, setData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchMembers = async () => {
    setLoading(true);
    setIsError(false);
    try {
      // Sort by loyalty points to get members
      const res = await apiFetch<any>(`/api/customers?page=${currentPage}&limit=${pageSize}&sortBy=loyaltyPoints&sortOrder=desc`);
      setData(res);
    } catch (e) {
      console.error(e);
      setIsError(true);
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-900">Enrolled Members</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Tier</th>
                <th className="px-5 py-3">Points Balance</th>
                <th className="px-5 py-3 text-right">Lifetime Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isError ? (
                <tr>
                  <td colSpan={4}>
                    <div className="p-10 text-center flex flex-col items-center">
                      <p className="text-xs font-bold text-red-500 mb-2">Couldn't load loyalty members.</p>
                      <button onClick={fetchMembers} className="text-xs font-semibold text-[#FF5722] hover:underline">
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={4}>
                    <PageLoader label="Loading members..." className="min-h-0 py-16" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="p-10 text-center flex flex-col items-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-2 text-slate-400">
                        <Sparkles size={22} />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900">No members found</h3>
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
