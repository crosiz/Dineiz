'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminOnly } from '@/components/admin-only';
import { CreateDealSlideOver } from './_components/CreateDealSlideOver';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { Pagination } from '@/components/ui/Pagination';

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
  // Only FIXED_AMOUNT deals have a real currency value on the deal itself —
  // PERCENT/HAPPY_HOUR discounts depend on the order total they were applied
  // to, which isn't available here, so they're left out rather than guessed.
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
    if (tab === 'scheduled') return d.type === 'HAPPY_HOUR'; // Approximation for demo
    return true;
  });

  const totalPages = Math.ceil(displayedDeals.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDeals = displayedDeals.slice(startIndex, startIndex + pageSize);

  return (
    <AdminOnly>
      <div className="space-y-8 pb-12 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Deals & Promotions</h1>
            <p className="text-gray-500 mt-1.5 text-sm font-medium">Create and manage discounts, promo codes, and time-based offers.</p>
          </div>
          <button 
            onClick={() => setSlideOverOpen(true)}
            className="px-6 py-3 bg-[#FF5722] hover:bg-[#E64A19] text-white font-medium rounded-full shadow-[0_8px_16px_rgba(255,87,34,0.3)] hover:shadow-[0_12px_24px_rgba(255,87,34,0.4)] transition-all flex items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Deal
          </button>
        </div>

        {/* Premium Summary Cards */}
        <div className="flex flex-wrap items-center gap-y-6 gap-x-8 mb-6 bg-white py-4 px-6 rounded-xl border border-slate-100 shadow-sm mt-6">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active Deals</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">{activeDeals}</h3>
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100 hidden md:block"></div>
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Redemptions</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">{totalRedemptions}</h3>
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100 hidden lg:block"></div>
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Fixed Discounts Given</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">PKR {fixedAmountDiscountsGiven.toLocaleString()}</h3>
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100 hidden lg:block"></div>
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Avg Redemptions / Deal</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-lg font-bold text-slate-900">{avgRedemptionsPerDeal.toFixed(1)}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-2 bg-white rounded-xl shadow-sm border border-slate-100 w-fit mb-6">
          {[
            { id: 'all', label: 'All Deals' },
            { id: 'promo', label: 'Promo Codes' },
            { id: 'combo', label: 'Combos' },
            { id: 'scheduled', label: 'Scheduled' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id as Tab); setCurrentPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors focus:outline-none ${
                tab === t.id 
                  ? 'bg-slate-100 text-slate-900 font-bold' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Deal Cards Listing */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="w-[300px] px-6 py-4">Deal Details</th>
                  <th className="px-6 py-4">Conditions</th>
                  <th className="w-64 px-6 py-4">Usage Limit</th>
                  <th className="w-32 px-6 py-4">Status</th>
                  <th className="w-20 px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="bg-white py-24 text-center flex flex-col items-center justify-center">
                        <div className="relative flex items-center justify-center">
                          {/* Outer pulse */}
                          <div className="absolute w-16 h-16 rounded-full border-4 border-[#ff5722]/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                          {/* Inner spinner */}
                          <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-[#ff5722] border-r-[#ff5722]/50 animate-spin relative z-10 shadow-[0_0_15px_rgba(255,87,34,0.2)]"></div>
                        </div>
                        <h3 className="mt-8 text-[14px] font-bold text-slate-900 tracking-wide">Loading Deals</h3>
                        <p className="text-slate-500 mt-1 text-[13px] font-medium">Fetching your latest promotions...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedDeals.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="bg-white p-12 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                          <span className="material-symbols-outlined text-slate-300 text-3xl">local_offer</span>
                        </div>
                        <h3 className="text-[13px] font-bold text-slate-900">No deals found</h3>
                        <p className="text-slate-500 mt-2 text-[13px] font-medium max-w-sm">Create your first deal to offer discounts, happy hours, or promo codes to your customers.</p>
                        <button 
                          onClick={() => setSlideOverOpen(true)}
                          className="mt-6 text-[#ff5722] text-[13px] font-bold hover:text-[#e64a19]"
                        >
                          + Create a new deal
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDeals.map(d => (
                    <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      {/* Name & Type */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${d.isActive ? 'bg-[#ff5722]/10 text-[#ff5722]' : 'bg-slate-100 text-slate-400'}`}>
                            <span className="material-symbols-outlined text-[16px]">
                              {d.requiresPromoCode ? 'confirmation_number' : d.type === 'COMBO_PRICE' ? 'fastfood' : 'sell'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-2">
                              {d.name}
                              {d.requiresPromoCode && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded uppercase tracking-wider">
                                  {d.promoCode}
                                </span>
                              )}
                            </p>
                            <span className="text-[9px] font-bold bg-slate-50 text-slate-400 rounded px-1.5 uppercase tracking-wide mt-1 inline-block">
                              {d.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Conditions */}
                      <td className="px-6 py-4">
                        {d.minOrderValue ? (
                          <span className="text-[13px] font-medium text-slate-700 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">shopping_cart</span> Min PKR {d.minOrderValue}
                          </span>
                        ) : (
                          <span className="text-[13px] font-medium text-slate-400">No minimum</span>
                        )}
                      </td>

                      {/* Usage */}
                      <td className="px-6 py-4">
                        <div className="w-full max-w-[200px]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] font-bold text-slate-700">{d.usedCount}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.maxUsesTotal ? `of ${d.maxUsesTotal}` : 'uses'}</span>
                          </div>
                          {d.maxUsesTotal ? (
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#ff5722] rounded-full transition-all" style={{ width: `${(d.usedCount / d.maxUsesTotal) * 100}%` }}></div>
                            </div>
                          ) : (
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full w-1/4 bg-slate-300 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="px-6 py-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={d.isActive} onChange={() => toggleDealStatus(d.id, d.isActive)} />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff5722]"></div>
                        </label>
                      </td>
                      
                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteDeal(d.id)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center focus:outline-none ml-auto"
                          title="Delete deal"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
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
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
              <div>
                Showing <span className="font-bold text-slate-900">{Math.min(startIndex + 1, displayedDeals.length)}-{Math.min(startIndex + pageSize, displayedDeals.length)}</span> of <span className="font-bold text-slate-900">{displayedDeals.length}</span> deals
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
