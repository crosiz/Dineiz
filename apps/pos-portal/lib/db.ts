import Dexie, { type Table } from "dexie";

// A payment that couldn't reach the server when "Collect" was pressed
// (network drop mid-shift is the realistic case). The order itself already
// exists server-side — only the checkout call is queued — so replaying it
// later is just a retry of the exact same POST, nothing to reconcile.
export interface QueuedPayment {
  localId: string;
  orderId: string;
  /** Human-friendly order number, for display in the sync queue UI. */
  displayId: string;
  method: "CASH" | "CARD" | "JAZZCASH" | "EASYPAISA";
  tenderedAmount?: number;
  createdAt: string;
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  syncAttempts: number;
  errorMessage?: string;
}

export class PosPortalDatabase extends Dexie {
  queuedPayments!: Table<QueuedPayment, string>;

  constructor() {
    super("DineizPosPortal");
    this.version(1).stores({
      queuedPayments: "localId, syncStatus, orderId, createdAt",
    });
  }
}

let _db: PosPortalDatabase | null = null;

export function getDB(): PosPortalDatabase {
  if (!_db) _db = new PosPortalDatabase();
  return _db;
}
