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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Churned & Cancelled Accounts</h1>
        <p className="text-sm text-slate-500">Tenants who cancelled their subscription or churned</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
              <th className="py-3 px-4">Restaurant</th>
              <th className="py-3 px-4">Previous Plan</th>
              <th className="py-3 px-4">Owner Email</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="py-3 px-4 font-bold text-slate-900">
                  <Link href={`/clients/${c.id}`} className="hover:text-orange-600">{c.name}</Link>
                </td>
                <td className="py-3 px-4 text-rose-600 font-bold">{c.plan}</td>
                <td className="py-3 px-4">{c.ownerEmail}</td>
                <td className="py-3 px-4 text-right">
                  <Link href={`/clients/${c.id}`} className="text-orange-600 hover:underline">Re-engage Client</Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-slate-400">No churned clients recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
