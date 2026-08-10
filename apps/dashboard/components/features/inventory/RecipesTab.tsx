'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { ChefHat, CheckCircle2, AlertCircle, Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export function RecipesTab() {
  const queryClient = useQueryClient();
  const { data: recipesData, isLoading, error } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiFetch('/api/inventory/recipes')
  });
  const { data: ingredientsData } = useQuery({
    queryKey: ['ingredients-all'],
    queryFn: () => apiFetch('/api/inventory/ingredients?limit=1000')
  });

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [editingLines, setEditingLines] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const items = recipesData || [];
  const ingredients = ingredientsData?.ingredients || [];

  const handleSelectItem = (item: any) => {
    setSelectedItem(item);
    if (item.recipe) {
      setEditingLines(item.recipe.lines.map((l: any) => ({ ...l })));
    } else {
      setEditingLines([]);
    }
  };

  const handleAddLine = () => {
    setEditingLines([...editingLines, { ingredientId: '', quantity: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    const newLines = [...editingLines];
    newLines.splice(index, 1);
    setEditingLines(newLines);
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...editingLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setEditingLines(newLines);
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    
    // validate
    if (editingLines.some(l => !l.ingredientId || l.quantity <= 0)) {
      toast.error('Please fill out all ingredient details with valid quantities.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch('/api/inventory/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.itemId,
          lines: editingLines.map(l => ({
            ingredientId: l.ingredientId,
            quantity: Number(l.quantity)
          }))
        })
      });
      toast.success('Recipe saved successfully');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center">Loading recipes...</div>;
  }

  if (error) {
    return <div className="h-64 flex items-center justify-center text-red-500">Failed to load recipes</div>;
  }

  return (
    <div className="flex gap-6 h-[600px]">
      {/* LEFT COLUMN: Item List */}
      <div className="w-1/3 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h3 className="font-semibold text-slate-900">Menu Items</h3>
          <p className="text-xs text-slate-500 mt-1">Select an item to edit its recipe</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.map((item: any) => (
            <button
              key={item.itemId}
              onClick={() => handleSelectItem(item)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between ${
                selectedItem?.itemId === item.itemId
                  ? 'bg-slate-100 text-slate-900'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div>
                <p className={`font-medium ${selectedItem?.itemId === item.itemId ? 'text-slate-900' : 'text-slate-800'}`}>
                  {item.itemName}
                </p>
                <p className="text-xs text-slate-500">{item.categoryName}</p>
              </div>
              <div>
                {item.hasRecipe ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : (
                  <AlertCircle size={18} className="text-slate-300" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: Recipe Editor */}
      <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        {selectedItem ? (
          <>
            <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-white">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <ChefHat size={20} className="text-slate-400" />
                  {selectedItem.itemName} Recipe
                </h2>
                <p className="text-sm text-slate-500 mt-1">Configure ingredients deducted when this item is sold.</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Est. Food Cost</p>
                <p className="text-lg font-semibold text-slate-900">Rs {selectedItem.totalCost?.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {editingLines.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ChefHat size={48} className="mb-4 text-slate-200" />
                  <p>No recipe configured for {selectedItem.itemName}.</p>
                  <button
                    onClick={handleAddLine}
                    className="mt-4 text-sm font-medium text-slate-900 hover:text-slate-700"
                  >
                    + Add First Ingredient
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {editingLines.map((line, idx) => (
                    <div key={idx} className="flex gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Ingredient</label>
                        <select
                          value={line.ingredientId}
                          onChange={(e) => handleLineChange(idx, 'ingredientId', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                        >
                          <option value="">Select ingredient...</option>
                          {ingredients.map((ing: any) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({ing.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32">
                        <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveLine(idx)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove ingredient"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={handleAddLine}
                    className="flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-slate-700 p-2 transition-colors mt-2"
                  >
                    <Plus size={16} />
                    Add Ingredient
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button
                onClick={() => handleSelectItem(selectedItem)} // reset to original
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={isSaving}
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Recipe'}
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center">
            <ChefHat size={64} className="mb-6 text-slate-200" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">Select an Item</h3>
            <p className="max-w-md">Choose a menu item from the left sidebar to view or edit its recipe and ingredient deductions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
