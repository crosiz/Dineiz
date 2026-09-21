"use client";

import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { SimpleTable, type Column } from "@/components/ui/SimpleTable";
import { SectionTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPKR } from "@/lib/utils";
import { useStaff, useStaffPermissions, useAttendance, usePayroll, type ApiStaffMember, type ApiAttendanceEntry, type ApiPayrollEntry } from "@/lib/queries";

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "Tenant Admin",
  BRANCH_MANAGER: "Branch Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
  KITCHEN_STAFF: "Kitchen Staff",
  RIDER: "Rider",
};

const TABS = [
  { key: "staff", label: "Staff" },
  { key: "roles", label: "Roles & Permissions" },
  { key: "attendance", label: "Attendance" },
  { key: "payroll", label: "Payroll" },
];

export default function StaffPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Staff Management" description="Team roster, role permissions, attendance and payroll" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "roles":
              return <RolesView />;
            case "attendance":
              return <AttendanceView />;
            case "payroll":
              return <PayrollView />;
            default:
              return <StaffListView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function StaffListView() {
  const { data: staff, isLoading } = useStaff();

  const columns: Column<ApiStaffMember>[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium text-text-1">{r.name}</span> },
    { key: "role", header: "Role", width: "150px", render: (r) => <span className="text-text-2">{ROLE_LABEL[r.role] ?? r.role}</span> },
    { key: "phone", header: "Phone", width: "150px", render: (r) => <span className="tabular text-text-2">{r.phone ?? "—"}</span> },
    { key: "status", header: "Status", width: "100px", render: (r) => <Badge tone={r.active ? "success" : "warning"}>{r.active ? "Active" : "On Leave"}</Badge> },
    { key: "joinedDate", header: "Joined", width: "100px", render: (r) => <span className="tabular text-xs text-text-3">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading staff…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={staff ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function RolesView() {
  const { data: permissions, isLoading } = useStaffPermissions("BRANCH_MANAGER");

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading permissions…</div>;

  return (
    <div className="p-6">
      <SectionTitle>Branch Manager Permissions</SectionTitle>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_80px_80px_80px_80px] items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          <span>Module</span>
          <span className="text-center">View</span>
          <span className="text-center">Create</span>
          <span className="text-center">Edit</span>
          <span className="text-center">Delete</span>
        </div>
        {(permissions ?? []).map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_80px_80px_80px_80px] items-center gap-2 border-b border-border bg-bg px-4 py-2.5 text-[13px] last:border-0">
            <span className="font-medium text-text-1">{row.module}</span>
            <PermCell value={row.canView} />
            <PermCell value={row.canCreate} />
            <PermCell value={row.canEdit} />
            <PermCell value={row.canDelete} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PermCell({ value }: { value: boolean }) {
  return (
    <span className="flex justify-center">
      {value ? <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} /> : <Minus className="h-3.5 w-3.5 text-text-4" strokeWidth={2} />}
    </span>
  );
}

function hoursBetween(checkIn: string, checkOut: string | null) {
  if (!checkOut) return "—";
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function AttendanceView() {
  const { data: attendance, isLoading } = useAttendance();

  const columns: Column<ApiAttendanceEntry>[] = [
    { key: "staff", header: "Staff", render: (r) => <span className="font-medium text-text-1">{r.user.name}</span> },
    { key: "date", header: "Date", width: "100px", render: (r) => <span className="text-text-2">{new Date(r.checkIn).toLocaleDateString()}</span> },
    { key: "checkIn", header: "Check In", width: "110px", render: (r) => <span className="tabular text-text-2">{new Date(r.checkIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span> },
    { key: "checkOut", header: "Check Out", width: "110px", render: (r) => <span className="tabular text-text-2">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</span> },
    { key: "hours", header: "Hours", width: "90px", render: (r) => <span className="tabular text-text-1">{hoursBetween(r.checkIn, r.checkOut)}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading attendance…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={attendance ?? []} rowKey={(r) => r.id} />
    </div>
  );
}

function PayrollView() {
  const { data: payroll, isLoading } = usePayroll();

  const columns: Column<ApiPayrollEntry>[] = [
    { key: "staff", header: "Staff", render: (r) => <span className="font-medium text-text-1">{r.user.name}</span> },
    { key: "role", header: "Role", width: "140px", render: (r) => <span className="text-text-2">{ROLE_LABEL[r.user.role] ?? r.user.role}</span> },
    { key: "base", header: "Base Salary", width: "120px", align: "right", render: (r) => <span className="tabular text-text-2">{formatPKR(r.baseSalary)}</span> },
    { key: "bonus", header: "Bonus", width: "100px", align: "right", render: (r) => <span className="tabular text-text-2">{r.bonus ? formatPKR(r.bonus) : "—"}</span> },
    { key: "net", header: "Net Pay", width: "120px", align: "right", render: (r) => <span className="tabular font-semibold text-text-1">{formatPKR(r.baseSalary + r.bonus)}</span> },
    { key: "month", header: "Month", width: "100px", render: (r) => <span className="tabular text-xs text-text-3">{r.month}</span> },
  ];

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading payroll…</div>;

  return (
    <div className="p-6">
      <SimpleTable columns={columns} rows={payroll ?? []} rowKey={(r) => r.id} />
    </div>
  );
}
