"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingBag, Truck, Utensils, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkout } from "@/components/checkout/Checkout";
import { cn, formatPKR } from "@/lib/utils";
import { CARD_TAX_RATE, CASH_TAX_RATE, useCart } from "@/lib/use-cart";
import {
  useMenuCategories,
  useMenuItems,
  useTableSections,
  useCreateOrder,
  useHoldOrder,
  useUpdateOrderStatus,
  type ApiTable,
} from "@/lib/queries";

type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

const ORDER_TYPES: { key: OrderType; label: string; icon: typeof Utensils }[] = [
  { key: "DINE_IN", label: "Dine-In", icon: Utensils },
  { key: "TAKEAWAY", label: "Takeaway", icon: ShoppingBag },
  { key: "DELIVERY", label: "Delivery", icon: Truck },
];

const TABLE_DOT: Record<ApiTable["status"], string> = {
  FREE: "bg-success",
  OCCUPIED: "bg-danger",
  RESERVED: "bg-purple",
};

export default function CreateNewOrderPage() {
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [step, setStep] = useState<"building" | "checkout">("building");
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [checkoutSequenceNo, setCheckoutSequenceNo] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: categories } = useMenuCategories();
  const { data: items } = useMenuItems();
  const { data: sections } = useTableSections();
  const tables = useMemo(() => sections?.flatMap((s) => s.tables) ?? [], [sections]);

  const createOrder = useCreateOrder();
  const holdOrder = useHoldOrder();
  const updateStatus = useUpdateOrderStatus();

  const cart = useCart();

  const activeCategory = activeCategoryId ?? categories?.[0]?.id ?? null;

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const byCategory = items.filter((item) => item.categoryId === activeCategory);
    if (!search.trim()) return byCategory;
    const q = search.trim().toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, activeCategory, search]);

  const cashTotal = Math.round(cart.subtotal * (1 + CASH_TAX_RATE));
  const cardTotal = Math.round(cart.subtotal * (1 + CARD_TAX_RATE));

  const canSend = cart.itemCount > 0 && (orderType !== "DINE_IN" || !!selectedTableId);

  const checkoutLabel =
    orderType === "DINE_IN"
      ? tables.find((t) => t.id === selectedTableId)?.label
      : orderType === "TAKEAWAY"
        ? customerName || "Takeaway"
        : customerName || "Delivery";

  function resetToBuilding() {
    cart.clearCart();
    setSelectedTableId(null);
    setCustomerName("");
    setDeliveryAddress("");
    setStep("building");
    setCheckoutOrderId(null);
    setCheckoutSequenceNo(null);
  }

  async function submitOrder() {
    return createOrder.mutateAsync({
      type: orderType,
      tableId: orderType === "DINE_IN" ? selectedTableId ?? undefined : undefined,
      customerName: orderType !== "DINE_IN" ? customerName || undefined : undefined,
      deliveryAddress: orderType === "DELIVERY" ? deliveryAddress || undefined : undefined,
      lines: cart.lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
    });
  }

  async function handleHold() {
    setActionError(null);
    try {
      const order = await submitOrder();
      await holdOrder.mutateAsync(order.id);
      resetToBuilding();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't hold the order");
    }
  }

  async function handleSendToKitchen() {
    setActionError(null);
    try {
      const order = await submitOrder();
      await updateStatus.mutateAsync({ orderId: order.id, status: "IN_KITCHEN" });
      resetToBuilding();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't send the order");
    }
  }

  async function handleCharge() {
    setActionError(null);
    try {
      const order = await submitOrder();
      setCheckoutOrderId(order.id);
      setCheckoutSequenceNo(order.sequenceNo);
      setStep("checkout");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't start checkout");
    }
  }

  const busy = createOrder.isPending || holdOrder.isPending || updateStatus.isPending;

  if (step === "checkout" && checkoutOrderId) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Checkout" description="Collect payment for this order" />
        <Checkout
          orderId={checkoutOrderId}
          displayId={checkoutSequenceNo != null ? String(checkoutSequenceNo) : undefined}
          label={checkoutLabel}
          lines={cart.lines.map((l) => ({ name: l.item.name, price: l.item.price, qty: l.qty }))}
          onDone={resetToBuilding}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Create New Order" description="Punch a new order and send it straight to the kitchen" />

      <div className="flex flex-col gap-3 border-b border-border px-6 pb-4">
        <div className="flex w-fit gap-1 rounded-md bg-panel p-1">
          {ORDER_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = orderType === type.key;
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => setOrderType(type.key)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded px-3.5 text-[13px] font-semibold transition-colors",
                  isActive ? "bg-bg text-text-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-text-2 hover:text-text-1"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "text-primary")} strokeWidth={1.75} />
                {type.label}
              </button>
            );
          })}
        </div>

        {orderType === "DINE_IN" && (
          <div className="flex flex-wrap gap-2">
            {tables.map((table) => {
              const disabled = table.status === "OCCUPIED";
              const isSelected = selectedTableId === table.id;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedTableId(table.id)}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    isSelected ? "border-primary bg-primary-tint text-primary" : "border-border bg-bg text-text-2 hover:bg-hover"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", TABLE_DOT[table.status])} />
                  {table.label}
                  <span className="tabular text-text-3">· {table.seats}</span>
                </button>
              );
            })}
          </div>
        )}

        {orderType === "TAKEAWAY" && (
          <div className="flex items-center gap-3">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="h-9 w-64 rounded-md border border-border px-3 text-[13px] text-text-1 outline-none placeholder:text-text-3 focus:border-primary"
            />
            <span className="text-xs text-text-3">Token will be assigned on send</span>
          </div>
        )}

        {orderType === "DELIVERY" && (
          <div className="flex items-center gap-3">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="h-9 w-56 rounded-md border border-border px-3 text-[13px] text-text-1 outline-none placeholder:text-text-3 focus:border-primary"
            />
            <input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Delivery address"
              className="h-9 w-80 rounded-md border border-border px-3 text-[13px] text-text-1 outline-none placeholder:text-text-3 focus:border-primary"
            />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-border px-6 py-3">
            <div className="flex h-9 flex-1 max-w-xs items-center gap-2 rounded-md border border-border bg-panel px-3">
              <Search className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu items…"
                className="w-full bg-transparent text-[13px] text-text-1 outline-none placeholder:text-text-3"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {(categories ?? []).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    setSearch("");
                  }}
                  className={cn(
                    "h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition-colors",
                    activeCategory === cat.id && !search ? "bg-primary-tint text-primary" : "text-text-2 hover:bg-hover"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid flex-1 auto-rows-min grid-cols-4 gap-3 overflow-y-auto p-6">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!item.available}
                onClick={() => cart.addItem(item)}
                className="flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary-border hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-bg"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold leading-snug text-text-1">{item.name}</span>
                  {item.popular && (
                    <Badge tone="primary" className="shrink-0">
                      Popular
                    </Badge>
                  )}
                </div>
                <span className="tabular text-sm font-bold text-text-1">
                  {formatPKR(item.price)}
                  {!item.available && <span className="ml-1.5 text-[11px] font-normal text-text-3">86&apos;d</span>}
                </span>
              </button>
            ))}
            {items && filteredItems.length === 0 && (
              <div className="col-span-4 flex flex-col items-center justify-center gap-2 py-16 text-center">
                <span className="text-sm font-medium text-text-2">No items match &ldquo;{search}&rdquo;</span>
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-[360px] shrink-0 flex-col border-l border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <span className="text-sm font-semibold text-text-1">Order Summary</span>
            <span className="tabular text-xs text-text-3">{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <ShoppingBag className="h-8 w-8 text-text-4" strokeWidth={1.5} />
                <span className="text-[13px] text-text-3">Tap a menu item to add it to this order</span>
              </div>
            ) : (
              <ul className="flex flex-col">
                {cart.lines.map(({ item, qty }) => (
                  <li key={item.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-text-1">{item.name}</div>
                      <div className="tabular text-xs text-text-3">{formatPKR(item.price)} each</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cart.setQty(item.id, qty - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-2 hover:bg-hover"
                        aria-label={`Decrease ${item.name}`}
                      >
                        <Minus className="h-3 w-3" strokeWidth={2} />
                      </button>
                      <span className="tabular w-5 text-center text-[13px] font-semibold text-text-1">{qty}</span>
                      <button
                        type="button"
                        onClick={() => cart.setQty(item.id, qty + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-2 hover:bg-hover"
                        aria-label={`Increase ${item.name}`}
                      >
                        <Plus className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => cart.removeItem(item.id)}
                      className="text-text-3 hover:text-danger"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
            <div className="flex justify-between text-[13px] text-text-2">
              <span>Subtotal</span>
              <span className="tabular">{formatPKR(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-text-3">
              <span>If paid cash (+{Math.round(CASH_TAX_RATE * 100)}% tax)</span>
              <span className="tabular">{formatPKR(cashTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-text-3">
              <span>If paid card (+{Math.round(CARD_TAX_RATE * 100)}% tax)</span>
              <span className="tabular">{formatPKR(cardTotal)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border p-4">
            {actionError && <div className="rounded-md border border-danger-border bg-danger-tint px-2.5 py-2 text-[11px] text-danger">{actionError}</div>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={cart.itemCount === 0 || busy} onClick={handleHold}>
                Hold Order
              </Button>
              <Button variant="secondary" className="flex-1" disabled={!canSend || busy} onClick={handleSendToKitchen}>
                Send to Kitchen
              </Button>
            </div>
            <Button size="lg" className="w-full" disabled={!canSend || busy} onClick={handleCharge}>
              Charge {cart.itemCount > 0 ? formatPKR(cashTotal) : ""}
            </Button>
            {orderType === "DINE_IN" && !selectedTableId && (
              <span className="text-center text-[11px] text-text-3">Select a table to continue</span>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
