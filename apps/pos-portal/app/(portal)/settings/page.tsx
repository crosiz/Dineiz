"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabbedPage } from "@/components/ui/TabbedPage";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SettingsRow, SettingsToggle } from "@/components/ui/SettingsRow";
import { formatPKR } from "@/lib/utils";
import { useCurrentBranch, useSettings, useUpdateSettings, usePrinters, type ApiBranchSettings } from "@/lib/queries";

const TABS = [
  { key: "branch", label: "Branch" },
  { key: "receipt", label: "Receipt" },
  { key: "tax", label: "Tax" },
  { key: "payments", label: "Payments" },
  { key: "workflow", label: "Workflow" },
  { key: "devices", label: "Devices" },
  { key: "notifications", label: "Notifications" },
  { key: "backup", label: "Backup" },
];

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Settings" description="Branch profile, receipts, tax, payments and system preferences" />
      <TabbedPage tabs={TABS}>
        {(tab) => {
          switch (tab) {
            case "receipt":
              return <ReceiptView />;
            case "tax":
              return <TaxView />;
            case "payments":
              return <PaymentsView />;
            case "workflow":
              return <WorkflowView />;
            case "devices":
              return <DevicesView />;
            case "notifications":
              return <NotificationsView />;
            case "backup":
              return <BackupView />;
            default:
              return <BranchView />;
          }
        }}
      </TabbedPage>
    </div>
  );
}

function FieldPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6">
      <Card className="max-w-2xl p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-text-1">{title}</span>
          <Button size="sm" variant="outline" disabled title="Inline editing isn't available yet">
            Edit
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function SettingsError({ message }: { message: string }) {
  return <div className="mt-3 rounded-md border border-danger-border bg-danger-tint px-3 py-2 text-[13px] text-danger">{message}</div>;
}

function BranchView() {
  const { data: branch, isLoading } = useCurrentBranch();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading branch…</div>;

  const fields = [
    { label: "Branch Name", value: branch?.name ?? "—" },
    { label: "Branch Code", value: branch?.code ?? "—" },
    { label: "Address", value: branch?.address ?? "—" },
    { label: "Phone", value: branch?.phone ?? "—" },
    { label: "Operating Hours", value: branch?.operatingHours ?? "—" },
  ];

  return (
    <FieldPanel title="Branch Profile">
      <div className="flex flex-col">
        {fields.map((f) => (
          <SettingsRow key={f.label} label={f.label}>
            <span className="tabular text-[13px] text-text-1">{f.value}</span>
          </SettingsRow>
        ))}
      </div>
    </FieldPanel>
  );
}

function useSettingsToggle() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [error, setError] = useState<string | null>(null);
  function toggle<S extends keyof ApiBranchSettings>(section: S, field: keyof ApiBranchSettings[S]) {
    if (!settings) return;
    setError(null);
    const current = settings[section] as Record<string, unknown>;
    update.mutate(
      { [section]: { ...current, [field]: !current[field as string] } } as Partial<ApiBranchSettings>,
      { onError: (err) => setError(err instanceof Error ? err.message : "Couldn't save that change") }
    );
  }
  return { settings, toggle, isPending: update.isPending, error };
}

function ReceiptView() {
  const { settings, toggle, isPending, error } = useSettingsToggle();

  if (!settings) return <div className="p-6 text-sm text-text-2">Loading receipt settings…</div>;

  return (
    <FieldPanel title="Receipt">
      <div className="flex flex-col">
        <SettingsRow label="Receipt Header">
          <span className="tabular text-[13px] text-text-1">{settings.receipt.header || "—"}</span>
        </SettingsRow>
        <SettingsRow label="Receipt Footer">
          <span className="tabular text-[13px] text-text-1">{settings.receipt.footer || "—"}</span>
        </SettingsRow>
        <SettingsRow label="Paper Size">
          <span className="tabular text-[13px] text-text-1">{settings.receipt.paperSize}</span>
        </SettingsRow>
      </div>
      <div className="flex flex-col">
        <SettingsRow label="Show logo on receipt">
          <button type="button" disabled={isPending} onClick={() => toggle("receipt", "showLogo")}>
            <SettingsToggle enabled={settings.receipt.showLogo} />
          </button>
        </SettingsRow>
        <SettingsRow label="Show tax breakdown">
          <button type="button" disabled={isPending} onClick={() => toggle("receipt", "showTaxBreakdown")}>
            <SettingsToggle enabled={settings.receipt.showTaxBreakdown} />
          </button>
        </SettingsRow>
      </div>
      {error && <SettingsError message={error} />}
    </FieldPanel>
  );
}

function TaxView() {
  const { settings } = useSettingsToggle();

  if (!settings) return <div className="p-6 text-sm text-text-2">Loading tax settings…</div>;

  const fields = [
    { label: "Cash Tax Rate", description: "Applied to cash payments", value: `${Math.round(settings.tax.cashTaxRate * 100)}%` },
    { label: "Card Tax Rate", description: "Applied to card, JazzCash, EasyPaisa", value: `${Math.round(settings.tax.cardTaxRate * 100)}%` },
    { label: "Tax Registration Number", value: settings.tax.taxRegistrationNumber || "—" },
  ];

  return (
    <FieldPanel title="Tax">
      <div className="flex flex-col">
        {fields.map((f) => (
          <SettingsRow key={f.label} label={f.label} description={f.description}>
            <span className="tabular text-[13px] text-text-1">{f.value}</span>
          </SettingsRow>
        ))}
      </div>
    </FieldPanel>
  );
}

function PaymentsView() {
  const { settings, toggle, isPending, error } = useSettingsToggle();

  if (!settings) return <div className="p-6 text-sm text-text-2">Loading payment settings…</div>;

  const rows: { key: keyof ApiBranchSettings["payments"]; label: string }[] = [
    { key: "cash", label: "Cash" },
    { key: "card", label: "Card" },
    { key: "jazzcash", label: "JazzCash" },
    { key: "easypaisa", label: "EasyPaisa" },
  ];

  return (
    <FieldPanel title="Accepted Payment Methods">
      <div className="flex flex-col">
        {rows.map((r) => (
          <SettingsRow key={r.key} label={r.label}>
            <button type="button" disabled={isPending} onClick={() => toggle("payments", r.key)}>
              <SettingsToggle enabled={settings.payments[r.key]} />
            </button>
          </SettingsRow>
        ))}
      </div>
      {error && <SettingsError message={error} />}
    </FieldPanel>
  );
}

function WorkflowView() {
  const { settings, toggle, isPending, error } = useSettingsToggle();

  if (!settings) return <div className="p-6 text-sm text-text-2">Loading workflow settings…</div>;

  const rows: { key: keyof ApiBranchSettings["workflow"]; label: string; description?: string }[] = [
    { key: "autoAcceptOrders", label: "Auto-accept incoming orders", description: "Skip manual confirmation for aggregator orders" },
    { key: "requireManagerPinForDiscounts", label: "Require manager PIN for discounts" },
    { key: "autoPrintKot", label: "Auto-print KOT on send" },
  ];

  return (
    <FieldPanel title="Workflow">
      <div className="flex flex-col">
        {rows.map((r) => (
          <SettingsRow key={r.key} label={r.label} description={r.description}>
            <button type="button" disabled={isPending} onClick={() => toggle("workflow", r.key)}>
              <SettingsToggle enabled={settings.workflow[r.key]} />
            </button>
          </SettingsRow>
        ))}
      </div>
      {error && <SettingsError message={error} />}
    </FieldPanel>
  );
}

function NotificationsView() {
  const { settings, toggle, isPending, error } = useSettingsToggle();

  if (!settings) return <div className="p-6 text-sm text-text-2">Loading notification settings…</div>;

  const rows: { key: keyof ApiBranchSettings["notifications"]; label: string }[] = [
    { key: "newOrderAlerts", label: "New order alerts" },
    { key: "lowStockAlerts", label: "Low stock alerts" },
    { key: "shiftReminders", label: "Shift reminders" },
    { key: "dailySummaryEmail", label: "Daily summary email" },
  ];

  return (
    <FieldPanel title="Notifications">
      <div className="flex flex-col">
        {rows.map((r) => (
          <SettingsRow key={r.key} label={r.label}>
            <button type="button" disabled={isPending} onClick={() => toggle("notifications", r.key)}>
              <SettingsToggle enabled={settings.notifications[r.key]} />
            </button>
          </SettingsRow>
        ))}
      </div>
      {error && <SettingsError message={error} />}
    </FieldPanel>
  );
}

function DevicesView() {
  const { data: printers, isLoading } = usePrinters();

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading devices…</div>;

  return (
    <div className="p-6">
      <div className="grid max-w-2xl grid-cols-2 gap-3">
        {(printers ?? []).map((d) => (
          <Card key={d.id} className="flex items-center justify-between p-4">
            <div>
              <div className="text-[13px] font-semibold text-text-1">{d.name}</div>
              <div className="text-xs text-text-3">{d.type}</div>
            </div>
            <Badge tone={d.isOnline ? "success" : "neutral"}>{d.isOnline ? "Paired" : "Offline"}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BackupView() {
  const { settings } = useSettingsToggle();

  if (!settings) return <div className="p-6 text-sm text-text-2">Loading backup info…</div>;

  const fields = [
    { label: "Last Backup", value: settings.backup.lastBackupAt ? new Date(settings.backup.lastBackupAt).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : "Never" },
    { label: "Backup Frequency", value: settings.backup.frequency },
    { label: "Storage Used", value: `${settings.backup.storageUsedGb} GB of ${settings.backup.storageLimitGb} GB` },
  ];

  return (
    <div className="p-6">
      <Card className="max-w-2xl p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-text-1">Backup</span>
          <Button size="sm" disabled title="Manual backup isn't available yet">
            Back Up Now
          </Button>
        </div>
        <div className="flex flex-col">
          {fields.map((f) => (
            <SettingsRow key={f.label} label={f.label}>
              <span className="tabular text-[13px] text-text-1">{f.value}</span>
            </SettingsRow>
          ))}
        </div>
      </Card>
    </div>
  );
}
