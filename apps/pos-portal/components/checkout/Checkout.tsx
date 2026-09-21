"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Download, Mail, MessageCircle, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { cn, formatPKR } from "@/lib/utils";
import { useCheckoutOrder } from "@/lib/queries";
import { ApiError } from "@/lib/api-client";
import { queuePayment } from "@/lib/sync-queue";
import type { CheckoutLine } from "@/mocks/checkout";

type PaymentMethod = "CASH" | "CARD" | "JAZZCASH" | "EASYPAISA";

const METHODS: { key: PaymentMethod; label: string; icon: typeof Banknote; taxRate: number }[] = [
  { key: "CASH", label: "Cash", icon: Banknote, taxRate: 0.05 },
  { key: "CARD", label: "Card", icon: CreditCard, taxRate: 0.17 },
  { key: "JAZZCASH", label: "JazzCash", icon: Smartphone, taxRate: 0.17 },
  { key: "EASYPAISA", label: "EasyPaisa", icon: Smartphone, taxRate: 0.17 },
];

const CASH_CHIPS = [3500, 4000, 5000];

export function Checkout({
  orderId,
  displayId,
  label,
  lines,
  onDone,
}: {
  /** The real order id — what's actually sent to the checkout API. */
  orderId: string;
  /** Short, human label shown as "Order #___" (e.g. a sequence number). Falls back to orderId. */
  displayId?: string;
  label?: string;
  lines: CheckoutLine[];
  onDone: () => void;
}) {
  const shownId = displayId ?? orderId;
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState<number | null>(null);
  const [step, setStep] = useState<"pay" | "collected">("pay");
  const [error, setError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const checkout = useCheckoutOrder();

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);
  const activeMethod = METHODS.find((m) => m.key === method)!;
  const total = Math.round(subtotal * (1 + activeMethod.taxRate));
  const effectiveTendered = method === "CASH" ? tendered ?? total : total;
  const change = method === "CASH" ? effectiveTendered - total : 0;
  const canCollect = (method !== "CASH" || effectiveTendered >= total) && !checkout.isPending;

  async function handleCollect() {
    setError(null);
    const tenderedAmount = method === "CASH" ? effectiveTendered : undefined;
    try {
      if (!navigator.onLine) throw new Error("offline");
      await checkout.mutateAsync({ orderId, method, tenderedAmount });
      setStep("collected");
    } catch (err) {
      if (err instanceof ApiError) {
        // A real answer from the server (e.g. already paid) — not a
        // connectivity problem, so don't queue a duplicate attempt.
        setError(err.message);
        return;
      }
      // Everything else here is "couldn't reach the server" (offline, or the
      // fetch itself failed) — the order already exists, and the receipt
      // below is built entirely from data we already have, so the cashier
      // can keep working. Queue it and let the background sync finish the
      // job once the connection is back.
      await queuePayment({ orderId, displayId: shownId, method, tenderedAmount });
      setQueuedOffline(true);
      setStep("collected");
    }
  }

  if (step === "collected") {
    return (
      <ReceiptView orderId={shownId} lines={lines} total={total} method={activeMethod.label} queuedOffline={queuedOffline} onDone={onDone} />
    );
  }

  return (
    <div className="flex gap-4 p-6">
      <Card className="flex w-[560px] shrink-0 overflow-hidden">
        <div className="flex w-[190px] shrink-0 flex-col gap-2 border-r border-border bg-panel p-4">
          <span className="text-xs font-semibold text-text-1">
            Order #{shownId}
            {label ? ` · ${label}` : ""}
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            {lines.map((line) => (
              <div key={line.name} className="flex justify-between text-[11px] text-text-2">
                <span className="truncate pr-2">
                  {line.name} ×{line.qty}
                </span>
                <span className="tabular shrink-0">{(line.price * line.qty).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-[13px] font-bold text-text-1">
            <span>Total</span>
            <span className="tabular text-primary">{formatPKR(total)}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex gap-1 rounded-md bg-[#F3F4F6] p-[3px]">
            {METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMethod(m.key);
                  setTendered(null);
                }}
                className={cn(
                  "flex-1 rounded py-1.5 text-[11px] font-semibold transition-colors",
                  method === m.key ? "bg-bg text-text-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-text-2"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="tabular text-center text-3xl font-bold text-text-1">{formatPKR(total)}</div>
          <div className="text-center text-[11px] text-text-3">
            {method === "CASH" ? "Cash tax (5%) applied" : `${activeMethod.label} tax (17%) applied`}
          </div>

          {method === "CASH" ? (
            <>
              <div className="flex justify-center gap-1.5">
                {CASH_CHIPS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTendered(amt)}
                    className={cn(
                      "tabular rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                      effectiveTendered === amt ? "bg-primary-tint text-primary" : "bg-[#F3F4F6] text-text-1"
                    )}
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTendered(total)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                    effectiveTendered === total ? "bg-primary-tint text-primary" : "bg-[#F3F4F6] text-text-1"
                  )}
                >
                  Exact
                </button>
              </div>
              <div
                className={cn(
                  "rounded-md p-2 text-center",
                  change >= 0 ? "bg-success-tint" : "bg-danger-tint"
                )}
              >
                <span className={cn("tabular text-base font-bold", change >= 0 ? "text-success" : "text-danger")}>
                  {change >= 0 ? `Change: ${formatPKR(change)}` : `Short by ${formatPKR(Math.abs(change))}`}
                </span>
              </div>
            </>
          ) : method === "CARD" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md bg-panel py-6">
              <CreditCard className="h-6 w-6 text-text-3" strokeWidth={1.5} />
              <span className="text-xs text-text-2">Tap, insert or swipe card</span>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-2 rounded-md bg-panel py-5">
              <div
                className="h-20 w-20 rounded"
                style={{ background: "repeating-linear-gradient(45deg,#111827,#111827 3px,#fff 3px,#fff 6px)" }}
              />
              <span className="tabular text-xs font-semibold text-text-1">Waiting for confirmation…</span>
            </div>
          )}

          {error && <div className="rounded-md border border-danger-border bg-danger-tint px-2.5 py-2 text-[11px] text-danger">{error}</div>}

          <button
            type="button"
            disabled={!canCollect}
            onClick={handleCollect}
            className="h-11 w-full rounded-md text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--success)" }}
          >
            {checkout.isPending ? "Collecting…" : `Collect ${formatPKR(total)}`}
          </button>
        </div>
      </Card>
    </div>
  );
}

function ReceiptView({
  orderId,
  lines,
  total,
  method,
  queuedOffline,
  onDone,
}: {
  orderId: string;
  lines: CheckoutLine[];
  total: number;
  method: string;
  queuedOffline?: boolean;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 p-10">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-tint">
        <Logo size={22} />
      </span>
      <div className="text-center">
        <div className="text-base font-bold text-text-1">Payment Collected</div>
        <div className="text-xs text-text-2">
          Order #{orderId} · Paid via {method}
        </div>
      </div>

      {queuedOffline && (
        <div className="rounded-md border border-warning-border bg-warning-tint px-3 py-2 text-center text-[11px] text-warning">
          You&rsquo;re offline — this payment is saved and will sync automatically once you&rsquo;re back online.
        </div>
      )}

      <div
        className="w-[220px] rounded-sm p-4 font-mono text-[10px] text-[#17140F]"
        style={{
          background: "repeating-linear-gradient(180deg,#F7F5EF,#F7F5EF 3px,#F1EEE6 3px,#F1EEE6 4px)",
        }}
      >
        <div className="text-center font-bold">KABABJEES</div>
        <div className="my-1.5 border-t border-dashed border-[#8A8574]" />
        {lines.map((line) => (
          <div key={line.name} className="flex justify-between py-0.5">
            <span>
              {line.name} ×{line.qty}
            </span>
            <span className="tabular">{(line.price * line.qty).toLocaleString()}</span>
          </div>
        ))}
        <div className="my-1.5 border-t border-dashed border-[#8A8574]" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span className="tabular">PKR {total.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <IconAction icon={Download} label="Download" />
        <IconAction icon={MessageCircle} label="WhatsApp" />
        <IconAction icon={Mail} label="Email" />
      </div>

      <Button size="lg" onClick={onDone}>
        New Order
      </Button>
    </div>
  );
}

function IconAction({ icon: Icon, label }: { icon: typeof Download; label: string }) {
  return (
    <button
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-2 transition-colors hover:bg-hover"
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}
