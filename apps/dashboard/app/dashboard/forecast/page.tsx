'use client';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { LineChart, RefreshCw, AlertCircle, Package, Calendar } from 'lucide-react';
import { RevenueForecastChart } from './_components/RevenueForecastChart';
import { BusyPeriodCalendar } from './_components/BusyPeriodCalendar';
import { InventoryForecastTable } from './_components/InventoryForecastTable';
import { MenuItemForecastList } from './_components/MenuItemForecastList';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { AllBranchesBanner } from '@/components/AllBranchesBanner';

export default function ForecastPage() {
  const [revenueData, setRevenueData] = useState<any>(null);
  const [busyPeriods, setBusyPeriods] = useState<any>(null);
  const [itemsData, setItemsData] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { branchId, queryParam, isAllBranches } = useBranchFilter();

  const fetchAll = async () => {
    try {
      setLoading(true);
      const suffix = queryParam ? `?${queryParam}` : '';
      const [rev, busy, items, inv] = await Promise.all([
        apiGet(`/api/forecast/revenue${suffix}`).catch(() => null),
        apiGet(`/api/forecast/busy-periods${suffix}`).catch(() => null),
        apiGet(`/api/forecast/items${suffix}`).catch(() => null),
        apiGet(`/api/forecast/inventory${suffix}`).catch(() => null),
      ]);
      setRevenueData(rev);
      setBusyPeriods(busy);
      setItemsData(items);
      setInventoryData(inv);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [branchId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const suffix = queryParam ? `?${queryParam}` : '';
      await apiPost(`/api/forecast/refresh${suffix}`, {});
      await fetchAll();
    } catch (err) {
      alert('Failed to refresh forecast');
    } finally {
      setRefreshing(false);
    }
  };

  const hasNotEnoughData = revenueData?.error === 'NOT_ENOUGH_DATA';
  const generatedAt = revenueData?.generatedAt || new Date().toISOString();

  if (loading && !revenueData) {
    return <div className="p-12 text-center text-slate-500 font-medium">Loading AI forecasts...</div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <AllBranchesBanner isAllBranches={isAllBranches} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <LineChart className="text-brand-primary shrink-0" size={28} />
            AI Forecast & Planning
          </h1>
          <p className="text-slate-500 mt-2">AI-powered predictions for smarter planning.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <p className="text-xs text-slate-400">
            Last updated: {new Date(generatedAt).toLocaleString()}
          </p>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh Forecast
          </button>
        </div>
      </div>

      {hasNotEnoughData ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-sm">
          <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
          <h3 className="text-xl font-bold text-slate-800">Not enough data yet</h3>
          <p className="text-slate-500 mt-2 mb-6">
            Our AI needs at least 14 days of historical order data to generate accurate forecasts. 
            Currently, you have {revenueData.daysAvailable} days of data.
          </p>
          <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
            <div 
              className="bg-brand-primary h-3 rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(100, (revenueData.daysAvailable / 14) * 100)}%` }}
            ></div>
          </div>
          <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
            {revenueData.daysAvailable} / 14 Days Collected
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1 - Revenue */}
          <section className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <LineChart className="text-slate-400" size={20} />
                Revenue Forecast
              </h2>
              <p className="text-sm text-slate-500">Predicted daily revenue for the next 30 days based on historical patterns.</p>
            </div>
            {revenueData && <RevenueForecastChart data={revenueData} />}
          </section>

          {/* Section 2 - Busy Periods */}
          <section className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-slate-400" size={20} />
                Busy Period Prediction
              </h2>
              <p className="text-sm text-slate-500">Expect these busy periods over the next 7 days. Use this for staff scheduling.</p>
            </div>
            {busyPeriods && !busyPeriods.error && <BusyPeriodCalendar data={busyPeriods.grid} />}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Section 3 - Inventory Planning */}
            <section className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Package className="text-slate-400" size={20} />
                  Inventory Planning
                </h2>
                <p className="text-sm text-slate-500">Based on the next 7 days forecast, you will need approximately:</p>
              </div>
              <div className="flex-1 overflow-auto">
                {inventoryData && !inventoryData.error && <InventoryForecastTable data={inventoryData.inventory} />}
              </div>
            </section>

            {/* Section 4 - Menu Item Forecast */}
            <section className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Top Selling Items</h2>
                <p className="text-sm text-slate-500">Predicted quantities for the next 7 days.</p>
              </div>
              <div className="flex-1">
                {itemsData && !itemsData.error && <MenuItemForecastList data={itemsData.items} />}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
