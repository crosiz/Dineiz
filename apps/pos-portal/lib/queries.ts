"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

// ── Types (shape of what the API actually returns) ──

export type ApiMenuCategory = { id: string; label: string; sortOrder: number; _count: { items: number } };
export type ApiMenuItem = { id: string; categoryId: string; name: string; price: number; popular: boolean; available: boolean; category?: ApiMenuCategory };
export type ApiVariationGroup = { id: string; name: string; appliesTo: string; options: { id: string; label: string; priceDelta: number }[] };
export type ApiAddOnGroup = { id: string; name: string; options: { id: string; label: string; price: number }[] };
export type ApiDeal = { id: string; name: string; description: string; price: number; originalPrice: number; active: boolean };

export type ApiTable = { id: string; sectionId: string; label: string; seats: number; status: "FREE" | "OCCUPIED" | "RESERVED" };
export type ApiTableSection = { id: string; name: string; sortOrder: number; tables: ApiTable[] };
export type ApiReservation = { id: string; name: string; partySize: number; time: string; status: string; table: ApiTable | null };

export type ApiOrderItem = { id: string; menuItemId: string; nameSnapshot: string; priceSnapshot: number; qty: number; notes: string | null };
export type ApiPayment = { method: string; subtotal: number; taxRate: number; taxAmount: number; total: number; tenderedAmount: number | null; changeAmount: number | null };
export type ApiOrder = {
  id: string;
  sequenceNo: number;
  type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  status: "PENDING" | "IN_KITCHEN" | "READY" | "COMPLETED" | "CANCELLED";
  tableId: string | null;
  table: ApiTable | null;
  customerName: string | null;
  deliveryAddress: string | null;
  heldAt: string | null;
  createdAt: string;
  items: ApiOrderItem[];
  payment?: ApiPayment | null;
};

export type ApiStockItem = { id: string; name: string; unit: string; onHand: number; threshold: number };
export type ApiIngredient = { id: string; name: string; unit: string; costPerUnit: number; supplier: { name: string } | null };
export type ApiRecipe = {
  id: string;
  yieldQty: string;
  menuItem: { name: string };
  lines: { id: string; qty: number; unit: string; ingredient: { name: string } }[];
};
export type ApiPurchaseOrder = {
  id: string;
  status: "DRAFT" | "SENT" | "RECEIVED";
  total: number;
  createdAt: string;
  supplier: { name: string };
  lines: { id: string }[];
};
export type ApiGoodsReceipt = {
  id: string;
  status: "COMPLETE" | "PARTIAL";
  createdAt: string;
  purchaseOrder: { id: string };
  receivedBy: { name: string };
};
export type ApiWastageEntry = { id: string; itemName: string; qtyLabel: string; reason: string; cost: number; createdAt: string };
export type ApiStockCheck = { id: string; discrepancies: number; status: "COMPLETE" | "IN_PROGRESS"; createdAt: string; conductedBy: { name: string } };
export type ApiStockMovement = { id: string; itemName: string; type: "IN" | "OUT"; qtyLabel: string; reason: string; createdAt: string };

export type ApiSupplier = { id: string; name: string; category: string; contact: string; leadTime: string };
export type ApiSupplierBalance = { id: string; outstanding: number; lastPaymentAt: string | null; terms: string; supplier: { name: string } };
export type ApiSupplierPayment = { id: string; amount: number; method: string; createdAt: string; supplier: { name: string } };

export type ApiRider = { id: string; name: string; phone: string; status: "AVAILABLE" | "ON_DELIVERY" | "OFFLINE"; rating: number };
export type ApiDeliveryZone = { id: string; name: string; fee: number; avgTimeMinutes: number };
export type ApiDelivery = {
  id: string;
  address: string;
  status: "ASSIGNED" | "PICKED_UP" | "EN_ROUTE" | "DELIVERED";
  etaMinutes: number | null;
  deliveredInMinutes: number | null;
  createdAt: string;
  order: { sequenceNo: number; customerName: string | null };
  rider: { name: string } | null;
  zone: { name: string } | null;
};

export type ApiShift = {
  id: string;
  status: "OPEN" | "CLOSED";
  openingFloat: number;
  openedAt: string;
  closedAt: string | null;
  expectedCash: number | null;
  countedCash: number | null;
  variance: number | null;
  openedBy: { name: string };
  ordersSoFar?: number;
  salesSoFar?: number;
  staffOnShift?: number;
};

export type ApiBranch = { id: string; code: string; name: string; address: string | null; phone: string | null; operatingHours: string | null };

export type ApiCustomer = { id: string; name: string; phone: string; tier: "BRONZE" | "SILVER" | "GOLD"; totalSpent: number; orderCount: number; lastOrderAt: string | null };
export type ApiCustomerSegment = { id: string; name: string; description: string };
export type ApiLoyaltyTier = { id: string; name: string; minPoints: number; perks: string; members: number };
export type ApiFeedback = { id: string; rating: number; comment: string; createdAt: string; customer: { name: string } | null };

export type ApiPromo = { id: string; name: string; discountLabel: string; validTill: string; active: boolean };
export type ApiCoupon = { id: string; code: string; discountLabel: string; usageLimit: number; used: number; expiresAt: string | null };
export type ApiCampaign = { id: string; name: string; channel: string; sent: number; opened: number; createdAt: string };

export type ApiExpense = { id: string; description: string; amount: number; createdAt: string; category: { name: string } | null; paidBy: { name: string } | null };
export type ApiExpenseCategory = { id: string; name: string; monthlyBudget: number; spentThisMonth: number };
export type ApiPettyCashEntry = { id: string; type: "IN" | "OUT"; description: string; amount: number; balanceAfter: number; createdAt: string };

export type ApiStaffMember = { id: string; name: string; role: string; phone: string | null; active: boolean; createdAt: string };
export type ApiPermission = { id: string; role: string; module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
export type ApiAttendanceEntry = { id: string; checkIn: string; checkOut: string | null; user: { name: string } };
export type ApiPayrollEntry = { id: string; month: string; baseSalary: number; bonus: number; user: { name: string; role: string } };

export type ApiSalesSummary = { revenue30d: number; orders30d: number; avgOrderValue: number; topDay: string };
export type ApiTopItem = { name: string; unitsSold: number; revenue: number };
export type ApiStaffPerformance = { staff: string; ordersHandled: number; avgOrderValue: number };

export type ApiAggregator = { id: string; name: string; isConnected: boolean; ordersToday: number; commissionLabel: string };
export type ApiPaymentGateway = { id: string; name: string; isActive: boolean; feeLabel: string };
export type ApiWebhookConfig = { id: string; event: string; url: string; isHealthy: boolean; lastTriggeredAt: string | null };
export type ApiPrinterDevice = { id: string; name: string; type: string; station: string; isOnline: boolean };

export type ApiBranchSettings = {
  receipt: { header: string; footer: string; paperSize: string; showLogo: boolean; showTaxBreakdown: boolean };
  tax: { cashTaxRate: number; cardTaxRate: number; taxRegistrationNumber: string };
  payments: { cash: boolean; card: boolean; jazzcash: boolean; easypaisa: boolean };
  workflow: { autoAcceptOrders: boolean; requireManagerPinForDiscounts: boolean; autoPrintKot: boolean };
  notifications: { newOrderAlerts: boolean; lowStockAlerts: boolean; shiftReminders: boolean; dailySummaryEmail: boolean };
  backup: { lastBackupAt: string | null; frequency: string; storageUsedGb: number; storageLimitGb: number };
};

// ── Menu ──

export function useMenuCategories() {
  return useQuery({ queryKey: ["menu", "categories"], queryFn: () => api.get<ApiMenuCategory[]>("/api/menu/categories") });
}
export function useMenuItems() {
  return useQuery({ queryKey: ["menu", "items"], queryFn: () => api.get<ApiMenuItem[]>("/api/menu/items") });
}
export function useVariationGroups() {
  return useQuery({ queryKey: ["menu", "variations"], queryFn: () => api.get<ApiVariationGroup[]>("/api/menu/variations") });
}
export function useAddOnGroups() {
  return useQuery({ queryKey: ["menu", "addons"], queryFn: () => api.get<ApiAddOnGroup[]>("/api/menu/addons") });
}
export function useDeals() {
  return useQuery({ queryKey: ["menu", "deals"], queryFn: () => api.get<ApiDeal[]>("/api/menu/deals") });
}
export function useSetItemAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      api.patch(`/api/menu/items/${id}/availability`, { available }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", "items"] }),
  });
}

// ── Branch ──

export function useCurrentBranch() {
  return useQuery({ queryKey: ["branch", "current"], queryFn: () => api.get<ApiBranch>("/api/branches/current") });
}
export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<{ name: string; address: string; phone: string; operatingHours: string }>) =>
      api.patch<ApiBranch>("/api/branches/current", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branch", "current"] }),
  });
}

// ── Tables ──

export function useTableSections() {
  return useQuery({ queryKey: ["tables", "sections"], queryFn: () => api.get<ApiTableSection[]>("/api/tables/sections") });
}
export function useTable(id: string | undefined) {
  return useQuery({
    queryKey: ["tables", id],
    queryFn: () => api.get<{ table: ApiTable & { section: ApiTableSection }; currentOrder: ApiOrder | null }>(`/api/tables/${id}`),
    enabled: !!id,
  });
}
export function useReservations() {
  return useQuery({ queryKey: ["reservations"], queryFn: () => api.get<ApiReservation[]>("/api/reservations") });
}

// ── Orders ──

export function useLiveOrders() {
  return useQuery({ queryKey: ["orders", "live"], queryFn: () => api.get<ApiOrder[]>("/api/orders/live"), refetchInterval: 15_000 });
}
export function useOrderHistory() {
  return useQuery({ queryKey: ["orders", "history"], queryFn: () => api.get<ApiOrder[]>("/api/orders/history") });
}
export function useHeldOrders() {
  return useQuery({ queryKey: ["orders", "held"], queryFn: () => api.get<ApiOrder[]>("/api/orders/held") });
}

function invalidateOrders(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["orders"] });
  qc.invalidateQueries({ queryKey: ["tables"] });
  qc.invalidateQueries({ queryKey: ["shifts", "current"] });
}

export type CreateOrderInput = {
  type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableId?: string;
  customerName?: string;
  deliveryAddress?: string;
  waiterId?: string;
  lines: { menuItemId: string; qty: number }[];
};

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.post<ApiOrder>("/api/orders", input),
    onSuccess: () => invalidateOrders(qc),
  });
}
export function useHoldOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.post<ApiOrder>(`/api/orders/${orderId}/hold`),
    onSuccess: () => invalidateOrders(qc),
  });
}
export function useResumeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.post<ApiOrder>(`/api/orders/${orderId}/resume`),
    onSuccess: () => invalidateOrders(qc),
  });
}
export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: "IN_KITCHEN" | "READY" | "COMPLETED" | "CANCELLED" }) =>
      api.patch<ApiOrder>(`/api/orders/${orderId}/status`, { status }),
    onSuccess: () => invalidateOrders(qc),
  });
}
export function useCheckoutOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, method, tenderedAmount }: { orderId: string; method: string; tenderedAmount?: number }) =>
      api.post<ApiPayment>(`/api/orders/${orderId}/checkout`, { method, tenderedAmount }),
    onSuccess: () => invalidateOrders(qc),
  });
}

// ── Shifts ──

export function useCurrentShift() {
  return useQuery({
    queryKey: ["shifts", "current"],
    queryFn: async () => {
      try {
        return await api.get<ApiShift>("/api/shifts/current");
      } catch {
        return null;
      }
    },
  });
}
export function useShiftHistory() {
  return useQuery({ queryKey: ["shifts", "history"], queryFn: () => api.get<ApiShift[]>("/api/shifts/history") });
}
export function useOpenOrdersCount() {
  return useQuery({ queryKey: ["shifts", "open-orders-count"], queryFn: () => api.get<{ count: number }>("/api/shifts/open-orders-count") });
}
export function useShiftClosePreview() {
  return useQuery({
    queryKey: ["shifts", "close-preview"],
    queryFn: () => api.get<{ shiftId: string; expectedCash: number }>("/api/shifts/close-preview"),
  });
}
export function useOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { openingFloat: number; notes?: string }) => api.post<ApiShift>("/api/shifts/open", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}
export function useCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, countedCash }: { shiftId: string; countedCash: number }) =>
      api.post<ApiShift>(`/api/shifts/${shiftId}/close`, { countedCash }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

// ── Inventory ──

export function useStockItems() {
  return useQuery({ queryKey: ["inventory", "stock"], queryFn: () => api.get<ApiStockItem[]>("/api/inventory/stock") });
}
export function useIngredients() {
  return useQuery({ queryKey: ["inventory", "ingredients"], queryFn: () => api.get<ApiIngredient[]>("/api/inventory/ingredients") });
}
export function useRecipes() {
  return useQuery({ queryKey: ["inventory", "recipes"], queryFn: () => api.get<ApiRecipe[]>("/api/inventory/recipes") });
}
export function usePurchaseOrders() {
  return useQuery({ queryKey: ["inventory", "purchase-orders"], queryFn: () => api.get<ApiPurchaseOrder[]>("/api/inventory/purchase-orders") });
}
export function useGoodsReceipts() {
  return useQuery({ queryKey: ["inventory", "goods-receipts"], queryFn: () => api.get<ApiGoodsReceipt[]>("/api/inventory/goods-receipts") });
}
export function useWastage() {
  return useQuery({ queryKey: ["inventory", "wastage"], queryFn: () => api.get<ApiWastageEntry[]>("/api/inventory/wastage") });
}
export function useStockChecks() {
  return useQuery({ queryKey: ["inventory", "stock-checks"], queryFn: () => api.get<ApiStockCheck[]>("/api/inventory/stock-checks") });
}
export function useStockMovements() {
  return useQuery({ queryKey: ["inventory", "movements"], queryFn: () => api.get<ApiStockMovement[]>("/api/inventory/movements") });
}

// ── Warehouse ──

export function useSuppliers() {
  return useQuery({ queryKey: ["warehouse", "suppliers"], queryFn: () => api.get<ApiSupplier[]>("/api/warehouse/suppliers") });
}
export function useSupplierBalances() {
  return useQuery({ queryKey: ["warehouse", "balances"], queryFn: () => api.get<ApiSupplierBalance[]>("/api/warehouse/balances") });
}
export function useSupplierPayments() {
  return useQuery({ queryKey: ["warehouse", "payments"], queryFn: () => api.get<ApiSupplierPayment[]>("/api/warehouse/payments") });
}

// ── Delivery ──

export function useActiveDeliveries() {
  return useQuery({ queryKey: ["delivery", "active"], queryFn: () => api.get<ApiDelivery[]>("/api/delivery/active"), refetchInterval: 20_000 });
}
export function useDeliveryHistory() {
  return useQuery({ queryKey: ["delivery", "history"], queryFn: () => api.get<ApiDelivery[]>("/api/delivery/history") });
}
export function useRiders() {
  return useQuery({ queryKey: ["delivery", "riders"], queryFn: () => api.get<ApiRider[]>("/api/delivery/riders") });
}
export function useDeliveryZones() {
  return useQuery({ queryKey: ["delivery", "zones"], queryFn: () => api.get<ApiDeliveryZone[]>("/api/delivery/zones") });
}

// ── Customers ──

export function useCustomers() {
  return useQuery({ queryKey: ["customers", "all"], queryFn: () => api.get<ApiCustomer[]>("/api/customers") });
}
export function useCustomerSegments() {
  return useQuery({ queryKey: ["customers", "segments"], queryFn: () => api.get<ApiCustomerSegment[]>("/api/customers/segments") });
}
export function useLoyaltyTiers() {
  return useQuery({ queryKey: ["customers", "loyalty-tiers"], queryFn: () => api.get<ApiLoyaltyTier[]>("/api/customers/loyalty-tiers") });
}
export function useCustomerFeedback() {
  return useQuery({ queryKey: ["customers", "feedback"], queryFn: () => api.get<ApiFeedback[]>("/api/customers/feedback") });
}

// ── Marketing ──

export function usePromos() {
  return useQuery({ queryKey: ["marketing", "promos"], queryFn: () => api.get<ApiPromo[]>("/api/marketing/promos") });
}
export function useCoupons() {
  return useQuery({ queryKey: ["marketing", "coupons"], queryFn: () => api.get<ApiCoupon[]>("/api/marketing/coupons") });
}
export function useCampaigns() {
  return useQuery({ queryKey: ["marketing", "campaigns"], queryFn: () => api.get<ApiCampaign[]>("/api/marketing/campaigns") });
}

// ── Expenses ──

export function useExpenses() {
  return useQuery({ queryKey: ["expenses", "daily"], queryFn: () => api.get<ApiExpense[]>("/api/expenses") });
}
export function useExpenseCategories() {
  return useQuery({ queryKey: ["expenses", "categories"], queryFn: () => api.get<ApiExpenseCategory[]>("/api/expenses/categories") });
}
export function usePettyCash() {
  return useQuery({ queryKey: ["expenses", "petty-cash"], queryFn: () => api.get<ApiPettyCashEntry[]>("/api/expenses/petty-cash") });
}

// ── Staff ──

export function useStaff() {
  return useQuery({ queryKey: ["staff", "all"], queryFn: () => api.get<ApiStaffMember[]>("/api/staff") });
}
export type ApiCreatedStaff = { id: string; name: string; role: string; pin: string };
export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; role: "BRANCH_MANAGER" | "CASHIER" | "WAITER" | "KITCHEN_STAFF" }) =>
      api.post<ApiCreatedStaff>("/api/staff", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "all"] }),
  });
}
export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/staff/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", "all"] }),
  });
}
export function useStaffPermissions(role: string) {
  return useQuery({ queryKey: ["staff", "permissions", role], queryFn: () => api.get<ApiPermission[]>(`/api/staff/permissions?role=${role}`) });
}
export function useAttendance() {
  return useQuery({ queryKey: ["staff", "attendance"], queryFn: () => api.get<ApiAttendanceEntry[]>("/api/staff/attendance") });
}
export function usePayroll() {
  return useQuery({ queryKey: ["staff", "payroll"], queryFn: () => api.get<ApiPayrollEntry[]>("/api/staff/payroll") });
}

// ── Analytics ──

export function useSalesSummary() {
  return useQuery({ queryKey: ["analytics", "summary"], queryFn: () => api.get<ApiSalesSummary>("/api/analytics/summary") });
}
export function useTopItems() {
  return useQuery({ queryKey: ["analytics", "top-items"], queryFn: () => api.get<ApiTopItem[]>("/api/analytics/top-items") });
}
export function useStaffPerformance() {
  return useQuery({ queryKey: ["analytics", "staff-performance"], queryFn: () => api.get<ApiStaffPerformance[]>("/api/analytics/staff-performance") });
}

// ── Integrations ──

export function useAggregators() {
  return useQuery({ queryKey: ["integrations", "aggregators"], queryFn: () => api.get<ApiAggregator[]>("/api/integrations/aggregators") });
}
export function usePaymentGateways() {
  return useQuery({ queryKey: ["integrations", "payment-gateways"], queryFn: () => api.get<ApiPaymentGateway[]>("/api/integrations/payment-gateways") });
}
export function useWebhooks() {
  return useQuery({ queryKey: ["integrations", "webhooks"], queryFn: () => api.get<ApiWebhookConfig[]>("/api/integrations/webhooks") });
}
export function usePrinters() {
  return useQuery({ queryKey: ["integrations", "printers"], queryFn: () => api.get<ApiPrinterDevice[]>("/api/integrations/printers") });
}

// ── Settings ──

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get<ApiBranchSettings>("/api/settings") });
}
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<ApiBranchSettings>) => api.patch<ApiBranchSettings>("/api/settings", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ── Sync Queue ──
// "Pending" lives client-side only (lib/db.ts, via dexie-react-hooks in the
// pages that read it) — there's nothing for the server to know about until a
// device reconnects. This is the server-side record of syncs that already
// completed, written by lib/sync-queue.ts right after each one.

export type ApiSyncQueueEntry = { id: string; kind: string; label: string; createdAt: string };
export function useSyncQueueLog() {
  return useQuery({ queryKey: ["sync-queue", "recent"], queryFn: () => api.get<ApiSyncQueueEntry[]>("/api/sync-queue") });
}
