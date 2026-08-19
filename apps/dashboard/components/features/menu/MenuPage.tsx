'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Plus, Upload, MapPin, X, AlertTriangle } from 'lucide-react';
import { useCategories, useMenuItems, usePublishMenu } from './hooks/useMenuQueries';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { MenuSidebar } from './MenuSidebar';
import { MenuItemGrid } from './MenuItemGrid';
import { EditItemPanel } from './EditItemPanel';
import { BulkUploadTab } from './BulkUploadTab';
import { PreviewModal } from './PreviewModal';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function MenuPage() {
  const { tenantId, role } = useUser();
  const isAdmin = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  const { selectedBranchId } = useDashboardContext();
  const { data: branches = [] } = useBranches();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'MANAGE' | 'BULK'>('MANAGE');
  const [showPreview, setShowPreview] = useState(false);
  const [hasUnpublished, setHasUnpublished] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedTargetBranchIds, setSelectedTargetBranchIds] = useState<string[]>([]);

  // Split Pane Resizer States
  const [sidebarWidth, setSidebarWidth] = useState(208);
  const [editPanelWidth, setEditPanelWidth] = useState(384);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingEditPanel, setIsResizingEditPanel] = useState(false);

  useEffect(() => {
    const sw = localStorage.getItem('menu_sidebar_width');
    if (sw) setSidebarWidth(parseInt(sw, 10));
    const ew = localStorage.getItem('menu_edit_panel_width');
    if (ew) setEditPanelWidth(parseInt(ew, 10));
  }, []);

  useEffect(() => {
    if (!isResizingSidebar && !isResizingEditPanel) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (isResizingSidebar) {
        setSidebarWidth(prev => Math.min(Math.max(prev + e.movementX, 150), 400));
      } else if (isResizingEditPanel) {
        setEditPanelWidth(prev => Math.min(Math.max(prev - e.movementX, 300), 600));
      }
    };

    const handlePointerUp = () => {
      setIsResizingSidebar(false);
      setIsResizingEditPanel(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizingSidebar, isResizingEditPanel]);

  useEffect(() => {
    if (!isResizingSidebar) {
      localStorage.setItem('menu_sidebar_width', sidebarWidth.toString());
    }
  }, [isResizingSidebar, sidebarWidth]);

  useEffect(() => {
    if (!isResizingEditPanel) {
      localStorage.setItem('menu_edit_panel_width', editPanelWidth.toString());
    }
  }, [isResizingEditPanel, editPanelWidth]);

  const isReadOnly = selectedBranchId === null;

  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories(tenantId, selectedBranchId);
  const { data: items = [], isLoading: isItemsLoading, isError: isItemsError, refetch: refetchItems } = useMenuItems({
    tenantId,
    categoryId: selectedCategoryId,
    search: debouncedSearch,
    isAvailable:
      availabilityFilter === 'available'
        ? true
        : availabilityFilter === 'unavailable'
          ? false
          : undefined,
    branchId: selectedBranchId,
  });

  const publishMenu = usePublishMenu();

  const selectedItem = selectedItemId && selectedItemId !== 'new'
    ? items.find((i: any) => i.id === selectedItemId) || null
    : null;

  // Track unpublished changes
  const markDirty = useCallback(() => setHasUnpublished(true), []);

  const handleOpenItem = (id: string | null) => {
    setIsCreating(false);
    setSelectedItemId(id);
  };

  const handleAddItem = () => {
    setSelectedItemId(null);
    setIsCreating(true);
  };

  const handleClosePanel = () => {
    setSelectedItemId(null);
    setIsCreating(false);
  };

  const handlePublish = async () => {
    if (isReadOnly) {
      toast.error('Please select a specific branch to publish from');
      return;
    }
    // Pre-select other branches (exclude current)
    const initialTargets = branches.filter((b: any) => b.id !== selectedBranchId).map((b: any) => b.id);
    setSelectedTargetBranchIds(initialTargets);
    setShowPublishModal(true);
  };

  const panelOpen = isCreating || !!selectedItemId;

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Top Bar Row 1: Header */}
      <header className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-5 z-20">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-900">Menu Management</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Eye size={16} />
            Preview Menu
          </button>

          {isAdmin && (
            <button
              onClick={handlePublish}
              disabled={publishMenu.isPending || isReadOnly || !hasUnpublished}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 relative ${
                isReadOnly || !hasUnpublished
                  ? 'bg-slate-300 disabled:cursor-not-allowed opacity-75'
                  : 'bg-[#ff5722] hover:bg-orange-700'
              }`}
              title={
                isReadOnly
                  ? 'Select a specific branch to sync menu from'
                  : !hasUnpublished
                  ? 'No recent changes to sync'
                  : 'Sync menu to other branches'
              }
            >
              {publishMenu.isPending && (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {publishMenu.isPending ? 'Syncing...' : 'Sync Branches'}
              {hasUnpublished && !publishMenu.isPending && !isReadOnly && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" />
              )}
            </button>
          )}
 
          {isAdmin && activeTab === 'MANAGE' && (
            <button
              onClick={handleAddItem}
              disabled={isReadOnly}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#ff5722] rounded-lg hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              title={isReadOnly ? 'Select a specific branch to add or edit items' : undefined}
            >
              <Plus size={16} />
              Add Item
            </button>
          )}
        </div>
      </header>

      {/* Top Bar Row 2: Tabs */}
      <div className="h-12 bg-white border-b border-slate-200 shrink-0 flex items-center px-5 z-10">
        <nav className="flex items-center gap-6 h-full">
          <button
            className={`h-full text-sm transition-colors border-b-2 font-semibold flex items-center ${activeTab === 'MANAGE'
                ? 'border-[#ff5722] text-[#ff5722]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            onClick={() => setActiveTab('MANAGE')}
          >
            Manage Items
          </button>
          {isAdmin && (
            <button
              className={`h-full text-sm transition-colors border-b-2 font-semibold flex items-center gap-1.5 ${activeTab === 'BULK'
                  ? 'border-[#ff5722] text-[#ff5722]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              onClick={() => setActiveTab('BULK')}
            >
              <Upload size={14} />
              Bulk Upload CSV
            </button>
          )}
        </nav>
      </div>

      {/* Branch Context Label */}
      {!isReadOnly && selectedBranchId && (
        <div className="h-8 bg-[#FFF7ED] flex items-center px-5 shrink-0">
          <span className="text-[12px] text-amber-600 flex items-center gap-1">
            <MapPin size={14} className="text-amber-500" /> Showing menu for {branches.find((b: any) => b.id === selectedBranchId)?.name || 'this branch'} — availability toggles affect this branch only
          </span>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'MANAGE' ? (
        <div className="flex-1 flex overflow-hidden">
          {isReadOnly ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white m-4 rounded-xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                <MapPin className="text-[#ff5722]" size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Select a Branch to Manage Menu</h2>
              <p className="text-slate-500 text-sm max-w-md text-center">
                Menus are managed independently for each branch. Please use the branch selector at the top right of the navigation bar to select a specific branch (e.g., "Clifton") to view or edit its menu.
              </p>
            </div>
          ) : (
            <>
              {/* Left Panel - Sidebar */}
              <MenuSidebar
                categories={categories}
                isLoading={isCategoriesLoading}
                selectedCategoryId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                isAdmin={isAdmin}
                onMutate={markDirty}
                isReadOnly={isReadOnly}
                branchId={selectedBranchId}
                width={sidebarWidth}
              />

              {/* Resizer Handle for Sidebar */}
              <div 
                className="w-1.5 cursor-col-resize hover:bg-[#ff5722]/20 active:bg-[#ff5722]/40 items-center justify-center shrink-0 relative transition-colors flex z-10"
                onPointerDown={(e) => { e.preventDefault(); setIsResizingSidebar(true); }}
              >
                <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10 cursor-col-resize" />
              </div>

              {/* Center Panel - Grid */}
              <MenuItemGrid
                items={items}
                categories={categories}
                isLoading={isItemsLoading}
                isError={isItemsError}
                onRetry={refetchItems}
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
                onMutate={markDirty}
                panelOpen={panelOpen}
                isReadOnly={isReadOnly}
              />
            </>
          )}

          {/* Resizer Handle for Edit Panel */}
          {panelOpen && (
            <div 
              className="w-1.5 cursor-col-resize hover:bg-[#ff5722]/20 active:bg-[#ff5722]/40 items-center justify-center shrink-0 relative transition-colors flex z-10"
              onPointerDown={(e) => { e.preventDefault(); setIsResizingEditPanel(true); }}
            >
              <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10 cursor-col-resize" />
            </div>
          )}

          {/* Right Panel - Edit/Create Item */}
          {panelOpen && (
            <EditItemPanel
              item={selectedItem}
              categories={categories}
              mode={isCreating ? 'create' : 'edit'}
              onClose={handleClosePanel}
              onSaved={markDirty}
              width={editPanelWidth}
            />
          )}
        </div>
      ) : (
        <BulkUploadTab onUploaded={markDirty} />
      )}

      {/* Publish Changes Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-slate-800">Sync Menu to Other Branches</h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Push menu categories and items from this branch to target branches.
                </p>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs transition-colors p-1.5 rounded-md hover:bg-slate-100 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              <div className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-wider">
                Select Branches to Sync Menu To
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                {branches.map((b: any) => {
                  const isActiveBranch = b.id === selectedBranchId;
                  const isChecked = isActiveBranch || selectedTargetBranchIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all select-none ${
                        isActiveBranch
                          ? 'bg-slate-100 border-slate-200 cursor-default opacity-80'
                          : isChecked
                          ? 'bg-orange-50/50 border-[#ff5722] text-[#ff5722] cursor-pointer'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isActiveBranch}
                          onChange={(e) => {
                            if (isActiveBranch) return;
                            if (e.target.checked) {
                              setSelectedTargetBranchIds((prev) => [...prev, b.id]);
                            } else {
                              setSelectedTargetBranchIds((prev) => prev.filter((id) => id !== b.id));
                            }
                          }}
                          className={`w-3.5 h-3.5 rounded ${isActiveBranch ? 'text-slate-400 border-slate-300 accent-slate-400 cursor-default' : 'text-[#ff5722] border-slate-300 focus:ring-[#ff5722] accent-[#ff5722] cursor-pointer'}`}
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{b.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {b.city || 'Pakistan'} {isActiveBranch && "— Changes are saved here automatically"}
                          </span>
                        </div>
                      </div>
                      {isActiveBranch && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                          Source Branch
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              
              {selectedTargetBranchIds.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1 font-bold">
                  <AlertTriangle size={12} /> Please select at least one target branch.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={selectedTargetBranchIds.length === 0 || publishMenu.isPending}
                onClick={async () => {
                  try {
                    await publishMenu.mutateAsync({
                      tenantId,
                      params: {
                        sourceBranchId: selectedBranchId!,
                        branchIds: selectedTargetBranchIds,
                      },
                    });
                    setHasUnpublished(false);
                    setShowPublishModal(false);
                    setSelectedTargetBranchIds([]);
                  } catch (e) {
                    // toast is already handled in mutation
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#ff5722] hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
              >
                {publishMenu.isPending && (
                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {publishMenu.isPending ? 'Publishing...' : 'Sync & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          categories={categories}
          items={items}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
