"use client";

import Link from "next/link";
import { CalendarClock, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { useTableSections, useReservations, type ApiTable } from "@/lib/queries";
import { SECTIONS, SESSIONS, WAITERS } from "@/mocks/dine-in";

const STATUS_TONE: Record<ApiTable["status"], BadgeTone> = {
  FREE: "success",
  OCCUPIED: "danger",
  RESERVED: "purple",
};

const TABS = [
  { key: "tables", label: "Tables" },
  { key: "sections", label: "Sections & Floor Plan" },
  { key: "sessions", label: "Sessions" },
  { key: "waiters", label: "Waiters" },
  { key: "reservations", label: "Reservations" },
];

export default function DineInPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Dine-In" description="Kababjees · Clifton floor plan" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "sections":
              return <SectionsView />;
            case "sessions":
              return <SessionsView />;
            case "waiters":
              return <WaitersView />;
            case "reservations":
              return <ReservationsView />;
            default:
              return <TablesView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function TablesView() {
  const { data: sections, isLoading } = useTableSections();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading tables…</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      {(sections ?? []).map((section) => (
        <div key={section.id}>
          <SectionTitle>{section.name}</SectionTitle>
          <div className="grid grid-cols-6 gap-3">
            {section.tables.map((table) => (
              <Link
                key={table.id}
                href={`/tables/${table.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 transition-colors hover:border-primary-border hover:bg-primary-tint"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text-1">{table.label}</span>
                  <Badge tone={STATUS_TONE[table.status]}>{table.status[0]}{table.status.slice(1).toLowerCase()}</Badge>
                </div>
                <span className="flex items-center gap-1 text-xs text-text-3">
                  <Users className="h-3 w-3" strokeWidth={1.75} />
                  Seats {table.seats}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionsView() {
  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {SECTIONS.map((section) => (
        <Card key={section.id} className="flex flex-col gap-3 p-4">
          <span className="text-sm font-semibold text-text-1">{section.name}</span>
          <div className="flex items-center justify-between text-xs text-text-2">
            <span>{section.tables} tables</span>
            <span className="tabular font-semibold text-text-1">{section.occupied} occupied</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(section.occupied / section.tables) * 100}%` }}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

function SessionsView() {
  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[80px_80px_100px_1fr_120px] items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <span>Table</span>
          <span className="text-right">Guests</span>
          <span>Opened</span>
          <span>Waiter</span>
          <span className="text-right">Running Total</span>
        </div>
        {SESSIONS.map((s) => (
          <div
            key={s.table}
            className="grid grid-cols-[80px_80px_100px_1fr_120px] items-center gap-2 border-b border-border px-4 py-3 text-[13px] last:border-0"
          >
            <span className="font-semibold text-text-1">{s.table}</span>
            <span className="tabular text-right text-text-2">{s.guests}</span>
            <span className="tabular text-text-2">{s.openedAt}</span>
            <span className="text-text-2">{s.waiter}</span>
            <span className="tabular text-right font-semibold text-text-1">{formatPKR(s.runningTotal)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function WaitersView() {
  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {WAITERS.map((w) => (
        <Card key={w.name} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text-1">{w.name}</span>
            <Badge tone={w.status === "On Floor" ? "success" : "neutral"}>{w.status}</Badge>
          </div>
          <span className="text-xs text-text-2">{w.sections.join(", ")}</span>
          <span className="tabular text-xs text-text-3">{w.activeTables} active tables</span>
        </Card>
      ))}
    </div>
  );
}

function ReservationsView() {
  const { data: reservations, isLoading } = useReservations();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading reservations…</div>;

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_90px_80px_110px] items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <span>Name</span>
          <span className="text-right">Party</span>
          <span>Time</span>
          <span>Table</span>
          <span>Status</span>
        </div>
        {(reservations ?? []).map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_80px_90px_80px_110px] items-center gap-2 border-b border-border px-4 py-3 text-[13px] last:border-0"
          >
            <span className="flex items-center gap-2 font-medium text-text-1">
              <CalendarClock className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
              {r.name}
            </span>
            <span className="tabular text-right text-text-2">{r.partySize}</span>
            <span className="tabular text-text-2">{new Date(r.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="text-text-2">{r.table?.label ?? "—"}</span>
            <Badge tone={r.status === "SEATED" ? "success" : r.status === "PENDING" ? "warning" : "info"}>{r.status[0]}{r.status.slice(1).toLowerCase()}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
