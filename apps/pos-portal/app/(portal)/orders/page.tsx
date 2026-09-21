"use client";

import Link from "next/link";
import { Clock, Eye, Printer, ShoppingBag, Truck, Utensils } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatPKR } from "@/lib/utils";
import { STATUS_TONE, STATUS_LABEL } from "@/lib/order-status";
import { useLiveOrders, useOrderHistory, type ApiOrder } from "@/lib/queries";

const TYPE_ICON: Record<ApiOrder["type"], typeof Utensils> = {
  DINE_IN: Utensils,
  TAKEAWAY: ShoppingBag,
  DELIVERY: Truck,
};

const TYPE_LABEL: Record<ApiOrder["type"], string> = {
  DINE_IN: "Dine-In",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

function orderTotal(order: ApiOrder) {
  return order.payment?.total ?? order.items.reduce((sum, i) => sum + i.priceSnapshot * i.qty, 0);
}

function relativeTime(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr} hr ago`;
}

export default function OrdersPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Orders"
        description="Live orders across the branch, and full order history"
        actions={
          <Link
            href="/orders/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create New Order
          </Link>
        }
      />
      <TabbedPage tabs={[{ key: "live", label: "Live Orders" }, { key: "history", label: "Order History" }]}>
        {(tab) => (tab === "live" ? <LiveOrdersView /> : <OrderHistoryView />)}
      </TabbedPage>
    </div>
  );
}

function LiveOrdersView() {
  const { data: orders, isLoading } = useLiveOrders();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading orders…</div>;
  if (!orders || orders.length === 0) return <div className="p-6 text-sm text-text-2">No live orders right now.</div>;

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {orders.map((order) => {
        const Icon = TYPE_ICON[order.type];
        const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
        return (
          <Card key={order.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-text-3" strokeWidth={1.75} />
                <span className="tabular text-sm font-bold text-text-1">#{order.sequenceNo}</span>
              </div>
              <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            </div>
            <div className="text-xs text-text-2">
              {TYPE_LABEL[order.type]}
              {order.table ? ` · ${order.table.label}` : order.customerName ? ` · ${order.customerName}` : ""}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="tabular text-xs text-text-3">{itemCount} items</span>
              <span className="tabular text-sm font-bold text-text-1">{formatPKR(orderTotal(order))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-text-3">
                <Clock className="h-3 w-3" strokeWidth={1.75} />
                {relativeTime(order.createdAt)}
              </span>
              <Button size="sm" variant="outline">
                View
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function OrderHistoryView() {
  const { data: orders, isLoading } = useOrderHistory();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading history…</div>;

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[90px_90px_120px_60px_100px_100px_110px_130px_70px] items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <span>Order</span>
          <span>Type</span>
          <span>Table / Customer</span>
          <span className="text-right">Items</span>
          <span className="text-right">Total</span>
          <span>Payment</span>
          <span>Status</span>
          <span>Time</span>
          <span></span>
        </div>
        {(orders ?? []).map((order) => {
          const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
          return (
            <div
              key={order.id}
              className="grid grid-cols-[90px_90px_120px_60px_100px_100px_110px_130px_70px] items-center gap-2 border-b border-border px-4 py-3 text-[13px] last:border-0"
            >
              <span className="tabular font-semibold text-text-1">#{order.sequenceNo}</span>
              <span className="text-text-2">{TYPE_LABEL[order.type]}</span>
              <span className="text-text-2">{order.table?.label ?? order.customerName ?? "—"}</span>
              <span className="tabular text-right text-text-2">{itemCount}</span>
              <span className="tabular text-right font-semibold text-text-1">{formatPKR(orderTotal(order))}</span>
              <span className="text-text-2">{order.payment?.method ?? "—"}</span>
              <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
              <span className="tabular text-xs text-text-3">{relativeTime(order.createdAt)}</span>
              <div className="flex justify-end gap-1">
                <button className="flex h-7 w-7 items-center justify-center rounded text-text-3 hover:bg-hover hover:text-text-1" aria-label="View">
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded text-text-3 hover:bg-hover hover:text-text-1" aria-label="Print">
                  <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
