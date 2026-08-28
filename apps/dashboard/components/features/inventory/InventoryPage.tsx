'use client';

import React from 'react';
import { useInventory } from './hooks/useInventory';
import { InventoryStatsBar } from './InventoryStatsBar';
import { CriticalAlertBanner } from './CriticalAlertBanner';
import { InventoryFilters } from './InventoryFilters';
import { InventoryTable } from './InventoryTable';
import { RecipesTab } from './RecipesTab';
import { PurchaseOrdersTab } from './purchase-orders/PurchaseOrdersTab';
import { WastageTab } from './wastage/WastageTab';
import { PhysicalCountTab } from './counts/PhysicalCountTab';
import { SuppliersTab } from './suppliers/SuppliersTab';
import { AddIngredientPanel } from './panels/AddIngredientPanel';
import { Package, Plus } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonStatCards, SkeletonTable } from '@/components/ui/skeleton';

// ─── Stat card skeleton ───────────────────────────────────────────────────────
function StatsSkeleton() {
  return <SkeletonStatCards count={4} className="mb-6" />;
}

// ─── Table skeleton matching the real InventoryTable columns ──────────────────
function InventoryTableSkeleton() {
  return (
    <SkeletonTable
      className="!border-slate-100 rounded-lg mb-6"
      rows={6}
      columns={[
        { w: 160, avatar: true },
        48,
        70,
        70,
        { w: 72, pill: true },
        70,
        90,
        { w: 56, align: 'right' },
      ]}
    />
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
    isStatsLoading,
    isIngredientsLoading,
    isIngredientsError,
    refetchIngredients,
    isAddModalOpen,
    setIsAddModalOpen,
    editIngredient,
    setEditIngredient,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
  } = useInventory();

  const tabs = ['Stock Levels', 'Ingredients', 'Recipes', 'Purchase Orders', 'Wastage Log', 'Physical Count', 'Suppliers'];

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
      <div className="flex gap-8 border-b border-slate-200 mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-medium transition-all relative whitespace-nowrap ${
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
          {isStatsLoading ? (
            <StatsSkeleton />
          ) : (
            <>
              <InventoryStatsBar stats={stats} />
              {stats.criticalAlerts.length > 0 && (
                <CriticalAlertBanner outOfStockCount={stats.outOfStock} />
              )}
            </>
          )}

          <InventoryFilters filters={filters} onChange={setFilters} resultCount={inventoryList.length} />

          {isIngredientsError ? (
            <ErrorState message="Couldn't load inventory." onRetry={refetchIngredients} />
          ) : isIngredientsLoading ? (
            <InventoryTableSkeleton />
          ) : inventoryList.length === 0 ? (
            <EmptyIngredientsState onAdd={() => setIsAddModalOpen(true)} />
          ) : (
            <InventoryTable inventoryList={inventoryList} onEdit={setEditIngredient} />
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
          <PurchaseOrdersTab />
        </div>
      )}

      {activeTab === 'Wastage Log' && (
        <div className="mt-6">
          <WastageTab />
        </div>
      )}

      {activeTab === 'Physical Count' && (
        <div className="mt-6">
          <PhysicalCountTab />
        </div>
      )}

      {activeTab === 'Suppliers' && (
        <div className="mt-6">
          <SuppliersTab />
        </div>
      )}

      <AddIngredientPanel
        isOpen={isAddModalOpen || !!editIngredient}
        onClose={() => { setIsAddModalOpen(false); setEditIngredient(null); }}
        editIngredient={editIngredient}
      />
    </div>
  );
}
