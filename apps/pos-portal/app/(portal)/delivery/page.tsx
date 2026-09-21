"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { useActiveDeliveries, useDeliveryHistory, useRiders, useDeliveryZones, type ApiDelivery, type ApiRider } from "@/lib/queries";

const ACTIVE_TONE: Record<string, BadgeTone> = { ASSIGNED: "neutral", PICKED_UP: "warning", EN_ROUTE: "info" };
const RIDER_TONE: Record<string, BadgeTone> = { AVAILABLE: "success", ON_DELIVERY: "info", OFFLINE: "neutral" };

const TABS = [
  { key: "active", label: "Active" },
  { key: "riders", label: "Riders" },
  { key: "zones", label: "Zones" },
  { key: "history", label: "History" },
];

export default function DeliveryPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Delivery" description="Track riders, delivery zones and dispatch history" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "riders":
              return <RidersView />;
            case "zones":
              return <ZonesView />;
            case "history":
              return <HistoryView />;
            default:
              return <ActiveView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function ActiveView() {
  const { data: deliveries, isLoading } = useActiveDeliveries();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiDelivery>[] = [
    { key: "orderId", header: "Order", width: "90px", render: (r) => <span className="tabular font-semibold text-text-1">#{r.order.sequenceNo}</span> },
    { key: "customer", header: "Customer", width: "130px", render: (r) => <span className="text-text-2">{r.order.customerName ?? "—"}</span> },
    { key: "address", header: "Address", render: (r) => <span className="text-text-2">{r.address}</span> },
    { key: "rider", header: "Rider", width: "110px", render: (r) => <span className="text-text-1">{r.rider?.name ?? "Unassigned"}</span> },
    { key: "status", header: "Status", width: "110px", render: (r) => <Badge tone={ACTIVE_TONE[r.status]}>{r.status.replace("_", " ")}</Badge> },
    { key: "eta", header: "ETA", width: "80px", render: (r) => <span className="tabular text-text-1">{r.etaMinutes != null ? `${r.etaMinutes} min` : "—"}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={deliveries ?? []} rowKey={(r) => r.id} emptyText="No deliveries in progress" />
    </div>
  );
}

function RidersView() {
  const { data: riders, isLoading } = useRiders();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {(riders ?? []).map((r: ApiRider) => (
        <Card key={r.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text-1">{r.name}</span>
            <Badge tone={RIDER_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
          </div>
          <span className="tabular text-xs text-text-2">{r.phone}</span>
          <div className="flex items-center justify-between text-xs text-text-3">
            <span className="tabular">★ {r.rating}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ZonesView() {
  const { data: zones, isLoading } = useDeliveryZones();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {(zones ?? []).map((z) => (
        <Card key={z.id} className="flex flex-col gap-3 p-4">
          <span className="text-sm font-semibold text-text-1">{z.name}</span>
          <div className="flex items-center justify-between text-xs text-text-2">
            <span>Delivery fee</span>
            <span className="tabular font-semibold text-text-1">{formatPKR(z.fee)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-2">
            <span>Avg. delivery time</span>
            <span className="tabular text-text-1">{z.avgTimeMinutes} min</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function HistoryView() {
  const { data: deliveries, isLoading } = useDeliveryHistory();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiDelivery>[] = [
    { key: "orderId", header: "Order", width: "90px", render: (r) => <span className="tabular font-semibold text-text-1">#{r.order.sequenceNo}</span> },
    { key: "customer", header: "Customer", render: (r) => <span className="text-text-2">{r.order.customerName ?? "—"}</span> },
    { key: "rider", header: "Rider", width: "110px", render: (r) => <span className="text-text-2">{r.rider?.name ?? "—"}</span> },
    { key: "deliveredIn", header: "Delivered In", width: "110px", render: (r) => <span className="tabular text-text-2">{r.deliveredInMinutes != null ? `${r.deliveredInMinutes} min` : "—"}</span> },
    { key: "date", header: "Date", width: "150px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleString()}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={deliveries ?? []} rowKey={(r) => r.id} />
    </div>
  );
}
