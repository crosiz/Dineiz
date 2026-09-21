"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  useAggregators,
  usePaymentGateways,
  useWebhooks,
  usePrinters,
  type ApiAggregator,
  type ApiPaymentGateway,
  type ApiWebhookConfig,
  type ApiPrinterDevice,
} from "@/lib/queries";

const TABS = [
  { key: "orders", label: "Order Integration" },
  { key: "aggregators", label: "Aggregators" },
  { key: "payments", label: "Payments" },
  { key: "webhooks", label: "Webhooks" },
  { key: "printers", label: "Printers" },
];

function relativeTime(iso: string | null) {
  if (!iso) return "Never";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr} hr ago`;
}

export default function IntegrationsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Integrations" description="Aggregators, payment gateways, webhooks and connected hardware" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "aggregators":
              return <AggregatorsView />;
            case "payments":
              return <PaymentsView />;
            case "webhooks":
              return <WebhooksView />;
            case "printers":
              return <PrintersView />;
            default:
              return <OrderIntegrationView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function OrderIntegrationView() {
  const { data: aggregators, isLoading: aggLoading } = useAggregators();
  const { data: webhooks, isLoading: webhooksLoading } = useWebhooks();

  if (aggLoading || webhooksLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const agg = aggregators ?? [];
  const hooks = webhooks ?? [];
  const connected = agg.filter((a) => a.isConnected);

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      <Card className="p-4">
        <span className="text-xs text-text-2">Connected Channels</span>
        <div className="tabular mt-1 text-xl font-bold text-text-1">{connected.length} / {agg.length}</div>
      </Card>
      <Card className="p-4">
        <span className="text-xs text-text-2">Orders Today (all channels)</span>
        <div className="tabular mt-1 text-xl font-bold text-text-1">{agg.reduce((s, a) => s + a.ordersToday, 0)}</div>
      </Card>
      <Card className="p-4">
        <span className="text-xs text-text-2">Active Webhooks</span>
        <div className="tabular mt-1 text-xl font-bold text-text-1">{hooks.filter((w) => w.isHealthy).length} / {hooks.length}</div>
      </Card>
    </div>
  );
}

function AggregatorsView() {
  const { data: aggregators, isLoading } = useAggregators();

  const columns: Column<ApiAggregator>[] = [
    { key: "name", header: "Aggregator", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "status", header: "Status", width: "130px", render: (r) => <Badge tone={r.isConnected ? "success" : "neutral"}>{r.isConnected ? "CONNECTED" : "DISCONNECTED"}</Badge> },
    { key: "ordersToday", header: "Orders Today", width: "120px", align: "right", render: (r) => <span className="tabular text-text-2">{r.ordersToday}</span> },
    { key: "commission", header: "Commission", width: "110px", align: "right", render: (r) => <span className="tabular text-text-2">{r.commissionLabel}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading aggregators…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={aggregators ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function PaymentsView() {
  const { data: gateways, isLoading } = usePaymentGateways();

  const columns: Column<ApiPaymentGateway>[] = [
    { key: "name", header: "Gateway", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "status", header: "Status", width: "110px", render: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "ACTIVE" : "INACTIVE"}</Badge> },
    { key: "fee", header: "Fee", width: "90px", align: "right", render: (r) => <span className="tabular text-text-2">{r.feeLabel}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading payment gateways…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={gateways ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function WebhooksView() {
  const { data: webhooks, isLoading } = useWebhooks();

  const columns: Column<ApiWebhookConfig>[] = [
    { key: "event", header: "Event", width: "160px", render: (r) => <span className="tabular font-medium text-text-1">{r.event}</span> },
    { key: "url", header: "Endpoint", render: (r) => <span className="tabular text-text-2">{r.url}</span> },
    { key: "status", header: "Status", width: "100px", render: (r) => <Badge tone={r.isHealthy ? "success" : "danger"}>{r.isHealthy ? "HEALTHY" : "FAILING"}</Badge> },
    { key: "lastTriggered", header: "Last Triggered", width: "130px", render: (r) => <span className="tabular text-xs text-text-3">{relativeTime(r.lastTriggeredAt)}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading webhooks…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={webhooks ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function PrintersView() {
  const { data: printers, isLoading } = usePrinters();

  const columns: Column<ApiPrinterDevice>[] = [
    { key: "name", header: "Device", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "type", header: "Type", width: "110px", render: (r) => <span className="text-text-2">{r.type}</span> },
    { key: "station", header: "Station", width: "140px", render: (r) => <span className="text-text-2">{r.station}</span> },
    { key: "status", header: "Status", width: "100px", render: (r) => <Badge tone={r.isOnline ? "success" : "neutral"}>{r.isOnline ? "ONLINE" : "OFFLINE"}</Badge> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading printers…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={printers ?? []} rowKey={(r) => r.id} />
    </div>
  );
}
