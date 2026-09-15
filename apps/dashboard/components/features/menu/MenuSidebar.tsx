'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, MoreHorizontal, Pencil, Trash2, Check, X, EyeOff, AlignLeft } from 'lucide-react';
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useToggleCategoryAvailability,
} from './hooks/useMenuQueries';
import { useUser } from '@/contexts/user-context';
import { menuApi } from '@/lib/api/menu';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  itemCount?: number;
  _count?: { items: number };
}

function catCount(c: Category) {
  return c.itemCount ?? c._count?.items ?? 0;
}

function SortableCategoryItem({
  category,
  isActive,
  onClick,
  isAdmin,
  onEdit,
  onEditDescription,
  onHide,
  onDelete,
  isReadOnly,
}: {
  category: Category;
  isActive: boolean;
  onClick: () => void;
  isAdmin: boolean;
  onEdit: () => void;
  onEditDescription: () => void;
  onHide: () => void;
  onDelete: () => void;
  isReadOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !isAdmin || isReadOnly,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const count = catCount(category);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1.5 pl-2 pr-2 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-orange-50 text-[#ff5722] font-medium' : 'text-slate-600 hover:bg-slate-50'
      }`}
      onClick={onClick}
    >
      {isAdmin && !isReadOnly ? (
        <button
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          aria-label="Reorder category"
        >
          <GripVertical size={13} />
        </button>
      ) : (
        <div className="w-[13px] shrink-0" />
      )}

      <span className="text-sm truncate select-none flex-1">{category.name}</span>

      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${count > 0 ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
        {count}
      </span>

      {isAdmin && !isReadOnly && (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            aria-label="Category actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-44 text-sm">
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                >
                  <Pencil size={13} /> Rename
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEditDescription(); }}
                >
                  <AlignLeft size={13} /> Edit description
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50 border-t border-slate-100"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onHide(); }}
                >
                  <EyeOff size={13} /> Hide from this branch
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-red-600 hover:bg-red-50 border-t border-slate-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={13} /> Delete everywhere
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface MenuSidebarProps {
  categories: Category[];
  isLoading?: boolean;
  selectedCategoryId: string | undefined;
  onSelect: (id: string | undefined) => void;
  isAdmin: boolean;
  onMutate?: () => void;
  isReadOnly?: boolean;
  branchId?: string | null;
}

export function MenuSidebar({
  categories,
  isLoading,
  selectedCategoryId,
  onSelect,
  isAdmin,
  onMutate,
  isReadOnly,
  branchId,
}: MenuSidebarProps) {
  const { tenantId } = useUser();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const toggleCategoryAvailability = useToggleCategoryAvailability();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalItems = categories.reduce((sum, c) => sum + catCount(c), 0);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = [...categories];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    queryClient.setQueryData(['menu', 'categories', tenantId, branchId], reordered);
    try {
      await menuApi.reorderCategories(tenantId, reordered.map((c) => c.id));
      onMutate?.();
    } catch {
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories'] });
      toast.error('Failed to reorder categories');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setAddError('');
    createCategory.mutate(
      { tenantId, name: newCatName.trim(), branchId },
      {
        onSuccess: (cat: any) => {
          setIsAdding(false);
          setNewCatName('');
          onSelect(cat.id);
          onMutate?.();
        },
        onError: (err: any) => setAddError(err.message || 'Failed to add category'),
      },
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editingName.trim()) return;
    updateCategory.mutate(
      { id: editingId, data: { name: editingName.trim() } },
      { onSuccess: () => { setEditingId(null); onMutate?.(); } },
    );
  };

  const handleDescSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDescId) return;
    updateCategory.mutate(
      { id: editingDescId, data: { description: editingDesc.trim() } },
      { onSuccess: () => { setEditingDescId(null); setEditingDesc(''); onMutate?.(); } },
    );
  };

  const handleDelete = (cat: Category) => {
    const count = catCount(cat);
    const msg = count > 0
      ? `Delete "${cat.name}" and all ${count} item(s) from every branch? This cannot be undone.`
      : `Delete the "${cat.name}" category from every branch?`;
    if (!window.confirm(msg)) return;
    deleteCategory.mutate(cat.id, {
      onSuccess: () => {
        if (selectedCategoryId === cat.id) onSelect(undefined);
        onMutate?.();
      },
    });
  };

  const handleHide = (cat: Category) => {
    if (!branchId) {
      toast.error('Select a specific branch to hide categories');
      return;
    }
    toggleCategoryAvailability.mutate(
      { categoryId: cat.id, data: { isAvailable: false, branchId } },
      {
        onSuccess: () => {
          if (selectedCategoryId === cat.id) onSelect(undefined);
          onMutate?.();
        },
      },
    );
  };

  return (
    <div className="w-60 shrink-0 bg-white border-r border-slate-200 h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Categories</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {/* All items */}
        <div
          className={`flex items-center gap-1.5 pl-2 pr-2 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${
            !selectedCategoryId ? 'bg-orange-50 text-[#ff5722] font-medium' : 'text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => onSelect(undefined)}
        >
          <div className="w-[13px] shrink-0" />
          <span className="text-sm truncate select-none flex-1">All items</span>
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${totalItems > 0 ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
            {totalItems}
          </span>
        </div>

        {isLoading ? (
          <div className="mt-2 px-3 flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {categories.map((cat) => {
                if (editingId === cat.id) {
                  return (
                    <form
                      key={cat.id}
                      onSubmit={handleEditSubmit}
                      className="flex items-center gap-1 px-3 py-1.5 mx-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        className="flex-1 text-sm px-2 py-1.5 border border-[#ff5722] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        disabled={updateCategory.isPending}
                      />
                      <button type="submit" disabled={!editingName.trim() || updateCategory.isPending} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check size={14} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-50 rounded">
                        <X size={14} />
                      </button>
                    </form>
                  );
                }
                if (editingDescId === cat.id) {
                  return (
                    <form
                      key={cat.id}
                      onSubmit={handleDescSubmit}
                      className="px-3 py-2 mx-2 space-y-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        autoFocus
                        rows={2}
                        placeholder="Short description shown on the menu…"
                        className="w-full text-sm px-2 py-1.5 border border-[#ff5722] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
                        value={editingDesc}
                        onChange={(e) => setEditingDesc(e.target.value)}
                        disabled={updateCategory.isPending}
                      />
                      <div className="flex gap-1.5">
                        <button type="submit" disabled={updateCategory.isPending} className="flex-1 py-1.5 bg-[#ff5722] text-white text-xs font-semibold rounded-md hover:bg-orange-600 disabled:opacity-50">
                          Save
                        </button>
                        <button type="button" onClick={() => { setEditingDescId(null); setEditingDesc(''); }} className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md hover:bg-slate-200">
                          Cancel
                        </button>
                      </div>
                    </form>
                  );
                }
                return (
                  <SortableCategoryItem
                    key={cat.id}
                    category={cat}
                    isActive={selectedCategoryId === cat.id}
                    onClick={() => onSelect(cat.id)}
                    isAdmin={isAdmin}
                    onEdit={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                    onEditDescription={() => { setEditingDescId(cat.id); setEditingDesc(cat.description || ''); }}
                    onHide={() => handleHide(cat)}
                    onDelete={() => handleDelete(cat)}
                    isReadOnly={isReadOnly}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {isAdmin && !isReadOnly && (
        <div className="p-3 border-t border-slate-100">
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-slate-500 hover:text-[#ff5722] hover:bg-orange-50 rounded-lg transition-colors"
            >
              <Plus size={15} />
              Add category
            </button>
          ) : (
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-2">
              <input
                autoFocus
                className="w-full text-sm px-2.5 py-2 border border-[#ff5722] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100"
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                disabled={createCategory.isPending}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newCatName.trim() || createCategory.isPending}
                  className="flex-1 py-1.5 bg-[#ff5722] text-white text-xs font-semibold rounded-md hover:bg-orange-600 disabled:opacity-50"
                >
                  {createCategory.isPending ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setNewCatName(''); setAddError(''); }}
                  className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
              {addError && <span className="text-xs text-red-500">{addError}</span>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
