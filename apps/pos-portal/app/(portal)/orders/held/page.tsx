"use client";

import { PauseCircle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatPKR } from "@/lib/utils";
import { useHeldOrders, useResumeOrder, type ApiOrder } from "@/lib/queries";
import { REVERSALS } from "@/mocks/orders";

const TYPE_LABEL: Record<ApiOrder["type"], string> = { DINE_IN: "Dine-In", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

export default function HeldOrdersPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Held Orders, Reversals & Refunds" description="Resume parked orders, or review manager-approved reversals" />
      <TabbedPage tabs={[{ key: "held", label: "Held Orders" }, { key: "reversals", label: "Reversals & Refunds" }]}>
        {(tab) => (tab === "held" ? <HeldView /> : <ReversalsView />)}
      </TabbedPage>
    </div>
  );
}

function HeldView() {
  const { data: orders, isLoading } = useHeldOrders();
  const resumeOrder = useResumeOrder();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading held orders…</div>;
  if (!orders || orders.length === 0) {
    return <EmptyState icon={PauseCircle} text="No orders are currently on hold" />;
  }
  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {orders.map((order) => {
        const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
        const total = order.items.reduce((s, i) => s + i.priceSnapshot * i.qty, 0);
        return (
          <Card key={order.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="tabular text-sm font-bold text-text-1">#{order.sequenceNo}</span>
              <Badge tone="warning">On Hold</Badge>
            </div>
            <div className="text-xs text-text-2">
              {TYPE_LABEL[order.type]}
              {order.table ? ` · ${order.table.label}` : order.customerName ? ` · ${order.customerName}` : ""}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="tabular text-xs text-text-3">{itemCount} items</span>
              <span className="tabular text-sm font-bold text-text-1">{formatPKR(total)}</span>
            </div>
            {order.heldAt && (
              <div className="text-[11px] text-text-3">Held {new Date(order.heldAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
            )}
            <Button size="sm" className="w-full" disabled={resumeOrder.isPending} onClick={() => resumeOrder.mutate(order.id)}>
              Resume Order
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

function ReversalsView() {
  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[80px_90px_100px_1fr_140px_150px] items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <span>Ref</span>
          <span>Order</span>
          <span className="text-right">Amount</span>
          <span>Reason</span>
          <span>Approved By</span>
          <span>Time</span>
        </div>
        {REVERSALS.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[80px_90px_100px_1fr_140px_150px] items-center gap-2 border-b border-border px-4 py-3 text-[13px] last:border-0"
          >
            <span className="tabular font-semibold text-text-1">{r.id}</span>
            <span className="tabular text-text-2">#{r.orderId}</span>
            <span className="tabular text-right font-semibold text-danger">-{formatPKR(r.amount)}</span>
            <span className="text-text-2">{r.reason}</span>
            <span className="text-text-2">{r.approvedBy}</span>
            <span className="tabular text-xs text-text-3">{r.time}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof RotateCcw; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <Icon className="h-8 w-8 text-text-4" strokeWidth={1.5} />
      <span className="text-[13px] text-text-3">{text}</span>
    </div>
  );
}
