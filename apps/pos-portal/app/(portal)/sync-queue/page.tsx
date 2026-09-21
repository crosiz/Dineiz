"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getDB, type QueuedPayment } from "@/lib/db";
import { syncQueuedPayments } from "@/lib/sync-queue";
import { useSyncQueueLog } from "@/lib/queries";

function relativeTime(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr} hr ago`;
}

export default function SyncQueuePage() {
  const [retrying, setRetrying] = useState(false);
  const pending = useLiveQuery(
    () => getDB().queuedPayments.where("syncStatus").anyOf(["pending", "syncing", "failed"]).sortBy("createdAt"),
    []
  );
  const { data: recent, isLoading: recentLoading } = useSyncQueueLog();

  async function retryAll() {
    setRetrying(true);
    try {
      await syncQueuedPayments();
    } finally {
      setRetrying(false);
    }
  }

  const nothingPending = pending && pending.length === 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Sync Queue"
        description="Changes made while offline — these will sync automatically once you're back online"
        actions={
          <Button size="sm" variant="outline" onClick={retryAll} disabled={retrying || nothingPending}>
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} strokeWidth={1.75} />
            Retry All
          </Button>
        }
      />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">Pending on this device</div>
          <Card className="overflow-hidden">
            {(pending ?? []).map((change) => (
              <PendingRow key={change.localId} change={change} />
            ))}
            {nothingPending && <div className="py-10 text-center text-xs text-text-3">Everything is synced</div>}
          </Card>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">Recently synced</div>
          <Card className="overflow-hidden">
            {recentLoading && <div className="py-6 text-center text-xs text-text-3">Loading…</div>}
            {(recent ?? []).map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-panel">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-text-1">{entry.label}</div>
                  <div className="text-[11px] text-text-3">Synced {relativeTime(entry.createdAt)}</div>
                </div>
              </div>
            ))}
            {!recentLoading && (recent ?? []).length === 0 && (
              <div className="py-10 text-center text-xs text-text-3">Nothing has synced from offline mode yet</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function PendingRow({ change }: { change: QueuedPayment }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-panel">
        <CreditCard className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-medium text-text-1">Payment for #{change.displayId}</div>
        <div className="text-[11px] text-text-3">
          Queued {relativeTime(change.createdAt)}
          {change.syncStatus === "failed" && change.errorMessage ? ` · ${change.errorMessage}` : ""}
        </div>
      </div>
      <Badge tone={change.syncStatus === "failed" ? "danger" : "warning"}>
        {change.syncStatus === "syncing" ? "Syncing" : change.syncStatus === "failed" ? "Failed" : "Queued"}
      </Badge>
    </div>
  );
}
