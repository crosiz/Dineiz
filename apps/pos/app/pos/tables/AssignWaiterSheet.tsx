'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Link as LinkIcon } from 'lucide-react';
import { getToken } from '@/lib/pos-session';
import { toast } from 'sonner';

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
  orderId: string;
  tableLabel: string;
  branchId: string;
  currentWaiterId?: string | null;
}

export function AssignWaiterSheet({
  isOpen, onClose, orderId, tableLabel, branchId, currentWaiterId
}: AssignWaiterSheetProps) {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      fetchWaiters();
    }
  }, [isOpen, branchId]);

  const fetchWaiters = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

      // Real per-waiter table load — the floor plan already carries
      // assignedWaiterId per table (same field ClientTableMap.tsx reads),
      // so we can derive a real count instead of a random placeholder.
      const [waitersRes, floorPlanRes] = await Promise.all([
        fetch(`${API_URL}/api/pos/waiters?branchId=${branchId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/floor-plan/${branchId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (waitersRes.ok) {
        const res = await waitersRes.json();
        // Handle paginated or direct array responses safely
        const dataArray = Array.isArray(res) ? res : (res.waiters || res.data || []);

        const floorTables: any[] = Array.isArray(floorPlanRes) ? floorPlanRes : (floorPlanRes?.tables || []);
        const tableCountByWaiter = new Map<string, number>();
        for (const t of floorTables) {
          if (!t.assignedWaiterId) continue;
          tableCountByWaiter.set(t.assignedWaiterId, (tableCountByWaiter.get(t.assignedWaiterId) || 0) + 1);
        }

        const w = dataArray.map((u: any) => {
          const name = u.name || 'Unknown';
          const parts = name.trim().split(' ');
          const avatarInitials = parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();

          return {
            ...u,
            avatarInitials,
            isOnShift: u.lastActiveAt ? (new Date().getTime() - new Date(u.lastActiveAt).getTime()) < 15 * 60 * 1000 : false,
            assignedTablesCount: tableCountByWaiter.get(u.id) || 0,
          };
        });
        setWaiters(w);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (waiter: Waiter) => {
    if (waiter.id === currentWaiterId) {
      return; // Already assigned
    }
    
    setAssigningId(waiter.id);
    try {
      const token = getToken();
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/orders/${orderId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          waiterId: waiter.id,
          waiterName: waiter.name
        })
      });
      
      if (!res.ok) throw new Error('Failed to assign waiter');
      
      toast.success(`Table ${tableLabel} assigned to ${waiter.name}`);
      onClose();
    } catch (err) {
      toast.error('Failed to assign waiter');
    } finally {
      setAssigningId(null);
    }
  };

  if (!isOpen) return null;

  const filtered = waiters.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));

  // Ensure current waiter is at the top
  const sortedWaiters = [...filtered].sort((a, b) => {
    if (a.id === currentWaiterId) return -1;
    if (b.id === currentWaiterId) return 1;
    return 0;
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[9999] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 transform translate-y-0 max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-[18px] font-bold text-slate-800">Assign Table {tableLabel} to Waiter</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search waiter..."
              className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : waiters.length === 0 ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <LinkIcon className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-[14px] text-slate-500 leading-relaxed max-w-[280px]">
                No waiters configured for this branch. Add waiters in the admin panel under Staff and Roles.
              </p>
            </div>
          ) : sortedWaiters.length === 0 ? (
            <div className="py-8 text-center text-[14px] text-slate-500">No waiters found matching "{search}"</div>
          ) : (
            <div className="space-y-1">
              {sortedWaiters.map(waiter => {
                const isAssigned = waiter.id === currentWaiterId;
                const isAssigning = assigningId === waiter.id;

                return (
                  <button
                    key={waiter.id}
                    onClick={() => handleAssign(waiter)}
                    disabled={isAssigning}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                      isAssigned ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm"
                      style={{ backgroundColor: waiter.avatarColor }}
                    >
                      {waiter.avatarInitials}
                    </div>
                    
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-[14px] font-bold truncate ${isAssigned ? 'text-blue-900' : 'text-slate-800'}`}>
                          {waiter.name}
                        </p>
                        {isAssigned && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold uppercase tracking-wider rounded-md shrink-0">
                            Currently assigned
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${waiter.isOnShift ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className={`text-[11px] ${waiter.isOnShift ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                            {waiter.isOnShift ? 'On shift' : 'Not on shift'}
                          </span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className="text-[11px] text-slate-500">
                          Handling {waiter.assignedTablesCount} tables
                        </span>
                      </div>
                    </div>

                    {isAssigning && (
                      <div className="shrink-0 mr-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
