"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Badge } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { useSuppliers, useSupplierBalances, useSupplierPayments, type ApiSupplier, type ApiSupplierBalance, type ApiSupplierPayment } from "@/lib/queries";

const TABS = [
  { key: "suppliers", label: "Suppliers" },
  { key: "balances", label: "Balances" },
  { key: "payments", label: "Payments" },
];

export default function WarehousePage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Warehouse" description="Suppliers, outstanding balances and payment history" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "balances":
              return <BalancesView />;
            case "payments":
              return <PaymentsView />;
            default:
              return <SuppliersView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function SuppliersView() {
  const { data: suppliers, isLoading } = useSuppliers();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading suppliers…</div>;

  const columns: Column<ApiSupplier>[] = [
    { key: "name", header: "Supplier", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "category", header: "Category", render: (r) => <span className="text-text-2">{r.category}</span> },
    { key: "contact", header: "Contact", width: "160px", render: (r) => <span className="tabular text-text-2">{r.contact}</span> },
    { key: "leadTime", header: "Lead Time", width: "110px", render: (r) => <span className="text-text-3">{r.leadTime}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={suppliers ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function BalancesView() {
  const { data: balances, isLoading } = useSupplierBalances();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiSupplierBalance>[] = [
    { key: "supplier", header: "Supplier", render: (r) => <span className="font-medium text-text-1">{r.supplier.name}</span> },
    {
      key: "outstanding",
      header: "Outstanding",
      width: "130px",
      align: "right",
      render: (r) => (
        <span className={r.outstanding > 0 ? "tabular font-semibold text-danger" : "tabular text-success"}>
          {r.outstanding > 0 ? formatPKR(r.outstanding) : "Settled"}
        </span>
      ),
    },
    { key: "terms", header: "Terms", width: "100px", render: (r) => <Badge tone="neutral">{r.terms}</Badge> },
    { key: "lastPayment", header: "Last Payment", width: "130px", render: (r) => <span className="tabular text-xs text-text-3">{r.lastPaymentAt ? new Date(r.lastPaymentAt).toLocaleDateString() : "—"}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={balances ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function PaymentsView() {
  const { data: payments, isLoading } = useSupplierPayments();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiSupplierPayment>[] = [
    { key: "id", header: "Ref", width: "110px", render: (r) => <span className="tabular font-semibold text-text-1">{r.id.slice(-6)}</span> },
    { key: "supplier", header: "Supplier", render: (r) => <span className="text-text-2">{r.supplier.name}</span> },
    { key: "amount", header: "Amount", width: "120px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.amount)}</span> },
    { key: "method", header: "Method", width: "130px", render: (r) => <span className="text-text-2">{r.method}</span> },
    { key: "date", header: "Date", width: "120px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={payments ?? []} rowKey={(r) => r.id} />
    </div>
  );
}
