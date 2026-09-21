"use client";

import { Star } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { useCustomers, useCustomerSegments, useLoyaltyTiers, useCustomerFeedback, type ApiCustomer } from "@/lib/queries";

const TIER_TONE: Record<string, BadgeTone> = { BRONZE: "neutral", SILVER: "info", GOLD: "primary" };
const TIER_LABEL: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold" };

const TABS = [
  { key: "all", label: "All Customers" },
  { key: "segments", label: "Segments" },
  { key: "loyalty", label: "Loyalty" },
  { key: "feedback", label: "Feedback" },
];

function relativeDate(iso: string | null) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay <= 0) return "Today";
  if (diffDay === 1) return "Yesterday";
  return `${diffDay} days ago`;
}

export default function CustomersPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Customers" description="Customer profiles, segments, loyalty and feedback" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "segments":
              return <SegmentsView />;
            case "loyalty":
              return <LoyaltyView />;
            case "feedback":
              return <FeedbackView />;
            default:
              return <AllCustomersView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function AllCustomersView() {
  const { data: customers, isLoading } = useCustomers();

  const columns: Column<ApiCustomer>[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "phone", header: "Phone", width: "150px", render: (r) => <span className="tabular text-text-2">{r.phone}</span> },
    { key: "orders", header: "Orders", width: "80px", align: "right", render: (r) => <span className="tabular text-text-2">{r.orderCount}</span> },
    { key: "totalSpent", header: "Total Spent", width: "120px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.totalSpent)}</span> },
    { key: "tier", header: "Tier", width: "90px", render: (r) => <Badge tone={TIER_TONE[r.tier]}>{TIER_LABEL[r.tier]}</Badge> },
    { key: "lastOrder", header: "Last Order", width: "140px", render: (r) => <span className="tabular text-xs text-text-3">{relativeDate(r.lastOrderAt)}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading customers…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={customers ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function SegmentsView() {
  const { data: segments, isLoading } = useCustomerSegments();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading segments…</div>;

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {(segments ?? []).map((s) => (
        <Card key={s.id} className="flex flex-col gap-2 p-4">
          <span className="text-sm font-semibold text-text-1">{s.name}</span>
          <p className="text-xs text-text-2">{s.description}</p>
        </Card>
      ))}
    </div>
  );
}

function LoyaltyView() {
  const { data: tiers, isLoading } = useLoyaltyTiers();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading loyalty tiers…</div>;

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {(tiers ?? []).map((t) => (
        <Card key={t.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-1">{t.name}</span>
            <span className="tabular text-xs text-text-3">{t.members} members</span>
          </div>
          <span className="tabular text-xs text-text-2">{t.minPoints.toLocaleString()}+ points</span>
          <p className="text-xs text-text-2">{t.perks}</p>
        </Card>
      ))}
    </div>
  );
}

function FeedbackView() {
  const { data: feedback, isLoading } = useCustomerFeedback();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading feedback…</div>;
  if (!feedback || feedback.length === 0) return <div className="p-6 text-sm text-text-2">No feedback yet.</div>;

  return (
    <div className="flex flex-col gap-3 p-6">
      {feedback.map((f) => (
        <Card key={f.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text-1">{f.customer?.name ?? "Anonymous"}</span>
            <span className="flex items-center gap-0.5 text-warning">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5" strokeWidth={0} fill={i < f.rating ? "currentColor" : "var(--border)"} />
              ))}
            </span>
          </div>
          <p className="text-[13px] text-text-2">&ldquo;{f.comment}&rdquo;</p>
          <span className="tabular text-[11px] text-text-3">{relativeDate(f.createdAt)}</span>
        </Card>
      ))}
    </div>
  );
}
