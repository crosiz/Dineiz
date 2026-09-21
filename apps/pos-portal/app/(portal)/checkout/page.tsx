"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Checkout } from "@/components/checkout/Checkout";
import { useTable, type ApiOrder, type ApiTable } from "@/lib/queries";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");
  const { data, isLoading, error } = useTable(tableId ?? undefined);

  // Snapshot the order once it loads and keep rendering Checkout from that
  // snapshot regardless of later refetches — collecting payment invalidates
  // this table's query (it just went from occupied to free), and without
  // freezing the snapshot that refetch would yank the receipt screen out
  // from under the cashier the instant "Collect" succeeds.
  const [snapshot, setSnapshot] = useState<{ order: ApiOrder; table: ApiTable } | null>(null);
  useEffect(() => {
    if (data?.currentOrder && !snapshot) {
      setSnapshot({ order: data.currentOrder, table: data.table });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!tableId) {
    return <div className="p-6 text-sm text-text-2">No table specified.</div>;
  }
  if (isLoading && !snapshot) {
    return <div className="p-6 text-sm text-text-2">Loading order…</div>;
  }
  if (!snapshot && (error || !data?.currentOrder)) {
    return <div className="p-6 text-sm text-text-2">This table has no open order.</div>;
  }
  if (!snapshot) {
    return <div className="p-6 text-sm text-text-2">Loading order…</div>;
  }

  const { order, table } = snapshot;
  const lines = order.items.map((i) => ({ name: i.nameSnapshot, price: i.priceSnapshot, qty: i.qty }));

  return (
    <Checkout
      orderId={order.id}
      displayId={String(order.sequenceNo)}
      label={`Table ${table.label}`}
      lines={lines}
      onDone={() => router.push(`/tables/${tableId}`)}
    />
  );
}

export default function CheckoutPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Checkout" description="Collect payment for this order" />
      <Suspense fallback={<div className="p-6 text-sm text-text-2">Loading…</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
