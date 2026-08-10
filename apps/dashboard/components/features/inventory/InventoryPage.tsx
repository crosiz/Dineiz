'use client';

import React, { useState } from 'react';
import { useInventory } from './hooks/useInventory';
import { InventoryStatsBar } from './InventoryStatsBar';
import { CriticalAlertBanner } from './CriticalAlertBanner';
import { InventoryFilters } from './InventoryFilters';
import { InventoryTable } from './InventoryTable';
import { RecentPurchaseOrders } from './RecentPurchaseOrders';
import { QuickWastageLog } from './QuickWastageLog';
import { RecipesTab } from './RecipesTab';
import { AddIngredientPanel } from './panels/AddIngredientPanel';
import { Package, Plus } from 'lucide-react';

// ─── Stat card skeleton ───────────────────────────────────────────────────────
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-6 mb-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col justify-center gap-2"
        >
          <div className="h-2.5 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-8 w-12 bg-slate-200 rounded animate-pulse" />
          <div className="h-2.5 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Table skeleton matching real columns exactly ─────────────────────────────
// Real columns: Ingredient | Unit | In Stock | Min Threshold | Status | Branches | Actions
function InventoryTableSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-100 overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
            <tr>
              <th className="w-[280px] px-6 py-4">Ingredient</th>
              <th className="w-32 px-6 py-4">Unit</th>
              <th className="w-32 px-6 py-4">In Stock</th>
              <th className="w-40 px-6 py-4">Min Threshold</th>
              <th className="w-32 px-6 py-4">Status</th>
              <th className="w-40 px-6 py-4">Branches</th>
              <th className="w-20 px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[0, 60, 120, 180, 240].map((delay) => (
              <tr key={delay} className="border-b border-slate-100">
                {/* Ingredient: thumb + name + category chip */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg bg-slate-200 animate-pulse shrink-0"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                      <div className="h-2.5 w-16 bg-slate-100 rounded animate-pulse" style={{ animationDelay: `${delay + 30}ms` }} />
                    </div>
                  </div>
                </td>
                {/* Unit */}
                <td className="px-6 py-4">
                  <div className="h-3.5 w-10 bg-slate-200 rounded animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                </td>
                {/* In Stock */}
                <td className="px-6 py-4">
                  <div className="h-3.5 w-16 bg-slate-200 rounded animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                </td>
                {/* Min Threshold */}
                <td className="px-6 py-4">
                  <div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                </td>
                {/* Status: pill */}
                <td className="px-6 py-4">
                  <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                </td>
                {/* Branches */}
                <td className="px-6 py-4">
                  <div className="h-3.5 w-20 bg-slate-200 rounded animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                </td>
                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                    <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" style={{ animationDelay: `${delay + 30}ms` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyIngredientsState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-6 py-16 flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
        <Package size={24} className="text-slate-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-900">No ingredients added yet</p>
        <p className="text-sm text-slate-500 mt-1">Add your first ingredient to start tracking stock</p>
      </div>
      <button
        onClick={onAdd}
        className="mt-2 bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
      >
        <Plus size={16} />
        Add Ingredient
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function InventoryPage() {
  const {
    inventoryList,
    stats,
    recentPOs,
    wastageLogs,
    isLoading,
    isStatsLoading,
    isIngredientsLoading,
    isAddModalOpen,
    setIsAddModalOpen,
    activeTab,
    setActiveTab,
  } = useInventory();

  const tabs = ['Stock Levels', 'Ingredients', 'Recipes', 'Purchase Orders', 'Wastage Log'];

  return (
    <div className="p-6 max-w-7xl mx-auto pb-20 relative">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">
            Operations &gt; Inventory
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory Management</h1>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Ingredient
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-slate-200 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-medium transition-all relative ${
              activeTab === tab ? 'text-[#ff5722]' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#ff5722] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Stock Levels / Ingredients tab */}
      {(activeTab === 'Stock Levels' || activeTab === 'Ingredients') && (
        <>
          {/* Stats — show skeleton while loading */}
          {isStatsLoading ? (
            <StatsSkeleton />
          ) : (
            <>
              <InventoryStatsBar stats={stats} />
              {stats.criticalAlerts.length > 0 && (
                <CriticalAlertBanner
                  alerts={stats.criticalAlerts}
                  outOfStockCount={stats.outOfStock}
                />
              )}
            </>
          )}

          {/* Filters */}
          <InventoryFilters />

          {/* Ingredients table */}
          {isIngredientsLoading ? (
            <InventoryTableSkeleton />
          ) : inventoryList.length === 0 ? (
            <EmptyIngredientsState onAdd={() => setIsAddModalOpen(true)} />
          ) : (
            <InventoryTable inventoryList={inventoryList} />
          )}
        </>
      )}

      {activeTab === 'Recipes' && (
        <div className="mt-6">
          <RecipesTab />
        </div>
      )}

      {activeTab === 'Purchase Orders' && (
        <div className="mt-6">
          <RecentPurchaseOrders orders={recentPOs} isLoading={isLoading} />
        </div>
      )}

      {activeTab === 'Wastage Log' && (
        <div className="mt-6">
          <QuickWastageLog logs={wastageLogs} isLoading={isLoading} />
        </div>
      )}

      <AddIngredientPanel
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
