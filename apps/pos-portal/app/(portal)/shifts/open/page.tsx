"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn, formatPKR } from "@/lib/utils";
import { useOpenShift, useShiftHistory } from "@/lib/queries";

const FLOAT_CHIPS = [5000, 10000];

export default function ShiftOpenPage() {
  const router = useRouter();
  const { data: history } = useShiftHistory();
  const previous = history?.[0];
  const openShift = useOpenShift();

  const [floatAmount, setFloatAmount] = useState<number>(5000);
  const [customFloat, setCustomFloat] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const effectiveFloat = isCustom ? Number(customFloat) || 0 : floatAmount;

  async function handleStart() {
    setError(null);
    try {
      await openShift.mutateAsync({ openingFloat: effectiveFloat, notes: notes || undefined });
      router.push("/shifts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open shift");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Open Shift" description="Start a new shift for Kababjees · Clifton" />
      <div className="flex justify-center p-6">
        <div className="flex w-[480px] flex-col gap-3">
          <SectionTitle>Shift Open</SectionTitle>
          <Card className="flex flex-col gap-4 p-5">
            {previous && (
              <div className="flex items-center justify-between rounded-md bg-panel px-3 py-2.5 text-xs">
                <span className="text-text-2">
                  Previous shift ({previous.openedBy.name}, {new Date(previous.openedAt).toLocaleDateString()})
                </span>
                <span className="tabular font-semibold text-text-1">
                  Closed {!previous.variance ? "+0 variance" : `${previous.variance > 0 ? "+" : ""}${formatPKR(previous.variance)} variance`}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-text-2">Opening float</label>
              <div className="tabular my-1.5 text-3xl font-bold text-text-1">{formatPKR(effectiveFloat)}</div>
              <div className="flex flex-wrap gap-2">
                {FLOAT_CHIPS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setFloatAmount(amt);
                      setIsCustom(false);
                    }}
                    className={cn(
                      "tabular rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                      !isCustom && floatAmount === amt ? "border-primary-border bg-primary-tint text-primary" : "border-transparent bg-[#F3F4F6] text-text-1"
                    )}
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    isCustom ? "border-primary-border bg-primary-tint text-primary" : "border-transparent bg-[#F3F4F6] text-text-1"
                  )}
                >
                  Custom
                </button>
              </div>
              {isCustom && (
                <input
                  type="number"
                  value={customFloat}
                  onChange={(e) => setCustomFloat(e.target.value)}
                  placeholder="Enter amount"
                  className="tabular mt-2 h-9 w-full rounded-md border border-border px-3 text-sm text-text-1 outline-none placeholder:text-text-3 focus:border-primary"
                />
              )}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="h-[70px] resize-none rounded-md border border-border px-3 py-2 text-[13px] text-text-1 outline-none placeholder:text-text-3 focus:border-primary"
            />

            {error && <div className="rounded-md border border-danger-border bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div>}

            <Button size="lg" className="w-full" disabled={openShift.isPending} onClick={handleStart}>
              {openShift.isPending ? "Starting…" : "Start Shift"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
