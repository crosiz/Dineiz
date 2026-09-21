"use client";

import { useCallback, useMemo, useState } from "react";

// Structural — matches both the mock MenuItem and the API's ApiMenuItem, so
// the cart doesn't care which data source is feeding it.
export type CartableItem = { id: string; name: string; price: number };
export type CartLine = { item: CartableItem; qty: number };

export const CASH_TAX_RATE = 0.05;
export const CARD_TAX_RATE = 0.17;

// New order screens never receive a persisted cart — state always starts
// empty on mount, which is what keeps orders from bleeding into each other.
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addItem = useCallback((item: CartableItem) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((itemId: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.item.id !== itemId);
      return prev.map((l) => (l.item.id === itemId ? { ...l, qty } : l));
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((l) => l.item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.item.price * l.qty, 0), [lines]);
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);

  return { lines, addItem, removeItem, setQty, clearCart, subtotal, itemCount };
}
