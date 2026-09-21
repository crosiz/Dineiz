"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { useCurrentShift, useShiftHistory, type ApiShift } from "@/lib/queries";
import { SCHEDULE, type ScheduleEntry } from "@/mocks/shifts";

const TABS = [
  { key: "current", label: "Current Shift" },
  { key: "schedule", label: "Schedule" },
  { key: "history", label: "History" },
  { key: "reconciliation", label: "Cash Reconciliation" },
];

export default function ShiftManagementPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Shift Management" description="Shift status, staff schedule and cash reconciliation" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "schedule":
              return <ScheduleView />;
            case "history":
              return <HistoryView />;
            case "reconciliation":
              return <ReconciliationView />;
            default:
              return <CurrentShiftView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function CurrentShiftView() {
  const { data: shift, isLoading } = useCurrentShift();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading shift…</div>;

  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <span className="text-sm text-text-2">No shift is currently open for this branch.</span>
        <Link
          href="/shifts/open"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Open Shift
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-xs text-text-2">Opened By</span>
          <div className="mt-1 text-sm font-semibold text-text-1">{shift.openedBy.name}</div>
          <div className="tabular text-xs text-text-3">at {new Date(shift.openedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-text-2">Opening Float</span>
          <div className="tabular mt-1 text-lg font-bold text-text-1">{formatPKR(shift.openingFloat)}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-text-2">Orders So Far</span>
          <div className="tabular mt-1 text-lg font-bold text-text-1">{shift.ordersSoFar ?? 0}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-text-2">Sales So Far</span>
          <div className="tabular mt-1 text-lg font-bold text-text-1">{formatPKR(shift.salesSoFar ?? 0)}</div>
        </Card>
      </div>
      <Card className="flex items-center justify-between p-4">
        <div>
          <span className="text-[13px] font-semibold text-text-1">{shift.staffOnShift ?? 0} staff on shift</span>
          <p className="text-xs text-text-3">Shift is open — close it from here when the branch stops taking orders</p>
        </div>
        <Link
          href="/shifts/close"
          className="inline-flex h-10 items-center rounded-md bg-danger px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Close Shift
        </Link>
      </Card>
    </div>
  );
}

function ScheduleView() {
  const columns: Column<ScheduleEntry>[] = [
    { key: "staff", header: "Staff", render: (r) => <span className="font-medium text-text-1">{r.staff}</span> },
    { key: "role", header: "Role", width: "150px", render: (r) => <span className="text-text-2">{r.role}</span> },
    { key: "start", header: "Start", width: "100px", render: (r) => <span className="tabular text-text-2">{r.start}</span> },
    { key: "end", header: "End", width: "100px", render: (r) => <span className="tabular text-text-2">{r.end}</span> },
    { key: "day", header: "Day", width: "90px", render: (r) => <span className="text-text-3">{r.day}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={SCHEDULE} rowKey={(r) => r.staff + r.start} />
    </div>
  );
}

function HistoryView() {
  const { data: shifts, isLoading } = useShiftHistory();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading history…</div>;

  const columns: Column<ApiShift>[] = [
    { key: "id", header: "Shift", width: "100px", render: (r) => <span className="tabular font-semibold text-text-1">{r.id.slice(-6)}</span> },
    { key: "staff", header: "Staff", render: (r) => <span className="text-text-2">{r.openedBy.name}</span> },
    {
      key: "duration",
      header: "Duration",
      width: "100px",
      render: (r) => <span className="tabular text-text-2">{formatDuration(r.openedAt, r.closedAt)}</span>,
    },
    { key: "sales", header: "Sales", width: "110px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.expectedCash ?? 0)}</span> },
    {
      key: "variance",
      header: "Variance",
      width: "100px",
      align: "right",
      render: (r) => (
        <span className={!r.variance ? "tabular text-text-3" : r.variance < 0 ? "tabular text-danger" : "tabular text-success"}>
          {!r.variance ? "—" : `${r.variance > 0 ? "+" : ""}${formatPKR(r.variance)}`}
        </span>
      ),
    },
    { key: "date", header: "Date", width: "110px", render: (r) => <span className="tabular text-xs text-text-3">{r.closedAt ? new Date(r.closedAt).toLocaleDateString() : "—"}</span> },
  ];
  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={shifts ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

const RECON_TONE: Record<string, BadgeTone> = { MATCHED: "success", SHORT: "danger", OVER: "warning" };

function ReconciliationView() {
  const { data: shifts, isLoading } = useShiftHistory();
  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;

  const columns: Column<ApiShift>[] = [
    { key: "shiftId", header: "Shift", width: "100px", render: (r) => <span className="tabular font-semibold text-text-1">{r.id.slice(-6)}</span> },
    { key: "expected", header: "Expected", width: "120px", align: "right", render: (r) => <span className="tabular text-text-2">{formatPKR(r.expectedCash ?? 0)}</span> },
    { key: "counted", header: "Counted", width: "120px", align: "right", render: (r) => <span className="tabular text-text-2">{formatPKR(r.countedCash ?? 0)}</span> },
    {
      key: "variance",
      header: "Variance",
      width: "100px",
      align: "right",
      render: (r) => (
        <span className={!r.variance ? "tabular text-text-3" : "tabular font-semibold"} style={{ color: !r.variance ? undefined : r.variance < 0 ? "var(--danger)" : "var(--warning)" }}>
          {!r.variance ? "—" : `${r.variance > 0 ? "+" : ""}${formatPKR(r.variance)}`}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (r) => {
        const status = !r.variance ? "MATCHED" : r.variance < 0 ? "SHORT" : "OVER";
        return <Badge tone={RECON_TONE[status]}>{status}</Badge>;
      },
    },
  ];
  return (
    <div className="p-6">
      <SectionTitle>Recent shift close-outs</SectionTitle>
      <SimpleTable columns={columns} rows={shifts ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function formatDuration(openedAt: string, closedAt: string | null) {
  if (!closedAt) return "—";
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  const hrs = Math.floor(ms / 3_600_000);
  const mins = Math.round((ms % 3_600_000) / 60_000);
  return `${hrs}h ${mins}m`;
}
