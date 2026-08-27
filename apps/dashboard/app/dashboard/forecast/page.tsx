'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api-client';
import { LineChart, RefreshCw, AlertCircle, Package, Calendar } from 'lucide-react';
import { RevenueForecastChart } from './_components/RevenueForecastChart';
import { BusyPeriodCalendar } from './_components/BusyPeriodCalendar';
import { InventoryForecastTable } from './_components/InventoryForecastTable';
import { MenuItemForecastList } from './_components/MenuItemForecastList';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { AllBranchesBanner } from '@/components/AllBranchesBanner';
import { PageLoader } from '@/components/ui/Spinner';

export default function ForecastPage() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { branchId, queryParam, isAllBranches } = useBranchFilter();

  const suffix = queryParam ? `?${queryParam}` : '';
  const { data, isLoading: loading } = useQuery({
    queryKey: ['forecast', branchId ?? null],
    queryFn: async () => {
      const [rev, busy, items, inv] = await Promise.all([
        apiGet<any>(`/api/forecast/revenue${suffix}`).catch(() => null),
        apiGet<any>(`/api/forecast/busy-periods${suffix}`).catch(() => null),
        apiGet<any>(`/api/forecast/items${suffix}`).catch(() => null),
        apiGet<any>(`/api/forecast/inventory${suffix}`).catch(() => null),
      ]);
      return { revenueData: rev, busyPeriods: busy, itemsData: items, inventoryData: inv };
    },
    placeholderData: keepPreviousData,
  });

  const revenueData = data?.revenueData ?? null;
  const busyPeriods = data?.busyPeriods ?? null;
  const itemsData = data?.itemsData ?? null;
  const inventoryData = data?.inventoryData ?? null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiPost(`/api/forecast/refresh${suffix}`, {});
      await queryClient.invalidateQueries({ queryKey: ['forecast'] });
    } catch (err) {
      alert('Failed to refresh forecast');
    } finally {
      setRefreshing(false);
    }
  };

  const hasNotEnoughData = revenueData?.error === 'NOT_ENOUGH_DATA';
  const generatedAt = revenueData?.generatedAt || new Date().toISOString();

  if (loading && !revenueData) {
    return <PageLoader label="Loading forecast models..." />;
  }

  return (
    <div className="space-y-6">
      <AllBranchesBanner isAllBranches={isAllBranches} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LineChart className="text-[#FF5722]" size={22} />
            Demand & Inventory Forecast
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Statistical projections for sales volume, peak hours, and ingredient restock</p>
        </div>
        
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400">
            Updated: <span className="font-mono">{new Date(generatedAt).toLocaleDateString()}</span>
          </p>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-3.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Recalculate
          </button>
        </div>
      </div>

      {hasNotEnoughData ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-xl mx-auto shadow-xs space-y-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto text-amber-500">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">14-Day Baseline Required</h3>
            <p className="text-xs text-slate-500 mt-1">
              Forecast models require at least 14 continuous days of historical order history. 
              Currently {revenueData.daysAvailable} days are recorded.
            </p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-[#FF5722] h-2 rounded-full transition-all duration-700" 
              style={{ width: `${Math.min(100, (revenueData.daysAvailable / 14) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] font-semibold text-slate-500 font-mono">
            {revenueData.daysAvailable} / 14 Days Collected
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1 - Revenue */}
          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LineChart className="text-slate-400" size={16} />
                30-Day Revenue Projection
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Estimated daily sales based on historical seasonality and day-of-week trends</p>
            </div>
            {revenueData && <RevenueForecastChart data={revenueData} />}
          </section>

          {/* Section 2 - Busy Periods */}
          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="text-slate-400" size={16} />
                Peak Hour & Staffing Heatmap
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Projected hourly rush periods across the upcoming 7 days</p>
            </div>
            {busyPeriods && !busyPeriods.error && <BusyPeriodCalendar data={busyPeriods.grid} />}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Section 3 - Inventory Planning */}
            <section className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="text-slate-400" size={16} />
                  Predicted Ingredient Demand
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Estimated 7-day raw material requirements based on forecast orders</p>
              </div>
              <div className="flex-1 overflow-auto">
                {inventoryData && !inventoryData.error && <InventoryForecastTable data={inventoryData.inventory} />}
              </div>
            </section>

            {/* Section 4 - Menu Item Forecast */}
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-900">Top Predicted Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">Most in-demand recipes for the upcoming week</p>
              </div>
              <div className="flex-1 overflow-auto">
                {itemsData && !itemsData.error && <MenuItemForecastList data={itemsData.items} />}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
