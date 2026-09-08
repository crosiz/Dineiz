import { create } from 'zustand'
import * as PosLogic from '@dineiz/pos-logic'

export interface CartVariation {
  id: string
  name: string
  price: number
}
export interface CartAddOn {
  id: string
  name: string
  price: number
}

export interface CartLine {
  key: string
  itemId: string
  name: string
  basePrice: number
  quantity: number
  variation: CartVariation | null
  addOns: CartAddOn[]
  notes?: string
}

interface CartState {
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  lines: CartLine[]
  discount: PosLogic.Discount | null
  tableId: string | null
  tableLabel: string | null
  setOrderType: (type: CartState['orderType']) => void
  setTable: (table: { id: string; label: string } | null) => void
  addLine: (input: {
    itemId: string
    name: string
    basePrice: number
    variation: CartVariation | null
    addOns: CartAddOn[]
    notes?: string
  }) => void
  incrementLine: (key: string) => void
  decrementLine: (key: string) => void
  removeLine: (key: string) => void
  setDiscount: (discount: PosLogic.Discount | null) => void
  clear: () => void
}

// No persist middleware, deliberately — a fresh order always starts empty.
export const useCartStore = create<CartState>((set) => ({
  orderType: 'DINE_IN',
  lines: [],
  discount: null,
  tableId: null,
  tableLabel: null,

  // Switching away from Dine In (or changing order type generally) drops
  // whatever table was selected — a Takeaway/Delivery order has no table,
  // and re-entering Dine In should prompt fresh rather than silently reuse
  // a stale selection from a previous order type.
  setOrderType: (orderType) => set({ orderType, tableId: null, tableLabel: null }),

  setTable: (table) => set({ tableId: table?.id ?? null, tableLabel: table?.label ?? null }),

  addLine: (input) => {
    const key = PosLogic.cartLineKey(
      input.itemId,
      input.variation?.id,
      input.addOns.map((a) => a.id)
    )
    set((state) => {
      const existingIndex = state.lines.findIndex((l) => l.key === key)
      if (existingIndex >= 0) {
        const lines = [...state.lines]
        lines[existingIndex] = { ...lines[existingIndex], quantity: lines[existingIndex].quantity + 1 }
        return { lines }
      }
      return { lines: [...state.lines, { ...input, key, quantity: 1 }] }
    })
  },

  incrementLine: (key) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
    })),

  decrementLine: (key) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    })),

  removeLine: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),

  setDiscount: (discount) => set({ discount }),

  clear: () => set({ lines: [], discount: null, orderType: 'DINE_IN', tableId: null, tableLabel: null })
}))

export function cartLinesToPosLogic(lines: CartLine[]): PosLogic.CartLineInput[] {
  return lines.map((l) => ({
    itemId: l.itemId,
    name: l.name,
    basePrice: l.basePrice,
    quantity: l.quantity,
    variation: l.variation,
    addOns: l.addOns
  }))
}
