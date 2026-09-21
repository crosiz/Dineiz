"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { usePromos, useCoupons, useCampaigns, type ApiPromo, type ApiCoupon, type ApiCampaign } from "@/lib/queries";

const TABS = [
  { key: "promos", label: "Deals & Promos" },
  { key: "coupons", label: "Coupons" },
  { key: "campaigns", label: "Campaigns" },
];

export default function MarketingPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Marketing" description="Promotions, coupon codes and outbound campaigns" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "coupons":
              return <CouponsView />;
            case "campaigns":
              return <CampaignsView />;
            default:
              return <PromosView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function PromosView() {
  const { data: promos, isLoading } = usePromos();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading promos…</div>;

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {(promos ?? []).map((p: ApiPromo) => (
        <Card key={p.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text-1">{p.name}</span>
            <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Inactive"}</Badge>
          </div>
          <span className="tabular text-lg font-bold text-primary">{p.discountLabel} off</span>
          <span className="text-xs text-text-3">Valid till {p.validTill}</span>
        </Card>
      ))}
    </div>
  );
}

function CouponsView() {
  const { data: coupons, isLoading } = useCoupons();

  const columns: Column<ApiCoupon>[] = [
    { key: "code", header: "Code", width: "150px", render: (r) => <span className="tabular font-semibold text-text-1">{r.code}</span> },
    { key: "discount", header: "Discount", width: "120px", render: (r) => <span className="text-text-2">{r.discountLabel}</span> },
    {
      key: "usage",
      header: "Usage",
      width: "140px",
      render: (r) => (
        <span className="tabular text-text-2">
          {r.used} / {r.usageLimit}
        </span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      width: "130px",
      render: (r) => (
        <span className="tabular text-xs text-text-3">
          {!r.expiresAt ? "No expiry" : new Date(r.expiresAt).getTime() < Date.now() ? "Expired" : new Date(r.expiresAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading coupons…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={coupons ?? []} rowKey={(r) => r.code} />
    </div>
  );
}

function CampaignsView() {
  const { data: campaigns, isLoading } = useCampaigns();

  const columns: Column<ApiCampaign>[] = [
    { key: "name", header: "Campaign", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "channel", header: "Channel", width: "100px", render: (r) => <Badge tone="info">{r.channel}</Badge> },
    { key: "sent", header: "Sent", width: "90px", align: "right", render: (r) => <span className="tabular text-text-2">{r.sent.toLocaleString()}</span> },
    {
      key: "opened",
      header: "Open Rate",
      width: "110px",
      align: "right",
      render: (r) => <span className="tabular text-text-1">{r.sent > 0 ? Math.round((r.opened / r.sent) * 100) : 0}%</span>,
    },
    { key: "date", header: "Date", width: "120px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading campaigns…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={campaigns ?? []} rowKey={(r) => r.id} />
    </div>
  );
}
