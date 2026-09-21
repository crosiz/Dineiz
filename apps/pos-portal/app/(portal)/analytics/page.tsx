"use client";

import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatPKR, formatPKRCompact } from "@/lib/utils";
import { useSalesSummary, useTopItems, useStaffPerformance, type ApiTopItem, type ApiStaffPerformance } from "@/lib/queries";

const TABS = [
  { key: "sales", label: "Sales Dashboard" },
  { key: "reports", label: "Reports" },
  { key: "performance", label: "Performance" },
];

const REPORT_DEFS = [
  { name: "Daily Sales Summary", description: "Revenue, orders and tax breakdown by day" },
  { name: "Item Performance", description: "Best and worst selling items by revenue and quantity" },
  { name: "Staff Performance", description: "Orders handled and average order value per staff member" },
  { name: "Tax Summary", description: "Cash vs card tax collected, ready for filing" },
];

export default function AnalyticsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Analytics & Reports" description="Branch performance, generated reports and staff productivity" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "reports":
              return <ReportsView />;
            case "performance":
              return <PerformanceView />;
            default:
              return <SalesView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function SalesView() {
  const { data: summary, isLoading: summaryLoading } = useSalesSummary();
  const { data: topItems, isLoading: itemsLoading } = useTopItems();

  const columns: Column<ApiTopItem>[] = [
    { key: "name", header: "Item", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "unitsSold", header: "Units Sold", width: "110px", align: "right", render: (r) => <span className="tabular text-text-2">{r.unitsSold}</span> },
    { key: "revenue", header: "Revenue", width: "120px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.revenue)}</span> },
  ];

  if (summaryLoading || itemsLoading) return <div className="p-6 text-sm text-text-2">Loading analytics…</div>;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-xs text-text-2">Revenue (30d)</span>
          <div className="tabular mt-1 text-xl font-bold text-text-1">{formatPKRCompact(summary?.revenue30d ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-text-2">Orders (30d)</span>
          <div className="tabular mt-1 text-xl font-bold text-text-1">{(summary?.orders30d ?? 0).toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-text-2">Avg. Order Value</span>
          <div className="tabular mt-1 text-xl font-bold text-text-1">{formatPKR(summary?.avgOrderValue ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-text-2">Best Day</span>
          <div className="mt-1 text-xl font-bold text-text-1">{summary?.topDay ?? "N/A"}</div>
        </Card>
      </div>
      {topItems && topItems.length > 0 ? (
        <SimpleTable columns={columns} rows={topItems} rowKey={(r) => r.name} />
      ) : (
        <div className="text-sm text-text-2">No completed orders in the last 30 days yet.</div>
      )}
    </div>
  );
}

function ReportsView() {
  return (
    <div className="flex flex-col gap-3 p-6">
      {REPORT_DEFS.map((r) => (
        <Card key={r.name} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-panel">
              <FileText className="h-4 w-4 text-text-3" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-text-1">{r.name}</div>
              <div className="text-xs text-text-2">{r.description}</div>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled title="Report generation isn't available yet">
            Generate
          </Button>
        </Card>
      ))}
    </div>
  );
}

function PerformanceView() {
  const { data: performance, isLoading } = useStaffPerformance();

  const columns: Column<ApiStaffPerformance>[] = [
    { key: "staff", header: "Staff", render: (r) => <span className="font-medium text-text-1">{r.staff}</span> },
    { key: "orders", header: "Orders Handled", width: "140px", align: "right", render: (r) => <span className="tabular text-text-2">{r.ordersHandled}</span> },
    { key: "aov", header: "Avg. Order Value", width: "150px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.avgOrderValue)}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading performance…</div>;
  if (!performance || performance.length === 0) return <div className="p-6 text-sm text-text-2">No completed orders handled yet.</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={performance} rowKey={(r) => r.staff} />
    </div>
  );
}
