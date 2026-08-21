'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  ChefHat, CheckCircle2, AlertCircle, Plus, Trash2, Save, Copy,
  AlertTriangle, Info, HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/Spinner';
import { CopyRecipeModal } from './modals/CopyRecipeModal';

// ─── Types ──────────────────────────────────────────────────────────────────
interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

interface RecipeLineDetail {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  conversionToBase: number;
  isOptional: boolean;
  wastagePercent: number;
  sortOrder: number;
  cost: number;
}

interface RecipeDetail {
  id: string;
  itemId: string;
  variationId: string | null;
  yieldQty: number;
  prepTimeMinutes: number | null;
  instructions: string | null;
  lines: RecipeLineDetail[];
  hasDeletedIngredients: boolean;
}

interface ItemVariation {
  id: string;
  name: string;
  price: number;
  hasRecipe: boolean;
}

interface RecipeListItem {
  itemId: string;
  itemName: string;
  categoryName: string;
  price: number;
  hasRecipe: boolean;
  hasVariations: boolean;
  variations: ItemVariation[];
  recipe: RecipeDetail | null;
  totalCost: number;
  foodCostPercent: number;
}

interface EditingLine {
  ingredientId: string;
  quantity: number | string;
  unit: string;
  conversionToBase: number;
  isOptional: boolean;
  wastagePercent: number | string;
}

interface RecipeMeta {
  yieldQty: number | string;
  prepTimeMinutes: string;
  instructions: string;
}

const EMPTY_META: RecipeMeta = { yieldQty: 1, prepTimeMinutes: '', instructions: '' };

const unitsMatch = (a: string | undefined | null, b: string | undefined | null) =>
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

function lineCost(line: EditingLine, ingredients: IngredientOption[]): number {
  const ingredient = ingredients.find((i) => i.id === line.ingredientId);
  if (!ingredient) return 0;
  const qty = Number(line.quantity) || 0;
  const needsConversion = !unitsMatch(line.unit, ingredient.unit);
  const conversion = needsConversion ? Number(line.conversionToBase) || 1 : 1;
  const wastage = Number(line.wastagePercent) || 0;
  return qty * conversion * (1 + wastage / 100) * (ingredient.costPerUnit || 0);
}

function foodCostColorClasses(pct: number) {
  if (pct > 40) return 'bg-red-50 border-red-200 text-red-700';
  if (pct >= 30) return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-green-50 border-green-200 text-green-700';
}

const segmentClass = (active: boolean) =>
  `px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1 ${
    active ? 'bg-white text-[#ff5722] shadow-sm' : 'text-slate-500 hover:text-slate-700'
  }`;

export function RecipesTab() {
  const queryClient = useQueryClient();

  const { data: recipesData, isLoading, error } = useQuery({
    queryKey: ['recipes', 'list'],
    queryFn: () => apiFetch<RecipeListItem[]>('/api/inventory/recipes'),
  });
  const { data: ingredientsData } = useQuery({
    queryKey: ['ingredients-all'],
    queryFn: () => apiFetch<{ ingredients: IngredientOption[]; pagination: any }>('/api/inventory/ingredients?limit=1000'),
  });

  const items: RecipeListItem[] = recipesData || [];
  const ingredients: IngredientOption[] = ingredientsData?.ingredients || [];

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null); // null = base recipe
  const [recipeMeta, setRecipeMeta] = useState<RecipeMeta>(EMPTY_META);
  const [editingLines, setEditingLines] = useState<EditingLine[]>([]);
  const [hasDeletedIngredients, setHasDeletedIngredients] = useState(false);
  const [recipeExists, setRecipeExists] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedItem = useMemo(
    () => items.find((i) => i.itemId === selectedItemId) || null,
    [items, selectedItemId]
  );
  const selectedVariation = useMemo(
    () => (selectedVariationId ? selectedItem?.variations.find((v) => v.id === selectedVariationId) || null : null),
    [selectedItem, selectedVariationId]
  );

  // On-demand fetch for a variation's recipe — the list endpoint only carries the base recipe.
  const variationDetailQuery = useQuery({
    queryKey: ['recipes', 'detail', selectedItemId, selectedVariationId],
    queryFn: () =>
      apiFetch<RecipeDetail | null>(
        `/api/inventory/recipes/${selectedItemId}?variationId=${selectedVariationId}`
      ),
    enabled: !!selectedItemId && !!selectedVariationId,
  });

  const activeRecipe: RecipeDetail | null | undefined = selectedVariationId === null
    ? (selectedItem?.recipe ?? null)
    : variationDetailQuery.data;

  const loadRecipeIntoState = (recipe: RecipeDetail | null | undefined) => {
    if (recipe) {
      setRecipeMeta({
        yieldQty: recipe.yieldQty ?? 1,
        prepTimeMinutes: recipe.prepTimeMinutes != null ? String(recipe.prepTimeMinutes) : '',
        instructions: recipe.instructions ?? '',
      });
      setEditingLines(
        recipe.lines.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: l.quantity,
          unit: l.unit,
          conversionToBase: l.conversionToBase,
          isOptional: l.isOptional,
          wastagePercent: l.wastagePercent,
        }))
      );
      setHasDeletedIngredients(!!recipe.hasDeletedIngredients);
      setRecipeExists(true);
    } else {
      setRecipeMeta(EMPTY_META);
      setEditingLines([]);
      setHasDeletedIngredients(false);
      setRecipeExists(false);
    }
  };

  // Sync local editing state whenever the selected item/variation (or its underlying data) changes.
  useEffect(() => {
    if (!selectedItemId) return;
    if (selectedVariationId === null) {
      loadRecipeIntoState(selectedItem?.recipe ?? null);
    } else if (variationDetailQuery.data !== undefined) {
      loadRecipeIntoState(variationDetailQuery.data ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, selectedVariationId, selectedItem?.recipe, variationDetailQuery.data]);

  const handleSelectItem = (item: RecipeListItem) => {
    setSelectedItemId(item.itemId);
    setSelectedVariationId(null);
    setShowDeleteConfirm(false);
  };

  const handleSelectVariation = (variationId: string | null) => {
    setSelectedVariationId(variationId);
    setShowDeleteConfirm(false);
  };

  const handleAddLine = () => {
    setEditingLines((lines) => [
      ...lines,
      { ingredientId: '', quantity: '', unit: '', conversionToBase: 1, isOptional: false, wastagePercent: 0 },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setEditingLines((lines) => lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof EditingLine, value: any) => {
    setEditingLines((lines) =>
      lines.map((l, i) => {
        if (i !== index) return l;
        const updated: EditingLine = { ...l, [field]: value } as EditingLine;
        if (field === 'ingredientId') {
          const ing = ingredients.find((x) => x.id === value);
          if (ing && !l.unit.trim()) {
            updated.unit = ing.unit;
            updated.conversionToBase = 1;
          } else if (ing && unitsMatch(l.unit, ing.unit)) {
            updated.conversionToBase = 1;
          }
        }
        if (field === 'unit') {
          const ing = ingredients.find((x) => x.id === updated.ingredientId);
          if (ing && unitsMatch(value, ing.unit)) {
            updated.conversionToBase = 1;
          }
        }
        return updated;
      })
    );
  };

  const invalidateRecipeQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['recipes'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch('/api/inventory/recipes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast.success('Recipe saved successfully');
      invalidateRecipeQueries();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save recipe'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const q = selectedVariationId ? `?variationId=${selectedVariationId}` : '';
      return apiFetch(`/api/inventory/recipes/${selectedItemId}${q}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Recipe deleted');
      setShowDeleteConfirm(false);
      invalidateRecipeQueries();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete recipe'),
  });

  const copyFromBaseMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/inventory/recipes/copy', {
        method: 'POST',
        body: JSON.stringify({
          sourceItemId: selectedItemId,
          sourceVariationId: null,
          targetItemId: selectedItemId,
          targetVariationId: selectedVariationId,
        }),
      }),
    onSuccess: () => {
      toast.success('Copied base recipe to this variation');
      invalidateRecipeQueries();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to copy recipe'),
  });

  const handleSave = () => {
    if (!selectedItemId) return;
    if (editingLines.length === 0) {
      toast.error('Add at least one ingredient line.');
      return;
    }
    if (editingLines.some((l) => !l.ingredientId || !(Number(l.quantity) > 0))) {
      toast.error('Please fill out all ingredient details with valid quantities.');
      return;
    }

    const yieldQtyValue = Number(recipeMeta.yieldQty);
    const prepTimeValue = Math.round(Number(recipeMeta.prepTimeMinutes));

    saveMutation.mutate({
      itemId: selectedItemId,
      variationId: selectedVariationId,
      yieldQty: yieldQtyValue > 0 ? yieldQtyValue : 1,
      prepTimeMinutes: prepTimeValue > 0 ? prepTimeValue : undefined,
      instructions: recipeMeta.instructions || undefined,
      lines: editingLines.map((l, idx) => {
        const ing = ingredients.find((x) => x.id === l.ingredientId);
        const needsConversion = ing ? !unitsMatch(l.unit, ing.unit) : true;
        const wastage = Math.min(100, Math.max(0, Number(l.wastagePercent) || 0));
        return {
          ingredientId: l.ingredientId,
          quantity: Number(l.quantity),
          unit: l.unit || undefined,
          conversionToBase: needsConversion ? Number(l.conversionToBase) || 1 : 1,
          isOptional: !!l.isOptional,
          wastagePercent: wastage,
          sortOrder: idx,
        };
      }),
    });
  };

  const handleReset = () => {
    loadRecipeIntoState(activeRecipe);
  };

  const isSaving = saveMutation.isPending;

  // ── Live cost / margin calculations ─────────────────────────────────────────
  const totalCost = editingLines.reduce((sum, l) => sum + lineCost(l, ingredients), 0);
  const yieldQty = Number(recipeMeta.yieldQty) || 1;
  const costPerPortion = yieldQty > 0 ? totalCost / yieldQty : totalCost;
  const menuPrice = selectedVariationId ? (selectedVariation?.price ?? selectedItem?.price ?? 0) : (selectedItem?.price ?? 0);
  const grossMargin = menuPrice - costPerPortion;
  const foodCostPercent = menuPrice > 0 ? (costPerPortion / menuPrice) * 100 : 0;

  const totalItems = items.length;
  const itemsWithRecipe = items.filter((i) => i.hasRecipe).length;
  const highFoodCostCount = items.filter((i) => i.hasRecipe && i.foodCostPercent > 40).length;

  const isVariationLoading = selectedVariationId !== null && variationDetailQuery.isLoading;

  const currentLabel = selectedItem
    ? `${selectedItem.itemName}${selectedVariation ? ` — ${selectedVariation.name}` : ''}`
    : '';

  if (isLoading) {
    return <PageLoader label="Loading recipes..." className="min-h-[240px]" />;
  }

  if (error) {
    return <div className="h-64 flex items-center justify-center text-red-500">Failed to load recipes</div>;
  }

  return (
    <div className="flex gap-6 h-[720px]">
      {/* LEFT COLUMN: Item List */}
      <div className="w-1/3 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h3 className="font-semibold text-slate-900">Menu Items</h3>
          <p className="text-xs text-slate-500 mt-1">
            {itemsWithRecipe} of {totalItems} items have recipes
          </p>
          {highFoodCostCount > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-1.5 flex items-center gap-1">
              <AlertTriangle size={12} />
              {highFoodCostCount} item{highFoodCostCount === 1 ? '' : 's'} exceed 40% food cost
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.map((item) => (
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
                <p className="text-xs text-slate-500">
                  {item.categoryName}
                  {item.hasVariations && ` · ${item.variations.length} variation${item.variations.length === 1 ? '' : 's'}`}
                </p>
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
            <div className="p-6 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                    <ChefHat size={20} className="text-slate-400" />
                    {selectedItem.itemName} Recipe
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Configure ingredients deducted when this item is sold.</p>
                </div>
              </div>

              {selectedItem.hasVariations && (
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit max-w-full overflow-x-auto mt-4">
                  <button onClick={() => handleSelectVariation(null)} className={segmentClass(selectedVariationId === null)}>
                    Base Recipe
                    {selectedItem.hasRecipe && <CheckCircle2 size={12} className="text-green-500" />}
                  </button>
                  {selectedItem.variations.map((v) => (
                    <button key={v.id} onClick={() => handleSelectVariation(v.id)} className={segmentClass(selectedVariationId === v.id)}>
                      {v.name}
                      {v.hasRecipe && <CheckCircle2 size={12} className="text-green-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isVariationLoading ? (
              <PageLoader label="Loading variation recipe..." className="min-h-[200px]" />
            ) : (
              <div className="flex-1 flex overflow-hidden">
                {/* Form area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {hasDeletedIngredients && (
                    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      Some ingredients in this recipe no longer exist and are skipped automatically during deductions.
                    </div>
                  )}

                  {/* Recipe meta */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                          This recipe makes
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={recipeMeta.yieldQty}
                            onChange={(e) => setRecipeMeta((m) => ({ ...m, yieldQty: e.target.value }))}
                            className="w-20 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                          />
                          <span className="text-sm text-slate-600">portion(s)</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                          Prep time (minutes, optional)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={recipeMeta.prepTimeMinutes}
                          onChange={(e) => setRecipeMeta((m) => ({ ...m, prepTimeMinutes: e.target.value }))}
                          placeholder="e.g. 15"
                          className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                        Instructions (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={recipeMeta.instructions}
                        onChange={(e) => setRecipeMeta((m) => ({ ...m, instructions: e.target.value }))}
                        placeholder="Prep notes for kitchen staff..."
                        className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {editingLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 py-12">
                      <ChefHat size={48} className="mb-4 text-slate-200" />
                      <p>No recipe configured for {currentLabel}.</p>
                      <div className="flex items-center gap-3 mt-4">
                        {selectedVariationId && selectedItem.recipe && (
                          <button
                            onClick={() => copyFromBaseMutation.mutate()}
                            disabled={copyFromBaseMutation.isPending}
                            className="text-sm font-medium text-[#ff5722] hover:text-orange-600 border border-orange-200 bg-orange-50 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                          >
                            {copyFromBaseMutation.isPending ? 'Copying...' : 'Copy from Base Recipe'}
                          </button>
                        )}
                        <button
                          onClick={handleAddLine}
                          className="text-sm font-medium text-slate-900 hover:text-slate-700"
                        >
                          + Add First Ingredient
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {editingLines.map((line, idx) => {
                        const ing = ingredients.find((x) => x.id === line.ingredientId);
                        const needsConversion = !!ing && !unitsMatch(line.unit, ing.unit);
                        const thisLineCost = lineCost(line, ingredients);
                        return (
                          <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                            <div className="flex gap-4 items-end">
                              <div className="flex-1">
                                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                  Ingredient
                                </label>
                                <select
                                  value={line.ingredientId}
                                  onChange={(e) => handleLineChange(idx, 'ingredientId', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                                >
                                  <option value="">Select ingredient...</option>
                                  {ingredients.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.name} ({option.unit})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-28">
                                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.quantity}
                                  onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                                />
                              </div>
                              <div className="w-28">
                                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                  Unit
                                </label>
                                <input
                                  type="text"
                                  value={line.unit}
                                  onChange={(e) => handleLineChange(idx, 'unit', e.target.value)}
                                  placeholder={ing?.unit || 'GRAM'}
                                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                                />
                              </div>
                              {needsConversion && (
                                <div className="w-32">
                                  <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                    = how many {ing?.unit}?
                                  </label>
                                  <input
                                    type="number"
                                    min="0.0001"
                                    step="any"
                                    value={line.conversionToBase}
                                    onChange={(e) => handleLineChange(idx, 'conversionToBase', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                                  />
                                </div>
                              )}
                              <button
                                onClick={() => handleRemoveLine(idx)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0"
                                title="Remove ingredient"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>

                            <div className="flex items-center gap-6 pt-1 border-t border-slate-200/70">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                  Wastage %
                                  <span title="Inflates the amount deducted from stock to account for trim, spillage, or prep loss. e.g. 10% wastage on 100g deducts 110g.">
                                    <HelpCircle size={12} className="text-slate-400" />
                                  </span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={line.wastagePercent}
                                  onChange={(e) => handleLineChange(idx, 'wastagePercent', e.target.value)}
                                  className="w-20 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-slate-400 transition-colors"
                                />
                              </div>

                              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.isOptional}
                                  onChange={(e) => handleLineChange(idx, 'isOptional', e.target.checked)}
                                  className="rounded border-slate-300 text-[#ff5722] focus:ring-[#ff5722]/30"
                                />
                                Optional (garnish — won't block the item if missing)
                              </label>

                              <span className="ml-auto text-xs font-medium text-slate-500">
                                Line cost: <span className="text-slate-800">Rs {thisLineCost.toFixed(2)}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      <button
                        onClick={handleAddLine}
                        className="flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-slate-700 p-2 transition-colors"
                      >
                        <Plus size={16} />
                        Add Ingredient
                      </button>
                    </div>
                  )}
                </div>

                {/* Cost / margin panel */}
                <div className="w-72 shrink-0 border-l border-slate-200 bg-slate-50 p-5 overflow-y-auto">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Cost &amp; Margin</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500">Total ingredient cost</span>
                      <span className="font-semibold text-slate-900">Rs {totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500">Cost / portion (÷{yieldQty || 1})</span>
                      <span className="font-semibold text-slate-900">Rs {costPerPortion.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500">Menu price</span>
                      <span className="font-semibold text-slate-900">Rs {menuPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                      <span className="text-slate-500">Gross margin</span>
                      <span className={`font-semibold ${grossMargin < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        Rs {grossMargin.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className={`mt-5 rounded-lg p-3 border ${foodCostColorClasses(foodCostPercent)}`}>
                    <p className="text-[11px] font-bold uppercase tracking-wider">Food Cost %</p>
                    <p className="text-2xl font-bold mt-1">{menuPrice > 0 ? foodCostPercent.toFixed(1) : '—'}%</p>
                    {foodCostPercent > 40 && menuPrice > 0 && (
                      <p className="text-xs mt-2 flex items-start gap-1.5">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        Food cost is high. Consider adjusting the recipe or price.
                      </p>
                    )}
                    {menuPrice <= 0 && (
                      <p className="text-xs mt-2 flex items-start gap-1.5">
                        <Info size={13} className="shrink-0 mt-0.5" />
                        This item has no menu price set.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 bg-white shrink-0">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  {recipeExists && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleteMutation.isPending}
                      className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      Delete Recipe
                    </button>
                  )}
                  <button
                    onClick={() => setIsCopyModalOpen(true)}
                    disabled={!recipeExists}
                    title={!recipeExists ? 'Save this recipe first' : undefined}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                  >
                    <Copy size={14} />
                    Copy to another item
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReset}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
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
              </div>
              <p className="px-4 pb-3 text-[11px] text-slate-400">
                Saving this recipe only affects future orders; past orders keep their original ingredient deductions.
              </p>
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

      {selectedItem && (
        <CopyRecipeModal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          items={items}
          sourceItemId={selectedItem.itemId}
          sourceVariationId={selectedVariationId}
          sourceLabel={currentLabel}
        />
      )}

      {showDeleteConfirm && selectedItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete this recipe?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This removes the recipe for <span className="font-medium text-slate-800">{currentLabel}</span>. The item
              will stop deducting ingredients on sale until a new recipe is added.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
