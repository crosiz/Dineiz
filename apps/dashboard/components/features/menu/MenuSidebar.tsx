'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, MoreHorizontal, Pencil, Trash2, Check, X, EyeOff } from 'lucide-react';
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
  itemCount?: number;
  _count?: { items: number };
}

function SortableCategoryItem({
  category,
  isActive,
  onClick,
  isAdmin,
  onEdit,
  onDelete,
  isReadOnly,
}: {
  category: Category;
  isActive: boolean;
  onClick: () => void;
  isAdmin: boolean;
  onEdit: () => void;
  onHide: () => void;
  onDelete: () => void;
  isReadOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !isAdmin || isReadOnly,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const count = category.itemCount ?? category._count?.items ?? 0;

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
      className={`group flex items-center gap-1.5 px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${isActive
        ? 'bg-orange-50 text-[#ff5722] font-semibold border-l-[3px] border-[#ff5722] rounded-l-none -ml-px'
        : 'text-slate-600 hover:bg-slate-50'
        }`}
      onClick={onClick}
    >
      {isAdmin && !isReadOnly && (
        <button
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </button>
      )}
      {(!isAdmin || isReadOnly) && <div className="w-4 shrink-0" />}

      <span className="text-xs truncate select-none flex-1">{category.name}</span>

      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${count > 0 ? 'bg-orange-100 text-[#ff5722]' : 'bg-slate-100 text-slate-400'
          }`}
      >
        {count}
      </span>

      {isAdmin && !isReadOnly && (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <MoreHorizontal size={13} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-5 z-20 bg-white rounded-lg shadow-lg border border-slate-100 py-1 w-36 text-xs">
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit();
                  }}
                >
                  <Pencil size={12} /> Edit name
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-orange-600 hover:bg-orange-50 border-t border-slate-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onHide();
                  }}
                >
                  <EyeOff size={12} /> Hide from branch
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-red-600 hover:bg-red-50 border-t border-slate-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to permanently delete this category from ALL branches? This cannot be undone.')) {
                      setMenuOpen(false);
                      onDelete();
                    }
                  }}
                >
                  <Trash2 size={12} /> Delete everywhere
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
  width?: number;
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
  width = 208,
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      queryClient.invalidateQueries({ queryKey: ['menu', 'categories', tenantId] });
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
          toast.success('Category added');
          onMutate?.();
        },
        onError: (err: any) => {
          setAddError(err.message || 'Failed to add category');
        }
      }
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editingName.trim()) return;
    updateCategory.mutate(
      { id: editingId, data: { name: editingName.trim() } },
      {
        onSuccess: () => {
          setEditingId(null);
          onMutate?.();
        },
      }
    );
  };

  const handleDelete = (cat: Category) => {
    const count = cat.itemCount ?? cat._count?.items ?? 0;
    const msg = count > 0
      ? `Delete "${cat.name}" and all ${count} item(s)?`
      : `Delete category "${cat.name}"?`;
    if (!window.confirm(msg)) return;
    deleteCategory.mutate(cat.id, {
      onSuccess: () => {
        if (selectedCategoryId === cat.id) onSelect(undefined);
        onMutate?.();
      },
    });
  };

  const handleHide = (cat: Category) => {
    if (!branchId) return;
    toggleCategoryAvailability.mutate(
      { categoryId: cat.id, data: { isAvailable: false, branchId } },
      {
        onSuccess: () => {
          if (selectedCategoryId === cat.id) onSelect(undefined);
          onMutate?.();
        },
      }
    );
  };

  return (
    <div className="shrink-0 bg-white border-r border-slate-100 h-full flex flex-col overflow-hidden" style={{ width }}>
      <div className="px-3 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Your Menu
        </span>
      </div>



      {/* Category List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {/* All Items */}
        <div
          className={`flex items-center gap-1.5 px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors mb-0.5 ${!selectedCategoryId
            ? 'bg-orange-50 text-[#ff5722] font-semibold border-l-[3px] border-[#ff5722] rounded-l-none -ml-px'
            : 'text-slate-600 hover:bg-slate-50'
            }`}
          onClick={() => onSelect(undefined)}
        >
          <div className="w-4 shrink-0" />
          <span className="text-xs truncate select-none flex-1">All Items</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${categories.reduce((sum, c) => sum + (c.itemCount ?? c._count?.items ?? 0), 0) > 0
              ? 'bg-orange-100 text-[#ff5722]'
              : 'bg-slate-100 text-slate-400'
              }`}
          >
            {categories.reduce((sum, c) => sum + (c.itemCount ?? c._count?.items ?? 0), 0)}
          </span>
        </div>

        {isLoading ? (
          <div className="mt-2 px-3 flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {categories.map((cat) =>
                editingId === cat.id ? (
                  <form
                    key={cat.id}
                    onSubmit={handleEditSubmit}
                    className="flex items-center gap-1 px-3 py-1.5 mx-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      className="flex-1 text-xs px-2 py-1.5 border border-[#ff5722] rounded-lg focus:outline-none"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      disabled={updateCategory.isPending}
                    />
                    <button
                      type="submit"
                      disabled={!editingName.trim() || updateCategory.isPending}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-slate-400 hover:bg-slate-50 rounded"
                    >
                      <X size={13} />
                    </button>
                  </form>
                ) : (
                  <SortableCategoryItem
                    key={cat.id}
                    category={cat}
                    isActive={selectedCategoryId === cat.id}
                    onClick={() => onSelect(cat.id)}
                    isAdmin={isAdmin}
                    onEdit={() => {
                      setEditingId(cat.id);
                      setEditingName(cat.name);
                    }}
                    onHide={() => handleHide(cat)}
                    onDelete={() => handleDelete(cat)}
                    isReadOnly={isReadOnly}
                  />
                )
              )}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {isAdmin && !isReadOnly && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center justify-center gap-2 w-full py-2 text-xs font-semibold text-slate-500 hover:text-[#ff5722] hover:bg-[#ff5722]/10 border border-transparent hover:border-[#ff5722]/20 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Add Category
            </button>
          ) : (
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-2">
              <input
                autoFocus
                className="w-full text-xs px-2 py-1.5 border border-[#ff5722] rounded-lg focus:outline-none"
                placeholder="Category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                disabled={createCategory.isPending}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newCatName.trim() || createCategory.isPending}
                  className="flex-1 py-1.5 bg-[#ff5722] text-white text-[10px] font-bold rounded-md hover:bg-orange-600 disabled:opacity-50"
                >
                  {createCategory.isPending ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewCatName('');
                    setAddError('');
                  }}
                  className="flex-1 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
              {addError && <span className="text-[10px] text-red-500 font-medium block">{addError}</span>}
            </form>
          )}
        </div>
      )}

    </div>
  );
}
