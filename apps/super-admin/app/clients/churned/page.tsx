'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ChurnedPage() {
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/clients?status=CANCELLED')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.clients) setClients(d.clients);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Churned & Cancelled Accounts</h1>
        <p className="text-sm text-slate-400">Tenants who cancelled their subscription or churned</p>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase">
              <th className="py-3 px-4">Restaurant</th>
              <th className="py-3 px-4">Previous Plan</th>
              <th className="py-3 px-4">Owner Email</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="py-3 px-4 font-bold text-white">
                  <Link href={`/clients/${c.id}`} className="hover:text-amber-400">{c.name}</Link>
                </td>
                <td className="py-3 px-4 text-rose-400 font-bold">{c.plan}</td>
                <td className="py-3 px-4">{c.ownerEmail}</td>
                <td className="py-3 px-4 text-right">
                  <Link href={`/clients/${c.id}`} className="text-amber-400 hover:underline">Re-engage Client</Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-slate-500">No churned clients recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
