'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserMinus,
  Send,
  Check,
  Slash,
  DollarSign,
  RefreshCw,
} from 'lucide-react';

interface SubClient {
  id: string;
  name: string;
  plan: string;
  status: string;
  amount: number;
  ownerEmail: string;
  daysOverdue?: number;
  nextRenewalDate: string;
}

export default function SubscriptionsPage() {
  const [trialing, setTrialing] = useState<SubClient[]>([]);
  const [active, setActive] = useState<SubClient[]>([]);
  const [pastDue, setPastDue] = useState<SubClient[]>([]);
  const [cancelled, setCancelled] = useState<SubClient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = () => {
    setLoading(true);
    fetch('/api/clients?status=ALL')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.clients) {
          const all: SubClient[] = d.clients.map((c: any) => {
            const renewal = new Date(c.renewalDate || c.joinedDate);
            const today = new Date();
            const daysOver = Math.max(0, Math.floor((today.getTime() - renewal.getTime()) / (1000 * 60 * 60 * 24)));
            return {
              id: c.id,
              name: c.name,
              plan: c.plan,
              status: c.status,
              amount: c.mrr,
              ownerEmail: c.ownerEmail,
              daysOverdue: daysOver,
              nextRenewalDate: c.renewalDate,
            };
          });

          setTrialing(all.filter((c) => c.status === 'TRIALING'));
          setActive(all.filter((c) => c.status === 'ACTIVE'));
          setPastDue(all.filter((c) => c.status === 'PAST_DUE' || c.daysOverdue! > 0));
          setCancelled(all.filter((c) => c.status === 'CANCELLED'));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleMarkAsPaid = async (client: SubClient) => {
    try {
      const res = await fetch(`/api/clients/${client.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: client.amount || 8000,
          reference: 'MANUAL_SUPERADMIN_OVERRIDE',
          notes: 'Marked as paid by Super Admin',
          method: 'BANK_TRANSFER',
        }),
      });
      if (res.ok) fetchSubscriptions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendReminder = async (client: SubClient) => {
    try {
      await fetch(`/api/clients/${client.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'BOTH',
          subject: `Past Due Payment Notice — ${client.name}`,
          messageBody: `Salam ${client.name}! Aapki subscription payment of PKR ${client.amount} past due hai. Kindly online pay karein: console.dineiz.com`,
        }),
      });
      alert(`Reminder sent to ${client.name}!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSuspend = async (client: SubClient) => {
    if (!confirm(`Suspend ${client.name}?`)) return;
    try {
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUSPENDED' }),
      });
      fetchSubscriptions();
    } catch (e) {
      console.error(e);
    }
  };

  const totalActiveMRR = active.reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subscriptions Management</h1>
          <p className="text-sm text-slate-400">Overview of all subscription states, trial periods, and dunning</p>
        </div>
        <button
          onClick={fetchSubscriptions}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Trialing</span>
            <Clock className="w-5 h-5" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white">{trialing.length}</span>
            <span className="text-xs text-slate-400 ml-2">clients</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active</span>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white">{active.length}</span>
            <span className="text-xs text-emerald-400 font-bold ml-2">PKR {totalActiveMRR.toLocaleString()} MRR</span>
          </div>
        </div>

        <div className="bg-rose-950/40 border border-rose-800/80 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300">Past Due (Urgent)</span>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-400">{pastDue.length}</span>
            <span className="text-xs text-rose-300 ml-2">require action</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Cancelled</span>
            <UserMinus className="w-5 h-5" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-300">{cancelled.length}</span>
            <span className="text-xs text-slate-500 ml-2">this month</span>
          </div>
        </div>
      </div>

      {/* HIGHLIGHTED PAST DUE SECTION */}
      <div className="bg-rose-950/30 border border-rose-800/80 p-6 rounded-2xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3 border-b border-rose-900/60 pb-3">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          <h2 className="text-base font-bold text-rose-200">Past Due Accounts — Immediate Attention Needed</h2>
        </div>

        <div className="space-y-3">
          {pastDue.map((client) => (
            <div
              key={client.id}
              className="bg-slate-900/90 border border-rose-800/60 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <Link href={`/clients/${client.id}`} className="font-bold text-white text-sm hover:text-amber-400">
                  {client.name}
                </Link>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>Plan: <strong className="text-amber-400">{client.plan}</strong></span>
                  <span className="text-rose-400 font-bold">{client.daysOverdue || 3} Days Overdue</span>
                  <span className="text-white font-bold">Owes: PKR {(client.amount || 8000).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendReminder(client)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Reminder</span>
                </button>

                <button
                  onClick={() => handleMarkAsPaid(client)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark as Paid</span>
                </button>

                <button
                  onClick={() => handleSuspend(client)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1"
                >
                  <Slash className="w-3.5 h-3.5" />
                  <span>Suspend</span>
                </button>
              </div>
            </div>
          ))}

          {pastDue.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">No past due clients! All subscriptions are paid up.</p>
          )}
        </div>
      </div>
    </div>
  );
}
