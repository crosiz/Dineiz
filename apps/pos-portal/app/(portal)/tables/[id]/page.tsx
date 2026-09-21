"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Printer, Receipt, Users, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatPKR } from "@/lib/utils";
import { useTable, useUpdateOrderStatus, type ApiTable } from "@/lib/queries";

const STATUS_TONE: Record<ApiTable["status"], BadgeTone> = {
  FREE: "success",
  OCCUPIED: "danger",
  RESERVED: "purple",
};

export default function TableDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useTable(params.id);
  const updateStatus = useUpdateOrderStatus();
  const [voidError, setVoidError] = useState<string | null>(null);

  if (isLoading) return <div className="p-6 text-sm text-text-2">Loading table…</div>;
  if (error || !data) return <div className="p-6 text-sm text-text-2">Table not found.</div>;

  const { table, currentOrder } = data;
  const subtotal = currentOrder ? currentOrder.items.reduce((sum, i) => sum + i.priceSnapshot * i.qty, 0) : 0;

  async function handleVoid() {
    if (!currentOrder) return;
    setVoidError(null);
    try {
      await updateStatus.mutateAsync({ orderId: currentOrder.id, status: "CANCELLED" });
      router.refresh();
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "Couldn't void this order");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`Table ${table.label}`}
        description={`${table.section.name} · Seats ${table.seats}`}
        actions={<Badge tone={STATUS_TONE[table.status]}>{table.status[0]}{table.status.slice(1).toLowerCase()}</Badge>}
      />

      <div className="flex gap-4 px-6 pb-6">
        <div className="flex-1">
          {table.status === "OCCUPIED" && currentOrder ? (
            <Card className="flex flex-col gap-4 p-4">
              <SectionTitle>Current Order</SectionTitle>
              <div className="flex items-center gap-6 text-xs text-text-2">
                {currentOrder.type === "DINE_IN" && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
                    Order #{currentOrder.sequenceNo}
                  </span>
                )}
                <span>Opened {new Date(currentOrder.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                <Badge tone="warning">{currentOrder.status.replace("_", " ")}</Badge>
              </div>
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {currentOrder.items.map((line) => (
                  <li key={line.id} className="flex items-center justify-between py-2.5 text-[13px]">
                    <span className="text-text-1">
                      {line.qty} × {line.nameSnapshot}
                    </span>
                    <span className="tabular text-text-2">{formatPKR(line.priceSnapshot * line.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-1">Subtotal</span>
                <span className="tabular text-lg font-bold text-text-1">{formatPKR(subtotal)}</span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/orders/new?table=${table.id}`}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border text-[13px] font-semibold text-text-1 transition-colors hover:bg-hover"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  Add Items
                </Link>
                <Button variant="outline" className="flex-1">
                  <Printer className="h-4 w-4" strokeWidth={1.75} />
                  Print Bill
                </Button>
              </div>
              <Link
                href={`/checkout?table=${table.id}`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Receipt className="h-4 w-4" strokeWidth={1.75} />
                Collect Payment
              </Link>
              {voidError && <span className="text-center text-xs text-danger">{voidError}</span>}
              <button
                onClick={handleVoid}
                disabled={updateStatus.isPending}
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-danger disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                Void &amp; Close Table
              </button>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <span className="text-sm text-text-2">
                {table.status === "RESERVED" ? "This table is reserved for tonight." : "This table is free."}
              </span>
              <Link
                href={`/orders/new?table=${table.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Start New Order
              </Link>
            </Card>
          )}
        </div>

        <div className="w-[260px] shrink-0">
          <Card className="p-4">
            <SectionTitle>Table Info</SectionTitle>
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-text-2">Section</span>
                <span className="text-text-1">{table.section.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">Seats</span>
                <span className="tabular text-text-1">{table.seats}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">Status</span>
                <span className="text-text-1">{table.status[0]}{table.status.slice(1).toLowerCase()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
