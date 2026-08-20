'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminOnly } from '@/components/admin-only';
import { CreateDealSlideOver } from './_components/CreateDealSlideOver';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Tag, Ticket, Utensils, Trash2, ShoppingBag } from 'lucide-react';
import { PageLoader } from '@/components/ui/Spinner';

type Item = { id: string; name: string; basePrice: number };
type Category = { id: string; name: string; items: Item[] };
type Deal = { 
  id: string; name: string; type: string; config: any; 
  isActive: boolean; minOrderValue?: number; autoApply: boolean; 
  usedCount: number; maxUsesTotal?: number; requiresPromoCode: boolean; promoCode?: string 
};

type Tab = 'all' | 'promo' | 'combo' | 'scheduled';

export default function DealsPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [isSlideOverOpen, setSlideOverOpen] = useState(false);
  const { branchId, queryParam } = useBranchFilter();

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      const [menu, ds] = await Promise.all([
        apiFetch<Category[]>('/api/menu'),
        apiFetch<Deal[]>(`/api/deals${queryParam ? `?${queryParam}` : ''}`),
      ]);
      setCategories(menu);
      setItems(menu.flatMap(cat => cat.items ?? []));
      setDeals(ds);
    } catch (e: any) {
      setError(e?.message || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, [branchId]);

  const handleCreateDeal = async (dealData: any) => {
    try {
      await apiFetch('/api/deals', {
        method: 'POST',
        body: JSON.stringify(dealData),
      });
      await bootstrap();
    } catch (e: any) {
      alert(e?.message || 'Failed to create deal');
    }
  };

  const toggleDealStatus = async (dealId: string, currentStatus: boolean) => {
    try {
      await apiFetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      setDeals(deals.map(d => d.id === dealId ? { ...d, isActive: !currentStatus } : d));
    } catch (e: any) {
      alert(e?.message || 'Failed to update deal');
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    try {
      await apiFetch(`/api/deals/${dealId}`, {
        method: 'DELETE',
      });
      setDeals(deals.filter(d => d.id !== dealId));
    } catch (e: any) {
      alert(e?.message || 'Failed to delete deal');
    }
  };

  const activeDeals = deals.filter(d => d.isActive).length;
  const totalRedemptions = deals.reduce((acc, d) => acc + (d.usedCount || 0), 0);
  const fixedAmountDiscountsGiven = deals.reduce((acc, d) => {
    if (d.type === 'FIXED_AMOUNT' && typeof d.config?.amount === 'number') {
      return acc + d.config.amount * (d.usedCount || 0);
    }
    return acc;
  }, 0);
  const avgRedemptionsPerDeal = deals.length > 0 ? totalRedemptions / deals.length : 0;

  const displayedDeals = deals.filter(d => {
    if (tab === 'all') return true;
    if (tab === 'promo') return d.requiresPromoCode;
    if (tab === 'combo') return d.type === 'COMBO_PRICE';
    if (tab === 'scheduled') return d.type === 'HAPPY_HOUR';
    return true;
  });

  const totalPages = Math.ceil(displayedDeals.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDeals = displayedDeals.slice(startIndex, startIndex + pageSize);

  return (
    <AdminOnly>
      <div className="space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Deals & Promotions</h1>
            <p className="text-slate-500 mt-0.5 text-xs font-medium">Create and manage discounts, promo codes, and time-based offers</p>
          </div>
          <button 
            onClick={() => setSlideOverOpen(true)}
            className="h-9 px-4 bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} />
            Create Deal
          </button>
        </div>

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">Active Deals</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">{activeDeals}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">Total Redemptions</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">{totalRedemptions}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">Fixed Discounts Given</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">PKR {fixedAmountDiscountsGiven.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 mb-1">Avg Redemptions / Deal</p>
            <h3 className="text-xl font-bold text-slate-900 font-mono">{avgRedemptionsPerDeal.toFixed(1)}</h3>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit">
          {[
            { id: 'all', label: 'All Deals' },
            { id: 'promo', label: 'Promo Codes' },
            { id: 'combo', label: 'Combos' },
            { id: 'scheduled', label: 'Scheduled' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id as Tab); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors focus:outline-none ${
                tab === t.id 
                  ? 'bg-white shadow-xs text-slate-900' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        {/* Deal Cards Listing */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th className="w-[300px] px-5 py-3">Deal Details</th>
                  <th className="px-5 py-3">Conditions</th>
                  <th className="w-64 px-5 py-3">Usage Limit</th>
                  <th className="w-32 px-5 py-3">Status</th>
                  <th className="w-20 px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <PageLoader label="Fetching promotions..." className="min-h-0 py-16" />
                    </td>
                  </tr>
                ) : paginatedDeals.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-3 text-slate-400">
                          <Tag size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">No deals found</h3>
                        <p className="text-slate-500 mt-1 text-xs max-w-sm">Create your first deal to offer discounts, happy hours, or promo codes.</p>
                        <button 
                          onClick={() => setSlideOverOpen(true)}
                          className="mt-4 text-[#FF5722] text-xs font-bold hover:underline"
                        >
                          + Create a new deal
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDeals.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Type */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${d.isActive ? 'bg-[#FF5722]/10 text-[#FF5722]' : 'bg-slate-100 text-slate-400'}`}>
                            {d.requiresPromoCode ? <Ticket size={14} /> : d.type === 'COMBO_PRICE' ? <Utensils size={14} /> : <Tag size={14} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-2">
                              {d.name}
                              {d.requiresPromoCode && (
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-mono font-semibold rounded uppercase">
                                  {d.promoCode}
                                </span>
                              )}
                            </p>
                            <span className="text-[10px] font-medium text-slate-400 uppercase mt-0.5 inline-block">
                              {d.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Conditions */}
                      <td className="px-5 py-3">
                        {d.minOrderValue ? (
                          <span className="text-xs text-slate-700 flex items-center gap-1.5">
                            <ShoppingBag size={13} className="text-slate-400" /> Min PKR {d.minOrderValue}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No minimum</span>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="px-5 py-3">
                        <div className="w-full max-w-[180px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-700 font-mono">{d.usedCount}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{d.maxUsesTotal ? `of ${d.maxUsesTotal}` : 'uses'}</span>
                          </div>
                          {d.maxUsesTotal ? (
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#FF5722] rounded-full" style={{ width: `${(d.usedCount / d.maxUsesTotal) * 100}%` }} />
                            </div>
                          ) : (
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full w-1/4 bg-slate-300 rounded-full" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="px-5 py-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={d.isActive} onChange={() => toggleDealStatus(d.id, d.isActive)} />
                          <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#FF5722]" />
                        </label>
                      </td>
                      
                      {/* Actions */}
                      <td className="px-5 py-3 text-right">
                        <button 
                          onClick={() => handleDeleteDeal(d.id)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center ml-auto"
                          title="Delete deal"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          {!loading && displayedDeals.length > 0 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
              <div>
                Showing <span className="font-bold text-slate-900 font-mono">{Math.min(startIndex + 1, displayedDeals.length)}-{Math.min(startIndex + pageSize, displayedDeals.length)}</span> of <span className="font-bold text-slate-900 font-mono">{displayedDeals.length}</span>
              </div>
              <Pagination 
                currentPage={currentPage} 
                totalPages={Math.max(1, totalPages)} 
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

      <CreateDealSlideOver 
        isOpen={isSlideOverOpen} 
        onClose={() => setSlideOverOpen(false)} 
        onSubmit={handleCreateDeal}
        items={items}
        categories={categories}
      />
    </AdminOnly>
  );
}

