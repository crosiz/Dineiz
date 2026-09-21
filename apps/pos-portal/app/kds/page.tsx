"use client";

import Link from "next/link";
import { ShoppingBag, Truck, Utensils, X } from "lucide-react";
import { DineizLogo } from "@/components/ui/DineizLogo";
import { cn } from "@/lib/utils";
import { useLiveOrders, useUpdateOrderStatus, type ApiOrder } from "@/lib/queries";

const TYPE_ICON: Record<ApiOrder["type"], typeof Utensils> = { DINE_IN: Utensils, TAKEAWAY: ShoppingBag, DELIVERY: Truck };
const TYPE_LABEL: Record<ApiOrder["type"], string> = { DINE_IN: "Dine-In", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

type Tone = "info" | "warning" | "success";
const NEXT_STATUS: Record<"PENDING" | "IN_KITCHEN" | "READY", "IN_KITCHEN" | "READY" | "COMPLETED"> = {
  PENDING: "IN_KITCHEN",
  IN_KITCHEN: "READY",
  READY: "COMPLETED",
};

export default function KitchenDisplayPage() {
  const { data: orders } = useLiveOrders();
  const updateStatus = useUpdateOrderStatus();

  const newOrders = (orders ?? []).filter((o) => o.status === "PENDING" && !o.heldAt);
  const preparing = (orders ?? []).filter((o) => o.status === "IN_KITCHEN");
  const ready = (orders ?? []).filter((o) => o.status === "READY");

  function advance(order: ApiOrder) {
    const status = NEXT_STATUS[order.status as "PENDING" | "IN_KITCHEN" | "READY"];
    updateStatus.mutate({ orderId: order.id, status });
  }

  return (
    <div className="flex h-screen flex-col bg-panel">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg px-5">
        <div className="flex items-center gap-2.5">
          <DineizLogo size="sm" markOnly />
          <span className="text-sm font-bold text-text-1">Kitchen Display</span>
          <span className="tabular text-xs text-text-3">Kababjees · Clifton</span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text-2 transition-colors hover:bg-hover"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          Exit
        </Link>
      </header>

      <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden p-4">
        <Column title="New" tone="info" orders={newOrders} actionLabel="Start Preparing" onAction={advance} />
        <Column title="Preparing" tone="warning" orders={preparing} actionLabel="Mark Ready" onAction={advance} />
        <Column title="Ready" tone="success" orders={ready} actionLabel="Complete" onAction={advance} />
      </div>
    </div>
  );
}

function Column({
  title,
  tone,
  orders,
  actionLabel,
  onAction,
}: {
  title: string;
  tone: Tone;
  orders: ApiOrder[];
  actionLabel: string;
  onAction: (order: ApiOrder) => void;
}) {
  const toneColor = { info: "var(--info)", warning: "var(--warning)", success: "var(--success)" }[tone];
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-border bg-bg">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2 w-2 rounded-full" style={{ background: toneColor }} />
        <span className="text-sm font-bold text-text-1">{title}</span>
        <span className="tabular ml-auto rounded-full bg-panel px-2 py-0.5 text-xs font-semibold text-text-2">{orders.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {orders.map((order) => (
          <Ticket key={order.id} order={order} tone={tone} actionLabel={actionLabel} onAction={onAction} />
        ))}
        {orders.length === 0 && <div className="py-10 text-center text-xs text-text-3">No tickets</div>}
      </div>
    </div>
  );
}

function Ticket({
  order,
  tone,
  actionLabel,
  onAction,
}: {
  order: ApiOrder;
  tone: Tone;
  actionLabel: string;
  onAction: (order: ApiOrder) => void;
}) {
  const Icon = TYPE_ICON[order.type];
  const elapsedMin = Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60_000));
  const aging = elapsedMin >= 10 ? "danger" : elapsedMin >= 5 ? "warning" : "success";
  const agingColor = { danger: "var(--danger)", warning: "var(--warning)", success: "var(--text-3)" }[aging];
  const buttonBg = { info: "var(--info)", warning: "var(--warning)", success: "var(--success)" }[tone];

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
          <span className="tabular text-sm font-bold text-text-1">#{order.sequenceNo}</span>
        </span>
        <span className="tabular text-xs font-semibold" style={{ color: agingColor }}>
          {elapsedMin} min
        </span>
      </div>
      <span className="text-xs text-text-2">
        {TYPE_LABEL[order.type]}
        {order.table ? ` · ${order.table.label}` : order.customerName ? ` · ${order.customerName}` : ""}
      </span>
      <ul className="flex flex-col gap-1 border-t border-border pt-2">
        {order.items.map((line) => (
          <li key={line.id} className="text-[13px] text-text-1">
            <span className="tabular font-semibold">{line.qty}×</span> {line.nameSnapshot}
            {line.notes && <span className="block pl-4 text-[11px] italic text-warning">{line.notes}</span>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onAction(order)}
        className={cn("h-9 rounded-md text-[13px] font-semibold text-white transition-opacity hover:opacity-90")}
        style={{ background: buttonBg }}
      >
        {actionLabel}
      </button>
    </div>
  );
}
