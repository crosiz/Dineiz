"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { WifiOff } from "lucide-react";
import { getDB } from "@/lib/db";
import { startBackgroundSync } from "@/lib/sync-queue";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const pendingCount = useLiveQuery(() => getDB().queuedPayments.where("syncStatus").anyOf(["pending", "failed"]).count(), []) ?? 0;

  useEffect(() => {
    setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // Runs once per mount of the authenticated shell, regardless of whether
  // the banner itself is currently showing — a payment queued while offline
  // still needs to sync the moment connectivity returns, banner or not.
  useEffect(() => startBackgroundSync(), []);

  if (!isOffline) return null;

  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-warning-border bg-warning-tint px-5 py-2">
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={1.75} />
      <span className="text-xs font-semibold text-warning">
        Offline{pendingCount > 0 ? ` · ${pendingCount} change${pendingCount === 1 ? "" : "s"} pending sync` : ""}
      </span>
      <Link href="/sync-queue" className="ml-auto shrink-0 text-xs font-semibold text-warning">
        View sync queue
      </Link>
    </div>
  );
}
