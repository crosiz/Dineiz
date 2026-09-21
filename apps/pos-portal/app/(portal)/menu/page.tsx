"use client";

import { Pencil, Plus, Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatPKR } from "@/lib/utils";
import {
  useMenuCategories,
  useMenuItems,
  useVariationGroups,
  useAddOnGroups,
  useDeals,
  useSetItemAvailability,
} from "@/lib/queries";

const TABS = [
  { key: "categories", label: "Categories" },
  { key: "items", label: "Items" },
  { key: "variations", label: "Variations & Add-ons" },
  { key: "deals", label: "Deals & Combos" },
  { key: "availability", label: "Availability" },
];

export default function MenuManagementPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Menu Management"
        description="Categories, items, pricing and availability for this branch"
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add Item
          </Button>
        }
      />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "items":
              return <ItemsView />;
            case "variations":
              return <VariationsView />;
            case "deals":
              return <DealsView />;
            case "availability":
              return <AvailabilityView />;
            default:
              return <CategoriesView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function CategoriesView() {
  const { data: categories, isLoading } = useMenuCategories();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading categories…</div>;
  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {(categories ?? []).map((cat) => (
        <Card key={cat.id} className="flex flex-col gap-2 p-4">
          <span className="text-sm font-semibold text-text-1">{cat.label}</span>
          <span className="tabular text-xs text-text-3">{cat._count.items} items</span>
        </Card>
      ))}
    </div>
  );
}

function ItemsView() {
  const { data: items, isLoading } = useMenuItems();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading items…</div>;
  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_110px_100px_70px] items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <span>Item</span>
          <span>Category</span>
          <span className="text-right">Price</span>
          <span>Tag</span>
          <span></span>
        </div>
        {(items ?? []).map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_160px_110px_100px_70px] items-center gap-2 border-b border-border px-4 py-2.5 text-[13px] last:border-0"
          >
            <span className="font-medium text-text-1">{item.name}</span>
            <span className="text-text-2">{item.category?.label}</span>
            <span className="tabular text-right font-semibold text-text-1">{formatPKR(item.price)}</span>
            <span>{item.popular && <Badge tone="primary">Popular</Badge>}</span>
            <div className="flex justify-end">
              <button className="flex h-7 w-7 items-center justify-center rounded text-text-3 hover:bg-hover hover:text-text-1" aria-label="Edit">
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function VariationsView() {
  const { data: variationGroups } = useVariationGroups();
  const { data: addOnGroups } = useAddOnGroups();
  return (
    <div className="grid grid-cols-2 gap-4 p-6">
      <div>
        <SectionTitle>Variation Groups</SectionTitle>
        <div className="flex flex-col gap-3">
          {(variationGroups ?? []).map((group) => (
            <Card key={group.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-text-1">{group.name}</span>
                <span className="text-[11px] text-text-3">{group.appliesTo}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => (
                  <span key={opt.id} className="tabular rounded border border-border px-2 py-1 text-[11px] text-text-2">
                    {opt.label} {opt.priceDelta === 0 ? "" : opt.priceDelta > 0 ? `+${formatPKR(opt.priceDelta)}` : `-${formatPKR(Math.abs(opt.priceDelta))}`}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Add-on Groups</SectionTitle>
        <div className="flex flex-col gap-3">
          {(addOnGroups ?? []).map((group) => (
            <Card key={group.id} className="flex flex-col gap-2 p-4">
              <span className="text-[13px] font-semibold text-text-1">{group.name}</span>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => (
                  <span key={opt.id} className="tabular rounded border border-border px-2 py-1 text-[11px] text-text-2">
                    {opt.label} +{formatPKR(opt.price)}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function DealsView() {
  const { data: deals, isLoading } = useDeals();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading deals…</div>;
  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {(deals ?? []).map((deal) => (
        <Card key={deal.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-1">
              <Tag className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              {deal.name}
            </span>
            <Badge tone={deal.active ? "success" : "neutral"}>{deal.active ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="text-xs text-text-2">{deal.description}</p>
          <div className="flex items-baseline gap-2">
            <span className="tabular text-lg font-bold text-text-1">{formatPKR(deal.price)}</span>
            <span className="tabular text-xs text-text-3 line-through">{formatPKR(deal.originalPrice)}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function AvailabilityView() {
  const { data: items, isLoading } = useMenuItems();
  const setAvailability = useSetItemAvailability();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_120px] items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <span>Item</span>
          <span>Category</span>
          <span>Availability</span>
        </div>
        {(items ?? []).map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_160px_120px] items-center gap-2 border-b border-border px-4 py-2.5 text-[13px] last:border-0"
          >
            <span className="font-medium text-text-1">{item.name}</span>
            <span className="text-text-2">{item.category?.label}</span>
            <button
              type="button"
              disabled={setAvailability.isPending}
              onClick={() => setAvailability.mutate({ id: item.id, available: !item.available })}
            >
              <Badge tone={item.available ? "success" : "danger"}>{item.available ? "In Stock" : "86'd"}</Badge>
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
