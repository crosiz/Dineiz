'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Receipt, RefreshCw, ChevronRight } from 'lucide-react';

interface PastDueRow {
  tenantId: string;
  tenantName: string;
  plan: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  graceEndsAt: string;
}

interface PaymentRow {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  paidAt: string;
}

interface BillingOverview {
  payments: PaymentRow[];
  pastDue: PastDueRow[];
  totalOutstanding: number;
}

export default function BillingPage() {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = () => {
    setLoading(true);
    fetch('/api/system/billing-overview')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d && !d.error) setData(d);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Billing</h1>
          <p className="text-sm text-slate-500">Past-due accounts sorted by urgency, and full payment history across every tenant</p>
        </div>
        <button
          onClick={fetchOverview}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Outstanding summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-bold uppercase tracking-wider">Past Due Accounts</span>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-600">{data?.pastDue.length ?? 0}</span>
            <span className="text-xs text-rose-600 ml-2">require action</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-orange-600">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Outstanding</span>
            <Receipt className="w-5 h-5" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-orange-600">PKR {(data?.totalOutstanding ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Past Due Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Past Due — Most Urgent First</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sorted by longest overdue</p>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <th className="py-3 px-4">Tenant</th>
              <th className="py-3 px-4">Plan</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Days Overdue</th>
              <th className="py-3 px-4">Grace Ends</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading billing data...</td></tr>
            ) : data?.pastDue.length ? (
              data.pastDue.map((row) => (
                <tr key={row.tenantId} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{row.tenantName}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-lg font-bold text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                      {row.plan}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">PKR {row.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-bold text-rose-600">{row.daysOverdue}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{new Date(row.graceEndsAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/clients/${row.tenantId}`}
                      className="inline-flex items-center gap-1 text-orange-600 hover:underline font-semibold"
                    >
                      <span>Record Payment</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">No past due accounts. All subscriptions are current.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Payment History</h2>
          <p className="text-xs text-slate-500 mt-0.5">Most recent 200 payments across all tenants</p>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <th className="py-3 px-4">Tenant</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Paid Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading payment history...</td></tr>
            ) : data?.payments.length ? (
              data.payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <Link href={`/clients/${p.tenantId}`} className="hover:text-orange-600">{p.tenantName}</Link>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">PKR {p.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-orange-600">{p.method}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{p.reference || 'N/A'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{new Date(p.paidAt).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">No payment records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
