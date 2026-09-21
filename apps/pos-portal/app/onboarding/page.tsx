"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  FileSpreadsheet,
  PartyPopper,
  Printer,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { DineizLogo } from "@/components/ui/DineizLogo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useCurrentBranch, useUpdateBranch, useMenuCategories, useMenuItems, useCreateStaff, useDeleteStaff } from "@/lib/queries";

type StaffDraft = { id: string; name: string; role: string; pin: string };
type MenuChoice = "starter" | "blank" | null;

const STEPS = [
  { key: "branch", label: "Branch" },
  { key: "menu", label: "Menu Import" },
  { key: "staff", label: "Staff" },
  { key: "printer", label: "Printer" },
];

const ROLES: { label: string; value: "BRANCH_MANAGER" | "CASHIER" | "WAITER" | "KITCHEN_STAFF" }[] = [
  { label: "Branch Manager", value: "BRANCH_MANAGER" },
  { label: "Cashier", value: "CASHIER" },
  { label: "Waiter", value: "WAITER" },
  { label: "Kitchen Staff", value: "KITCHEN_STAFF" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  // 401s while this loads bounce to /login via the api-client's own global
  // handler — there's no separate auth gate to write here.
  const { data: branch } = useCurrentBranch();
  const updateBranch = useUpdateBranch();

  const [branchName, setBranchName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [branchHydrated, setBranchHydrated] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  useEffect(() => {
    if (branch && !branchHydrated) {
      setBranchName(branch.name);
      setAddress(branch.address ?? "");
      setPhone(branch.phone ?? "");
      setHours(branch.operatingHours ?? "");
      setBranchHydrated(true);
    }
  }, [branch, branchHydrated]);

  const { data: menuCategories } = useMenuCategories();
  const { data: menuItems } = useMenuItems();
  const [menuChoice, setMenuChoice] = useState<MenuChoice>(null);

  const [staffList, setStaffList] = useState<StaffDraft[]>([]);

  const [scanning, setScanning] = useState(false);
  const [printerFound, setPrinterFound] = useState(false);
  const [printerPaired, setPrinterPaired] = useState(false);

  async function next() {
    if (stepIndex === 0) {
      setBranchError(null);
      try {
        await updateBranch.mutateAsync({ name: branchName, address, phone, operatingHours: hours });
      } catch (err) {
        setBranchError(err instanceof Error ? err.message : "Couldn't save branch details");
        return;
      }
    }
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else setDone(true);
  }
  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  function scanForPrinters() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setPrinterFound(true);
    }, 900);
  }

  if (done) {
    return (
      <CompletionView
        branchName={branchName}
        menuChoice={menuChoice}
        menuItemCount={menuItems?.length ?? 0}
        staffCount={staffList.length}
        printerPaired={printerPaired}
        onGo={() => router.push("/dashboard")}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel px-6 py-10">
      <div className="flex w-[560px] flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <DineizLogo size="md" />
          <h1 className="text-lg font-bold text-text-1">Set up {branchName || "your branch"} on Dineiz</h1>
        </div>

        <StepIndicator steps={STEPS} activeIndex={stepIndex} onJump={(i) => i < stepIndex && setStepIndex(i)} />

        <div className="rounded-lg border border-border bg-bg p-6">
          {stepIndex === 0 && (
            <BranchStep
              branchName={branchName}
              setBranchName={setBranchName}
              address={address}
              setAddress={setAddress}
              phone={phone}
              setPhone={setPhone}
              hours={hours}
              setHours={setHours}
            />
          )}
          {stepIndex === 1 && (
            <MenuStep choice={menuChoice} setChoice={setMenuChoice} categoryCount={menuCategories?.length ?? 0} itemCount={menuItems?.length ?? 0} />
          )}
          {stepIndex === 2 && (
            <StaffStep staffList={staffList} onAdd={(s) => setStaffList((prev) => [...prev, s])} onRemoved={(id) => setStaffList((prev) => prev.filter((s) => s.id !== id))} />
          )}
          {stepIndex === 3 && (
            <PrinterStep
              scanning={scanning}
              printerFound={printerFound}
              printerPaired={printerPaired}
              onScan={scanForPrinters}
              onPair={() => setPrinterPaired(true)}
            />
          )}

          {stepIndex === 0 && branchError && (
            <div className="mt-4 rounded-md border border-danger-border bg-danger-tint px-3 py-2 text-[13px] text-danger">{branchError}</div>
          )}

          <div className="mt-6 flex justify-between border-t border-border pt-4">
            <button
              type="button"
              onClick={back}
              disabled={stepIndex === 0}
              className="h-9 rounded-md bg-[#F3F4F6] px-4 text-[13px] font-semibold text-text-1 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
              disabled={updateBranch.isPending}
              className="h-9 rounded-md bg-primary px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateBranch.isPending ? "Saving…" : stepIndex === STEPS.length - 1 ? "Finish" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  steps,
  activeIndex,
  onJump,
}: {
  steps: { key: string; label: string }[];
  activeIndex: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex items-start px-2">
      {steps.map((step, i) => {
        const isDone = i < activeIndex;
        const isCurrent = i === activeIndex;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={i > activeIndex}
              className="flex flex-col items-center gap-1.5 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                  isDone || isCurrent ? "bg-primary text-white" : "border border-border bg-[#F3F4F6] text-text-2"
                )}
              >
                {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-[10px] font-semibold whitespace-nowrap", isCurrent ? "text-text-1" : "text-text-3")}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && <span className={cn("mb-4 h-0.5 flex-1", isDone ? "bg-primary" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border px-3 text-[13px] text-text-1 outline-none focus:border-primary"
      />
    </label>
  );
}

function BranchStep({
  branchName,
  setBranchName,
  address,
  setAddress,
  phone,
  setPhone,
  hours,
  setHours,
}: {
  branchName: string;
  setBranchName: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  hours: string;
  setHours: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <span className="text-sm font-semibold text-text-1">Confirm your branch details</span>
      </div>
      <Field label="Branch Name" value={branchName} onChange={setBranchName} />
      <Field label="Address" value={address} onChange={setAddress} />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <Field label="Operating Hours" value={hours} onChange={setHours} />
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  description,
  icon: Icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: typeof Upload;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        selected ? "border-primary-border bg-primary-tint" : "border-border hover:bg-hover"
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", selected ? "bg-bg" : "bg-panel")}>
        <Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-text-3")} strokeWidth={1.75} />
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-text-1">{title}</div>
        <div className="text-xs text-text-3">{description}</div>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />}
    </button>
  );
}

function MenuStep({
  choice,
  setChoice,
  categoryCount,
  itemCount,
}: {
  choice: MenuChoice;
  setChoice: (c: MenuChoice) => void;
  categoryCount: number;
  itemCount: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <span className="text-sm font-semibold text-text-1">Import your menu</span>
      </div>
      <OptionCard
        selected={choice === "starter"}
        onClick={() => setChoice("starter")}
        title="Use the Kababjees starter menu"
        description={`${categoryCount} categories · ${itemCount} items, ready to edit`}
        icon={Upload}
      />
      <OptionCard
        selected={choice === "blank"}
        onClick={() => setChoice("blank")}
        title="Start with a blank menu"
        description="Add categories and items yourself from Menu Management"
        icon={FileSpreadsheet}
      />
    </div>
  );
}

function StaffStep({
  staffList,
  onAdd,
  onRemoved,
}: {
  staffList: StaffDraft[];
  onAdd: (s: StaffDraft) => void;
  onRemoved: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]!.value);
  const [error, setError] = useState<string | null>(null);
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();

  async function handleAdd() {
    if (!name.trim()) return;
    setError(null);
    try {
      const created = await createStaff.mutateAsync({ name: name.trim(), role });
      onAdd({ id: created.id, name: created.name, role: ROLES.find((r) => r.value === role)!.label, pin: created.pin });
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add staff member");
    }
  }

  async function handleRemove(id: string) {
    try {
      await deleteStaff.mutateAsync(id);
      onRemoved(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove staff member");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <span className="text-sm font-semibold text-text-1">Add your team</span>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Staff name"
          className="h-9 flex-1 rounded-md border border-border px-3 text-[13px] text-text-1 outline-none focus:border-primary"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="h-9 rounded-md border border-border bg-bg px-2 text-[13px] text-text-1 outline-none focus:border-primary"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={createStaff.isPending}
          className="h-9 shrink-0 rounded-md bg-primary px-3 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createStaff.isPending ? "Adding…" : "Add"}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {staffList.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {staffList.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
              <span className="text-text-1">{s.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-text-3">{s.role}</span>
                <span className="tabular rounded bg-primary-tint px-1.5 py-0.5 text-[11px] font-semibold text-primary">PIN {s.pin}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(s.id)}
                  disabled={deleteStaff.isPending}
                  className="text-text-3 hover:text-danger disabled:opacity-50"
                  aria-label={`Remove ${s.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-3">No staff added yet — you can also do this later from Staff Management.</p>
      )}
      {staffList.length > 0 && <p className="text-xs text-text-3">Share each PIN with its staff member — it won&rsquo;t be shown again.</p>}
    </div>
  );
}

function PrinterStep({
  scanning,
  printerFound,
  printerPaired,
  onScan,
  onPair,
}: {
  scanning: boolean;
  printerFound: boolean;
  printerPaired: boolean;
  onScan: () => void;
  onPair: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Printer className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <span className="text-sm font-semibold text-text-1">Connect a printer</span>
      </div>

      {!printerFound && !scanning && (
        <button
          type="button"
          onClick={onScan}
          className="flex flex-col items-center gap-2 rounded-lg border-[1.5px] border-dashed border-border py-8 text-center transition-colors hover:border-primary-border hover:bg-primary-tint"
        >
          <Search className="h-5 w-5 text-text-3" strokeWidth={1.5} />
          <span className="text-[13px] text-text-2">Scan for nearby printers</span>
        </button>
      )}

      {scanning && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          <span className="text-[13px] text-text-2">Scanning…</span>
        </div>
      )}

      {printerFound && (
        <OptionCard
          selected={printerPaired}
          onClick={onPair}
          title="Front Counter Printer"
          description={printerPaired ? "Paired" : "Found nearby — tap to pair"}
          icon={Printer}
        />
      )}

      <p className="text-xs text-text-3">You can also set this up later from Settings → Devices.</p>
    </div>
  );
}

function CompletionView({
  branchName,
  menuChoice,
  menuItemCount,
  staffCount,
  printerPaired,
  onGo,
}: {
  branchName: string;
  menuChoice: MenuChoice;
  menuItemCount: number;
  staffCount: number;
  printerPaired: boolean;
  onGo: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-panel px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-tint">
        <PartyPopper className="h-6 w-6 text-success" strokeWidth={1.5} />
      </span>
      <div>
        <h1 className="text-lg font-bold text-text-1">You&rsquo;re all set!</h1>
        <p className="mt-1 text-[13px] text-text-2">{branchName || "Your branch"} is ready to take orders on Dineiz.</p>
      </div>
      <div className="flex w-[300px] flex-col gap-2 rounded-lg border border-border bg-bg p-4 text-left text-[13px]">
        <SummaryRow label="Menu" value={menuChoice === "starter" ? `${menuItemCount} items ready` : "Blank — add items later"} />
        <SummaryRow label="Staff" value={staffCount > 0 ? `${staffCount} added` : "None yet"} />
        <SummaryRow label="Printer" value={printerPaired ? "Connected" : "Not paired yet"} />
      </div>
      <Button size="lg" onClick={onGo}>
        Go to Dashboard
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-2">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-text-1">
        <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
        {value}
      </span>
    </div>
  );
}
