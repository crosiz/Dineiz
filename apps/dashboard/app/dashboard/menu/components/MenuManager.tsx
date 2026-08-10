'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@swiftserve/ui/src/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@swiftserve/ui/src/components/card';
import { Plus, Edit, Trash2, Image as ImageIcon, ChevronDown, ChevronRight, UtensilsCrossed } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { toast } from 'sonner';
import CategorySlideOver from './CategorySlideOver';
import ItemSlideOver from './ItemSlideOver';

type Item = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable: boolean;
  variations?: any[];
  addOns?: any[];
  categoryId: string;
};
type Category = { id: string; name: string; description: string; sortOrder: number; isAvailable: boolean; items: Item[] };

export default function MenuManager() {
  const { role } = useUser();
  const isBranchManager = role === 'BRANCH_MANAGER';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Category slide-over state
  const [catPanelOpen, setCatPanelOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Item slide-over state
  const [itemPanelOpen, setItemPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newItemCategoryId, setNewItemCategoryId] = useState<string>('');

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/menu', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch menu');
      const data = await res.json();
      const cats = Array.isArray(data) ? data : [];
      setCategories(cats);
      // Auto-expand all categories
      setExpandedCats(new Set(cats.map((c: Category) => c.id)));
    } catch {
      toast.error('Failed to load menu');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const toggleExpand = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openAddCategory = () => { if (!isBranchManager) { setEditingCategory(null); setCatPanelOpen(true); } };
  const openEditCategory = (cat: Category) => { if (!isBranchManager) { setEditingCategory(cat); setCatPanelOpen(true); } };
  const openAddItem = (categoryId: string) => { if (!isBranchManager) { setEditingItem(null); setNewItemCategoryId(categoryId); setItemPanelOpen(true); } };
  const openEditItem = (item: Item) => { if (!isBranchManager) { setEditingItem(item); setNewItemCategoryId(item.categoryId); setItemPanelOpen(true); } };

  const deleteItem = async (itemId: string) => {
    if (isBranchManager) return;
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`http://localhost:8080/api/menu/items/${itemId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      toast.success('Item deleted');
      fetchMenu();
    } catch { toast.error('Failed to delete item'); }
  };

  const deleteCategory = async (catId: string) => {
    if (isBranchManager) return;
    if (!confirm('Delete this category and all its items?')) return;
    try {
      const res = await fetch(`http://localhost:8080/api/menu/categories/${catId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      toast.success('Category deleted');
      fetchMenu();
    } catch { toast.error('Failed to delete category'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Menu</h2>
        {!isBranchManager && (
          <Button size="sm" onClick={openAddCategory}>
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </Button>
        )}
      </div>

      {/* Empty state */}
      {categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-neutral-500">
            <div className="flex justify-center text-neutral-300 mb-3"><UtensilsCrossed className="w-12 h-12" /></div>
            <p className="font-medium mb-1">No categories yet</p>
            <p className="text-sm">Click &ldquo;Add Category&rdquo; to start building your menu, or use the Bulk Upload tab.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <Card key={cat.id}>
              {/* Category Header */}
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => toggleExpand(cat.id)}
                    className="flex items-center space-x-2 text-left"
                  >
                    {expandedCats.has(cat.id)
                      ? <ChevronDown className="w-4 h-4 text-neutral-400" />
                      : <ChevronRight className="w-4 h-4 text-neutral-400" />
                    }
                    <CardTitle className="text-base">{cat.name}</CardTitle>
                    <span className="ml-2 text-xs text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                      {cat.items.length} items
                    </span>
                    {!cat.isAvailable && (
                      <span className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Hidden</span>
                    )}
                  </button>
                  {!isBranchManager && (
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openAddItem(cat.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Item
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditCategory(cat)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteCategory(cat.id)}
                        className="text-red-500 hover:text-red-600 hover:border-red-300">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Items List */}
              {expandedCats.has(cat.id) && (
                <CardContent className="p-0">
                  {cat.items.length === 0 ? (
                    <div className="px-6 py-4 text-sm text-neutral-400 italic">
                      No items — click &ldquo;+ Item&rdquo; to add one.
                    </div>
                  ) : (
                    <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {cat.items.map(item => (
                        <li
                          key={item.id}
                          className="px-6 py-3 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-900/50 group"
                        >
                          <div className="flex items-center space-x-3">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-md object-cover" />
                            ) : (
                              <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-md flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-neutral-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-neutral-500">PKR {item.basePrice.toFixed(0)}</p>
                            </div>
                            {!item.isAvailable && (
                              <span className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Hidden</span>
                            )}
                          </div>
                          {!isBranchManager && (
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="outline" size="sm" onClick={() => openEditItem(item)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => deleteItem(item.id)}
                                className="text-red-500 hover:text-red-600 hover:border-red-300">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Slide-overs */}
      <CategorySlideOver
        isOpen={catPanelOpen}
        onClose={() => setCatPanelOpen(false)}
        onSuccess={fetchMenu}
        categoryToEdit={editingCategory}
      />

      <ItemSlideOver
        isOpen={itemPanelOpen}
        onClose={() => setItemPanelOpen(false)}
        onSuccess={fetchMenu}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
        itemToEdit={editingItem}
        defaultCategoryId={newItemCategoryId}
      />
    </div>
  );
}
