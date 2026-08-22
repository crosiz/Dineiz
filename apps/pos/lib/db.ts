import Dexie, { type EntityTable, type Table } from 'dexie';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CachedMenuItem {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description?: string;
  basePrice: number;
  image?: string;
  isAvailable: boolean;
  sortOrder: number;
  variations: Array<{ id: string; name: string; price: number }>;
  addOns: Array<{ id: string; name: string; price: number }>;
  syncedAt: number; // timestamp (ms)
}

export interface OfflineOrder {
  localId: string;
  serverId?: string;
  branchId: string;
  tenantId: string;
  cashierId: string;
  shiftId?: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableId?: string;
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    variationId?: string;
    addonIds?: string[];
    notes?: string;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes?: string;
  createdAt: string; // ISO string
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  errorMessage?: string;
}

export interface MenuCache {
  branchId: string;
  tenantId: string;
  lastUpdated: number;
  data: any;
}

export interface SettingsCache {
  tenantId: string;
  branchId: string;
  settings: any;
}

export interface OrdersCache {
  /** Composite key, e.g. 'live-<branchId>' or 'history-<branchId>' */
  cacheKey: string;
  /** Raw order array returned by the API */
  data: any[];
  /** Unix timestamp (ms) of when this was written */
  cachedAt: number;
}

export interface OfflinePayment {
  localId: string;
  orderId: string;
  tableId?: string;
  /** Pre-serialized JSON body for PUT /api/orders/:orderId — re-sent as-is on sync */
  body: string;
  createdAt: string; // ISO string
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  errorMessage?: string;
}

export interface PendingItemAdd {
  localId: string;
  orderId: string;
  /** Pre-serialized JSON body for POST /api/orders/:orderId/items — re-sent as-is on sync */
  body: string;
  createdAt: string; // ISO string
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  errorMessage?: string;
}

// ─── Dexie DB Class ─────────────────────────────────────────────────────────

export class POSDatabase extends Dexie {
  menuItems!: EntityTable<CachedMenuItem, 'id'>;
  offlineOrders!: Table<OfflineOrder, string>;
  menuCache!: Table<MenuCache, string>;
  settingsCache!: Table<SettingsCache, string>;
  keyValue!: EntityTable<{ key: string; value: string }, 'key'>;
  heldOrders!: Table<any, string>;
  ordersCache!: Table<OrdersCache, string>;
  offlinePayments!: Table<OfflinePayment, string>;
  pendingItemAdds!: Table<PendingItemAdd, string>;

  constructor() {
    super('DineizGoPOS');

    this.version(4).stores({
      menuItems: 'id, tenantId, categoryId, isAvailable',
      offlineOrders: 'localId, syncStatus, branchId, tenantId, createdAt',
      menuCache: 'branchId, tenantId, lastUpdated',
      settingsCache: 'tenantId, branchId',
      keyValue: 'key',
      heldOrders: 'id',
    });

    // v5 — adds ordersCache for stale-while-revalidate on Tickets
    this.version(5).stores({
      menuItems: 'id, tenantId, categoryId, isAvailable',
      offlineOrders: 'localId, syncStatus, branchId, tenantId, createdAt',
      menuCache: 'branchId, tenantId, lastUpdated',
      settingsCache: 'tenantId, branchId',
      keyValue: 'key',
      heldOrders: 'id',
      ordersCache: 'cacheKey, cachedAt',
    });

    // v6 — adds offlinePayments (Collect Payment) and pendingItemAdds
    // (adding items to an already-sent order), the same syncStatus queue
    // pattern as offlineOrders, so payments and item-adds survive a dropped
    // connection instead of failing outright.
    this.version(6).stores({
      menuItems: 'id, tenantId, categoryId, isAvailable',
      offlineOrders: 'localId, syncStatus, branchId, tenantId, createdAt',
      menuCache: 'branchId, tenantId, lastUpdated',
      settingsCache: 'tenantId, branchId',
      keyValue: 'key',
      heldOrders: 'id',
      ordersCache: 'cacheKey, cachedAt',
      offlinePayments: 'localId, syncStatus, orderId, createdAt',
      pendingItemAdds: 'localId, syncStatus, orderId, createdAt',
    });
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _db: POSDatabase | null = null;

export function getDB(): POSDatabase {
  if (!_db) {
    _db = new POSDatabase();
  }
  return _db;
}
