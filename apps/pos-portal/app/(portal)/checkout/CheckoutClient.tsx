"use client";

import { useRouter } from "next/navigation";
import { Checkout } from "@/components/checkout/Checkout";
import type { CheckoutLine } from "@/mocks/checkout";

export function CheckoutClient({
  orderId,
  label,
  lines,
  tableId,
}: {
  orderId: string;
  label: string;
  lines: CheckoutLine[];
  tableId: string;
}) {
  const router = useRouter();
  return <Checkout orderId={orderId} label={label} lines={lines} onDone={() => router.push(`/tables/${tableId}`)} />;
}
