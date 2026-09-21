"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { useExpenses, useExpenseCategories, usePettyCash, type ApiExpense, type ApiPettyCashEntry } from "@/lib/queries";

const TABS = [
  { key: "daily", label: "Daily Expenses" },
  { key: "categories", label: "Categories" },
  { key: "petty-cash", label: "Petty Cash" },
];

export default function ExpensesPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Expenses" description="Daily spending, budget categories and petty cash log" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "categories":
              return <CategoriesView />;
            case "petty-cash":
              return <PettyCashView />;
            default:
              return <DailyView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function DailyView() {
  const { data: expenses, isLoading } = useExpenses();

  const columns: Column<ApiExpense>[] = [
    { key: "description", header: "Description", render: (r) => <span className="font-medium text-text-1">{r.description}</span> },
    { key: "category", header: "Category", width: "130px", render: (r) => <Badge tone="neutral">{r.category?.name ?? "Uncategorized"}</Badge> },
    { key: "amount", header: "Amount", width: "110px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.amount)}</span> },
    { key: "paidBy", header: "Paid By", width: "120px", render: (r) => <span className="text-text-2">{r.paidBy?.name ?? "—"}</span> },
    { key: "date", header: "Date", width: "130px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading expenses…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={expenses ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function CategoriesView() {
  const { data: categories, isLoading } = useExpenseCategories();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading categories…</div>;

  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {(categories ?? []).map((c) => {
        const pct = c.monthlyBudget > 0 ? Math.round((c.spentThisMonth / c.monthlyBudget) * 100) : 0;
        return (
          <Card key={c.id} className="flex flex-col gap-2 p-4">
            <span className="text-[13px] font-semibold text-text-1">{c.name}</span>
            <span className="tabular text-lg font-bold text-text-1">{formatPKR(c.spentThisMonth)}</span>
            <span className="tabular text-xs text-text-3">of {formatPKR(c.monthlyBudget)} budget</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(pct, 100)}%`, background: pct > 90 ? "var(--danger)" : "var(--primary)" }}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PettyCashView() {
  const { data: entries, isLoading } = usePettyCash();

  const columns: Column<ApiPettyCashEntry>[] = [
    { key: "type", header: "Type", width: "70px", render: (r) => <Badge tone={r.type === "IN" ? "success" : "danger"}>{r.type}</Badge> },
    { key: "description", header: "Description", render: (r) => <span className="text-text-1">{r.description}</span> },
    {
      key: "amount",
      header: "Amount",
      width: "110px",
      align: "right",
      render: (r) => (
        <span className={r.type === "IN" ? "tabular font-semibold text-success" : "tabular font-semibold text-danger"}>
          {r.type === "IN" ? "+" : "-"}
          {formatPKR(r.amount)}
        </span>
      ),
    },
    { key: "balance", header: "Balance", width: "110px", align: "right", render: (r) => <span className="tabular text-text-1">{formatPKR(r.balanceAfter)}</span> },
    { key: "date", header: "Time", width: "130px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading petty cash…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={entries ?? []} rowKey={(r) => r.id} />
    </div>
  );
}
