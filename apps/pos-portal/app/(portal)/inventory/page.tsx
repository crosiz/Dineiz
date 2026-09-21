"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import {
  useStockItems,
  useIngredients,
  useRecipes,
  usePurchaseOrders,
  useGoodsReceipts,
  useWastage,
  useStockChecks,
  useStockMovements,
  type ApiStockItem,
  type ApiIngredient,
  type ApiPurchaseOrder,
  type ApiGoodsReceipt,
  type ApiWastageEntry,
  type ApiStockCheck,
  type ApiStockMovement,
} from "@/lib/queries";

function stockStatus(item: ApiStockItem): "OK" | "LOW" | "OUT" {
  if (item.onHand <= 0) return "OUT";
  if (item.onHand < item.threshold) return "LOW";
  return "OK";
}

const STOCK_TONE: Record<string, BadgeTone> = { OK: "success", LOW: "warning", OUT: "danger" };
const PO_TONE: Record<string, BadgeTone> = { DRAFT: "neutral", SENT: "info", RECEIVED: "success" };
const GRN_TONE: Record<string, BadgeTone> = { COMPLETE: "success", PARTIAL: "warning" };
const SC_TONE: Record<string, BadgeTone> = { COMPLETE: "success", IN_PROGRESS: "info" };

const TABS = [
  { key: "stock", label: "Stock" },
  { key: "ingredients", label: "Ingredients" },
  { key: "recipes", label: "Recipes" },
  { key: "purchase-orders", label: "Purchase Orders" },
  { key: "goods-receipt", label: "Goods Receipt" },
  { key: "wastage", label: "Wastage" },
  { key: "stock-check", label: "Stock Check" },
  { key: "movements", label: "Movements" },
];

export default function InventoryPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Inventory" description="Stock levels, recipes and the purchasing pipeline" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "ingredients":
              return <IngredientsView />;
            case "recipes":
              return <RecipesView />;
            case "purchase-orders":
              return <PurchaseOrdersView />;
            case "goods-receipt":
              return <GoodsReceiptView />;
            case "wastage":
              return <WastageView />;
            case "stock-check":
              return <StockCheckView />;
            case "movements":
              return <MovementsView />;
            default:
              return <StockView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function StockView() {
  const { data: items, isLoading } = useStockItems();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading stock…</div>;

  const columns: Column<ApiStockItem>[] = [
    { key: "name", header: "Item", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "unit", header: "Unit", width: "80px", render: (r) => <span className="text-text-2">{r.unit}</span> },
    { key: "onHand", header: "On Hand", width: "100px", align: "right", render: (r) => <span className="tabular text-text-1">{r.onHand}</span> },
    { key: "threshold", header: "Threshold", width: "100px", align: "right", render: (r) => <span className="tabular text-text-3">{r.threshold}</span> },
    { key: "status", header: "Status", width: "100px", render: (r) => <Badge tone={STOCK_TONE[stockStatus(r)]}>{stockStatus(r)}</Badge> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={items ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function IngredientsView() {
  const { data: ingredients, isLoading } = useIngredients();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading ingredients…</div>;

  const columns: Column<ApiIngredient>[] = [
    { key: "name", header: "Ingredient", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "unit", header: "Unit", width: "80px", render: (r) => <span className="text-text-2">{r.unit}</span> },
    { key: "cost", header: "Cost / Unit", width: "120px", align: "right", render: (r) => <span className="tabular text-text-1">{formatPKR(r.costPerUnit)}</span> },
    { key: "supplier", header: "Supplier", width: "180px", render: (r) => <span className="text-text-2">{r.supplier?.name ?? "—"}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={ingredients ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function RecipesView() {
  const { data: recipes, isLoading } = useRecipes();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading recipes…</div>;

  return (
    <div className="flex flex-col gap-4 p-6">
      {(recipes ?? []).map((recipe) => (
        <Card key={recipe.id} className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text-1">{recipe.menuItem.name}</span>
            <span className="text-xs text-text-3">{recipe.yieldQty}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recipe.lines.map((line) => (
              <span key={line.id} className="tabular rounded border border-border px-2 py-1 text-[11px] text-text-2">
                {line.ingredient.name} · {line.qty} {line.unit}
              </span>
            ))}
          </div>
        </Card>
      ))}
      {recipes && recipes.length === 0 && <div className="py-8 text-center text-xs text-text-3">No recipes defined yet</div>}
    </div>
  );
}

function PurchaseOrdersView() {
  const { data: orders, isLoading } = usePurchaseOrders();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading purchase orders…</div>;

  const columns: Column<ApiPurchaseOrder>[] = [
    { key: "id", header: "PO #", width: "100px", render: (r) => <span className="tabular font-semibold text-text-1">{r.id.slice(-6)}</span> },
    { key: "supplier", header: "Supplier", render: (r) => <span className="text-text-2">{r.supplier.name}</span> },
    { key: "items", header: "Items", width: "70px", align: "right", render: (r) => <span className="tabular text-text-2">{r.lines.length}</span> },
    { key: "total", header: "Total", width: "110px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.total)}</span> },
    { key: "status", header: "Status", width: "100px", render: (r) => <Badge tone={PO_TONE[r.status]}>{r.status}</Badge> },
    { key: "date", header: "Date", width: "120px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={orders ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function GoodsReceiptView() {
  const { data: receipts, isLoading } = useGoodsReceipts();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiGoodsReceipt>[] = [
    { key: "id", header: "GRN #", width: "110px", render: (r) => <span className="tabular font-semibold text-text-1">{r.id.slice(-6)}</span> },
    { key: "poRef", header: "PO Ref", width: "110px", render: (r) => <span className="tabular text-text-2">{r.purchaseOrder.id.slice(-6)}</span> },
    { key: "receivedBy", header: "Received By", render: (r) => <span className="text-text-2">{r.receivedBy.name}</span> },
    { key: "date", header: "Date", width: "120px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: "status", header: "Status", width: "100px", render: (r) => <Badge tone={GRN_TONE[r.status]}>{r.status}</Badge> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={receipts ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function WastageView() {
  const { data: entries, isLoading } = useWastage();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiWastageEntry>[] = [
    { key: "item", header: "Item", render: (r) => <span className="font-medium text-text-1">{r.itemName}</span> },
    { key: "qty", header: "Qty", width: "100px", render: (r) => <span className="tabular text-text-2">{r.qtyLabel}</span> },
    { key: "reason", header: "Reason", render: (r) => <span className="text-text-2">{r.reason}</span> },
    { key: "cost", header: "Cost", width: "100px", align: "right", render: (r) => <span className="tabular font-semibold text-danger">-{formatPKR(r.cost)}</span> },
    { key: "date", header: "Date", width: "120px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];
  const total = (entries ?? []).reduce((s, w) => s + w.cost, 0);
  return (
    <div className="p-6">
      <SectionTitle>Total wastage this week: {formatPKR(total)}</SectionTitle>
      <SimpleTable columns={columns} rows={entries ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function StockCheckView() {
  const { data: checks, isLoading } = useStockChecks();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiStockCheck>[] = [
    { key: "id", header: "Session", width: "110px", render: (r) => <span className="tabular font-semibold text-text-1">{r.id.slice(-6)}</span> },
    { key: "date", header: "Date", width: "120px", render: (r) => <span className="tabular text-text-2">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: "conductedBy", header: "Conducted By", render: (r) => <span className="text-text-2">{r.conductedBy.name}</span> },
    { key: "discrepancies", header: "Discrepancies", width: "130px", align: "right", render: (r) => <span className="tabular text-text-1">{r.discrepancies}</span> },
    { key: "status", header: "Status", width: "120px", render: (r) => <Badge tone={SC_TONE[r.status]}>{r.status.replace("_", " ")}</Badge> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={checks ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function MovementsView() {
  const { data: movements, isLoading } = useStockMovements();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiStockMovement>[] = [
    { key: "item", header: "Item", render: (r) => <span className="font-medium text-text-1">{r.itemName}</span> },
    { key: "type", header: "Type", width: "70px", render: (r) => <Badge tone={r.type === "IN" ? "success" : "danger"}>{r.type}</Badge> },
    { key: "qty", header: "Qty", width: "90px", render: (r) => <span className="tabular text-text-2">{r.qtyLabel}</span> },
    { key: "reason", header: "Reason", render: (r) => <span className="text-text-2">{r.reason}</span> },
    { key: "date", header: "Date", width: "120px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={movements ?? []} rowKey={(r) => r.id} />
    </div>
  );
}
