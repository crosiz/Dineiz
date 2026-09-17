'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, UserX, Loader2 } from 'lucide-react';
import { getToken } from '@/lib/pos-session';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api';
import * as commands from '@/lib/core/commands';

// ── Who's looking after this table ──────────────────────────────────────────
//
// Two modes, because the question gets asked at two different moments:
//
//   assign  — an order already exists (the floor plan's table sheet). The
//             choice is recorded through commands.assignWaiter, so it goes in
//             the event log and ships via the outbox's ASSIGN_WAITER task.
//             This used to be a raw `PUT /api/orders/:id/assign`, which meant
//             it simply failed offline with a toast and no retry.
//
//   pick    — there is no order yet (punching a new one on the menu screen).
//             Nothing is sent; the chosen waiter is handed back to the caller,
//             which parks it on the cart and applies it the moment the order
//             is created.

interface Waiter {
  id: string;
  name: string;
  avatarInitials: string;
  avatarColor: string;
  status: string;
  lastActiveAt?: string;
  assignedTablesCount?: number;
  isOnShift?: boolean;
}

interface AssignWaiterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  currentWaiterId?: string | null;
  /** Assign mode — the order to attach the waiter to. */
  orderId?: string;
  /** Shown in the header when there is one. */
  tableLabel?: string;
  /** Pick mode — called with the chosen waiter (or null to clear). Nothing is sent. */
  onPick?: (waiter: { id: string; name: string; color?: string | null } | null) => void;
}

export function AssignWaiterSheet({
  isOpen, onClose, orderId, tableLabel, branchId, currentWaiterId, onPick,
}: AssignWaiterSheetProps) {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    fetchWaiters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, branchId]);

  const fetchWaiters = async () => {
    setLoading(true);
    try {
      const token = getToken();

      // Real per-waiter table load — the floor plan already carries
      // assignedWaiterId per table (same field ClientTableMap.tsx reads),
      // so we can derive a real count instead of a placeholder.
      const [waitersRes, floorPlanRes] = await Promise.all([
        fetch(`${API_URL}/api/pos/waiters?branchId=${branchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/floor-plan/${branchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (!waitersRes.ok) return;
      const res = await waitersRes.json();
      const dataArray = Array.isArray(res) ? res : (res.waiters || res.data || []);

      const floorTables: any[] = Array.isArray(floorPlanRes) ? floorPlanRes : (floorPlanRes?.tables || []);
      const tableCountByWaiter = new Map<string, number>();
      for (const t of floorTables) {
        if (!t.assignedWaiterId) continue;
        tableCountByWaiter.set(t.assignedWaiterId, (tableCountByWaiter.get(t.assignedWaiterId) || 0) + 1);
      }

      setWaiters(dataArray.map((u: any) => {
        const name = u.name || 'Unknown';
        const parts = name.trim().split(' ');
        return {
          ...u,
          avatarInitials: parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase(),
          isOnShift: u.lastActiveAt
            ? Date.now() - new Date(u.lastActiveAt).getTime() < 15 * 60 * 1000
            : false,
          assignedTablesCount: tableCountByWaiter.get(u.id) || 0,
        };
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const choose = async (waiter: Waiter) => {
    if (waiter.id === currentWaiterId) { onClose(); return; }

    if (onPick) {
      onPick({ id: waiter.id, name: waiter.name, color: waiter.avatarColor });
      onClose();
      return;
    }
    if (!orderId) return;

    setBusyId(waiter.id);
    try {
      // Through the event store, not a raw fetch: it applies locally at once
      // and the outbox ships it with retries, so this works offline.
      await commands.assignWaiter(orderId, waiter.id, waiter.name, waiter.avatarColor);
      toast.success(tableLabel ? `Table ${tableLabel} is ${waiter.name}'s` : `Assigned to ${waiter.name}`);
      onClose();
    } catch {
      toast.error('Could not assign that waiter — try again.');
    } finally {
      setBusyId(null);
    }
  };

  const clear = async () => {
    if (onPick) { onPick(null); onClose(); return; }
    if (!orderId) return;
    setBusyId('__clear__');
    try {
      await commands.assignWaiter(orderId, null, null, null);
      toast.success('Waiter removed');
      onClose();
    } catch {
      toast.error('Could not remove the waiter — try again.');
    } finally {
      setBusyId(null);
    }
  };

  const sorted = useMemo(() => {
    const filtered = waiters.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()));
    // On shift first — the people who can actually take the table — then the
    // currently-assigned one pinned to the very top so it's obvious.
    return filtered.sort((a, b) => {
      if (a.id === currentWaiterId) return -1;
      if (b.id === currentWaiterId) return 1;
      if (a.isOnShift !== b.isOnShift) return a.isOnShift ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [waiters, search, currentWaiterId]);

  if (!isOpen) return null;

  return (
    <>
      {/* 500/501, not 9998/9999 — matches CustomerPickerSheet; see the comment
          there. Both had independently landed on the same "high enough" values,
          which also tied with ConfirmModal's real z-index. */}
      <div className="fixed inset-0 bg-black/40 z-[500]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[440px] bg-surface rounded-t-2xl sm:rounded-2xl z-[501] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.12)] max-h-[85dvh]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink truncate">Who's serving this order?</h2>
            {tableLabel && <p className="text-[12px] text-ink-3 mt-0.5">Table {tableLabel}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 grid place-items-center w-9 h-9 -mr-1.5 rounded-full text-ink-3 hover:text-ink hover:bg-sunken transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search only earns its space once the list is long enough to need it. */}
        {waiters.length > 6 && (
          <div className="px-5 pt-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name"
                className="w-full h-11 pl-9 pr-3 bg-sunken border border-line rounded-xl text-[15px] text-ink placeholder:text-ink-4 focus:border-brand focus:shadow-none outline-none transition-colors"
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-ink-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading staff…
            </div>
          ) : waiters.length === 0 ? (
            <p className="py-10 px-6 text-center text-[14px] text-ink-3 leading-relaxed">
              No waiters set up for this branch yet. A manager can add them under Staff in the admin panel.
            </p>
          ) : sorted.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-ink-3">No one matching “{search}”.</p>
          ) : (
            <div className="space-y-1">
              {sorted.map((waiter) => {
                const isCurrent = waiter.id === currentWaiterId;
                const isBusy = busyId === waiter.id;
                return (
                  <button
                    key={waiter.id}
                    onClick={() => choose(waiter)}
                    disabled={!!busyId}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors min-h-[60px] ${
                      isCurrent ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-sunken'
                    } ${busyId && !isBusy ? 'opacity-50' : ''}`}
                  >
                    <div
                      className="w-10 h-10 rounded-full grid place-items-center text-white text-[13px] font-semibold shrink-0"
                      style={{ backgroundColor: waiter.avatarColor || 'var(--pos-text-secondary)' }}
                    >
                      {waiter.avatarInitials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-ink truncate">{waiter.name}</p>
                      <p className="text-[12px] text-ink-3 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${waiter.isOnShift ? 'bg-ok' : 'bg-ink-4'}`} />
                        {waiter.isOnShift ? 'On shift' : 'Off shift'}
                        {(waiter.assignedTablesCount ?? 0) > 0 && (
                          <>
                            <span className="text-ink-4">·</span>
                            {waiter.assignedTablesCount} {waiter.assignedTablesCount === 1 ? 'table' : 'tables'}
                          </>
                        )}
                      </p>
                    </div>

                    {isBusy
                      ? <Loader2 className="w-4 h-4 shrink-0 text-ink-3 animate-spin" />
                      : isCurrent
                        ? <Check className="w-5 h-5 shrink-0 text-brand" aria-label="Currently assigned" />
                        : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {currentWaiterId && (
          <div className="px-5 py-3 border-t border-line shrink-0 pb-safe">
            <button
              onClick={clear}
              disabled={!!busyId}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-line text-[14px] font-medium text-ink-2 hover:bg-sunken transition-colors disabled:opacity-50"
            >
              {busyId === '__clear__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              Remove waiter
            </button>
          </div>
        )}
      </div>
    </>
  );
}
