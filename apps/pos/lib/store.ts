import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from './db';
import { TAX_RATE as DEFAULT_TAX_RATE } from './constants';
import { getPosSession } from './pos-session';
import { API_URL } from '@/lib/api';
import { computeTotals, resolveTaxConfig, type Totals } from './pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  itemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  unitPrice: number; // base + selected variation price offset
  subtotal: number;
  image?: string;
  notes?: string;
  selectedVariation?: {
    id: string;
    name: string;
    price: number;
  };
  selectedAddOns: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export interface POSSession {
  branchId: string | null;
  tenantId: string | null;
  cashierId: string | null;
  cashierName: string | null;
  shiftId: string | null; // Active open shift ID
  role: string | null; // e.g. 'CASHIER', 'BRANCH_MANAGER', 'TENANT_ADMIN'
  branchName: string | null;
  restaurantName: string | null;
  taxRate: number;        // @deprecated — use cashTaxRate/cardTaxRate
  cashTaxEnabled: boolean;
  cashTaxRate: number;    // GST rate for cash payments as decimal (e.g. 0.05)
  cardTaxEnabled: boolean;
  cardTaxRate: number;    // GST rate for card/digital payments as decimal (e.g. 0.17)
  cashTaxLabel: string;   // e.g. "GST (Cash)"
  cardTaxLabel: string;   // e.g. "GST (Card/Digital)"
  cashTaxNote: string | null;
  cardTaxNote: string | null;
  showDualTaxOnReceipt: boolean;
  taxRoundingMethod: 'ROUND' | 'FLOOR' | 'CEIL';
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  currency: string;       // 'PKR', 'USD', etc.
  token: string | null;   // JWT token for API calls
}

export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
  label?: string; // e.g., 'Promo: FLAT50'
}

export interface AutoDealsState {
  promoCode: string | null;
  lastValidatedAt: number | null;
  isValidating: boolean;
  applied: Array<{ type: string; id?: string; code?: string; amount: number; meta?: any }>;
  eligible: Array<any>;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface CartStore {
  // Session
  session: POSSession;
  setSession: (session: Partial<POSSession>) => void;
  clearSession: () => void;
  // Cart Identity
  cartSessionId: string;
  sourceOrderId: string | null;
  setSourceOrderId: (id: string | null) => void;

  // Cart
  cart: CartItem[];
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | null;
  orderNotes: string;
  discount: Discount | null;
  autoDeals: AutoDealsState;
  selectedTableId: string | null;
  selectedTableLabel: string | null;
  paymentOrderId: string | null;
  customerId: string | null;
  customerName: string | null;
  // Waiter chosen BEFORE the order exists. A dine-in order is usually taken by
  // one person and rung up by another, so the cashier needs to say whose table
  // it is while punching — commands.assignWaiter can only run once there is an
  // order to attach it to, so the choice is parked here and applied at creation.
  waiterId: string | null;
  waiterName: string | null;
  waiterColor: string | null;
  setCustomerId: (id: string | null) => void;
  setCustomer: (customer: { id: string; name: string } | null) => void;
  setWaiter: (waiter: { id: string; name: string; color?: string | null } | null) => void;
  isEditing: boolean;
  existingOrderData: any | null;
  setExistingOrderData: (data: any | null) => void;
  existingItems: any[];
  setExistingItems: (items: any[]) => void;

  addItem: (item: Omit<CartItem, 'quantity' | 'subtotal'>) => void;
  removeItem: (itemId: string, variationId?: string) => void;
  incrementItem: (itemId: string, variationId?: string) => void;
  decrementItem: (itemId: string, variationId?: string) => void;
  setQuantity: (itemId: string, quantity: number, variationId?: string) => void;
  updateItemNotes: (itemId: string, notes: string, variationId?: string) => void;
  clearCart: () => void;
  setOrderType: (type: CartStore['orderType']) => void;
  setOrderContext: (context: { tableId?: string | null, tableLabel?: string | null, orderId?: string | null, isEditing?: boolean }) => void;
  setOrderNotes: (notes: string) => void;
  setDiscount: (discount: Discount | null) => void;
  setPromoCode: (code: string | null) => void;
  clearAutoDeals: () => void;
  fetchEligibleDeals: () => Promise<void>;
  applyDeal: (deal: any) => void;
  validatePromoCode: () => Promise<void>;

  // Computed totals
  subtotal: () => number;
  discountAmount: () => number;
  taxAmount: (paymentMethod?: string) => number;
  serviceChargeAmount: (paymentMethod?: string) => number;
  /** Full breakdown for the live cart — the source every figure above reads. */
  totalsFor: (paymentMethod?: string) => Totals;
  cashTaxAmount: () => number;
  cardTaxAmount: () => number;
  cashTotal: () => number;
  cardTotal: () => number;
  total: (paymentMethod?: string) => number;
  totalItems: () => number;

  // Combined totals (existing + new)
  combinedSubtotal: () => number;
  combinedTotalsFor: (paymentMethod?: string) => Totals;
  combinedServiceCharge: (paymentMethod?: string) => number;
  combinedTaxAmount: (paymentMethod?: string) => number;
  combinedTotal: (paymentMethod?: string) => number;
  combinedDiscountAmount: () => number;
  combinedItems: () => any[];
  combinedTotalItems: () => number;

  // Active payment method (drives live total recalc in checkout)
  activePaymentMethod: string | null;
  setActivePaymentMethod: (method: string) => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────


/** Generates a unique cart key per item+variation combo */
const cartKey = (itemId: string, variationId?: string) =>
  `${itemId}-${variationId ?? 'base'}`;

// ─── Zustand Store ────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  devtools(
    (set, get) => ({
        // Session
        session: {
          branchId: getPosSession()?.branchId || null,
          tenantId: getPosSession()?.tenantId || null,
          cashierId: getPosSession()?.userId || null,
          cashierName: getPosSession()?.name || null,
          shiftId: null,
          role: (getPosSession()?.role as any) || null,
          branchName: getPosSession()?.branchName || null,
          restaurantName: null,
          taxRate: DEFAULT_TAX_RATE,     // legacy compat
          cashTaxEnabled: true,
          cashTaxRate: 0.05,             // 5% default
          cardTaxEnabled: true,
          cardTaxRate: 0.17,             // 17% default
          cashTaxLabel: 'GST (Cash)',
          cardTaxLabel: 'GST (Card/Digital)',
          cashTaxNote: null,
          cardTaxNote: null,
          showDualTaxOnReceipt: true,
          taxRoundingMethod: 'ROUND' as const,
          serviceChargeEnabled: false,
          serviceChargeRate: 10,
          currency: 'PKR',
          token: getPosSession()?.token || null,
        },
        setSession: (partial) =>
          set((s) => ({ session: { ...s.session, ...partial } }), false, 'setSession'),
        clearSession: () =>
          set(
            {
              session: {
                branchId: null,
                tenantId: null,
                cashierId: null,
                cashierName: null,
                shiftId: null,
                role: null,
                branchName: null,
                restaurantName: null,
                taxRate: DEFAULT_TAX_RATE,
                cashTaxEnabled: true,
                cashTaxRate: 0.05,
                cardTaxEnabled: true,
                cardTaxRate: 0.17,
                cashTaxLabel: 'GST (Cash)',
                cardTaxLabel: 'GST (Card/Digital)',
                cashTaxNote: null,
                cardTaxNote: null,
                showDualTaxOnReceipt: true,
                taxRoundingMethod: 'ROUND' as const,
                serviceChargeEnabled: false,
                serviceChargeRate: 10,
                currency: 'PKR',
                token: null,
              },
            },
            false,
            'clearSession'
          ),
        // Cart Identity
        cartSessionId: uuidv4(),
        sourceOrderId: null,
        setSourceOrderId: (id) => set({ sourceOrderId: id }, false, 'setSourceOrderId'),

        // Cart
        cart: [],
        orderType: null,
        orderNotes: '',
        discount: null,
        autoDeals: {
          promoCode: null,
          lastValidatedAt: null,
          isValidating: false,
          applied: [],
          eligible: [],
        },
        selectedTableId: null,
        selectedTableLabel: null,
        paymentOrderId: null,
        customerId: null,
        customerName: null,
        waiterId: null,
        waiterName: null,
        waiterColor: null,
        setCustomerId: (id) => set({ customerId: id }),
        setCustomer: (customer) => set({ customerId: customer?.id ?? null, customerName: customer?.name ?? null }, false, 'setCustomer'),
        setWaiter: (waiter) => set({ waiterId: waiter?.id ?? null, waiterName: waiter?.name ?? null, waiterColor: waiter?.color ?? null }, false, 'setWaiter'),
        isEditing: false,
        existingOrderData: null,
        existingItems: [],
        setExistingOrderData: (data) => set({ existingOrderData: data }, false, 'setExistingOrderData'),
        setExistingItems: (items) => set({ existingItems: items }, false, 'setExistingItems'),

        addItem: (incoming) =>
          set(
            (s) => {
              const key = cartKey(incoming.itemId, incoming.selectedVariation?.id);
              const exists = s.cart.find(
                (c) => cartKey(c.itemId, c.selectedVariation?.id) === key
              );

              if (exists) {
                // Increment existing line
                return {
                  cart: s.cart.map((c) =>
                    cartKey(c.itemId, c.selectedVariation?.id) === key
                      ? {
                        ...c,
                        quantity: c.quantity + 1,
                        subtotal: (c.quantity + 1) * c.unitPrice,
                      }
                      : c
                  ),
                };
              }

              // New cart line
              const newItem: CartItem = {
                ...incoming,
                quantity: 1,
                subtotal: incoming.unitPrice,
              };
              return { cart: [...s.cart, newItem] };
            },
            false,
            'addItem'
          ),

        removeItem: (itemId, variationId) =>
          set(
            (s) => ({
              cart: s.cart.filter(
                (c) => cartKey(c.itemId, c.selectedVariation?.id) !== cartKey(itemId, variationId)
              ),
            }),
            false,
            'removeItem'
          ),

        incrementItem: (itemId, variationId) =>
          set(
            (s) => ({
              cart: s.cart.map((c) =>
                cartKey(c.itemId, c.selectedVariation?.id) === cartKey(itemId, variationId)
                  ? {
                    ...c,
                    quantity: c.quantity + 1,
                    subtotal: (c.quantity + 1) * c.unitPrice,
                  }
                  : c
              ),
            }),
            false,
            'incrementItem'
          ),

        decrementItem: (itemId, variationId) =>
          set(
            (s) => ({
              cart: s.cart
                .map((c) =>
                  cartKey(c.itemId, c.selectedVariation?.id) === cartKey(itemId, variationId)
                    ? {
                      ...c,
                      quantity: c.quantity - 1,
                      subtotal: (c.quantity - 1) * c.unitPrice,
                    }
                    : c
                )
                .filter((c) => c.quantity > 0), // auto-remove when qty hits 0
            }),
            false,
            'decrementItem'
          ),

        setQuantity: (itemId, quantity, variationId) =>
          set(
            (s) => {
              if (quantity <= 0) {
                return {
                  cart: s.cart.filter(
                    (c) => cartKey(c.itemId, c.selectedVariation?.id) !== cartKey(itemId, variationId)
                  ),
                };
              }
              return {
                cart: s.cart.map((c) =>
                  cartKey(c.itemId, c.selectedVariation?.id) === cartKey(itemId, variationId)
                    ? { ...c, quantity, subtotal: quantity * c.unitPrice }
                    : c
                ),
              };
            },
            false,
            'setQuantity'
          ),

        updateItemNotes: (itemId, notes, variationId) =>
          set(
            (s) => ({
              cart: s.cart.map((c) =>
                cartKey(c.itemId, c.selectedVariation?.id) === cartKey(itemId, variationId)
                  ? { ...c, notes }
                  : c
              ),
            }),
            false,
            'updateItemNotes'
          ),

        clearCart: () =>
          set({ cart: [], orderNotes: '', discount: null, autoDeals: { promoCode: null, lastValidatedAt: null, isValidating: false, applied: [], eligible: [] }, selectedTableId: null, selectedTableLabel: null, paymentOrderId: null, isEditing: false, existingOrderData: null, existingItems: [], orderType: null, cartSessionId: uuidv4(), sourceOrderId: null, customerId: null, customerName: null, waiterId: null, waiterName: null, waiterColor: null }, false, 'clearCart'),
        setOrderType: (type) => set({ orderType: type }, false, 'setOrderType'),
        setOrderContext: (ctx) => set((s) => ({
          selectedTableId: ctx.tableId !== undefined ? ctx.tableId : s.selectedTableId,
          selectedTableLabel: ctx.tableLabel !== undefined ? ctx.tableLabel : s.selectedTableLabel,
          paymentOrderId: ctx.orderId !== undefined ? ctx.orderId : s.paymentOrderId,
          isEditing: ctx.isEditing !== undefined ? ctx.isEditing : s.isEditing,
        }), false, 'setOrderContext'),
        setOrderNotes: (notes) => set({ orderNotes: notes }, false, 'setOrderNotes'),
        setDiscount: (discount) => set({ discount }, false, 'setDiscount'),

        setPromoCode: (code) =>
          set((s) => ({ autoDeals: { ...s.autoDeals, promoCode: code } }), false, 'setPromoCode'),
        clearAutoDeals: () =>
          set((s) => ({ autoDeals: { ...s.autoDeals, promoCode: null, applied: [], eligible: [], lastValidatedAt: null } }), false, 'clearAutoDeals'),

        fetchEligibleDeals: async () => {
          const { cart, autoDeals, session, orderType, subtotal } = get();
          if (!session.tenantId || !session.branchId || cart.length === 0) {
            set((s) => ({ autoDeals: { ...s.autoDeals, eligible: [] } }));
            return;
          }
          
          const now = Date.now();
          if (autoDeals.lastValidatedAt && (now - autoDeals.lastValidatedAt < 30000) && autoDeals.eligible.length > 0) {
            return; // 30s revalidation
          }

          set((s) => ({ autoDeals: { ...s.autoDeals, isValidating: true } }), false, 'fetchEligibleDeals(start)');
          try {
            const query = new URLSearchParams({
              branchId: session.branchId,
              orderTotal: subtotal().toString(),
              orderType: orderType || 'DINE_IN',
              items: JSON.stringify(cart.map((c) => ({
                itemId: c.itemId,
                quantity: c.quantity,
                unitPrice: c.unitPrice,
              })))
            });

            const res = await fetch(`${API_URL}/api/deals/eligible?${query.toString()}`, {
              headers: { 
                'Content-Type': 'application/json',
                ...(session.token ? { Authorization: `Bearer ${session.token}` } : {})
              },
            });
            if (!res.ok) throw new Error(`Fetch eligible deals failed (${res.status})`);
            const data = await res.json();

            set((s) => ({
              autoDeals: { ...s.autoDeals, eligible: data, lastValidatedAt: Date.now(), isValidating: false },
            }), false, 'fetchEligibleDeals(done)');
          } catch (e) {
            set((s) => ({ autoDeals: { ...s.autoDeals, isValidating: false } }), false, 'fetchEligibleDeals(error)');
          }
        },
        
        applyDeal: (deal: any) => {
          // Add to applied deals
          // We can set discount fixed amount or percentage based on deal
          const { subtotal } = get();
          let amount = 0;
          let label = deal.name;
          if (deal.type === 'PERCENTAGE_DISCOUNT') {
            amount = (subtotal() * (deal.config?.percent ?? 0)) / 100;
            if (deal.config?.maxDiscount && amount > deal.config.maxDiscount) amount = deal.config.maxDiscount;
          } else if (deal.type === 'FIXED_DISCOUNT') {
            amount = deal.config?.amount ?? 0;
          }

          set((s) => {
            const applied = [...s.autoDeals.applied, { type: 'DEAL', id: deal.id, code: deal.promoCode, amount }];
            const totalDiscount = applied.reduce((sum, a) => sum + a.amount, 0);
            return {
              discount: { type: 'fixed', value: totalDiscount, label: label },
              autoDeals: { ...s.autoDeals, applied }
            };
          });
        },

        validatePromoCode: async () => {
          const { cart, autoDeals, session, orderType, subtotal } = get();
          if (!session.tenantId || !session.branchId || !autoDeals.promoCode) return;

          try {
            const body = {
              branchId: session.branchId,
              orderTotal: subtotal(),
              orderType: orderType || 'DINE_IN',
              items: cart.map((c) => ({
                itemId: c.itemId,
                quantity: c.quantity,
                unitPrice: c.unitPrice,
              })),
              promoCode: autoDeals.promoCode,
            };

            const res = await fetch(`${API_URL}/api/promo-codes/validate`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(session.token ? { Authorization: `Bearer ${session.token}` } : {})
              },
              body: JSON.stringify(body),
            });
            
            if (!res.ok) throw new Error(`Promo code validate failed (${res.status})`);
            const deal = await res.json();
            get().applyDeal(deal);
          } catch (e) {
            console.error('Validate Promo Error:', e);
            // reset promo if failed
            set((s) => ({ autoDeals: { ...s.autoDeals, promoCode: null } }));
          }
        },

        // Computed
        subtotal: () => get().cart.reduce((acc, c) => acc + c.subtotal, 0),
        discountAmount: () => {
          const d = get().discount;
          if (!d) return 0;
          const sub = get().subtotal();
          if (d.type === 'percent') {
            return parseFloat(((sub * d.value) / 100).toFixed(2));
          }
          return Math.min(d.value, sub); // never discount more than subtotal
        },

        // Every figure below comes from lib/pricing.ts's computeTotals, so the
        // cart, the event store, the outbox body and the receipt cannot
        // disagree about what an order costs — which they used to, three
        // different ways. See that file's header.
        cashTaxAmount: () => get().totalsFor('CASH').taxAmount,
        cardTaxAmount: () => get().totalsFor('CARD').taxAmount,
        cashTotal: () => get().totalsFor('CASH').total,
        cardTotal: () => get().totalsFor('CARD').total,

        serviceChargeAmount: (paymentMethod?: string) => get().totalsFor(paymentMethod).serviceCharge,
        taxAmount: (paymentMethod?: string) => get().totalsFor(paymentMethod).taxAmount,
        total: (paymentMethod?: string) => get().totalsFor(paymentMethod).total,

        /** Full breakdown for the live cart under a given payment method. */
        totalsFor: (paymentMethod?: string) =>
          computeTotals({
            subtotal: get().subtotal(),
            discount: get().discountAmount(),
            method: paymentMethod ?? get().activePaymentMethod ?? 'CASH',
            config: resolveTaxConfig(get().session),
          }),
        totalItems: () => get().cart.reduce((acc, c) => acc + c.quantity, 0),

        combinedItems: () => {
          const s = get();
          const normExisting = s.existingItems.map(ei => ({
            name: ei.item?.name || 'Unknown Item',
            quantity: ei.quantity,
            subtotal: Number(ei.subtotal) || 0,
            selectedVariation: ei.options?.variation ? { name: ei.options.variation.name } : null,
            selectedAddOns: [],
          }));
          return [...normExisting, ...s.cart];
        },
        combinedTotalItems: () => {
          const s = get();
          const existingCount = s.existingItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
          return existingCount + s.totalItems();
        },

        combinedSubtotal: () => {
          const s = get();
          const existingSub = s.existingItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
          return existingSub + s.subtotal();
        },
        combinedDiscountAmount: () => {
          const s = get();
          return (Number(s.existingOrderData?.discountAmount) || 0) + s.discountAmount();
        },
        /**
         * Breakdown for an existing order plus whatever is being added to it.
         *
         * The old `combinedTaxAmount` inlined its own rate lookup and — unlike
         * its sibling `taxAmount` — never checked `cashTaxEnabled`/
         * `cardTaxEnabled`, so a tenant with tax switched off was still charged
         * on every add-items checkout.
         */
        combinedTotalsFor: (paymentMethod?: string) => {
          const s = get();
          return computeTotals({
            subtotal: s.combinedSubtotal(),
            discount: s.combinedDiscountAmount(),
            method: paymentMethod ?? s.activePaymentMethod ?? 'CASH',
            config: resolveTaxConfig(s.session),
          });
        },
        combinedServiceCharge: (paymentMethod?: string) => get().combinedTotalsFor(paymentMethod).serviceCharge,
        combinedTaxAmount: (paymentMethod?: string) => get().combinedTotalsFor(paymentMethod).taxAmount,
        combinedTotal: (paymentMethod?: string) => get().combinedTotalsFor(paymentMethod).total,

        // Active payment method state
        activePaymentMethod: 'CASH',
        setActivePaymentMethod: (method: string) =>
          set({ activePaymentMethod: method }, false, 'setActivePaymentMethod'),
      }),
    { name: 'Dineiz Go POS Cart' }
  )
);
