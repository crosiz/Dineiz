import { getDB, type QueuedPayment } from "./db";
import { api } from "./api-client";
import { queryClient } from "@/components/Providers";

type QueueInput = Omit<QueuedPayment, "localId" | "createdAt" | "syncStatus" | "syncAttempts" | "errorMessage">;

export async function queuePayment(input: QueueInput): Promise<string> {
  const db = getDB();
  const localId = crypto.randomUUID();
  await db.queuedPayments.add({
    ...input,
    localId,
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
    syncAttempts: 0,
  });
  return localId;
}

function invalidateAfterSync() {
  queryClient.invalidateQueries({ queryKey: ["orders"] });
  queryClient.invalidateQueries({ queryKey: ["tables"] });
  queryClient.invalidateQueries({ queryKey: ["shifts", "current"] });
}

/** Replays every queued payment against the real checkout endpoint. Safe to call repeatedly — already-synced rows are skipped. */
export async function syncQueuedPayments(): Promise<void> {
  const db = getDB();
  const pending = await db.queuedPayments.where("syncStatus").anyOf(["pending", "failed"]).toArray();
  if (pending.length === 0) return;

  for (const payment of pending) {
    await db.queuedPayments.update(payment.localId, { syncStatus: "syncing" });
    try {
      await api.post(`/api/orders/${payment.orderId}/checkout`, {
        method: payment.method,
        tenderedAmount: payment.tenderedAmount,
      });
      await db.queuedPayments.update(payment.localId, { syncStatus: "synced" });
      invalidateAfterSync();
      await api.post("/api/sync-queue", { kind: "payment", label: `Payment for #${payment.displayId}` }).catch(() => {});
    } catch (err) {
      await db.queuedPayments.update(payment.localId, {
        syncStatus: "failed",
        syncAttempts: payment.syncAttempts + 1,
        errorMessage: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }
}

/** Polls + listens for `online` while mounted. Returns a cleanup function. */
export function startBackgroundSync(intervalMs = 30_000): () => void {
  if (typeof window === "undefined") return () => {};

  if (navigator.onLine) syncQueuedPayments();

  const interval = setInterval(() => {
    if (navigator.onLine) syncQueuedPayments();
  }, intervalMs);

  const handleOnline = () => syncQueuedPayments();
  window.addEventListener("online", handleOnline);

  return () => {
    clearInterval(interval);
    window.removeEventListener("online", handleOnline);
  };
}
