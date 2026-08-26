'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface TrialClient {
  id: string;
  name: string;
  ownerEmail: string;
  joinedDate: string;
  trialEndsAt?: string | null;
  renewalDate?: string | null;
  trialExtendedCount?: number;
}

function daysRemaining(trialEndsAt?: string | null): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function urgencyClasses(days: number | null): string {
  if (days === null) return 'text-slate-400';
  if (days <= 1) return 'text-rose-700 bg-rose-50 border border-rose-200';
  if (days <= 3) return 'text-orange-700 bg-orange-50 border border-orange-200';
  return 'text-slate-600';
}

export default function TrialsPage() {
  const [clients, setClients] = useState<TrialClient[]>([]);
  const [hasExtendedCount, setHasExtendedCount] = useState(false);

  useEffect(() => {
    fetch('/api/clients?status=TRIALING')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.clients) {
          setClients(d.clients);
          setHasExtendedCount(d.clients.some((c: any) => typeof c.trialExtendedCount === 'number'));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Active Trial Clients</h1>
        <p className="text-sm text-slate-500">Restaurants currently exploring Dineiz on a free trial</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
              <th className="py-3 px-4">Restaurant</th>
              <th className="py-3 px-4">Owner Email</th>
              <th className="py-3 px-4">Joined Date</th>
              <th className="py-3 px-4">Days Remaining</th>
              {hasExtendedCount && <th className="py-3 px-4 text-center">Extended</th>}
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {clients.map((c) => {
              const trialEnd = c.trialEndsAt ?? c.renewalDate ?? null;
              const days = daysRemaining(trialEnd);
              return (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <Link href={`/clients/${c.id}`} className="hover:text-orange-600">{c.name}</Link>
                  </td>
                  <td className="py-3 px-4">{c.ownerEmail}</td>
                  <td className="py-3 px-4 text-slate-500">{new Date(c.joinedDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    {days === null ? (
                      <span className="text-slate-400">N/A</span>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] ${urgencyClasses(days)}`}>
                        {days <= 0 ? 'Expired' : `${days} day${days === 1 ? '' : 's'} left`}
                      </span>
                    )}
                  </td>
                  {hasExtendedCount && (
                    <td className="py-3 px-4 text-center font-semibold text-slate-600">
                      {c.trialExtendedCount ?? 0}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right">
                    <Link href={`/clients/${c.id}`} className="text-orange-600 hover:underline">View Profile</Link>
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr><td colSpan={hasExtendedCount ? 6 : 5} className="py-8 text-center text-slate-400">No active trialing clients at the moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
