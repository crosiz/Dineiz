'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@dineiz/ui/src/components/card';
import { Button } from '@dineiz/ui/src/components/button';
import { Input } from '@dineiz/ui/src/components/input';
import { apiFetch } from '@/lib/api';
import { AdminOnly } from '@/components/admin-only';
import { useBranchFilter } from '@/hooks/useBranchFilter';

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  pointsBalance?: number;
};

type CustomerProfile = {
  customer: Customer;
  pointsBalance: number;
  ledger: Array<{ id: string; type: string; points: number; reference?: string | null; note?: string | null; createdAt: string }>;
};

export default function CRMPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const [pointsType, setPointsType] = useState<'EARN' | 'REDEEM' | 'ADJUST'>('EARN');
  const [pointsValue, setPointsValue] = useState<number>(10);
  const [pointsNote, setPointsNote] = useState('');

  const { branchId, queryParam } = useBranchFilter();

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['crm-customers', branchId ?? null, qDebounced],
    queryFn: async () => {
      const qs = new URLSearchParams(queryParam || '');
      if (qDebounced) qs.set('search', qDebounced);
      const res = await apiFetch<{ data: Customer[] }>(`/api/customers?${qs.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['crm-customers'] });

  async function openCustomer(id: string) {
    setSelectedId(id);
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: CustomerProfile }>(`/api/customers/${id}`);
      setProfile(res.data as any);
    } catch (e: any) {
      setError(e?.message || 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }

  async function createCustomer() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          phone: newPhone || undefined,
          email: newEmail || undefined,
        }),
      });
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  }

  async function adjustPoints() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/customers/${selectedId}/points/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedId,
          points: pointsType === 'REDEEM' ? -pointsValue : pointsValue,
          reason: pointsNote || 'Manual adjustment',
        }),
      });
      setPointsNote('');
      await openCustomer(selectedId);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to adjust points');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminOnly>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Customer CRM</h1>
          <p className="text-sm text-text-secondary">Profiles and loyalty points ledger.</p>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold">Directory</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name/phone/email" />
                <Button variant="outline" disabled={loading} onClick={refresh}>Search</Button>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openCustomer(c.id)}
                    className={`w-full flex items-center gap-3 text-left rounded-lg p-2.5 transition-colors focus:outline-none border border-transparent ${selectedId === c.id ? 'bg-gray-100 border-gray-200/50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-600 font-medium text-sm border border-gray-200">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {c.phone || c.email || '—'}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {c.pointsBalance ?? 0} pts
                    </div>
                  </button>
                ))}
                {customers.length === 0 && (
                  <div className="text-sm text-text-secondary">No customers found.</div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">New Customer</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone" />
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" />
                <div className="md:col-span-3">
                  <Button disabled={loading || !newName.trim()} onClick={createCustomer} size="sm">Create</Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Profile Details</h2>
              <div className="space-y-4">
                {!profile ? (
                  <div className="text-sm text-text-secondary">Select a customer to view profile.</div>
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <div className="text-xl font-bold">{profile.customer.name}</div>
                        <div className="text-sm text-text-secondary">{profile.customer.phone || '—'} • {profile.customer.email || '—'}</div>
                      </div>
                      <div className="text-sm">
                        <span className="text-text-secondary">Points balance:</span>{' '}
                        <span className="font-semibold">{profile.pointsBalance}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                      <div className="md:col-span-1">
                        <div className="text-xs text-text-secondary mb-1">Type</div>
                        <select className="h-10 rounded-md border border-border bg-surface-raised px-3 text-sm w-full" value={pointsType} onChange={(e) => setPointsType(e.target.value as any)}>
                          <option value="EARN">Earn</option>
                          <option value="REDEEM">Redeem</option>
                          <option value="ADJUST">Adjust</option>
                        </select>
                      </div>
                      <div className="md:col-span-1">
                        <div className="text-xs text-text-secondary mb-1">Points</div>
                        <Input type="number" value={pointsValue} onChange={(e) => setPointsValue(Number(e.target.value))} />
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-text-secondary mb-1">Note</div>
                        <Input value={pointsNote} onChange={(e) => setPointsNote(e.target.value)} placeholder="Optional note" />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <Button disabled={loading || !selectedId} onClick={adjustPoints}>Apply</Button>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold mb-2">Points ledger</div>
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-text-secondary">
                            <tr className="border-b border-border">
                              <th className="py-2 pr-3">Date</th>
                              <th className="py-2 pr-3">Type</th>
                              <th className="py-2 pr-3">Points</th>
                              <th className="py-2 pr-3">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profile.ledger.map((l) => (
                              <tr key={l.id} className="border-b border-border/60">
                                <td className="py-2 pr-3">{new Date(l.createdAt).toLocaleString()}</td>
                                <td className="py-2 pr-3">{l.type}</td>
                                <td className={`py-2 pr-3 ${l.points < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{l.points}</td>
                                <td className="py-2 pr-3">{l.note || l.reference || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminOnly>
  );
}

