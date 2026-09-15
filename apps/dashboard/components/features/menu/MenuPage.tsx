'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Plus, MapPin, Download, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { useCategories, useMenuItems } from './hooks/useMenuQueries';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { useBranches } from '@/hooks/useBranches';
import { MenuSidebar } from './MenuSidebar';
import { MenuItemGrid } from './MenuItemGrid';
import { EditItemPanel } from './EditItemPanel';
import { BulkUploadTab } from './BulkUploadTab';
import { PreviewModal } from './PreviewModal';
import { CopyMenuToBranchesModal } from './CopyMenuToBranchesModal';
import { menuToCsv, downloadCsv } from './menuCsv';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SECONDARY_BTN =
  'inline-flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function MenuPage() {
  const { tenantId, role } = useUser();
  const isAdmin = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  const { selectedBranchId, selectedBranchName } = useDashboardContext();
  const { data: branches = [] } = useBranches();

  const isReadOnly = selectedBranchId === null;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'MANAGE' | 'BULK'>('MANAGE');
  const [showPreview, setShowPreview] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories(tenantId, selectedBranchId);
  const {
    data: items = [],
    isLoading: isItemsLoading,
    isError: isItemsError,
    refetch: refetchItems,
  } = useMenuItems({
    tenantId,
    categoryId: selectedCategoryId,
    search: debouncedSearch,
    isAvailable:
      availabilityFilter === 'available' ? true : availabilityFilter === 'unavailable' ? false : undefined,
    branchId: selectedBranchId,
  });

  const selectedItem =
    selectedItemId && selectedItemId !== 'new' ? items.find((i: any) => i.id === selectedItemId) || null : null;
  const selectedCategory = categories.find((c: any) => c.id === selectedCategoryId) || null;
  const panelOpen = isCreating || !!selectedItemId;

  const handleOpenItem = (id: string | null) => { setIsCreating(false); setSelectedItemId(id); };
  const handleAddItem = () => { setSelectedItemId(null); setIsCreating(true); };
  const handleClosePanel = () => { setSelectedItemId(null); setIsCreating(false); };

  const handleExport = () => {
    if (!items.length) { toast.error('Nothing to export yet'); return; }
    const scope = selectedCategory ? selectedCategory.name.toLowerCase().replace(/\s+/g, '-') : 'menu';
    downloadCsv(`${scope}-export-${new Date().toISOString().slice(0, 10)}.csv`, menuToCsv(categories, items));
  };

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-5 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 shrink-0">Menu</h1>
          {!isReadOnly && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 truncate">
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{selectedBranchName}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 mr-1">
            <button
              onClick={() => setActiveTab('MANAGE')}
              className={`px-3 h-8 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'MANAGE' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Manage
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('BULK')}
                className={`px-3 h-8 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'BULK' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Bulk import
              </button>
            )}
          </div>

          {activeTab === 'MANAGE' && (
            <>
              <button onClick={() => setShowPreview(true)} className={SECONDARY_BTN}>
                <Eye size={15} /> Preview
              </button>

              {isAdmin && (
                <button onClick={handleExport} disabled={isReadOnly || items.length === 0} className={SECONDARY_BTN}>
                  <Download size={15} /> Export
                </button>
              )}

              {isAdmin && branches.length > 1 && (
                <button
                  onClick={() => setShowCopyModal(true)}
                  disabled={isReadOnly}
                  className={SECONDARY_BTN}
                  title={isReadOnly ? 'Select a source branch first' : undefined}
                >
                  <GitBranch size={15} /> Copy to branches
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={handleAddItem}
                  disabled={isReadOnly}
                  className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-semibold text-white bg-[#ff5722] rounded-lg hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                  title={isReadOnly ? 'Select a specific branch to add items' : undefined}
                >
                  <Plus size={15} /> Add item
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Body */}
      {activeTab === 'BULK' ? (
        <BulkUploadTab />
      ) : isReadOnly ? (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-md mx-auto text-center bg-white border border-slate-200 rounded-2xl p-10 mt-10">
            <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="text-[#ff5722]" size={26} />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">Choose a branch</h2>
            <p className="text-sm text-slate-500">
              Menus are managed per branch. Pick a branch from the selector in the top bar to view or edit its menu.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <MenuSidebar
            categories={categories}
            isLoading={isCategoriesLoading}
            selectedCategoryId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            isAdmin={isAdmin}
            isReadOnly={isReadOnly}
            branchId={selectedBranchId}
          />

          <MenuItemGrid
            items={items}
            search={search}
            setSearch={setSearch}
            viewMode={viewMode}
            setViewMode={setViewMode}
            availabilityFilter={availabilityFilter}
            setAvailabilityFilter={setAvailabilityFilter}
            selectedItemId={selectedItemId}
            onSelectItem={handleOpenItem}
            onAddItem={handleAddItem}
            isAdmin={isAdmin}
            isLoading={isItemsLoading}
            isError={isItemsError}
            onRetry={refetchItems}
            isReadOnly={isReadOnly}
            categoryName={selectedCategory?.name ?? null}
            categoryDescription={selectedCategory?.description ?? null}
          />
        </div>
      )}

      {/* Slide-over editor */}
      {panelOpen && (
        <EditItemPanel
          item={selectedItem}
          categories={categories}
          mode={isCreating ? 'create' : 'edit'}
          onClose={handleClosePanel}
        />
      )}

      {showPreview && (
        <PreviewModal
          categories={categories}
          items={items}
          branchName={isReadOnly ? undefined : selectedBranchName}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showCopyModal && !isReadOnly && (
        <CopyMenuToBranchesModal
          tenantId={tenantId}
          branches={branches}
          sourceBranchId={selectedBranchId!}
          sourceBranchName={selectedBranchName}
          onClose={() => setShowCopyModal(false)}
        />
      )}
    </div>
  );
}
