"use client";

import Link from "next/link";
import { ClipboardCheck, Grid2x2, Plus, Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Badge, Dot } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { STATUS_TONE, STATUS_LABEL } from "@/lib/order-status";
import { useCurrentShift, useLiveOrders, useOrderHistory, useTableSections, useCurrentBranch, useStockItems, type ApiOrder, type ApiStockItem } from "@/lib/queries";

const TYPE_LABEL: Record<ApiOrder["type"], string> = { DINE_IN: "Dine-In", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

// Same OK/LOW/OUT boundary as the Inventory page's stockStatus() — anything
// under threshold (including at/below zero) counts as an alert here.
function isLowStock(item: ApiStockItem) {
  return item.onHand < item.threshold;
}

export default function DashboardPage() {
  const { data: branch } = useCurrentBranch();
  const { data: shift } = useCurrentShift();
  const { data: liveOrders } = useLiveOrders();
  const { data: history } = useOrderHistory();
  const { data: sections } = useTableSections();
  const { data: stockItems } = useStockItems();
  const lowStock = (stockItems ?? []).filter(isLowStock).slice(0, 5);

  const recentOrders = [...(liveOrders ?? []), ...(history ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const tables = sections?.flatMap((s) => s.tables) ?? [];
  const occupied = tables.filter((t) => t.status === "OCCUPIED").length;
  const reserved = tables.filter((t) => t.status === "RESERVED").length;
  const free = tables.filter((t) => t.status === "FREE").length;

  const salesSoFar = shift?.salesSoFar ?? 0;
  const ordersSoFar = shift?.ordersSoFar ?? 0;
  const avgOrderValue = ordersSoFar > 0 ? Math.round(salesSoFar / ordersSoFar) : 0;

  const kpis = [
    { label: "Sales This Shift", value: formatPKR(salesSoFar), icon: Wallet },
    { label: "Orders Served", value: String(ordersSoFar), icon: ClipboardCheck },
    { label: "Avg Order Value", value: formatPKR(avgOrderValue), icon: Receipt },
    { label: "Active Tables", value: `${occupied} / ${tables.length}`, icon: Grid2x2 },
  ];

  return (
    <div className="flex flex-col pb-10">
      <PageHeader
        title="Dashboard"
        description={branch ? `${branch.name} — ${branch.code}` : "Loading branch…"}
        actions={
          <Link
            href="/orders/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Create New Order
          </Link>
        }
      />

      <div className="grid grid-cols-4 gap-4 px-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[1fr_320px] gap-4 px-6">
        <Card className="p-4">
          <SectionTitle
            action={
              <Link href="/orders" className="text-xs font-semibold text-primary">
                View all
              </Link>
            }
          >
            Recent Orders
          </SectionTitle>
          <div className="flex flex-col">
            <div className="grid grid-cols-[80px_90px_1fr_70px_100px_100px] gap-2 border-b border-border px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">
              <span>Order</span>
              <span>Type</span>
              <span>Table</span>
              <span className="text-right">Items</span>
              <span className="text-right">Total</span>
              <span>Status</span>
            </div>
            {recentOrders.map((order) => {
              const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
              const total = order.payment?.total ?? order.items.reduce((s, i) => s + i.priceSnapshot * i.qty, 0);
              return (
                <div
                  key={order.id}
                  className="grid grid-cols-[80px_90px_1fr_70px_100px_100px] items-center gap-2 border-b border-border px-2 py-2.5 text-[13px] last:border-0"
                >
                  <span className="tabular font-semibold text-text-1">#{order.sequenceNo}</span>
                  <span className="text-text-2">{TYPE_LABEL[order.type]}</span>
                  <span className="text-text-2">{order.table?.label ?? "—"}</span>
                  <span className="tabular text-right text-text-2">{itemCount}</span>
                  <span className="tabular text-right font-semibold text-text-1">{formatPKR(total)}</span>
                  <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                </div>
              );
            })}
            {recentOrders.length === 0 && <div className="py-8 text-center text-xs text-text-3">No orders yet</div>}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <SectionTitle>Table Status</SectionTitle>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dot tone="danger" />
                  <span className="text-[13px] text-text-2">Occupied</span>
                </div>
                <span className="tabular text-[13px] font-semibold text-text-1">{occupied}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dot tone="purple" />
                  <span className="text-[13px] text-text-2">Reserved</span>
                </div>
                <span className="tabular text-[13px] font-semibold text-text-1">{reserved}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dot tone="success" />
                  <span className="text-[13px] text-text-2">Free</span>
                </div>
                <span className="tabular text-[13px] font-semibold text-text-1">{free}</span>
              </div>
            </div>
            <Link href="/tables" className="mt-3 block text-center text-xs font-semibold text-primary">
              Open Table Map
            </Link>
          </Card>

          <Card className="p-4">
            <SectionTitle>Low Stock Alerts</SectionTitle>
            <div className="flex flex-col gap-3">
              {lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-[13px] text-text-2">{item.name}</span>
                  <span className="tabular text-xs font-semibold text-warning">
                    {item.onHand} {item.unit}
                  </span>
                </div>
              ))}
              {lowStock.length === 0 && <div className="py-2 text-center text-xs text-text-3">Nothing low right now</div>}
            </div>
            <Link href="/inventory" className="mt-3 block text-center text-xs font-semibold text-primary">
              View Inventory
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
