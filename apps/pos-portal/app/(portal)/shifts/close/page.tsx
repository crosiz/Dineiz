"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, SectionTitle } from "@/components/ui/Card";
import { formatPKR } from "@/lib/utils";
import { useShiftClosePreview, useOpenOrdersCount, useCloseShift } from "@/lib/queries";

export default function ShiftClosePage() {
  const router = useRouter();
  const { data: preview, isLoading } = useShiftClosePreview();
  const { data: openOrders } = useOpenOrdersCount();
  const closeShift = useCloseShift();

  const [counted, setCounted] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview && counted === "") setCounted(String(preview.expectedCash));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading…</div>;
  if (!preview) {
    return <div className="p-6 text-sm text-text-2">No shift is currently open.</div>;
  }

  const countedNum = Number(counted) || 0;
  const variance = countedNum - preview.expectedCash;

  async function handleClose() {
    setError(null);
    try {
      await closeShift.mutateAsync({ shiftId: preview!.shiftId, countedCash: countedNum });
      router.push("/shifts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't close shift");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Close Shift" description="Reconcile cash and confirm before closing" />
      <div className="flex justify-center p-6">
        <div className="flex w-[520px] flex-col gap-3">
          <SectionTitle>Shift Close</SectionTitle>
          <Card className="flex flex-col gap-3 p-5">
            {!!openOrders?.count && (
              <div className="rounded-md border border-warning-border bg-warning-tint px-3 py-2.5 text-xs text-[#92610A]">
                {openOrders.count} order{openOrders.count === 1 ? " is" : "s are"} still open. Complete or hold{" "}
                {openOrders.count === 1 ? "it" : "them"} before closing.
              </div>
            )}

            <div className="flex justify-between text-[13px]">
              <span className="text-text-2">Expected cash</span>
              <span className="tabular text-text-1">{formatPKR(preview.expectedCash)}</span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-2">Counted cash</span>
              <input
                type="number"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                className="tabular h-9 rounded-md border border-border px-3 text-sm text-text-1 outline-none focus:border-primary"
              />
            </label>

            <div className="flex items-center justify-between border-t border-border pt-2.5">
              <span className="text-[13px] font-semibold text-text-1">Variance</span>
              <span className={variance === 0 ? "tabular text-[15px] font-bold text-text-1" : variance < 0 ? "tabular text-[15px] font-bold text-danger" : "tabular text-[15px] font-bold text-success"}>
                {variance === 0 ? "PKR 0" : `${variance > 0 ? "+" : "−"}${formatPKR(Math.abs(variance))}`}
              </span>
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-text-2">
              <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
              All orders and payments are synced live — nothing queued
            </div>

            {error && <div className="rounded-md border border-danger-border bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div>}

            <button
              type="button"
              onClick={handleClose}
              disabled={closeShift.isPending}
              className="h-11 rounded-md bg-danger text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {closeShift.isPending ? "Closing…" : "Confirm & Close Shift"}
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
